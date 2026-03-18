const express = require('express');
const { z } = require('zod');
const { supabase } = require('../lib/supabase');
const { streamChatCompletion } = require('../lib/aiProvider');
const { checkRateLimit, incrementUsage } = require('../lib/rateLimit');
// getEffectiveApiKey no longer needed — keys are pre-fetched in mega batch

const router = express.Router();

const sendMessageSchema = z.object({
  chatId: z.string().uuid().optional(),
  modelId: z.string().uuid(),
  agentId: z.string().uuid().optional().nullable(),
  message: z.string().min(1).max(32000),
  useOwnKeys: z.boolean().optional().default(false),
  think: z.boolean().optional().default(true),
});

const regenerateSchema = z.object({
  useOwnKeys: z.boolean().optional().default(false),
  think: z.boolean().optional().default(true),
});

// POST /api/chat/send — Send message and stream response
router.post('/send', async (req, res) => {
  const t0 = Date.now();

  // ── Quick sync validation (instant, no await) ──
  let body;
  try {
    body = sendMessageSchema.parse(req.body);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  const userId = req.user.id;

  // ── SSE: Open stream IMMEDIATELY — before any DB work ──
  // This cuts ~1s off perceived latency (client connects in ~100ms instead of ~1.2s)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.socket) res.socket.setNoDelay(true);
  res.flushHeaders();

  // 2KB SSE comment padding — forces data through proxy buffers (Traefik, Cloudflare, nginx)
  res.write(`:${' '.repeat(2048)}\n\n`);

  // Helper: send SSE error and close
  const sseError = (msg) => {
    res.write(`data: ${JSON.stringify({ type: 'error', content: msg })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  };

  try {
    const effectiveUsingOwnKey = Boolean(body.useOwnKeys);

    // ── MEGA BATCH: Run ALL pre-flight checks in parallel ──
    const [modelResult, agent, rateLimit, userKeyMap] = await Promise.all([
      supabase.from('models').select('*').eq('id', body.modelId).eq('is_active', true).single(),
      body.agentId
        ? supabase.from('agents').select('system_prompt, user_id, temperature, top_p, max_tokens').eq('id', body.agentId).single().then(r => r.data)
        : Promise.resolve(null),
      effectiveUsingOwnKey
        ? Promise.resolve({ allowed: true, used: 0, limit: null, remaining: null })
        : checkRateLimit(userId, body.modelId),
      effectiveUsingOwnKey
        ? supabase.from('user_api_keys').select('provider, api_key').eq('user_id', userId).then(r => {
            const map = {};
            (r.data || []).forEach(k => { map[k.provider] = k.api_key?.trim() || null; });
            return map;
          })
        : Promise.resolve(null),
    ]);

    const model = modelResult.data;
    if (modelResult.error || !model) return sseError('Model not found or inactive');
    if (!rateLimit.allowed) return sseError(`Rate limit exceeded. ${rateLimit.remaining || 0} requests remaining.`);

    // ── Resolve API key instantly from pre-fetched data (no extra await) ──
    let apiKey, actuallyUsedOwnKey;
    if (effectiveUsingOwnKey) {
      const userKey = userKeyMap?.[model.provider];
      if (userKey) {
        apiKey = userKey;
        actuallyUsedOwnKey = true;
      } else {
        return sseError(`No ${model.provider} API key found. Please add your API key in Settings → API Keys.`);
      }
    } else {
      if (!model.api_key?.trim()) {
        return sseError(`The platform doesn't support ${model.name} yet. Please add your own ${model.provider} API key in Settings → API Keys to use this model.`);
      }
      apiKey = model.api_key;
      actuallyUsedOwnKey = false;
    }

    // ── Chat creation (only after validation to avoid orphan chats) ──
    let chatId = body.chatId;
    const isNewChat = !chatId;
    if (isNewChat) {
      const r = await supabase.from('chats').insert({ user_id: userId, model_id: body.modelId, agent_id: body.agentId || null, title: body.message.substring(0, 100) }).select('id').single();
      if (r.error) throw r.error;
      chatId = r.data.id;
    }

    // Send chatId meta event now that we have it
    res.write(`data: ${JSON.stringify({ type: 'meta', chatId })}\n\n`);

    // ── Build messages array (skip history fetch for new chats — nothing to fetch) ──
    const messages = [];
    let agentCreatorId = agent?.user_id || null;
    if (agent?.system_prompt) {
      messages.push({ role: 'system', content: agent.system_prompt });
    }

    if (isNewChat) {
      messages.push({ role: 'user', content: body.message });
      // Fire-and-forget: save user message (don't block streaming)
      supabase.from('messages').insert({ chat_id: chatId, role: 'user', content: body.message }).then(() => {}).catch(e => console.error('Save user msg error:', e));
    } else {
      // Existing chat — fetch history + save user message in parallel
      const [, historyResult] = await Promise.all([
        supabase.from('messages').insert({ chat_id: chatId, role: 'user', content: body.message }),
        supabase.from('messages').select('role, content').eq('chat_id', chatId).order('created_at', { ascending: true }).limit(20),
      ]);
      messages.push(...(historyResult.data || []));
      // Ensure the current user message is included (in case insert/select raced)
      const lastMsg = messages[messages.length - 1];
      if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== body.message) {
        messages.push({ role: 'user', content: body.message });
      }
    }

    console.log(`[chat] pre-stream setup: ${Date.now() - t0}ms`);

    // Use agent settings if present, otherwise defaults
    const temperature = agent?.temperature ?? 0.7;
    const topP = agent?.top_p ?? 0.95;

    const maxTokens = agent?.max_tokens
      ? Math.min(agent.max_tokens, 10000)
      : Math.min(model.max_tokens || 4096, 10000);

    console.log(`[chat] SSE open, calling AI (${model.provider}/${model.model_id}): ${Date.now() - t0}ms`);

    const wantThinking = body.think;
    const thinkingStart = Date.now();
    if (wantThinking) res.write(`data: ${JSON.stringify({ type: 'thinking_start' })}\n\n`);

    let fullResponse = '';
    let sentThinkingDone = false;
    try {
      for await (const chunk of streamChatCompletion(model.provider, apiKey, model.model_id, messages, maxTokens, temperature, topP)) {
        // Typed chunk from Gemini: { type: 'thinking'|'text', content }
        // Plain string from other providers
        const isTyped = typeof chunk === 'object' && chunk.type;
        const chunkType = isTyped ? chunk.type : 'text';
        const chunkContent = isTyped ? chunk.content : chunk;

        if (chunkType === 'thinking' && wantThinking) {
          // Stream thinking content to client
          res.write(`data: ${JSON.stringify({ type: 'thinking_content', content: chunkContent })}\n\n`);
        } else if (chunkType === 'text') {
          // First text chunk = thinking is done
          if (!sentThinkingDone) {
            const thinkingTime = ((Date.now() - thinkingStart) / 1000).toFixed(1);
            if (wantThinking) res.write(`data: ${JSON.stringify({ type: 'thinking_done', thinkingTime: Number(thinkingTime) })}\n\n`);
            console.log(`[chat] first chunk to client: ${Date.now() - t0}ms (thinking: ${thinkingTime}s)`);
            sentThinkingDone = true;
          }
          fullResponse += chunkContent;
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunkContent })}\n\n`);
        }
      }
    } catch (aiError) {
      console.error('AI streaming error:', aiError);
      const errMsg = aiError?.status === 401 || aiError?.code === 'invalid_api_key'
        ? `Your ${model.provider} API key is not valid. Please check it in Settings → API Keys.`
        : aiError?.status === 429
        ? 'Rate limited by the AI provider. Please wait a moment and try again.'
        : aiError?.status === 403
        ? 'Access denied. Your API key may not have permission for this model.'
        : `AI service error: ${aiError?.message || 'Please try again.'}`;
      return sseError(errMsg);
    }

    // ── Send done IMMEDIATELY, then save in background ──
    res.write(`data: ${JSON.stringify({ type: 'done', chatId })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();

    // Fire-and-forget: save assistant message + increment usage
    supabase.from('messages').insert({ chat_id: chatId, role: 'assistant', content: fullResponse }).then(() => {}).catch(e => console.error('Save msg error:', e));
    incrementUsage(userId, body.modelId, actuallyUsedOwnKey).catch(e => console.error('Usage error:', e));
    if (agentCreatorId && agentCreatorId !== userId && !actuallyUsedOwnKey) {
      incrementUsage(agentCreatorId, body.modelId, false).catch(e => console.error('Creator usage error:', e));
    }
  } catch (err) {
    console.error('Chat error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to process message' });
    }
    if (!res.writableEnded) { try { sseError('Failed to process message'); } catch (e) { /* already closed */ } }
  }
});

// GET /api/chat/history — List user's chats (paginated)
router.get('/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const offset = parseInt(req.query.offset) || 0;

    const [countResult, dataResult] = await Promise.all([
      supabase.from('chats').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id),
      supabase.from('chats').select(`
        id, title, created_at, updated_at,
        model:models(id, name, provider),
        agent:agents(id, name, username)
      `).eq('user_id', req.user.id).order('updated_at', { ascending: false }).range(offset, offset + limit - 1),
    ]);

    if (dataResult.error) throw dataResult.error;
    const total = countResult.count || 0;
    res.json({ chats: dataResult.data, total, hasMore: offset + limit < total });
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// GET /api/chat/:chatId/messages — Get messages for a chat (paginated)
router.get('/:chatId/messages', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;
    const chatId = req.params.chatId;

    // Parallel: verify ownership + count + fetch messages
    const [chatResult, countResult, msgResult] = await Promise.all([
      supabase.from('chats').select('id').eq('id', chatId).eq('user_id', req.user.id).single(),
      supabase.from('messages').select('id', { count: 'exact', head: true }).eq('chat_id', chatId),
      supabase.from('messages').select('id, role, content, created_at').eq('chat_id', chatId).order('created_at', { ascending: false }).range(offset, offset + limit - 1),
    ]);

    if (!chatResult.data) return res.status(404).json({ error: 'Chat not found' });
    if (msgResult.error) throw msgResult.error;

    const total = countResult.count || 0;
    const sorted = (msgResult.data || []).reverse();

    res.json({ messages: sorted, total, hasMore: offset + limit < total });
  } catch (err) {
    console.error('Messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// PATCH /api/chat/:chatId — Rename a chat
router.patch('/:chatId', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || typeof title !== 'string') return res.status(400).json({ error: 'Title required' });

    const { data, error } = await supabase
      .from('chats')
      .update({ title: title.substring(0, 200) })
      .eq('id', req.params.chatId)
      .eq('user_id', req.user.id)
      .select('id, title')
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Chat not found' });
    res.json(data);
  } catch (err) {
    console.error('Rename chat error:', err);
    res.status(500).json({ error: 'Failed to rename chat' });
  }
});

// DELETE /api/chat/:chatId — Delete a chat
router.delete('/:chatId', async (req, res) => {
  try {
    const { error } = await supabase
      .from('chats')
      .delete()
      .eq('id', req.params.chatId)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Delete chat error:', err);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

// POST /api/chat/:chatId/regenerate — Regenerate last response
router.post('/:chatId/regenerate', async (req, res) => {
  const body = regenerateSchema.parse(req.body || {});
  const userId = req.user.id;

  // ── SSE: Open stream IMMEDIATELY ──
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.socket) res.socket.setNoDelay(true);
  res.flushHeaders();
  res.write(`:${' '.repeat(2048)}\n\n`);

  const sseError = (msg) => {
    res.write(`data: ${JSON.stringify({ type: 'error', content: msg })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  };

  try {
    // Get chat
    const { data: chat } = await supabase
      .from('chats')
      .select('*, model:models(*)')
      .eq('id', req.params.chatId)
      .eq('user_id', userId)
      .single();

    if (!chat) return sseError('Chat not found');

    const effectiveUsingOwnKey = Boolean(body.useOwnKeys);

    // ── MEGA BATCH: Run all pre-flight checks in parallel ──
    const [lastMsgResult, agentResult, rateLimit, userKeyMap] = await Promise.all([
      supabase.from('messages').select('id').eq('chat_id', chat.id).eq('role', 'assistant').order('created_at', { ascending: false }).limit(1).single(),
      chat.agent_id
        ? supabase.from('agents').select('system_prompt, temperature, top_p, max_tokens').eq('id', chat.agent_id).single().then(r => r.data)
        : Promise.resolve(null),
      effectiveUsingOwnKey
        ? Promise.resolve({ allowed: true, used: 0, limit: null, remaining: null })
        : checkRateLimit(userId, chat.model_id),
      effectiveUsingOwnKey
        ? supabase.from('user_api_keys').select('provider, api_key').eq('user_id', userId).then(r => {
            const map = {};
            (r.data || []).forEach(k => { map[k.provider] = k.api_key?.trim() || null; });
            return map;
          })
        : Promise.resolve(null),
    ]);

    if (!rateLimit.allowed) return sseError('Rate limit exceeded');

    let apiKey, actuallyUsedOwnKey;
    if (effectiveUsingOwnKey) {
      const userKey = userKeyMap?.[chat.model.provider];
      if (userKey) { apiKey = userKey; actuallyUsedOwnKey = true; }
      else return sseError(`No ${chat.model.provider} API key found.`);
    } else {
      if (!chat.model.api_key?.trim()) return sseError(`Platform doesn't support ${chat.model.name} yet.`);
      apiKey = chat.model.api_key;
      actuallyUsedOwnKey = false;
    }

    // Delete last assistant msg + rebuild history in parallel
    const [, historyResult] = await Promise.all([
      lastMsgResult.data ? supabase.from('messages').delete().eq('id', lastMsgResult.data.id) : Promise.resolve(),
      supabase.from('messages').select('role, content').eq('chat_id', chat.id).order('created_at', { ascending: true }).limit(20),
    ]);

    const messages = [];
    if (agentResult?.system_prompt) {
      messages.push({ role: 'system', content: agentResult.system_prompt });
    }
    const history = (historyResult.data || []).filter(m => !(m.role === 'assistant' && lastMsgResult.data));
    messages.push(...history);

    const maxTokens = agentResult?.max_tokens
      ? Math.min(agentResult.max_tokens, 10000)
      : Math.min(chat.model.max_tokens || 4096, 10000);
    const temperature = agentResult?.temperature ?? 0.7;
    const topP = agentResult?.top_p ?? 0.95;

    const wantThinking = body.think;
    const thinkingStart = Date.now();
    if (wantThinking) res.write(`data: ${JSON.stringify({ type: 'thinking_start' })}\n\n`);

    let fullResponse = '';
    let sentThinkingDone = false;
    try {
      for await (const chunk of streamChatCompletion(chat.model.provider, apiKey, chat.model.model_id, messages, maxTokens, temperature, topP)) {
        const isTyped = typeof chunk === 'object' && chunk.type;
        const chunkType = isTyped ? chunk.type : 'text';
        const chunkContent = isTyped ? chunk.content : chunk;

        if (chunkType === 'thinking' && wantThinking) {
          res.write(`data: ${JSON.stringify({ type: 'thinking_content', content: chunkContent })}\n\n`);
        } else if (chunkType === 'text') {
          if (!sentThinkingDone) {
            const thinkingTime = ((Date.now() - thinkingStart) / 1000).toFixed(1);
            if (wantThinking) res.write(`data: ${JSON.stringify({ type: 'thinking_done', thinkingTime: Number(thinkingTime) })}\n\n`);
            sentThinkingDone = true;
          }
          fullResponse += chunkContent;
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunkContent })}\n\n`);
        }
      }
    } catch (aiError) {
      console.error('AI regenerate error:', aiError);
      const errMsg = aiError?.status === 401 || aiError?.code === 'invalid_api_key'
        ? 'Invalid API key. Please check Settings → API Keys.'
        : aiError?.status === 429
        ? 'Rate limited by AI provider. Please wait.'
        : `AI error: ${aiError?.message || 'Please try again.'}`;
      return sseError(errMsg);
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();

    supabase.from('messages').insert({ chat_id: chat.id, role: 'assistant', content: fullResponse }).then(() => {}).catch(e => console.error('Save regen msg error:', e));
    incrementUsage(userId, chat.model_id, actuallyUsedOwnKey).catch(e => console.error('Regen usage error:', e));
  } catch (err) {
    console.error('Regenerate error:', err);
    if (!res.writableEnded) { try { sseError('Failed to regenerate'); } catch (e) { /* already closed */ } }
  }
});

module.exports = router;

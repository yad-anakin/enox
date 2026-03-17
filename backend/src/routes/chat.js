const express = require('express');
const { z } = require('zod');
const { supabase } = require('../lib/supabase');
const { streamChatCompletion } = require('../lib/aiProvider');
const { checkRateLimit, incrementUsage } = require('../lib/rateLimit');
const { getEffectiveApiKey } = require('../lib/userApiKeys');

const router = express.Router();

const sendMessageSchema = z.object({
  chatId: z.string().uuid().optional(),
  modelId: z.string().uuid(),
  agentId: z.string().uuid().optional().nullable(),
  message: z.string().min(1).max(32000),
  useOwnKeys: z.boolean().optional().default(false),
});

const regenerateSchema = z.object({
  useOwnKeys: z.boolean().optional().default(false),
});

// POST /api/chat/send — Send message and stream response
router.post('/send', async (req, res) => {
  try {
    const body = sendMessageSchema.parse(req.body);
    const userId = req.user.id;

    // ── BATCH 1: Load model + agent first so we can determine effective key source ──
    const [modelResult, agent] = await Promise.all([
      supabase.from('models').select('*').eq('id', body.modelId).eq('is_active', true).single(),
      body.agentId
        ? supabase.from('agents').select('system_prompt, user_id, temperature, top_p, max_tokens').eq('id', body.agentId).single().then(r => r.data)
        : Promise.resolve(null),
    ]);

    const model = modelResult.data;
    if (modelResult.error || !model) {
      return res.status(404).json({ error: 'Model not found or inactive' });
    }

    const effectiveUsingOwnKey = Boolean(body.useOwnKeys);
    const rateLimit = effectiveUsingOwnKey
      ? { allowed: true, used: 0, limit: null, remaining: null }
      : await checkRateLimit(userId, body.modelId);

    if (!rateLimit.allowed) {
      return res.status(429).json({ error: 'Rate limit exceeded', used: rateLimit.used, limit: rateLimit.limit, remaining: rateLimit.remaining });
    }

    // ── Resolve API key BEFORE creating chat (avoid orphan chats on failure) ──
    const keyResult = effectiveUsingOwnKey
      ? await getEffectiveApiKey(userId, model.provider, model.api_key)
      : { apiKey: model.api_key, isUserKey: false };
    const apiKey = keyResult.apiKey;
    const actuallyUsedOwnKey = keyResult.isUserKey;

    // If user chose own key but none found for this provider
    if (effectiveUsingOwnKey && !actuallyUsedOwnKey) {
      return res.status(400).json({
        error: `No ${model.provider} API key found. Please add your API key in Settings → API Keys.`,
      });
    }

    // If using platform key but the platform doesn't have this model
    if (!effectiveUsingOwnKey && !model.api_key?.trim()) {
      return res.status(400).json({
        error: `The platform doesn't support ${model.name} yet. Please add your own ${model.provider} API key in Settings → API Keys to use this model.`,
      });
    }

    // ── BATCH 2: Chat creation ──
    let chatId = body.chatId;
    if (!chatId) {
      const r = await supabase.from('chats').insert({ user_id: userId, model_id: body.modelId, agent_id: body.agentId || null, title: body.message.substring(0, 100) }).select().single();
      if (r.error) throw r.error;
      chatId = r.data.id;
    }

    // ── BATCH 3: Save user msg + build history in parallel ──
    // We already know the user message content, so build history and append it
    const [, historyResult] = await Promise.all([
      supabase.from('messages').insert({ chat_id: chatId, role: 'user', content: body.message }),
      supabase.from('messages').select('role, content').eq('chat_id', chatId).order('created_at', { ascending: true }).limit(50),
    ]);

    // Build messages array
    const messages = [];
    let agentCreatorId = null;
    if (agent?.system_prompt) {
      messages.push({ role: 'system', content: agent.system_prompt });
    }
    if (agent?.user_id) {
      agentCreatorId = agent.user_id;
    }
    messages.push(...(historyResult.data || []));
    // Ensure the current user message is included (in case insert/select raced)
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== body.message) {
      messages.push({ role: 'user', content: body.message });
    }

    // ── SSE: Start streaming ASAP ──
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.socket) res.socket.setNoDelay(true);
    res.flushHeaders();

    res.write(`data: ${JSON.stringify({ type: 'meta', chatId })}\n\n`);
    if (typeof res.flush === 'function') res.flush();

    // Use agent settings if present, otherwise defaults
    const temperature = agent?.temperature ?? 0.7;
    const topP = agent?.top_p ?? 0.95;
    const effectiveApiKey = apiKey;

    const maxTokens = agent?.max_tokens
      ? Math.min(agent.max_tokens, 10000)
      : Math.min(model.max_tokens || 4096, 10000);

    let fullResponse = '';
    try {
      for await (const chunk of streamChatCompletion(model.provider, effectiveApiKey, model.model_id, messages, maxTokens, temperature, topP)) {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        if (typeof res.flush === 'function') res.flush();
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
      res.write(`data: ${JSON.stringify({ type: 'error', content: errMsg })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // ── Send done IMMEDIATELY, then save in background ──
    res.write(`data: ${JSON.stringify({ type: 'done', chatId })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();

    // Fire-and-forget: save assistant message + increment usage
    // Only mark as own-key usage when the user's key was genuinely used
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
    res.end();
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
  try {
    const userId = req.user.id;
    const body = regenerateSchema.parse(req.body || {});

    // Get chat
    const { data: chat } = await supabase
      .from('chats')
      .select('*, model:models(*)')
      .eq('id', req.params.chatId)
      .eq('user_id', userId)
      .single();

    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    // ── Parallel: delete last msg + agent ──
    const [lastMsgResult, agentResult] = await Promise.all([
      supabase.from('messages').select('id').eq('chat_id', chat.id).eq('role', 'assistant').order('created_at', { ascending: false }).limit(1).single(),
      chat.agent_id
        ? supabase.from('agents').select('system_prompt, temperature, top_p, max_tokens').eq('id', chat.agent_id).single().then(r => r.data)
        : Promise.resolve(null),
    ]);

    const effectiveUsingOwnKey = Boolean(body.useOwnKeys);
    const rateLimit = effectiveUsingOwnKey
      ? { allowed: true, used: 0, limit: null, remaining: null }
      : await checkRateLimit(userId, chat.model_id);

    if (!rateLimit.allowed) {
      return res.status(429).json({ error: 'Rate limit exceeded', ...rateLimit });
    }

    const keyResult = effectiveUsingOwnKey
      ? await getEffectiveApiKey(userId, chat.model.provider, chat.model.api_key)
      : { apiKey: chat.model.api_key, isUserKey: false };
    const apiKey = keyResult.apiKey;
    const actuallyUsedOwnKey = keyResult.isUserKey;

    // If user chose own key but none found for this provider
    if (effectiveUsingOwnKey && !actuallyUsedOwnKey) {
      return res.status(400).json({
        error: `No ${chat.model.provider} API key found. Please add your API key in Settings → API Keys.`,
      });
    }

    // If using platform key but the platform doesn't have this model
    if (!effectiveUsingOwnKey && !chat.model.api_key?.trim()) {
      return res.status(400).json({
        error: `The platform doesn't support ${chat.model.name} yet. Please add your own ${chat.model.provider} API key in Settings → API Keys to use this model.`,
      });
    }

    // Delete last assistant msg + rebuild history in parallel
    const [, historyResult] = await Promise.all([
      lastMsgResult.data ? supabase.from('messages').delete().eq('id', lastMsgResult.data.id) : Promise.resolve(),
      supabase.from('messages').select('role, content').eq('chat_id', chat.id).order('created_at', { ascending: true }).limit(50),
    ]);

    const messages = [];
    if (agentResult?.system_prompt) {
      messages.push({ role: 'system', content: agentResult.system_prompt });
    }
    // Filter out the deleted assistant message from history
    const history = (historyResult.data || []).filter(m => !(m.role === 'assistant' && lastMsgResult.data));
    messages.push(...history);

    // ── SSE: Start streaming ASAP ──
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.socket) res.socket.setNoDelay(true);
    res.flushHeaders();

    const maxTokens = agentResult?.max_tokens
      ? Math.min(agentResult.max_tokens, 10000)
      : Math.min(chat.model.max_tokens || 4096, 10000);

    const temperature = agentResult?.temperature ?? 0.7;
    const topP = agentResult?.top_p ?? 0.95;

    let fullResponse = '';
    try {
      for await (const chunk of streamChatCompletion(chat.model.provider, apiKey, chat.model.model_id, messages, maxTokens, temperature, topP)) {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        if (typeof res.flush === 'function') res.flush();
      }
    } catch (aiError) {
      console.error('AI regenerate error:', aiError);
      const errMsg = aiError?.status === 401 || aiError?.code === 'invalid_api_key'
        ? 'Invalid API key. Please check your API key in Settings → API Keys.'
        : aiError?.status === 429
        ? 'Rate limited by the AI provider. Please wait and try again.'
        : `AI service error: ${aiError?.message || 'Please try again.'}`;
      res.write(`data: ${JSON.stringify({ type: 'error', content: errMsg })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // ── Send done IMMEDIATELY, save in background ──
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();

    // Fire-and-forget — only mark own-key usage when user's key was genuinely used
    supabase.from('messages').insert({ chat_id: chat.id, role: 'assistant', content: fullResponse }).catch(e => console.error('Save regen msg error:', e));
    incrementUsage(userId, chat.model_id, actuallyUsedOwnKey).catch(e => console.error('Regen usage error:', e));
  } catch (err) {
    console.error('Regenerate error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to regenerate' });
    else res.end();
  }
});

module.exports = router;

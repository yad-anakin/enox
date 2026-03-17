'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { agentsAPI, chatAPI } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, Square } from 'lucide-react';
import { EnoxLogo } from '@/components/common/EnoxLogo';
import { MessageBubble } from '@/components/chat/MessageBubble';

interface AgentInfo {
  id: string;
  name: string;
  username: string;
  description: string | null;
  system_prompt: string;
  use_own_key?: boolean;
  model: { id: string; name: string; provider: string };
  creator?: { name: string; avatar_url: string | null } | null;
}

const STATUS_TEXTS = ['Thinking...', 'Generating response...', 'Crafting answer...', 'Almost there...'];

function StreamingStatus() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setIdx((i) => (i + 1) % STATUS_TEXTS.length), 2500);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="flex items-center gap-2 py-2">
      <EnoxLogo className="w-4 h-4 text-white/30 animate-pulse" />
      <AnimatePresence mode="wait">
        <motion.span key={idx} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }} className="text-xs text-white/25">
          {STATUS_TEXTS[idx]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

export default function AgentChatPage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;

  const {
    activeChatId, setActiveChatId,
    messages, setMessages, addMessage, replaceLastAssistantContent,
    isStreaming, setIsStreaming,
    setSelectedAgentId, setSelectedModelId,
    useOwnKeys, chats, setChats, apiKeys,
  } = useStore(useShallow((s) => ({
    activeChatId: s.activeChatId, setActiveChatId: s.setActiveChatId,
    messages: s.messages, setMessages: s.setMessages, addMessage: s.addMessage,
    replaceLastAssistantContent: s.replaceLastAssistantContent,
    isStreaming: s.isStreaming, setIsStreaming: s.setIsStreaming,
    setSelectedAgentId: s.setSelectedAgentId, setSelectedModelId: s.setSelectedModelId,
    useOwnKeys: s.useOwnKeys, chats: s.chats, setChats: s.setChats,
    apiKeys: s.apiKeys,
  })));

  // Local streaming content — avoids global store updates every flush cycle
  const [streamContent, setStreamContent] = useState('');

  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // --- Batched streaming ---
  const streamBufferRef = useRef('');
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastScrollRef = useRef(0);

  const startStreamFlush = useCallback(() => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setInterval(() => {
      if (streamBufferRef.current) {
        setStreamContent(streamBufferRef.current);
        const now = Date.now();
        if (now - lastScrollRef.current > 100) {
          lastScrollRef.current = now;
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }
      }
    }, 30);
  }, []);

  const stopStreamFlush = useCallback(() => {
    if (flushTimerRef.current) { clearInterval(flushTimerRef.current); flushTimerRef.current = null; }
    // Final flush — commit to global store once
    if (streamBufferRef.current) { replaceLastAssistantContent(streamBufferRef.current); streamBufferRef.current = ''; }
    setStreamContent('');
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replaceLastAssistantContent]);

  // Cleanup on unmount — abort in-flight streams to prevent isStreaming getting stuck
  useEffect(() => {
    return () => {
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      setIsStreaming(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const messageCount = messages.length;
  useEffect(() => {
    if (!isStreaming) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messageCount, isStreaming]);

  const agents = useStore((s) => s.agents);

  // Fetch messages when activeChatId is set but messages are empty (navigated from sidebar/history)
  useEffect(() => {
    if (!activeChatId || messages.length > 0) return;
    let cancelled = false;
    setLoadingChat(true);
    chatAPI.getMessages(activeChatId).then((res) => {
      if (cancelled) return;
      setMessages(res.messages || []);
    }).catch(() => {
      if (!cancelled) setMessages([]);
    }).finally(() => {
      if (!cancelled) setLoadingChat(false);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId]);

  // Load agent by username — check own agents first (covers non-public), then public API
  const initializedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const setupAgent = (info: AgentInfo) => {
      setAgent(info);
      setSelectedAgentId(info.id);
      setSelectedModelId(info.model.id);
      if (!initializedRef.current) {
        initializedRef.current = true;
      }
      setLoading(false);
    };

    // Check if it's one of the user's own agents
    const ownAgent = agents.find(a => a.username === username);
    if (ownAgent) {
      setupAgent({
        id: ownAgent.id,
        name: ownAgent.name,
        username: ownAgent.username || username,
        description: ownAgent.description,
        system_prompt: ownAgent.system_prompt,
        use_own_key: ownAgent.use_own_key,
        model: ownAgent.model as AgentInfo['model'],
        creator: ownAgent.creator,
      });
      return;
    }

    agentsAPI.getByUsername(username).then((data) => {
      if (cancelled) return;
      setupAgent(data);
    }).catch(() => {
      if (!cancelled) { setNotFound(true); setLoading(false); }
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || !agent || isStreaming) return;

    // Client-side API key validation — instant feedback without round-trip
    if (useOwnKeys && agent) {
      const providerKey = apiKeys.find(k => k.provider === agent.model.provider);
      if (!providerKey?.has_key) {
        addMessage({ id: crypto.randomUUID(), role: 'user', content: trimmed, created_at: new Date().toISOString() });
        addMessage({ id: crypto.randomUUID(), role: 'assistant', content: `No ${agent.model.provider} API key found. Please add your API key in Settings → API Keys.`, created_at: new Date().toISOString() });
        setInput('');
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        });
        return;
      }
    }

    setInput('');
    setIsStreaming(true);

    addMessage({ id: crypto.randomUUID(), role: 'user', content: trimmed, created_at: new Date().toISOString() });
    addMessage({ id: crypto.randomUUID(), role: 'assistant', content: '', created_at: new Date().toISOString() });
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });

    streamBufferRef.current = '';
    startStreamFlush();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await chatAPI.sendMessage({
        chatId: activeChatId || undefined,
        modelId: agent.model.id,
        agentId: agent.id,
        message: trimmed,
        useOwnKeys,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `Server error ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No reader');

      let buffer = '';
      while (true) {
        if (controller.signal.aborted) { await reader.cancel(); break; }
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n');
        buffer = parts.pop() || '';
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'meta' && parsed.chatId) {
              setActiveChatId(parsed.chatId);
            } else if (parsed.type === 'chunk') {
              streamBufferRef.current += parsed.content;
            } else if (parsed.type === 'error') {
              streamBufferRef.current += parsed.content || 'An error occurred';
            } else if (parsed.type === 'done') {
              chatAPI.getHistory().then(r => setChats(r.chats || r)).catch(() => {});
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        streamBufferRef.current += err.message || 'Failed to send message.';
      }
    } finally {
      stopStreamFlush();
      abortRef.current = null;
      setIsStreaming(false);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopStreamFlush();
    setIsStreaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Show loading while agent info or messages are being fetched
  if ((loading || loadingChat) && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 border-2 border-white/10 border-t-white/50 rounded-full animate-spin" />
          <span className="text-xs text-white/30">{loadingChat ? 'Loading messages...' : 'Loading agent...'}</span>
        </div>
      </div>
    );
  }

  if (notFound || (!agent && !loading)) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <Bot size={32} className="text-white/15" />
          <h2 className="text-lg font-semibold text-white/60">Agent not found</h2>
          <p className="text-sm text-white/30">No public agent with username &ldquo;{username}&rdquo;</p>
          <button onClick={() => router.push('/explore')} className="px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-sm text-white/60 hover:bg-white/[0.1] transition-colors">
            Explore agents
          </button>
        </div>
      </div>
    );
  }

  // Empty state — show agent info
  if (messages.length === 0 && agent) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="h-14 flex items-center px-6 border-b border-white/[0.06] gap-2">
          <Bot size={14} className="text-white/40" />
          <span className="text-sm text-white/60">{agent.name}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-white/30">
            {agent.model.name}
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="flex flex-col items-center gap-4 max-w-md text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.06]">
              <Bot size={26} className="text-white/50" />
            </div>
            <h2 className="text-xl font-semibold text-white/80">{agent.name}</h2>
            {agent.description && <p className="text-sm text-white/35">{agent.description}</p>}
            {agent.creator?.name && (
              <p className="text-[11px] text-white/20">by <span className="text-white/35">{agent.creator.name}</span></p>
            )}
          </motion.div>
        </div>
        <div className="p-4 border-t border-white/[0.06]">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl bg-[#1a1a1a] border border-white/[0.08] flex items-end gap-2 p-3">
              <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={`Ask ${agent.name}...`} rows={1} className="flex-1 bg-transparent text-sm text-white/90 placeholder:text-white/25 resize-none outline-none max-h-32" style={{ minHeight: '24px' }} />
              <button onClick={handleSend} disabled={!input.trim()} className={cn('p-2 rounded-xl transition-all duration-200', input.trim() ? 'bg-white text-black hover:bg-white/90' : 'bg-white/5 text-white/20')}><Send size={16} /></button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Chat with messages
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-14 flex items-center px-6 border-b border-white/[0.06] gap-2 shrink-0">
        <Bot size={14} className="text-white/40" />
        <span className="text-sm text-white/60">{agent?.name || 'Agent'}</span>
        {agent?.creator?.name && (
          <span className="text-[9px] text-white/15">by {agent.creator.name}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg, idx) => {
            const isStreamingMsg = isStreaming && idx === messages.length - 1 && msg.role === 'assistant';
            const displayMsg = isStreamingMsg && streamContent ? { ...msg, content: streamContent } : msg;
            return (
              <div key={msg.id || idx}>
                {isStreamingMsg && <StreamingStatus />}
                <MessageBubble message={displayMsg} isStreaming={isStreamingMsg} />
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="p-4 border-t border-white/[0.06] shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl bg-[#1a1a1a] border border-white/[0.08] flex items-end gap-2 p-3">
            <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={agent ? `Ask ${agent.name}...` : 'Type a message...'} rows={1} disabled={isStreaming} className="flex-1 bg-transparent text-sm text-white/90 placeholder:text-white/25 resize-none outline-none max-h-32 disabled:opacity-50" style={{ minHeight: '24px' }} />
            {isStreaming ? (
              <button onClick={handleStop} className="p-2 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 transition-all"><Square size={16} /></button>
            ) : (
              <button onClick={handleSend} disabled={!input.trim()} className={cn('p-2 rounded-xl transition-all duration-200', input.trim() ? 'bg-white text-black hover:bg-white/90' : 'bg-white/5 text-white/20')}><Send size={16} /></button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import type { MediaItem } from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { chatAPI } from '@/lib/api';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Square, ChevronUp, Bot, Maximize2, Minimize2, Brain, PanelLeft, Paperclip, Volume2, Sparkles, ImagePlus } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { ModelSelector } from './ModelSelector';
import { EnoxLogo } from '@/components/common/EnoxLogo';
import { VoiceRecorder } from './VoiceRecorder';
import { AttachmentPreview } from './AttachmentPreview';
import type { Attachment } from './AttachmentPreview';

const STARTER_PROMPTS = [
  'Explain quantum computing simply',
  'Write a Python web scraper',
  'Compare React vs Vue pros/cons',
  'Draft a professional email',
  'Explain blockchain in simple terms',
  'Write a regex for email validation',
  'How does a neural network work?',
  'Create a REST API with Node.js',
  'Explain the theory of relativity',
  'Write a SQL query for top 10 users',
  'What are design patterns in OOP?',
  'Build a to-do app with React',
  'Explain TCP vs UDP differences',
  'Write a bash script to backup files',
  'How does garbage collection work?',
  'Create a responsive CSS grid layout',
  'Explain HTTPS and TLS handshake',
  'Write a binary search in JavaScript',
  'What is Docker and why use it?',
  'Create a cron job explained simply',
  'How do transformers work in AI?',
  'Write a unit test with Jest',
  'Explain git rebase vs merge',
  'Build a CLI tool with Python',
  'What is WebSocket and when to use it?',
  'Write a sorting algorithm comparison',
  'Explain microservices architecture',
  'Create a JWT authentication flow',
  'How does DNS resolution work?',
  'Write a debounce function in JS',
  'Explain NoSQL vs SQL databases',
  'Build a markdown parser from scratch',
  'What are Rust ownership rules?',
  'Write a rate limiter in Node.js',
  'Explain how a compiler works',
  'Create an OAuth2 login flow',
  'How does CSS Flexbox work?',
  'Write a linked list in TypeScript',
  'Explain event-driven architecture',
  'Build a real-time chat with Socket.io',
  'What is the CAP theorem?',
  'Write a custom React hook',
  'Explain Kubernetes in simple terms',
  'Create a state machine example',
  'How does HTTP/2 differ from HTTP/1.1?',
  'Write a recursive tree traversal',
  'Explain functional programming basics',
  'Build a simple game with JavaScript',
  'What are SOLID principles?',
  'Write a GraphQL schema and resolver',
  'Explain how CDNs work',
  'Create a pub/sub messaging system',
  'How does browser rendering work?',
  'Write a promise-based queue in JS',
  'Explain zero-knowledge proofs simply',
  'Build a URL shortener backend',
  'What is memoization and when to use it?',
  'Write a middleware for Express.js',
  'Explain MapReduce in simple terms',
  'Create a drag-and-drop UI component',
];

const STATUS_TEXTS = [
  'Thinking...',
  'Generating response...',
  'Processing your request...',
  'Analyzing context...',
  'Crafting answer...',
  'Almost there...',
];

const INPUT_LINE_HEIGHT = 24;
const INPUT_TOGGLE_ROWS = 4;
const INPUT_MAX_ROWS = 5;
const INPUT_TOGGLE_HEIGHT = INPUT_LINE_HEIGHT * INPUT_TOGGLE_ROWS;
const INPUT_MAX_HEIGHT = INPUT_LINE_HEIGHT * INPUT_MAX_ROWS;

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
        <motion.span
          key={idx}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          className="text-xs text-white/25"
        >
          {STATUS_TEXTS[idx]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

export function ChatView() {
  const {
    models, selectedModelId, setSelectedModelId,
    activeChatId, setActiveChatId,
    messages, setMessages, addMessage, replaceLastAssistantContent, replaceLastAssistantFull,
    isStreaming, setIsStreaming,
    selectedAgentId, agents, chats, setChats,
    useOwnKeys, setRecentModelId, apiKeys, think, setThink, sidebarOpen, setSidebarOpen,
  } = useStore(useShallow((s) => ({
    models: s.models, selectedModelId: s.selectedModelId, setSelectedModelId: s.setSelectedModelId,
    activeChatId: s.activeChatId, setActiveChatId: s.setActiveChatId,
    messages: s.messages, setMessages: s.setMessages, addMessage: s.addMessage,
    replaceLastAssistantContent: s.replaceLastAssistantContent,
    replaceLastAssistantFull: s.replaceLastAssistantFull,
    isStreaming: s.isStreaming, setIsStreaming: s.setIsStreaming,
    selectedAgentId: s.selectedAgentId, agents: s.agents, chats: s.chats, setChats: s.setChats,
    useOwnKeys: s.useOwnKeys, setRecentModelId: s.setRecentModelId,
    apiKeys: s.apiKeys, think: s.think, setThink: s.setThink, sidebarOpen: s.sidebarOpen, setSidebarOpen: s.setSidebarOpen,
  })));

  // Pick 4 random starter prompts on mount
  const starterPrompts = useMemo(() => {
    const shuffled = [...STARTER_PROMPTS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 4);
  }, []);

  // Local streaming content — avoids global store updates every flush cycle
  const [streamContent, setStreamContent] = useState('');
  // Local loading state — self-contained, can't get stuck across components
  const [loadingChat, setLoadingChat] = useState(false);

  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [ttsVoice, setTtsVoice] = useState('Kore');

  // Derive the model type of the currently selected model
  const selectedModel = models.find(m => m.id === selectedModelId);
  const selectedModelType = selectedModel?.model_type || 'text';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const streamMediaRef = useRef<MediaItem[]>([]);
  const [isGenerating, setIsGenerating] = useState<string | null>(null); // 'image' | 'audio' | 'video' | null
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalMessages, setTotalMessages] = useState(0);
  const [thinkingStartTime, setThinkingStartTime] = useState<number | null>(null);
  const [thinkingDone, setThinkingDone] = useState<number | null>(null);
  const [thinkingContent, setThinkingContent] = useState('');
  const lastThinkingTimeRef = useRef<number | null>(null);
  const lastThinkingContentRef = useRef('');
  const thinkingContentRef = useRef('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // --- Typewriter streaming: smooth character-by-character reveal like ChatGPT ---
  const streamBufferRef = useRef('');       // Full accumulated text from backend
  const displayPosRef = useRef(0);          // How many chars we've rendered so far
  const animFrameRef = useRef<number | null>(null);
  const streamActiveRef = useRef(false);
  const lastScrollRef = useRef(0);

  const startStreamRender = useCallback(() => {
    streamBufferRef.current = '';
    displayPosRef.current = 0;
    streamActiveRef.current = true;
    if (animFrameRef.current) return;

    const tick = () => {
      const buf = streamBufferRef.current;
      const pos = displayPosRef.current;

      if (pos < buf.length) {
        // Adaptive speed: at least 2 chars/frame, scales with backlog so we never fall behind
        const backlog = buf.length - pos;
        const step = Math.max(2, Math.ceil(backlog / 3));
        const nextPos = Math.min(pos + step, buf.length);
        displayPosRef.current = nextPos;
        setStreamContent(buf.slice(0, nextPos));

        // Smooth scroll following (~60fps throttled)
        const now = Date.now();
        if (now - lastScrollRef.current > 80) {
          lastScrollRef.current = now;
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }
      }

      // Keep running while streaming or buffer not fully drained
      if (streamActiveRef.current || displayPosRef.current < streamBufferRef.current.length) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        animFrameRef.current = null;
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const stopStreamRender = useCallback(() => {
    streamActiveRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    // Commit full text + any generated media to global store
    const hasMedia = streamMediaRef.current.length > 0;
    if (streamBufferRef.current || hasMedia) {
      replaceLastAssistantFull(streamBufferRef.current, hasMedia ? streamMediaRef.current : undefined);
    }
    streamBufferRef.current = '';
    streamMediaRef.current = [];
    displayPosRef.current = 0;
    setStreamContent('');
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replaceLastAssistantFull]);

  // Cleanup on unmount — abort in-flight streams to prevent isStreaming getting stuck
  useEffect(() => {
    return () => {
      streamActiveRef.current = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      // Reset global streaming flag so other pages aren't blocked
      setIsStreaming(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only scroll on non-streaming message changes (new chat loaded, user msg added)
  const messageCount = messages.length;
  useEffect(() => {
    if (!isStreaming) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messageCount, isStreaming]);

  useEffect(() => {
    if (models.length === 0) return;
    // If no model selected, or saved model no longer exists, pick the newest (first in list)
    if (!selectedModelId || !models.find(m => m.id === selectedModelId)) {
      setSelectedModelId(models[0].id);
    }
  }, [models, selectedModelId, setSelectedModelId]);

  // Fetch messages when activeChatId changes and messages are empty
  useEffect(() => {
    if (!activeChatId || messages.length > 0) return;
    let cancelled = false;
    setLoadingChat(true);
    chatAPI.getMessages(activeChatId).then((res) => {
      if (cancelled) return;
      const msgs = res.messages || [];
      setMessages(msgs);
      setHasMore(msgs.length >= 20);
    }).catch(() => {
      if (!cancelled) setMessages([]);
    }).finally(() => {
      if (!cancelled) setLoadingChat(false);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId]);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const handleLoadMore = useCallback(async () => {
    if (!activeChatId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const scrollEl = scrollRef.current;
    const prevHeight = scrollEl?.scrollHeight || 0;
    try {
      const offset = messagesRef.current.length;
      const res = await chatAPI.getMessages(activeChatId, offset, 20);
      const older = res.messages || [];
      setHasMore(res.hasMore);
      setTotalMessages(res.total);
      if (older.length > 0) {
        setMessages([...older, ...messagesRef.current]);
        requestAnimationFrame(() => {
          if (scrollEl) {
            scrollEl.scrollTop = scrollEl.scrollHeight - prevHeight;
          }
        });
      }
    } catch (err) {
      console.error('Load more error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [activeChatId, loadingMore, hasMore, setMessages]);

  // Derive active agent/chat early so handleSend can reference them
  const activeAgent = selectedAgentId ? agents.find(a => a.id === selectedAgentId) : null;
  const activeChat = activeChatId ? chats.find(c => c.id === activeChatId) : null;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    });
  }, []);

  // ── Attachment handlers ──
  const MAX_ATTACHMENTS = 10;

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      if (file.size > 20 * 1024 * 1024) return; // 20MB max per file
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        const isImage = file.type.startsWith('image/');
        const att: Attachment = {
          id: crypto.randomUUID(),
          type: isImage ? 'image' : 'file',
          mimeType: file.type || 'application/octet-stream',
          data: base64,
          name: file.name,
          preview: isImage ? (reader.result as string) : undefined,
          size: file.size,
        };
        setAttachments(prev => prev.length >= MAX_ATTACHMENTS ? prev : [...prev, att]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }, []);

  const handleVoiceRecorded = useCallback((blob: Blob, mimeType: string) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      const att: Attachment = {
        id: crypto.randomUUID(),
        type: 'voice',
        mimeType,
        data: base64,
        name: 'Voice message',
        size: blob.size,
      };
      setAttachments(prev => [...prev, att]);
    };
    reader.readAsDataURL(blob);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const handleSend = async () => {
    const trimmed = input.trim();
    const hasAttachments = attachments.length > 0;
    if ((!trimmed && !hasAttachments) || !selectedModelId || isStreaming) return;

    // Use a default message if only attachments are provided
    const messageText = trimmed || (hasAttachments ? 'Please analyze the attached content.' : '');

    // Client-side API key validation — instant feedback without round-trip
    if (useOwnKeys && selectedModel) {
      const providerKey = apiKeys.find(k => k.provider === selectedModel.provider);
      if (!providerKey?.has_key) {
        addMessage({ id: crypto.randomUUID(), role: 'user' as const, content: messageText, created_at: new Date().toISOString() });
        addMessage({ id: crypto.randomUUID(), role: 'assistant' as const, content: `No ${selectedModel.provider} API key found. Please add your API key in Settings → API Keys.`, created_at: new Date().toISOString() });
        setInput('');
        setAttachments([]);
        scrollToBottom('smooth');
        return;
      }
    }

    // Build attachment labels for display in user bubble
    const attLabels = attachments.map(a => {
      if (a.type === 'voice') return '[Voice message sent]';
      if (a.type === 'image') return '[Image sent]';
      return `[File: ${a.name}]`;
    });

    // Capture attachments before clearing
    const currentAttachments = [...attachments];

    setInput('');
    setAttachments([]);
    setIsStreaming(true);
    if (selectedModelId) setRecentModelId(selectedModelId);

    addMessage({
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: messageText,
      created_at: new Date().toISOString(),
      attachmentLabels: attLabels.length > 0 ? attLabels : undefined,
    });
    addMessage({ id: crypto.randomUUID(), role: 'assistant' as const, content: '', created_at: new Date().toISOString() });
    scrollToBottom('smooth');

    // Start typewriter animation loop + reset thinking/media state
    startStreamRender();
    streamMediaRef.current = [];
    setThinkingStartTime(null);
    setThinkingDone(null);
    setThinkingContent('');
    lastThinkingTimeRef.current = null;
    lastThinkingContentRef.current = '';
    thinkingContentRef.current = '';

    const controller = new AbortController();
    abortRef.current = controller;
    const t0 = performance.now();

    try {
      const response = await chatAPI.sendMessage({
        chatId: activeChatId || undefined,
        modelId: selectedModelId,
        agentId: selectedAgentId,
        message: messageText,
        useOwnKeys,
        think,
        attachments: currentAttachments.map(a => ({
          type: a.type,
          mimeType: a.mimeType,
          data: a.data,
          name: a.name,
        })),
        ...(selectedModelType === 'tts' ? { ttsVoice } : {}),
      });
      console.log(`[stream] response headers: ${(performance.now() - t0).toFixed(0)}ms`);

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `Server error ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No reader available');

      let buffer = '';
      let firstData = true;
      let firstChunk = true;
      while (true) {
        if (controller.signal.aborted) { await reader.cancel(); break; }
        const { done, value } = await reader.read();
        if (done) break;
        if (firstData) { console.log(`[stream] first data: ${(performance.now() - t0).toFixed(0)}ms`); firstData = false; }

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
            } else if (parsed.type === 'thinking_start') {
              setThinkingStartTime(Date.now());
            } else if (parsed.type === 'thinking_content') {
              thinkingContentRef.current += parsed.content;
              setThinkingContent(thinkingContentRef.current);
            } else if (parsed.type === 'thinking_done') {
              setThinkingDone(parsed.thinkingTime);
              setThinkingStartTime(null);
              lastThinkingTimeRef.current = parsed.thinkingTime;
              lastThinkingContentRef.current = thinkingContentRef.current;
            } else if (parsed.type === 'clear_content') {
              // Clear fake tool-call JSON from the streamed text
              streamBufferRef.current = '';
              displayPosRef.current = 0;
              setStreamContent('');
            } else if (parsed.type === 'generating') {
              // Show generation skeleton
              console.log(`[stream] generating event: mediaType=${parsed.mediaType}`);
              setIsGenerating(parsed.mediaType || 'image');
            } else if (parsed.type === 'media') {
              // Inline generated media (image/audio/video)
              console.log(`[stream] media event: mimeType=${parsed.mimeType}, data length=${parsed.data?.length || 0}`);
              setIsGenerating(null); // Hide skeleton
              const mediaType = parsed.mimeType?.startsWith('image/') ? 'image'
                : parsed.mimeType?.startsWith('audio/') ? 'audio'
                : parsed.mimeType?.startsWith('video/') ? 'video' : 'image';
              streamMediaRef.current = [...streamMediaRef.current, {
                type: mediaType as 'image' | 'audio' | 'video',
                mimeType: parsed.mimeType,
                data: parsed.data,
              }];
            } else if (parsed.type === 'chunk') {
              if (firstChunk) { console.log(`[stream] first token: ${(performance.now() - t0).toFixed(0)}ms`); firstChunk = false; }
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
        console.error('Send error:', err);
        streamBufferRef.current += err.message || 'Failed to send message. Please try again.';
      }
    } finally {
      stopStreamRender();
      abortRef.current = null;
      setIsStreaming(false);
      setIsGenerating(null);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopStreamRender();
    setIsGenerating(null);
    setIsStreaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    textarea.style.height = '0px';
    const nextHeight = isInputExpanded
      ? Math.max(INPUT_LINE_HEIGHT, textarea.scrollHeight)
      : Math.min(Math.max(INPUT_LINE_HEIGHT, textarea.scrollHeight), INPUT_MAX_HEIGHT);

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = isInputExpanded ? 'auto' : textarea.scrollHeight > INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
  }, [input, isInputExpanded]);

  useEffect(() => {
    if (!input.trim()) setIsInputExpanded(false);
  }, [input]);

  const shouldShowExpandToggle = Boolean(inputRef.current && inputRef.current.scrollHeight > INPUT_TOGGLE_HEIGHT);

  const canSend = (input.trim() || attachments.length > 0) && selectedModelId;

  const renderComposer = (placeholder: string, disabled = false) => (
    <div className="rounded-2xl bg-[#1a1a1a] border border-white/[0.08] p-3">
      {/* Attachment preview chips */}
      <AttachmentPreview attachments={attachments} onRemove={removeAttachment} />
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,audio/*,video/*,.pdf,.txt,.csv,.json,.md,.doc,.docx"
        onChange={handleFileSelect}
        className="hidden"
      />
      <div className="flex items-end gap-2">
        {/* Attach file button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isStreaming}
          title="Attach image or file"
          className={cn(
            'p-2 rounded-xl transition-all duration-200 shrink-0',
            disabled || isStreaming
              ? 'bg-white/5 text-white/20 cursor-not-allowed'
              : 'bg-white/[0.06] text-white/40 hover:bg-white/[0.1] hover:text-white/70 border border-white/[0.06]'
          )}
        >
          <Paperclip size={16} />
        </button>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          className="flex-1 bg-transparent text-sm text-white/90 placeholder:text-white/25 resize-none outline-none disabled:opacity-50"
          style={{ minHeight: `${INPUT_LINE_HEIGHT}px`, maxHeight: isInputExpanded ? '50vh' : `${INPUT_MAX_HEIGHT}px` }}
        />
        {/* Voice recorder — iOS-compatible (MP4/AAC) */}
        <VoiceRecorder onRecorded={handleVoiceRecorded} disabled={disabled || isStreaming} />
        <button
          onClick={() => setThink(!think)}
          title={think ? 'Thinking enabled — model will reason before answering' : 'Thinking disabled — model will answer directly'}
          className={cn(
            'flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-all duration-200 shrink-0',
            think
              ? 'bg-white/[0.08] text-white/70 border border-white/[0.12] hover:bg-white/[0.12]'
              : 'bg-transparent text-white/30 border border-white/[0.06] hover:text-white/50 hover:border-white/[0.1]'
          )}
        >
          <Brain size={14} />
          <span className="hidden sm:inline">{think ? 'Think' : 'Think'}</span>
        </button>
        {isStreaming ? (
          <button onClick={handleStop} className="p-2 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 transition-all duration-200"><Square size={16} /></button>
        ) : (
          <button onClick={handleSend} disabled={!canSend || disabled} className={cn('p-2 rounded-xl transition-all duration-200', canSend && !disabled ? 'bg-white text-black hover:bg-white/90' : 'bg-white/5 text-white/20')}><Send size={16} /></button>
        )}
      </div>
      {(shouldShowExpandToggle || isInputExpanded) && (
        <div className="mt-2 flex justify-end">
          <button
            onClick={() => setIsInputExpanded((prev) => !prev)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-white/35 transition-colors hover:bg-white/5 hover:text-white/70"
          >
            {isInputExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            {isInputExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      )}
    </div>
  );

  const GOOGLE_VOICES = ['Kore', 'Charon', 'Fenrir', 'Aoede', 'Puck', 'Leda', 'Orus', 'Zephyr'];

  const renderTTSComposer = (disabled = false) => (
    <div className="rounded-2xl bg-[#1a1a1a] border border-white/[0.08] p-3 space-y-3">
      {/* Voice selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <Volume2 size={14} className="text-emerald-400/60 shrink-0" />
        <span className="text-[11px] text-white/30 shrink-0">Voice</span>
        <div className="flex gap-1.5 flex-wrap">
          {GOOGLE_VOICES.map(v => (
            <button
              key={v}
              onClick={() => setTtsVoice(v)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border',
                ttsVoice === v
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-white/[0.04] text-white/35 border-white/[0.06] hover:bg-white/[0.08] hover:text-white/50'
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      {/* Text input + send */}
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type the text you want to hear spoken..."
          rows={2}
          disabled={disabled}
          className="flex-1 bg-white/[0.03] rounded-xl px-3 py-2.5 text-sm text-white/90 placeholder:text-white/20 resize-none outline-none border border-white/[0.06] focus:border-emerald-500/20 transition-colors disabled:opacity-50"
          style={{ minHeight: '56px', maxHeight: '120px' }}
        />
        {isStreaming ? (
          <button onClick={handleStop} className="p-2.5 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 transition-all shrink-0"><Square size={16} /></button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim() || !selectedModelId || disabled}
            className={cn(
              'p-2.5 rounded-xl transition-all shrink-0',
              input.trim() && selectedModelId && !disabled
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                : 'bg-white/5 text-white/20 border border-white/[0.06]'
            )}
          >
            <Volume2 size={16} />
          </button>
        )}
      </div>
    </div>
  );

  const renderGenerationComposer = (placeholder: string, disabled = false) => {
    const isImg = selectedModelType === 'image';
    const imageAttachments = attachments.filter(a => a.type === 'image');
    const genCanSend = (input.trim() || attachments.length > 0) && selectedModelId && !disabled;

    return (
      <div className="rounded-2xl bg-[#1a1a1a] border border-white/[0.08] p-3 space-y-2">
        {/* Reference image thumbnails */}
        {isImg && imageAttachments.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {imageAttachments.map(att => (
              <div key={att.id} className="relative group">
                <img src={att.preview} alt="" className="h-14 w-14 rounded-lg object-cover border border-white/[0.08]" />
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500/80 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
            <span className="text-[10px] text-white/25">{imageAttachments.length}/{MAX_ATTACHMENTS}</span>
          </div>
        )}
        {/* Hidden image-only file input */}
        <input
          ref={imageInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="flex items-end gap-2">
          {/* Reference image button (image models only) */}
          {isImg && (
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={disabled || isStreaming || attachments.length >= MAX_ATTACHMENTS}
              title={attachments.length >= MAX_ATTACHMENTS ? 'Max 10 references' : 'Add reference images'}
              className={cn(
                'p-2 rounded-xl transition-all duration-200 shrink-0',
                disabled || isStreaming || attachments.length >= MAX_ATTACHMENTS
                  ? 'bg-white/5 text-white/20 cursor-not-allowed'
                  : 'bg-purple-500/10 text-purple-400/50 hover:bg-purple-500/20 hover:text-purple-400/80 border border-purple-500/20'
              )}
            >
              <ImagePlus size={16} />
            </button>
          )}
          <div className="flex-1 flex items-center gap-2">
            <Sparkles size={14} className="text-purple-400/60 shrink-0" />
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              disabled={disabled}
              className="flex-1 bg-transparent text-sm text-white/90 placeholder:text-white/25 resize-none outline-none disabled:opacity-50"
              style={{ minHeight: `${INPUT_LINE_HEIGHT}px`, maxHeight: `${INPUT_MAX_HEIGHT}px` }}
            />
          </div>
          {isStreaming ? (
            <button onClick={handleStop} className="p-2 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 transition-all"><Square size={16} /></button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!genCanSend}
              className={cn(
                'p-2 rounded-xl transition-all',
                genCanSend
                  ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30'
                  : 'bg-white/5 text-white/20'
              )}
            >
              <Sparkles size={16} />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderActiveComposer = (disabled = false) => {
    if (selectedModelType === 'tts') return renderTTSComposer(disabled);
    if (selectedModelType === 'image' || selectedModelType === 'video') {
      const ph = selectedModelType === 'image' ? 'Describe the image you want to generate...' : 'Describe the video you want to generate...';
      return renderGenerationComposer(ph, disabled);
    }
    const activeAgent = selectedAgentId ? agents.find(a => a.id === selectedAgentId) : null;
    return renderComposer(activeAgent ? `Ask ${activeAgent.name}...` : 'Type a message...', disabled);
  };

  const handleRegenerate = async () => {
    if (!activeChatId || isStreaming) return;
    setIsStreaming(true);

    const newMessages = [...messages];
    if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
      newMessages.pop();
    }
    setMessages(newMessages);

    addMessage({ id: crypto.randomUUID(), role: 'assistant', content: '', created_at: new Date().toISOString() });

    // Start typewriter animation loop + reset thinking/media state
    startStreamRender();
    streamMediaRef.current = [];
    setThinkingStartTime(null);
    setThinkingDone(null);
    setThinkingContent('');
    lastThinkingTimeRef.current = null;
    lastThinkingContentRef.current = '';
    thinkingContentRef.current = '';

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await chatAPI.regenerate(activeChatId, { useOwnKeys, think, ...(selectedModelType === 'tts' ? { ttsVoice } : {}) });
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
            if (parsed.type === 'thinking_start') {
              setThinkingStartTime(Date.now());
            } else if (parsed.type === 'thinking_content') {
              thinkingContentRef.current += parsed.content;
              setThinkingContent(thinkingContentRef.current);
            } else if (parsed.type === 'thinking_done') {
              setThinkingDone(parsed.thinkingTime);
              setThinkingStartTime(null);
              lastThinkingTimeRef.current = parsed.thinkingTime;
              lastThinkingContentRef.current = thinkingContentRef.current;
            } else if (parsed.type === 'clear_content') {
              streamBufferRef.current = '';
              displayPosRef.current = 0;
              setStreamContent('');
            } else if (parsed.type === 'generating') {
              setIsGenerating(parsed.mediaType || 'image');
            } else if (parsed.type === 'media') {
              setIsGenerating(null);
              const mediaType = parsed.mimeType?.startsWith('image/') ? 'image'
                : parsed.mimeType?.startsWith('audio/') ? 'audio'
                : parsed.mimeType?.startsWith('video/') ? 'video' : 'image';
              streamMediaRef.current = [...streamMediaRef.current, {
                type: mediaType as 'image' | 'audio' | 'video',
                mimeType: parsed.mimeType,
                data: parsed.data,
              }];
            } else if (parsed.type === 'chunk') {
              streamBufferRef.current += parsed.content;
            } else if (parsed.type === 'error') {
              streamBufferRef.current += parsed.content || 'An error occurred';
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Regenerate error:', err);
        streamBufferRef.current += err.message || 'Failed to regenerate.';
      }
    } finally {
      stopStreamRender();
      abortRef.current = null;
      setIsStreaming(false);
      setIsGenerating(null);
    }
  };

  // Auto-set model to agent's model when agent is selected
  useEffect(() => {
    if (activeAgent?.model?.id && activeAgent.model.id !== selectedModelId) {
      setSelectedModelId(activeAgent.model.id);
    }
  }, [activeAgent, selectedModelId, setSelectedModelId]);

  // Empty state (no messages and not loading)
  if (messages.length === 0 && !loadingChat) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="h-14 flex items-center justify-between px-6 border-b border-white/[0.06] shrink-0">
          {activeAgent ? (
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-white/55 transition-all hover:bg-white/[0.06] md:hidden shrink-0"
              >
                <PanelLeft size={18} />
              </button>
              <Bot size={14} className="text-white/40" />
              <span className="text-sm text-white/60">{activeAgent.name}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-white/30">
                {activeAgent.model.name}
              </span>
            </div>
          ) : (
            <ModelSelector />
          )}
        </div>
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-6 px-4">
          {activeAgent ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="flex flex-col items-center gap-4 max-w-md text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                <Bot size={22} className="text-white/50" />
              </div>
              <h2 className="text-xl font-semibold text-white/80">{activeAgent.name}</h2>
              {activeAgent.description && (
                <p className="text-sm text-white/35">{activeAgent.description}</p>
              )}
              {activeAgent.creator?.name && (
                <p className="text-[11px] text-white/20">
                  by <span className="text-white/35">{activeAgent.creator.name}</span>
                </p>
              )}
            </motion.div>
          ) : selectedModelType === 'tts' ? (
            <>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="flex flex-col items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <Volume2 size={22} className="text-emerald-400/70" />
                </div>
                <h2 className="text-xl font-semibold text-white/80">Text to Speech</h2>
                <p className="text-sm text-white/30 text-center max-w-md">Type any text below and choose a voice. The AI will generate natural-sounding speech for you.</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-2 gap-3 max-w-lg w-full">
                {['Hello! Welcome to our platform.', 'The quick brown fox jumps over the lazy dog.', 'Breaking news: AI can now speak naturally.', 'Once upon a time, in a land far away...'].map((prompt, i) => (
                  <button key={i} onClick={() => { setInput(prompt); inputRef.current?.focus(); }} className="text-left p-3 rounded-xl glass hover:bg-emerald-500/[0.04] border border-emerald-500/[0.06] transition-all text-sm text-white/50 hover:text-emerald-400/70">{prompt}</button>
                ))}
              </motion.div>
            </>
          ) : (selectedModelType === 'image' || selectedModelType === 'video') ? (
            <>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="flex flex-col items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/20">
                  <Sparkles size={22} className="text-purple-400/70" />
                </div>
                <h2 className="text-xl font-semibold text-white/80">{selectedModelType === 'image' ? 'Image Generation' : 'Video Generation'}</h2>
                <p className="text-sm text-white/30 text-center max-w-md">Describe what you want to {selectedModelType === 'image' ? 'see' : 'create'}. Be specific about style, colors, and composition for best results.</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-2 gap-3 max-w-lg w-full">
                {(selectedModelType === 'image'
                  ? ['A serene mountain lake at sunset with reflections', 'Futuristic city skyline with neon lights', 'Cute robot reading a book in a library', 'Abstract art with flowing colors and shapes']
                  : ['A timelapse of clouds moving over mountains', 'Ocean waves crashing on a rocky shore', 'A butterfly emerging from its cocoon', 'Northern lights dancing over a snowy forest']
                ).map((prompt, i) => (
                  <button key={i} onClick={() => { setInput(prompt); inputRef.current?.focus(); }} className="text-left p-3 rounded-xl glass hover:bg-purple-500/[0.04] border border-purple-500/[0.06] transition-all text-sm text-white/50 hover:text-purple-400/70">{prompt}</button>
                ))}
              </motion.div>
            </>
          ) : (
            <>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="flex flex-col items-center gap-4">
                <EnoxLogo className="w-5 h-5 text-white/45" />
                <h2 className="text-xl font-semibold text-white/80">How can I help you?</h2>
                <p className="text-sm text-white/30 text-center max-w-md">Start a conversation with AI. Select a model above or choose an agent to get specialized responses.</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-2 gap-3 max-w-lg w-full">
                {starterPrompts.map((prompt, i) => (
                  <button key={i} onClick={() => { setInput(prompt); inputRef.current?.focus(); }} className="text-left p-3 rounded-xl glass hover:bg-white/[0.06] transition-all text-sm text-white/50 hover:text-white/70">{prompt}</button>
                ))}
              </motion.div>
            </>
          )}
        </div>
        <div className="p-4 border-t border-white/[0.06] shrink-0">
          <div className="max-w-3xl mx-auto">
            {renderActiveComposer()}
          </div>
        </div>
      </div>
    );
  }

  // Chat with messages
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-14 flex items-center justify-between px-6 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-3">
          <ModelSelector />
          {(() => {
            const activeChat = chats.find(c => c.id === activeChatId);
            if (!activeChat?.agent) return null;
            const isOwn = agents.find(a => a.id === activeChat.agent!.id);
            return (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                <Bot size={11} className="text-white/40" />
                <span className="text-[10px] text-white/40">{activeChat.agent.name}</span>
                <span className={cn('text-[8px] px-1.5 py-0.5 rounded-full', isOwn ? 'bg-blue-500/10 text-blue-400/60' : 'bg-green-500/10 text-green-400/60')}>
                  {isOwn ? 'yours' : 'public'}
                </span>
              </div>
            );
          })()}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 min-h-0 overscroll-contain">
        {loadingChat ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-5 h-5 border-2 border-white/10 border-t-white/50 rounded-full animate-spin" />
              <span className="text-xs text-white/30">Loading messages...</span>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Load more button */}
            {hasMore && (
              <div className="flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-[11px] text-white/30 hover:bg-white/[0.05] hover:text-white/50 transition-all disabled:opacity-30"
                >
                  {loadingMore ? (
                    <div className="w-3 h-3 border border-white/10 border-t-white/40 rounded-full animate-spin" />
                  ) : (
                    <ChevronUp size={12} />
                  )}
                  {loadingMore ? 'Loading...' : 'Load older messages'}
                </button>
              </div>
            )}
            {messages.map((msg, idx) => {
              const isStreamingMsg = isStreaming && idx === messages.length - 1 && msg.role === 'assistant';
              const displayMsg = isStreamingMsg && streamContent ? { ...msg, content: streamContent } : msg;
              const isLatestAssistantMessage = msg.role === 'assistant' && idx === messages.length - 1;
              return (
                <div key={msg.id || idx}>
                  {isStreamingMsg && <StreamingStatus />}
                  <MessageBubble
                    message={displayMsg}
                    isStreaming={isStreamingMsg}
                    isGenerating={isStreamingMsg ? isGenerating : null}
                    thinkingStartTime={isStreamingMsg ? thinkingStartTime : null}
                    thinkingDone={isStreamingMsg ? thinkingDone : (isLatestAssistantMessage ? lastThinkingTimeRef.current : null)}
                    thinkingContent={isStreamingMsg ? thinkingContent : (isLatestAssistantMessage ? lastThinkingContentRef.current : '')}
                    onRegenerate={activeChatId && !isStreaming && isLatestAssistantMessage ? handleRegenerate : undefined}
                  />
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="p-4 border-t border-white/[0.06] shrink-0">
        <div className="max-w-3xl mx-auto">
          {renderActiveComposer(isStreaming)}
        </div>
      </div>
    </div>
  );
}

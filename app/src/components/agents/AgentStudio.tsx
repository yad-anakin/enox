'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { agentsAPI, chatAPI } from '@/lib/api';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Bot, Save, Cpu, SlidersHorizontal,
  Globe, Lock, Thermometer, Hash, Type, Send, Square,
  Trash2, Rocket, Key, Building2, X, CheckCircle2, Search, ChevronLeft, AtSign, Volume2,
  ImageIcon, Mic, Download, Play, Pause,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { EnoxLogo } from '@/components/common/EnoxLogo';

const PROVIDER_DOTS: Record<string, string> = {
  openai: 'bg-green-400', anthropic: 'bg-orange-400', google: 'bg-blue-400',
  mistral: 'bg-purple-400', groq: 'bg-yellow-400', openrouter: 'bg-pink-400',
};

const TTS_VOICES = ['Kore', 'Charon', 'Fenrir', 'Aoede', 'Puck', 'Leda', 'Orus', 'Zephyr'];

const TYPE_BADGES: Record<string, { label: string; cls: string }> = {
  image: { label: 'IMG', cls: 'bg-purple-500/15 text-purple-400/70' },
  video: { label: 'VID', cls: 'bg-amber-500/15 text-amber-400/70' },
  tts: { label: 'TTS', cls: 'bg-emerald-500/15 text-emerald-400/70' },
};

interface StudioForm {
  name: string;
  username: string;
  description: string;
  system_prompt: string;
  model_id: string;
  is_public: boolean;
  temperature: number;
  top_p: number;
  max_tokens: number;
  use_own_key: boolean;
  tts_voice: string;
}

interface MediaItem {
  type: 'image' | 'audio' | 'video';
  mimeType: string;
  data: string;
}

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  media?: MediaItem[];
  isGenerating?: string | null; // 'image' | 'audio' | 'video' | null
}

// ── Generating skeleton for agent studio chat ──
function StudioSkeleton({ mediaType }: { mediaType: string }) {
  const isImage = mediaType === 'image';
  const isAudio = mediaType === 'audio';
  return (
    <div className="my-2">
      {isImage ? (
        <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] w-[220px] h-[220px]">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className="relative">
              <div className="w-8 h-8 rounded-full border-2 border-white/[0.08] border-t-white/40 animate-spin" />
              <ImageIcon size={12} className="absolute inset-0 m-auto text-white/30" />
            </div>
            <span className="text-[10px] text-white/25">Generating image...</span>
          </div>
          <div className="absolute inset-0 animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.03) 50%, transparent 75%)', backgroundSize: '200% 100%' }} />
        </div>
      ) : isAudio ? (
        <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] w-[220px] px-3 py-4">
          <div className="flex items-center gap-2">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full border-2 border-white/[0.08] border-t-white/40 animate-spin" />
              <Mic size={10} className="absolute inset-0 m-auto text-white/30" />
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="h-1.5 w-16 rounded-full bg-white/[0.06] animate-pulse" />
              <div className="h-1 w-full rounded-full bg-white/[0.04]" />
            </div>
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] w-[280px] h-[158px]">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-white/[0.08] border-t-white/40 animate-spin" />
            <span className="text-[10px] text-white/25">Generating video...</span>
          </div>
          <div className="absolute inset-0 animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.03) 50%, transparent 75%)', backgroundSize: '200% 100%' }} />
        </div>
      )}
    </div>
  );
}

// ── Inline media renderer for agent studio chat ──
function StudioMedia({ item }: { item: MediaItem }) {
  const blobUrl = useMemo(() => {
    try {
      const bin = atob(item.data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: item.mimeType });
      return URL.createObjectURL(blob);
    } catch { return null; }
  }, [item.data, item.mimeType]);

  if (!blobUrl) return null;

  if (item.type === 'image') {
    return (
      <div className="my-1">
        <img src={blobUrl} alt="Generated" className="max-w-[260px] rounded-xl border border-white/[0.08]" />
        <a href={blobUrl} download="generated-image.png" className="flex items-center gap-1 mt-1 text-[9px] text-white/25 hover:text-white/50 transition-colors w-fit">
          <Download size={9} /> Download
        </a>
      </div>
    );
  }

  if (item.type === 'audio') {
    return (
      <div className="my-1">
        <audio controls src={blobUrl} className="max-w-[260px] h-8" style={{ filter: 'invert(1) brightness(0.7)' }} />
        <a href={blobUrl} download="generated-audio.wav" className="flex items-center gap-1 mt-1 text-[9px] text-white/25 hover:text-white/50 transition-colors w-fit">
          <Download size={9} /> Download
        </a>
      </div>
    );
  }

  if (item.type === 'video') {
    return (
      <div className="my-1">
        <video controls src={blobUrl} className="max-w-[280px] rounded-xl border border-white/[0.08]" />
        <a href={blobUrl} download="generated-video.mp4" className="flex items-center gap-1 mt-1 text-[9px] text-white/25 hover:text-white/50 transition-colors w-fit">
          <Download size={9} /> Download
        </a>
      </div>
    );
  }

  return null;
}

export function AgentStudio() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const { models, agents, setAgents, useOwnKeys, apiKeys } = useStore();

  const [form, setForm] = useState<StudioForm>({
    name: '',
    username: '',
    description: '',
    system_prompt: '',
    model_id: models[0]?.id || '',
    is_public: false,
    temperature: 0.7,
    top_p: 0.95,
    max_tokens: useOwnKeys ? 32768 : 4096,
    use_own_key: useOwnKeys,
    tts_voice: 'Kore',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [modelQuery, setModelQuery] = useState('');
  const [modelTypeFilter, setModelTypeFilter] = useState<string>('all');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [appliedPrompt, setAppliedPrompt] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editId) {
      const agent = agents.find((a) => a.id === editId);
      if (agent) {
        setForm((f) => ({
          ...f,
          name: agent.name,
          username: agent.username || '',
          description: agent.description || '',
          system_prompt: agent.system_prompt,
          model_id: agent.model.id,
          is_public: agent.is_public,
          temperature: agent.temperature ?? 0.7,
          top_p: agent.top_p ?? 0.95,
          max_tokens: agent.max_tokens ?? 4096,
          use_own_key: agent.use_own_key ?? false,
        }));
        setAppliedPrompt(agent.system_prompt);
      }
    }
  }, [editId, agents]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Persist chat history to localStorage
  const chatStorageKey = editId ? `enox_agentChat_${editId}` : `enox_agentChat_new_${form.model_id}`;
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  useEffect(() => {
    if (chatStorageKey) {
      localStorage.setItem(chatStorageKey, JSON.stringify(chatMessages));
    }
  }, [chatMessages, chatStorageKey]);

  // Restore chat history from localStorage on mount
  useEffect(() => {
    if (chatStorageKey) {
      try {
        const saved = localStorage.getItem(chatStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          setChatMessages(parsed);
          setChatHistory(parsed);
        }
      } catch {}
    }
  }, [chatStorageKey, form.model_id]);

  // Update history when messages change
  useEffect(() => {
    if (chatMessages.length > 0) {
      setChatHistory([...chatMessages]);
    }
  }, [chatMessages]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Reset height to auto to get the natural scrollHeight
    textarea.style.height = 'auto';
    
    // Calculate new height (minimum for 1 row, maximum for 3 rows)
    const scrollHeight = textarea.scrollHeight;
    const lineHeight = 20; // Approximate line height
    const minRows = 1;
    const maxRows = 3;
    
    const newHeight = Math.min(scrollHeight, maxRows * lineHeight);
    textarea.style.height = `${newHeight}px`;
  }, [chatInput]);

  const selectedModel = models.find((m) => m.id === form.model_id);
  const selectedModelType = selectedModel?.model_type || 'text';
  const filteredModels = models.filter((m) => {
    if (modelTypeFilter !== 'all' && (m.model_type || 'text') !== modelTypeFilter) return false;
    const q = modelQuery.toLowerCase().trim();
    if (!q) return true;
    return m.name.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q);
  });

  const update = (key: keyof StudioForm, value: StudioForm[keyof StudioForm]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  };

  const applyModel = (modelId: string) => {
    update('model_id', modelId);
    setModelModalOpen(false);
  };

  const handleSave = async () => {
    if (!form.name || !form.username || !form.system_prompt || !form.model_id) return;
    if (!/^[a-z0-9_]{3,30}$/.test(form.username)) {
      setUsernameError('3-30 chars, lowercase letters, numbers, underscores only');
      return;
    }
    setUsernameError('');
    setSaving(true);
    try {
      if (editId) {
        const updated = await agentsAPI.update(editId, {
          name: form.name,
          username: form.username,
          description: form.description,
          system_prompt: form.system_prompt,
          model_id: form.model_id,
          is_public: form.is_public,
          temperature: form.temperature,
          top_p: form.top_p,
          max_tokens: form.max_tokens,
          use_own_key: form.use_own_key,
        });
        setAgents(agents.map((a) => (a.id === editId ? updated : a)));
      } else {
        const agent = await agentsAPI.create({
          name: form.name,
          username: form.username,
          description: form.description,
          system_prompt: form.system_prompt,
          model_id: form.model_id,
          is_public: form.is_public,
          temperature: form.temperature,
          top_p: form.top_p,
          max_tokens: form.max_tokens,
          use_own_key: form.use_own_key,
        });
        setAgents([agent, ...agents]);
      }
      setSaved(true);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('Username already taken') || msg.includes('username') || msg.includes('409')) {
        setUsernameError('Username already taken — choose a different one');
      } else {
        setUsernameError('');
        console.error('Save agent error:', err);
        alert(msg || 'Failed to save agent');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeploy = async () => {
    if (!form.name || !form.username || !form.system_prompt || !form.model_id) return;
    if (!/^[a-z0-9_]{3,30}$/.test(form.username)) {
      setUsernameError('3-30 chars, lowercase letters, numbers, underscores only');
      return;
    }

    setUsernameError('');
    setSaving(true);

    try {
      const payload = {
        name: form.name,
        username: form.username,
        description: form.description,
        system_prompt: form.system_prompt,
        model_id: form.model_id,
        is_public: true,
        temperature: form.temperature,
        top_p: form.top_p,
        max_tokens: form.max_tokens,
        use_own_key: form.use_own_key,
      };

      const result = editId
        ? await agentsAPI.update(editId, payload)
        : await agentsAPI.create(payload);

      if (editId) {
        setAgents(agents.map((a) => (a.id === editId ? result : a)));
      } else {
        setAgents([result, ...agents]);
      }

      setForm((f) => ({ ...f, is_public: true }));
      setSaved(true);
      router.push('/agents');
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('Username already taken') || msg.includes('username') || msg.includes('409')) {
        setUsernameError('Username already taken — choose a different one');
      } else {
        setUsernameError('');
        console.error('Deploy agent error:', err);
        alert(msg || 'Failed to deploy agent');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleApplyPrompt = () => {
    setAppliedPrompt(form.system_prompt);
    setPromptModalOpen(false);
  };

  // Live chat with current agent settings
  const handleChatSend = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || streaming || !form.model_id) return;

    // Pre-validate API key availability
    const testModel = models.find(m => m.id === form.model_id);
    if (form.use_own_key && testModel) {
      const providerKey = apiKeys.find(k => k.provider === testModel.provider);
      if (!providerKey?.has_key) {
        const errMsg: ChatMsg = { id: crypto.randomUUID(), role: 'assistant', content: `No ${testModel.provider} API key found. Add your API key in Settings → API Keys.` };
        setChatMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content: trimmed }, errMsg]);
        setChatInput('');
        return;
      }
    }

    setChatInput('');
    setStreaming(true);

    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: 'user', content: trimmed };
    const assistantMsg: ChatMsg = { id: crypto.randomUUID(), role: 'assistant', content: '' };
    setChatMessages((prev) => [...prev, userMsg, assistantMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    // Build conversation history for context (excluding current user message - backend will add it)
    const conversationHistory = chatHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
    }));

    // Build the message payload — include all agent studio settings
    const messagePayload = {
      modelId: form.model_id,
      message: trimmed,
      useOwnKeys: form.use_own_key,
      conversationHistory,
      temperature: form.temperature,
      topP: form.top_p,
      maxTokens: form.max_tokens,
      ...(selectedModelType === 'tts' ? { ttsVoice: form.tts_voice } : {}),
    };

    // Add system prompt to conversation history if present
    if (form.system_prompt) {
      messagePayload.conversationHistory.unshift({
        role: 'system',
        content: form.system_prompt
      });
    }

    try {
      const response = await chatAPI.sendMessage(messagePayload);

      if (!response.ok) throw new Error('Request failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No reader');

      let mediaItems: MediaItem[] = [];
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
            if (parsed.type === 'generating') {
              setChatMessages((prev) => {
                const msgs = [...prev];
                const last = msgs[msgs.length - 1];
                if (last?.role === 'assistant') {
                  msgs[msgs.length - 1] = { ...last, isGenerating: parsed.mediaType || 'image' };
                }
                return msgs;
              });
            } else if (parsed.type === 'media') {
              const mediaType = parsed.mimeType?.startsWith('image/') ? 'image'
                : parsed.mimeType?.startsWith('audio/') ? 'audio'
                : parsed.mimeType?.startsWith('video/') ? 'video' : 'image';
              mediaItems.push({ type: mediaType, mimeType: parsed.mimeType, data: parsed.data });
              setChatMessages((prev) => {
                const msgs = [...prev];
                const last = msgs[msgs.length - 1];
                if (last?.role === 'assistant') {
                  msgs[msgs.length - 1] = { ...last, isGenerating: null, media: [...mediaItems] };
                }
                return msgs;
              });
            } else if (parsed.type === 'chunk') {
              setChatMessages((prev) => {
                const msgs = [...prev];
                const last = msgs[msgs.length - 1];
                if (last?.role === 'assistant') {
                  msgs[msgs.length - 1] = { ...last, content: last.content + parsed.content };
                }
                return msgs;
              });
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setChatMessages((prev) => {
          const msgs = [...prev];
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant') {
            msgs[msgs.length - 1] = { ...last, content: 'Error: ' + (err.message || 'Failed') };
          }
          return msgs;
        });
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
      // Ensure history is updated after streaming completes
      setChatHistory([...chatMessages]);
    }
  };

  const handleChatStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top bar */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/agents')} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-colors">
            <ArrowLeft size={14} className="text-white/50" />
          </button>
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-white/40" />
            <span className="text-sm font-medium text-white/80">{editId ? 'Edit Agent' : 'New Agent'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <button onClick={handleDeploy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-400/80 hover:bg-green-500/20 transition-all">
              <Rocket size={11} /> Deploy
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !form.name || !form.username || !form.system_prompt || !form.model_id}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-white text-black text-xs font-medium hover:bg-white/90 disabled:opacity-30 transition-all"
          >
            <Save size={11} />
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Studio layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left sidebar: config overlay */}
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <>
              <motion.button
                type="button"
                aria-label="Close studio editor"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                onClick={() => setSidebarOpen(false)}
                className="absolute inset-0 z-10 bg-black/20"
              />
              <motion.div
                initial={{ x: -24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -24, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="absolute left-0 top-0 bottom-0 z-20 w-[360px] max-w-[88vw] border-r border-white/[0.06] overflow-y-auto bg-[#090909]"
              >
          <div className="p-5 space-y-5">
            {/* Name */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/20 mb-1.5 block">Name</label>
              <input
                value={form.name}
                onChange={(e) => {
                  const val = e.target.value;
                  update('name', val);
                  // Auto-generate username from name if username is empty or was auto-generated
                  if (!editId && (!form.username || form.username === form.name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 30))) {
                    const slug = val.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 30);
                    setForm(f => ({ ...f, name: val, username: slug }));
                    setSaved(false);
                  }
                }}
                placeholder="Agent name..."
                className="w-full bg-[#141414] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-white/[0.12] transition-colors"
              />
            </div>

            {/* Username */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/20 mb-1.5 block flex items-center gap-1">
                <AtSign size={9} /> Username
              </label>
              <div className="flex items-center bg-[#141414] border border-white/[0.08] rounded-lg overflow-hidden focus-within:border-white/[0.12] transition-colors">
                <span className="pl-3 text-sm text-white/20 select-none">/</span>
                <input
                  value={form.username}
                  onChange={(e) => {
                    const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30);
                    update('username', val);
                    setUsernameError('');
                  }}
                  placeholder="my_agent"
                  className="w-full bg-transparent px-1 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none"
                />
              </div>
              {usernameError && (
                <p className="text-[9px] text-red-400/70 mt-1">{usernameError}</p>
              )}
              {form.username && !usernameError && (
                <p className="text-[9px] text-white/15 mt-1">enox.ai/{form.username}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/20 mb-1.5 block">Bio</label>
              <textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="What does this agent do?..."
                rows={2}
                className="w-full bg-[#141414] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/60 placeholder:text-white/20 outline-none focus:border-white/[0.12] resize-none transition-colors"
              />
            </div>

            {/* System Instructions */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Type size={10} className="text-white/25" />
                <span className="text-[10px] uppercase tracking-wider text-white/20">System Instructions</span>
              </div>
              <button
                onClick={() => setPromptModalOpen(true)}
                className="w-full text-left rounded-lg border border-white/[0.06] bg-[#141414] px-3 py-2.5 hover:bg-[#1a1a1a] transition-colors"
              >
                {form.system_prompt ? (
                  <p className="text-[11px] text-white/40 line-clamp-2">{form.system_prompt}</p>
                ) : (
                  <p className="text-[11px] text-white/15">Click to add system prompt...</p>
                )}
              </button>
              {appliedPrompt && (
                <div className="flex items-center gap-1 mt-1">
                  <CheckCircle2 size={8} className="text-green-400/50" />
                  <span className="text-[8px] text-green-400/40">Prompt applied to live chat</span>
                </div>
              )}
            </div>

            {/* Model */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Cpu size={10} className="text-white/25" />
                <span className="text-[10px] uppercase tracking-wider text-white/20">Model</span>
              </div>
              <button
                onClick={() => setModelModalOpen(true)}
                className="w-full rounded-lg border border-white/[0.06] bg-[#141414] px-3 py-2.5 text-left hover:bg-[#1a1a1a] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className={cn('h-2 w-2 rounded-full shrink-0', selectedModel ? PROVIDER_DOTS[selectedModel.provider] || 'bg-white/30' : 'bg-white/20')} />
                  <span className="text-[11px] text-white/70 truncate">{selectedModel?.name || 'Choose model'}</span>
                  {selectedModel && TYPE_BADGES[selectedModel.model_type] && (
                    <span className={cn('text-[8px] px-1 rounded font-medium ml-auto', TYPE_BADGES[selectedModel.model_type].cls)}>
                      {TYPE_BADGES[selectedModel.model_type].label}
                    </span>
                  )}
                </div>
              </button>
            </div>

            {/* TTS Voice — only for TTS models */}
            {selectedModelType === 'tts' && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Volume2 size={10} className="text-emerald-400/50" />
                  <span className="text-[10px] uppercase tracking-wider text-white/20">Voice</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TTS_VOICES.map(v => (
                    <button
                      key={v}
                      onClick={() => update('tts_voice', v)}
                      className={cn(
                        'px-2.5 py-1.5 rounded-lg text-[10px] font-medium border transition-all',
                        form.tts_voice === v
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400/80'
                          : 'border-white/[0.06] bg-white/[0.02] text-white/30 hover:text-white/50'
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Model type info */}
            {selectedModelType !== 'text' && (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <p className="text-[9px] text-white/25">
                  {selectedModelType === 'tts' ? 'This model generates speech audio from text input.'
                    : selectedModelType === 'image' ? 'This model generates images from text prompts.'
                    : 'This model generates video from text prompts.'}
                </p>
              </div>
            )}

            {/* API Key mode toggle — controls testing mode */}
            <div>
              <span className="text-[10px] uppercase tracking-wider text-white/20 mb-1 block">Testing API Key</span>
              <p className="text-[8px] text-white/15 mb-2">Choose how to test your agent in the live preview</p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => update('use_own_key', false)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-[10px] transition-all',
                    !form.use_own_key ? 'border-white/[0.1] bg-white/[0.06] text-white/70' : 'border-white/[0.04] bg-white/[0.02] text-white/25 hover:text-white/40'
                  )}
                >
                  <Building2 size={10} /> Platform
                </button>
                <button
                  onClick={() => update('use_own_key', true)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-[10px] transition-all',
                    form.use_own_key ? 'border-white/[0.1] bg-white/[0.06] text-white/70' : 'border-white/[0.04] bg-white/[0.02] text-white/25 hover:text-white/40'
                  )}
                >
                  <Key size={10} /> Own Key
                </button>
              </div>
              <p className="text-[8px] text-white/15 mt-1.5">
                {form.use_own_key
                  ? 'Testing with your own API key — no platform quota used.'
                  : 'Testing with platform quota. If unsupported, use your own key.'}
              </p>
            </div>

            {/* Parameters */}
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <SlidersHorizontal size={10} className="text-white/25" />
                <span className="text-[10px] uppercase tracking-wider text-white/20">Parameters</span>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] text-white/30 flex items-center gap-1"><Thermometer size={9} /> Temperature</span>
                    <span className="text-[10px] text-white/40 font-mono">{form.temperature.toFixed(2)}</span>
                  </div>
                  <input type="range" min="0" max="2" step="0.05" value={form.temperature} onChange={(e) => update('temperature', parseFloat(e.target.value))} className="w-full h-1 bg-white/[0.06] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white/50" />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] text-white/30">Top P</span>
                    <span className="text-[10px] text-white/40 font-mono">{form.top_p.toFixed(2)}</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.05" value={form.top_p} onChange={(e) => update('top_p', parseFloat(e.target.value))} className="w-full h-1 bg-white/[0.06] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white/50" />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] text-white/30 flex items-center gap-1"><Hash size={9} /> Max Tokens</span>
                    <span className="text-[10px] text-white/40 font-mono">{form.max_tokens.toLocaleString()}</span>
                  </div>
                  <input type="range" min="256" max={form.use_own_key ? '131072' : '10000'} step={form.use_own_key ? '1024' : '256'} value={form.max_tokens} onChange={(e) => update('max_tokens', parseInt(e.target.value))} className="w-full h-1 bg-white/[0.06] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white/50" />
                  <p className="text-[8px] text-white/15 mt-0.5">{form.use_own_key ? 'Own key: up to 128k' : 'Platform max: 10,000'}</p>
                </div>
              </div>
            </div>

            {/* Chat History */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-white/20">Chat History</span>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-[9px] text-white/30 hover:text-white/50 transition-colors"
                >
                  {showHistory ? 'Hide' : 'Show'}
                </button>
              </div>
              {showHistory && (
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {chatHistory.length === 0 ? (
                    <p className="text-[9px] text-white/15 text-center py-4">No chat history yet</p>
                  ) : (
                    chatHistory.map((msg, idx) => (
                      <div key={idx} className={cn(
                        'text-[10px] p-2 rounded-lg border',
                        msg.role === 'user' 
                          ? 'border-white/[0.04] bg-white/[0.02] text-white/60' 
                          : 'border-white/[0.06] bg-white/[0.01] text-white/40'
                      )}>
                        <div className="font-medium mb-1 opacity-70">
                          {msg.role === 'user' ? 'You' : 'Assistant'}
                        </div>
                        <div className="line-clamp-3 break-words">
                          {msg.content || (msg.media ? `[${msg.media.map(m => m.type).join(', ')} generated]` : '...')}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Visibility */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                {form.is_public ? <Globe size={10} className="text-green-400/50" /> : <Lock size={10} className="text-white/25" />}
                <span className="text-[10px] uppercase tracking-wider text-white/20">Visibility</span>
              </div>
              <button
                onClick={() => update('is_public', !form.is_public)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all',
                  form.is_public ? 'border-green-500/20 bg-green-500/5 text-green-400/70' : 'border-white/[0.06] bg-white/[0.02] text-white/35'
                )}
              >
                <span className="text-[11px]">{form.is_public ? 'Public' : 'Private'}</span>
                <div className={cn('h-4 w-8 rounded-full relative transition-colors', form.is_public ? 'bg-green-500/30' : 'bg-white/10')}>
                  <div className={cn('h-3 w-3 rounded-full bg-white absolute top-[2px] transition-transform', form.is_public ? 'translate-x-[14px]' : 'translate-x-[2px]')} />
                </div>
              </button>
            </div>
          </div>
            </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Right: Live chat area */}
        <div
          className="flex-1 flex flex-col min-w-0"
          onClick={() => {
            if (sidebarOpen) setSidebarOpen(false);
          }}
        >
          {/* Chat header */}
          <div className="h-10 flex items-center justify-between px-4 border-b border-white/[0.04] shrink-0">
            <div className="flex items-center gap-2">
              <EnoxLogo className="w-3 h-3 text-white/25" />
              <span className="text-[11px] text-white/30">Live Preview</span>
              {selectedModel && (
                <span className="text-[9px] text-white/15 px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.04]">{selectedModel.name}</span>
              )}
            </div>
            {chatMessages.length > 0 && (
              <button onClick={() => { setChatMessages([]); }} className="flex items-center gap-1 text-[10px] text-white/20 hover:text-white/40 transition-colors">
                <Trash2 size={10} /> Clear
              </button>
            )}
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <EnoxLogo className="w-6 h-6 text-white/10" />
                <p className="text-xs text-white/20 text-center max-w-xs">
                  Test your agent here. Configure settings on the left, then send a message to see how your agent responds.
                </p>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto space-y-4">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
                      msg.role === 'user'
                        ? 'bg-white/[0.08] text-white/80'
                        : 'bg-white/[0.03] text-white/60'
                    )}>
                      {/* Generating skeleton */}
                      {msg.isGenerating && (
                        <StudioSkeleton mediaType={msg.isGenerating} />
                      )}
                      {/* Rendered media */}
                      {msg.media && msg.media.length > 0 && (
                        <div className="space-y-2 mb-2">
                          {msg.media.map((item, idx) => (
                            <StudioMedia key={idx} item={item} />
                          ))}
                        </div>
                      )}
                      {/* Text content or loading dots */}
                      {msg.role === 'assistant' && !msg.content && !msg.media?.length && !msg.isGenerating && streaming ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 bg-white/20 rounded-full animate-bounce" />
                          <div className="w-1.5 h-1.5 bg-white/20 rounded-full animate-bounce [animation-delay:0.1s]" />
                          <div className="w-1.5 h-1.5 bg-white/20 rounded-full animate-bounce [animation-delay:0.2s]" />
                        </div>
                      ) : msg.content ? (
                        <div className="prose prose-invert prose-sm max-w-none break-words [overflow-wrap:anywhere] [&_*]:max-w-full [&_p]:leading-relaxed [&_p]:break-words [&_p]:[overflow-wrap:anywhere] [&_li]:break-words [&_li]:[overflow-wrap:anywhere] [&_ol]:break-words [&_ul]:break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:whitespace-pre [&_code]:break-words">
                          <ReactMarkdown
                            components={{
                              h1: ({ children }) => <h1 className="mb-4 mt-1 text-2xl font-semibold tracking-tight text-white/95">{children}</h1>,
                              h2: ({ children }) => <h2 className="mb-3 mt-5 text-xl font-semibold tracking-tight text-white/92">{children}</h2>,
                              h3: ({ children }) => <h3 className="mb-2 mt-4 text-base font-semibold tracking-tight text-white/90">{children}</h3>,
                              p: ({ children }) => <p className="my-3 leading-7 text-white/82 break-words [overflow-wrap:anywhere]">{children}</p>,
                              ul: ({ children }) => <ul className="my-3 space-y-2 pl-1">{children}</ul>,
                              ol: ({ children }) => <ol className="my-3 space-y-2 pl-1">{children}</ol>,
                              li: ({ children }) => (
                                <li className="flex items-start gap-2 text-white/80 break-words [overflow-wrap:anywhere]">
                                  <span className="mt-[7px] flex h-1.5 w-1.5 shrink-0 rounded-full bg-white/30" />
                                  <span className="min-w-0 flex-1 leading-7">{children}</span>
                                </li>
                              ),
                              blockquote: ({ children }) => (
                                <blockquote className="my-4 rounded-r-2xl rounded-l-md border-l-2 border-white/15 bg-white/[0.03] px-4 py-3 text-white/72">
                                  {children}
                                </blockquote>
                              ),
                              hr: () => <div className="my-5 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />,
                              table: ({ children }) => (
                                <div className="my-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
                                  <div className="overflow-x-auto">
                                    <table className="w-full min-w-[420px] border-collapse text-left text-sm">{children}</table>
                                  </div>
                                </div>
                              ),
                              thead: ({ children }) => <thead className="bg-white/[0.04]">{children}</thead>,
                              tbody: ({ children }) => <tbody>{children}</tbody>,
                              tr: ({ children }) => <tr className="border-t border-white/[0.06]">{children}</tr>,
                              th: ({ children }) => <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">{children}</th>,
                              td: ({ children }) => <td className="px-4 py-3 align-top text-white/78 break-words [overflow-wrap:anywhere]">{children}</td>,
                              code: ({ node, inline, className, children, ...props }: any) => {
                const match = /language-(\w+)/.exec(className || '');
                return !inline ? (
                  <pre className="my-3 rounded-lg bg-[#0a0a0a] border border-white/[0.06] p-3 overflow-x-auto">
                    <code className={className + ' text-[11px] font-mono text-white/80'} {...props}>
                      {children}
                    </code>
                  </pre>
                ) : (
                  <code className="px-1 py-0.5 rounded bg-white/[0.1] text-[11px] font-mono text-white/90" {...props}>
                    {children}
                  </code>
                );
              },
                              strong: ({ children }) => <strong className="font-semibold text-white/95">{children}</strong>,
                              em: ({ children }) => <em className="italic text-white/80">{children}</em>,
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {/* Chat input */}
          <div className="p-3 border-t border-white/[0.06] shrink-0">
            <div className="max-w-2xl mx-auto flex items-end gap-2">
              <div className="flex-1 bg-[#1a1a1a] border border-white/[0.08] rounded-xl px-3 py-2">
                <textarea
                  ref={textareaRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                  placeholder="Test your agent..."
                  rows={1}
                  disabled={streaming}
                  className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/20 outline-none resize-none disabled:opacity-50 scrollbar-thin"
                  style={{ minHeight: '20px', maxHeight: '60px' }}
                />
              </div>
              {streaming ? (
                <button onClick={handleChatStop} className="p-2 rounded-xl bg-white/10 text-white/60 hover:bg-white/20 transition-all shrink-0"><Square size={14} /></button>
              ) : (
                <button onClick={handleChatSend} disabled={!chatInput.trim() || !form.model_id} className={cn('p-2 rounded-xl transition-all shrink-0', chatInput.trim() && form.model_id ? 'bg-white text-black hover:bg-white/90' : 'bg-white/5 text-white/20')}><Send size={14} /></button>
              )}
            </div>
          </div>
        </div>

        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex items-center gap-3 rounded-full border border-white/[0.10] bg-black/85 backdrop-blur px-4 py-3 hover:bg-[#141414] transition-colors shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
            title="Open studio editor"
          >
            <EnoxLogo className="w-4.5 h-4.5 text-white/70" />
            <span className="text-xs text-white/55">Edit AI</span>
            <ChevronLeft size={14} className="text-white/50" />
          </button>
        )}
      </div>

      {/* System Prompt Modal */}
      <AnimatePresence>
        {promptModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setPromptModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl mx-4 rounded-2xl border border-white/[0.08] bg-[#0a0a0a] overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Type size={14} className="text-white/40" />
                  <span className="text-sm font-medium text-white/80">System Instructions</span>
                </div>
                <button onClick={() => setPromptModalOpen(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors">
                  <X size={14} className="text-white/40" />
                </button>
              </div>
              <div className="p-5">
                <textarea
                  value={form.system_prompt}
                  onChange={(e) => update('system_prompt', e.target.value)}
                  placeholder="You are a helpful assistant that specializes in..."
                  rows={12}
                  className="w-full bg-[#141414] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-white/[0.1] resize-none font-mono leading-relaxed transition-colors"
                  autoFocus
                />
                <p className="text-[10px] text-white/20 mt-2">This tells the AI how to behave. Click &quot;Apply &amp; Close&quot; to use it in the live chat.</p>
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/[0.06]">
                <button
                  onClick={() => setPromptModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyPrompt}
                  disabled={!form.system_prompt.trim()}
                  className="px-4 py-2 rounded-lg bg-white text-black text-xs font-medium hover:bg-white/90 disabled:opacity-30 transition-all"
                >
                  Apply &amp; Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modelModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setModelModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl mx-4 rounded-2xl border border-white/[0.08] bg-[#0a0a0a] overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Cpu size={14} className="text-white/40" />
                  <span className="text-sm font-medium text-white/80">Choose Model</span>
                </div>
                <button onClick={() => setModelModalOpen(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors">
                  <X size={14} className="text-white/40" />
                </button>
              </div>
              <div className="p-5 border-b border-white/[0.06]">
                <div className="flex items-center gap-2 rounded-xl bg-[#141414] border border-white/[0.06] px-3 py-2.5">
                  <Search size={14} className="text-white/30" />
                  <input
                    value={modelQuery}
                    onChange={(e) => setModelQuery(e.target.value)}
                    placeholder="Search models..."
                    className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/20 outline-none"
                    autoFocus
                  />
                </div>
              </div>
              {/* Type filter tabs */}
              <div className="flex items-center gap-1 px-4 pt-3 pb-1">
                {['all', 'text', 'image', 'tts', 'video'].map(t => {
                  const count = t === 'all' ? models.length : models.filter(m => (m.model_type || 'text') === t).length;
                  if (count === 0 && t !== 'all') return null;
                  return (
                    <button
                      key={t}
                      onClick={() => setModelTypeFilter(t)}
                      className={cn(
                        'px-2 py-1 rounded-md text-[10px] font-medium transition-all capitalize',
                        modelTypeFilter === t ? 'bg-white/[0.1] text-white/80' : 'text-white/30 hover:text-white/50'
                      )}
                    >
                      {t === 'tts' ? 'TTS' : t}
                    </button>
                  );
                })}
              </div>
              <div className="max-h-[380px] overflow-y-auto p-4 space-y-2">
                {filteredModels.map((m) => {
                  const badge = TYPE_BADGES[m.model_type || ''];
                  return (
                  <button
                    key={m.id}
                    onClick={() => applyModel(m.id)}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-all',
                      form.model_id === m.id
                        ? 'border-white/[0.12] bg-white/[0.06] text-white/90'
                        : 'border-white/[0.04] bg-white/[0.02] text-white/40 hover:bg-white/[0.04] hover:text-white/70'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn('h-2 w-2 rounded-full shrink-0', PROVIDER_DOTS[m.provider] || 'bg-white/30')} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm truncate">{m.name}</p>
                          {badge && <span className={cn('text-[8px] px-1 rounded font-medium', badge.cls)}>{badge.label}</span>}
                        </div>
                        <p className="text-[10px] text-white/25 uppercase">{m.provider}</p>
                      </div>
                    </div>
                    {form.model_id === m.id && <CheckCircle2 size={14} className="text-green-400/70 shrink-0" />}
                  </button>
                  );
                })}
                {filteredModels.length === 0 && (
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4 text-center text-sm text-white/30">
                    No models found
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

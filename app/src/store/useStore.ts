import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: string;
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  model_id: string;
  daily_limit: number;
  max_tokens: number;
  is_active: boolean;
}

export interface Agent {
  id: string;
  name: string;
  username?: string | null;
  description: string | null;
  system_prompt: string;
  is_public: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  use_own_key?: boolean;
  model: Pick<Model, 'id' | 'name' | 'provider'>;
  user_id?: string;
  creator?: { name: string; avatar_url: string | null } | null;
  created_at: string;
  updated_at: string;
}

export interface Chat {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  model: Pick<Model, 'id' | 'name' | 'provider'>;
  agent: Pick<Agent, 'id' | 'name' | 'username'> | null;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface UsageInfo {
  model: Pick<Model, 'id' | 'name' | 'provider' | 'daily_limit'>;
  used: number;
  total_used?: number;
  own_key_used: number;
  platform_used: number;
  limit: number;
  remaining: number;
}

export type AppView = 'chat' | 'agents' | 'explore' | 'settings' | 'privacy' | 'terms' | 'usage';

interface AppState {
  // Auth
  user: User | null;
  setUser: (user: User | null) => void;

  // Models
  models: Model[];
  setModels: (models: Model[]) => void;
  selectedModelId: string | null;
  setSelectedModelId: (id: string | null) => void;

  // Agents
  agents: Agent[];
  setAgents: (agents: Agent[]) => void;
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;

  // Chat
  chats: Chat[];
  setChats: (chats: Chat[]) => void;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateLastAssistantMessage: (content: string) => void;
  replaceLastAssistantContent: (fullContent: string) => void;
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;

  // Preloaded data
  usage: UsageInfo[];
  setUsage: (usage: UsageInfo[]) => void;
  apiKeys: { provider: string; has_key: boolean; api_key: string; updated_at: string | null }[];
  setApiKeys: (keys: { provider: string; has_key: boolean; api_key: string; updated_at: string | null }[]) => void;

  // UI
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  activeView: AppView;
  setActiveView: (view: AppView) => void;

  // Preferences
  useOwnKeys: boolean;
  setUseOwnKeys: (val: boolean) => void;

  // Model favorites
  pinnedModelIds: string[];
  setPinnedModelIds: (ids: string[]) => void;
  recentModelId: string | null;
  setRecentModelId: (id: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  // Auth
  user: null,
  setUser: (user) => set({ user }),

  // Models
  models: [],
  setModels: (models) => set({ models }),
  selectedModelId: null,
  setSelectedModelId: (selectedModelId) => set({ selectedModelId }),

  // Agents
  agents: [],
  setAgents: (agents) => set({ agents }),
  selectedAgentId: null,
  setSelectedAgentId: (selectedAgentId) => set({ selectedAgentId }),

  // Chat
  chats: [],
  setChats: (chats) => set({ chats }),
  activeChatId: null,
  setActiveChatId: (activeChatId) => set({ activeChatId }),
  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  updateLastAssistantMessage: (content) =>
    set((state) => {
      const msgs = [...state.messages];
      const lastIdx = msgs.length - 1;
      if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant') {
        msgs[lastIdx] = { ...msgs[lastIdx], content: msgs[lastIdx].content + content };
      }
      return { messages: msgs };
    }),
  replaceLastAssistantContent: (fullContent) =>
    set((state) => {
      const lastIdx = state.messages.length - 1;
      if (lastIdx >= 0 && state.messages[lastIdx].role === 'assistant' && state.messages[lastIdx].content !== fullContent) {
        const msgs = state.messages.slice();
        msgs[lastIdx] = { ...msgs[lastIdx], content: fullContent };
        return { messages: msgs };
      }
      return state;
    }),
  isStreaming: false,
  setIsStreaming: (isStreaming) => set({ isStreaming }),

  // Preloaded data
  usage: [],
  setUsage: (usage) => set({ usage }),
  apiKeys: [],
  setApiKeys: (apiKeys) => set({ apiKeys }),

  // UI
  sidebarOpen: true,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  activeView: 'chat',
  setActiveView: (activeView) => set({ activeView }),

  // Preferences — load from localStorage
  useOwnKeys: typeof window !== 'undefined' && localStorage.getItem('enox_useOwnKeys') === 'true',
  setUseOwnKeys: (useOwnKeys) => {
    if (typeof window !== 'undefined') localStorage.setItem('enox_useOwnKeys', String(useOwnKeys));
    set({ useOwnKeys });
  },

  // Model favorites — load from localStorage
  pinnedModelIds: typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('enox_pinnedModels') || '[]')
    : [],
  setPinnedModelIds: (pinnedModelIds) => {
    if (typeof window !== 'undefined') localStorage.setItem('enox_pinnedModels', JSON.stringify(pinnedModelIds));
    set({ pinnedModelIds });
  },
  recentModelId: typeof window !== 'undefined'
    ? localStorage.getItem('enox_recentModel') || null
    : null,
  setRecentModelId: (recentModelId) => {
    if (typeof window !== 'undefined') {
      if (recentModelId) localStorage.setItem('enox_recentModel', recentModelId);
      else localStorage.removeItem('enox_recentModel');
    }
    set({ recentModelId });
  },
}));

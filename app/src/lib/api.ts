import { supabase } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Cache auth headers to avoid getSession() on every request (~50-150ms saved)
let _cachedHeaders: { headers: Record<string, string>; ts: number } | null = null;
const AUTH_CACHE_TTL = 30_000; // 30 seconds

async function getAuthHeaders() {
  if (_cachedHeaders && Date.now() - _cachedHeaders.ts < AUTH_CACHE_TTL) {
    return _cachedHeaders.headers;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  const headers = {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
  _cachedHeaders = { headers, ts: Date.now() };
  return headers;
}

// Pre-seed auth cache from an existing token (avoids redundant getSession calls)
export function seedAuthCache(accessToken: string) {
  _cachedHeaders = {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    ts: Date.now(),
  };
}

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return res.json();
}

// Chat API
export const chatAPI = {
  sendMessage: async (body: {
    chatId?: string;
    modelId: string;
    agentId?: string | null;
    message: string;
    useOwnKeys?: boolean;
  }) => {
    const headers = await getAuthHeaders();
    return fetch(`${API_URL}/api/chat/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  },

  getHistory: (offset = 0, limit = 50) => fetchAPI(`/api/chat/history?offset=${offset}&limit=${limit}`),

  renameChat: (chatId: string, title: string) =>
    fetchAPI(`/api/chat/${chatId}`, { method: 'PATCH', body: JSON.stringify({ title }) }),

  getMessages: (chatId: string, offset = 0, limit = 20) =>
    fetchAPI(`/api/chat/${chatId}/messages?offset=${offset}&limit=${limit}`),

  deleteChat: (chatId: string) => fetchAPI(`/api/chat/${chatId}`, { method: 'DELETE' }),

  regenerate: async (chatId: string, body?: { useOwnKeys?: boolean }) => {
    const headers = await getAuthHeaders();
    return fetch(`${API_URL}/api/chat/${chatId}/regenerate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body || {}),
    });
  },
};

// Models API
export const modelsAPI = {
  list: () => fetchAPI('/api/models'),
  getUsage: (modelId: string) => fetchAPI(`/api/models/${modelId}/usage`),
};

// Agents API
export const agentsAPI = {
  list: () => fetchAPI('/api/agents'),
  get: (id: string) => fetchAPI(`/api/agents/${id}`),
  create: (body: {
    name: string;
    username: string;
    description?: string;
    system_prompt: string;
    model_id: string;
    is_public?: boolean;
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    use_own_key?: boolean;
  }) => fetchAPI('/api/agents', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Record<string, unknown>) =>
    fetchAPI(`/api/agents/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id: string) => fetchAPI(`/api/agents/${id}`, { method: 'DELETE' }),
  listPublic: async () => {
    const res = await fetch(`${API_URL}/api/agents/public`);
    if (!res.ok) throw new Error('Failed to fetch public agents');
    return res.json();
  },
  getPublic: async (id: string) => {
    const res = await fetch(`${API_URL}/api/agents/public/${id}`);
    if (!res.ok) throw new Error('Agent not found');
    return res.json();
  },
  getByUsername: async (username: string) => {
    const res = await fetch(`${API_URL}/api/agents/public/u/${username}`);
    if (!res.ok) throw new Error('Agent not found');
    return res.json();
  },
};

// Users API
export const usersAPI = {
  getMe: () => fetchAPI('/api/users/me'),
  updateMe: (body: { name?: string }) =>
    fetchAPI('/api/users/me', { method: 'PATCH', body: JSON.stringify(body) }),
  getUsage: () => fetchAPI('/api/users/me/usage'),
  getApiKeys: () => fetchAPI('/api/users/me/api-keys'),
  updateApiKeys: (body: { keys: { provider: string; api_key: string }[] }) =>
    fetchAPI('/api/users/me/api-keys', { method: 'PUT', body: JSON.stringify(body) }),
};

import { supabase } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
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

export const adminAPI = {
  // Stats
  getStats: () => fetchAPI('/api/admin/stats'),

  // Models
  getModels: () => fetchAPI('/api/admin/models'),
  createModel: (body: {
    name: string;
    provider: string;
    model_id: string;
    api_key: string;
    daily_limit: number;
    is_active?: boolean;
  }) => fetchAPI('/api/admin/models', { method: 'POST', body: JSON.stringify(body) }),
  updateModel: (id: string, body: Record<string, unknown>) =>
    fetchAPI(`/api/admin/models/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteModel: (id: string) =>
    fetchAPI(`/api/admin/models/${id}`, { method: 'DELETE' }),

  // Users
  getUsers: () => fetchAPI('/api/admin/users'),
  updateUser: (id: string, body: Record<string, unknown>) =>
    fetchAPI(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getUserModelLimits: (id: string) =>
    fetchAPI(`/api/admin/users/${id}/model-limits`),
  updateUserModelLimits: (id: string, body: {
    limits: { model_id: string; daily_limit: number }[];
  }) => fetchAPI(`/api/admin/users/${id}/model-limits`, { method: 'PUT', body: JSON.stringify(body) }),

  // Usage
  getUsage: (date?: string) =>
    fetchAPI(`/api/admin/usage${date ? `?date=${date}` : ''}`),
};

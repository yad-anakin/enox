'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { adminAPI } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Cpu, Users, BarChart3, LogOut, Plus,
  Pencil, Trash2, X, Shield, Activity,
} from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: string;
}

interface AdminModel {
  id: string;
  name: string;
  provider: string;
  model_id: string;
  api_key: string;
  daily_limit: number;
  is_active: boolean;
  created_at: string;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: string;
  created_at: string;
}

interface UsageLog {
  id: string;
  message_count: number;
  date: string;
  user: { id: string; name: string; email: string; avatar_url: string | null };
  model: { id: string; name: string; provider: string };
}

interface UserModelLimit {
  model_id: string;
  model_name: string;
  provider: string;
  is_active: boolean;
  default_limit: number;
  custom_limit: number | null;
  effective_limit: number;
}

interface Stats {
  totalUsers: number;
  activeModels: number;
  totalAgents: number;
  monthlyRequests: number;
}

type Tab = 'dashboard' | 'models' | 'users' | 'usage';

export default function AdminPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // Data
  const [stats, setStats] = useState<Stats | null>(null);
  const [models, setModels] = useState<AdminModel[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);

  // Model form
  const [showModelForm, setShowModelForm] = useState(false);
  const [editingModel, setEditingModel] = useState<AdminModel | null>(null);
  const [modelForm, setModelForm] = useState({
    name: '', provider: 'openai', model_id: '', api_key: '', daily_limit: 25, is_active: true,
  });
  const [formLoading, setFormLoading] = useState(false);
  const [showUserLimitsModal, setShowUserLimitsModal] = useState(false);
  const [selectedUserForLimits, setSelectedUserForLimits] = useState<AdminUser | null>(null);
  const [userModelLimits, setUserModelLimits] = useState<UserModelLimit[]>([]);
  const [limitsLoading, setLimitsLoading] = useState(false);
  const [quickLimitValue, setQuickLimitValue] = useState('');

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setLoading(false); return; }

      try {
        const headers = {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        };
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${API_URL}/api/users/me`, { headers });
        const profile = await res.json();

        if (profile.role !== 'admin') {
          setUser(null);
          setLoading(false);
          return;
        }

        setUser(profile);
        await loadAllData();
      } catch (err) {
        console.error('Admin init error:', err);
      }
      setLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadAllData = async () => {
    try {
      const [s, m, u, usage] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getModels(),
        adminAPI.getUsers(),
        adminAPI.getUsage(),
      ]);
      setStats(s);
      setModels(m);
      setUsers(u);
      setUsageLogs(usage);
    } catch (err) {
      console.error('Load data error:', err);
    }
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  // Model CRUD
  const resetModelForm = () => {
    setModelForm({ name: '', provider: 'openai', model_id: '', api_key: '', daily_limit: 25, is_active: true });
    setShowModelForm(false);
    setEditingModel(null);
  };

  const handleCreateModel = async () => {
    setFormLoading(true);
    try {
      const created = await adminAPI.createModel(modelForm);
      setModels([created, ...models]);
      resetModelForm();
    } catch (err) {
      console.error('Create model error:', err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateModel = async () => {
    if (!editingModel) return;
    setFormLoading(true);
    try {
      const updated = await adminAPI.updateModel(editingModel.id, modelForm);
      setModels(models.map(m => m.id === editingModel.id ? updated : m));
      resetModelForm();
    } catch (err) {
      console.error('Update model error:', err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteModel = async (id: string) => {
    if (!confirm('Delete this model?')) return;
    try {
      await adminAPI.deleteModel(id);
      setModels(models.filter(m => m.id !== id));
    } catch (err) {
      console.error('Delete model error:', err);
    }
  };

  const openEditModel = (model: AdminModel) => {
    setEditingModel(model);
    setModelForm({
      name: model.name,
      provider: model.provider,
      model_id: model.model_id,
      api_key: '',
      daily_limit: model.daily_limit,
      is_active: model.is_active,
    });
    setShowModelForm(true);
  };

  const handleUpdateUserRole = async (userId: string, role: string) => {
    try {
      const updated = await adminAPI.updateUser(userId, { role });
      setUsers(users.map(u => u.id === userId ? { ...u, ...updated } : u));
    } catch (err) {
      console.error('Update user error:', err);
    }
  };

  const openUserLimitsModal = async (targetUser: AdminUser) => {
    setSelectedUserForLimits(targetUser);
    setShowUserLimitsModal(true);
    setLimitsLoading(true);
    setQuickLimitValue('');
    try {
      const data = await adminAPI.getUserModelLimits(targetUser.id);
      setUserModelLimits(data);
    } catch (err) {
      console.error('Load user model limits error:', err);
    } finally {
      setLimitsLoading(false);
    }
  };

  const closeUserLimitsModal = () => {
    setShowUserLimitsModal(false);
    setSelectedUserForLimits(null);
    setUserModelLimits([]);
    setQuickLimitValue('');
    setLimitsLoading(false);
  };

  const handleUserLimitChange = (modelId: string, value: string) => {
    setUserModelLimits((current) => current.map((item) => {
      if (item.model_id !== modelId) return item;
      const parsed = parseInt(value, 10);
      const customLimit = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      return {
        ...item,
        custom_limit: customLimit,
        effective_limit: customLimit ?? item.default_limit,
      };
    }));
  };

  const applyQuickLimitToAll = (value: number) => {
    setUserModelLimits((current) => current.map((item) => ({
      ...item,
      custom_limit: value,
      effective_limit: value,
    })));
  };

  const handleSaveUserLimits = async () => {
    if (!selectedUserForLimits) return;
    setLimitsLoading(true);
    try {
      const limits = userModelLimits
        .filter((item) => item.custom_limit && item.custom_limit > 0)
        .map((item) => ({ model_id: item.model_id, daily_limit: item.custom_limit as number }));

      await adminAPI.updateUserModelLimits(selectedUserForLimits.id, { limits });
      const refreshed = await adminAPI.getUserModelLimits(selectedUserForLimits.id);
      setUserModelLimits(refreshed);
    } catch (err) {
      console.error('Save user model limits error:', err);
    } finally {
      setLimitsLoading(false);
    }
  };

  // Loading / login
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="flex items-center gap-2">
            <Shield size={24} className="text-white/60" />
            <h1 className="text-2xl font-semibold">Enox Admin</h1>
          </div>
          <p className="text-sm text-white/40">Admin access required. Sign in with an admin account.</p>
          <button
            onClick={handleGoogleLogin}
            className="flex items-center gap-3 px-6 py-3 rounded-xl bg-white text-black font-medium text-sm hover:bg-white/90 transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>
        </motion.div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'models', label: 'Models', icon: Cpu },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'usage', label: 'Usage', icon: BarChart3 },
  ];

  return (
    <div className="h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 glass-strong border-r border-white/[0.06] flex flex-col">
        <div className="p-5 flex items-center gap-2">
          <Shield size={20} className="text-white/60" />
          <span className="text-sm font-semibold">Enox Admin</span>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm',
                activeTab === tab.id
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
              )}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 px-3 py-2">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-xs">{user.name?.[0]?.toUpperCase()}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/70 truncate">{user.name}</p>
              <p className="text-[10px] text-white/30">Admin</p>
            </div>
            <button onClick={handleSignOut} className="p-1.5 hover:bg-white/5 rounded-lg">
              <LogOut size={14} className="text-white/30" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="p-8"
          >
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <div>
                <h1 className="text-xl font-semibold text-white/90 mb-6">Dashboard</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Users', value: stats?.totalUsers || 0, icon: Users },
                    { label: 'Active Models', value: stats?.activeModels || 0, icon: Cpu },
                    { label: 'Total Agents', value: stats?.totalAgents || 0, icon: Activity },
                    { label: 'Requests This Month', value: stats?.monthlyRequests || 0, icon: BarChart3 },
                  ].map((stat, i) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="glass rounded-2xl p-5"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-white/30 uppercase tracking-wider">{stat.label}</span>
                        <stat.icon size={16} className="text-white/20" />
                      </div>
                      <p className="text-2xl font-semibold text-white/90">{stat.value}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Recent usage */}
                <div className="mt-8">
                  <h2 className="text-base font-semibold text-white/70 mb-4">Recent Usage (Today)</h2>
                  <div className="glass rounded-2xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          <th className="text-left text-[11px] uppercase tracking-wider text-white/30 px-5 py-3">User</th>
                          <th className="text-left text-[11px] uppercase tracking-wider text-white/30 px-5 py-3">Model</th>
                          <th className="text-left text-[11px] uppercase tracking-wider text-white/30 px-5 py-3">Requests</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usageLogs.slice(0, 10).map(log => (
                          <tr key={log.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                {log.user.avatar_url ? (
                                  <img src={log.user.avatar_url} className="w-6 h-6 rounded-full" alt="" />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px]">
                                    {log.user.name?.[0]?.toUpperCase()}
                                  </div>
                                )}
                                <span className="text-sm text-white/70">{log.user.name}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-sm text-white/50">{log.model.name}</td>
                            <td className="px-5 py-3 text-sm text-white/70">{log.message_count}</td>
                          </tr>
                        ))}
                        {usageLogs.length === 0 && (
                          <tr><td colSpan={3} className="text-center text-sm text-white/30 py-8">No usage data today</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Models Tab */}
            {activeTab === 'models' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-xl font-semibold text-white/90">Models</h1>
                  <button
                    onClick={() => { resetModelForm(); setShowModelForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-all"
                  >
                    <Plus size={16} />
                    Add Model
                  </button>
                </div>

                <div className="glass rounded-2xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left text-[11px] uppercase tracking-wider text-white/30 px-5 py-3">Name</th>
                        <th className="text-left text-[11px] uppercase tracking-wider text-white/30 px-5 py-3">Provider</th>
                        <th className="text-left text-[11px] uppercase tracking-wider text-white/30 px-5 py-3">Model ID</th>
                        <th className="text-left text-[11px] uppercase tracking-wider text-white/30 px-5 py-3">API Key</th>
                        <th className="text-left text-[11px] uppercase tracking-wider text-white/30 px-5 py-3">Requests / Month</th>
                        <th className="text-left text-[11px] uppercase tracking-wider text-white/30 px-5 py-3">Status</th>
                        <th className="text-right text-[11px] uppercase tracking-wider text-white/30 px-5 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {models.map(model => (
                        <tr key={model.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-3 text-sm text-white/80 font-medium">{model.name}</td>
                          <td className="px-5 py-3 text-sm text-white/50 capitalize">{model.provider}</td>
                          <td className="px-5 py-3 text-xs text-white/40 font-mono">{model.model_id}</td>
                          <td className="px-5 py-3 text-xs text-white/30 font-mono">{model.api_key}</td>
                          <td className="px-5 py-3 text-sm text-white/50">{model.daily_limit}/month</td>
                          <td className="px-5 py-3">
                            <span className={cn(
                              'text-xs px-2 py-1 rounded-full',
                              model.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                            )}>
                              {model.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openEditModel(model)} className="p-1.5 rounded-lg hover:bg-white/5">
                                <Pencil size={14} className="text-white/40" />
                              </button>
                              <button onClick={() => handleDeleteModel(model.id)} className="p-1.5 rounded-lg hover:bg-red-500/10">
                                <Trash2 size={14} className="text-red-400/50" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {models.length === 0 && (
                        <tr><td colSpan={7} className="text-center text-sm text-white/30 py-8">No models configured</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div>
                <h1 className="text-xl font-semibold text-white/90 mb-6">Users</h1>
                <div className="glass rounded-2xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left text-[11px] uppercase tracking-wider text-white/30 px-5 py-3">User</th>
                        <th className="text-left text-[11px] uppercase tracking-wider text-white/30 px-5 py-3">Email</th>
                        <th className="text-left text-[11px] uppercase tracking-wider text-white/30 px-5 py-3">Role</th>
                        <th className="text-left text-[11px] uppercase tracking-wider text-white/30 px-5 py-3">Joined</th>
                        <th className="text-right text-[11px] uppercase tracking-wider text-white/30 px-5 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              {u.avatar_url ? (
                                <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs">
                                  {u.name?.[0]?.toUpperCase()}
                                </div>
                              )}
                              <span className="text-sm text-white/80">{u.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-sm text-white/50">{u.email}</td>
                          <td className="px-5 py-3">
                            <span className={cn(
                              'text-xs px-2 py-1 rounded-full',
                              u.role === 'admin' ? 'bg-purple-500/10 text-purple-400' : 'bg-white/5 text-white/40'
                            )}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs text-white/30">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openUserLimitsModal(u)}
                                className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/60 transition-colors"
                              >
                                Limits
                              </button>
                              <button
                                onClick={() => handleUpdateUserRole(u.id, u.role === 'admin' ? 'user' : 'admin')}
                                className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/50 transition-colors"
                              >
                                {u.role === 'admin' ? 'Demote' : 'Promote'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Usage Tab */}
            {activeTab === 'usage' && (
              <div>
                <h1 className="text-xl font-semibold text-white/90 mb-6">Usage Logs</h1>
                <div className="glass rounded-2xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left text-[11px] uppercase tracking-wider text-white/30 px-5 py-3">User</th>
                        <th className="text-left text-[11px] uppercase tracking-wider text-white/30 px-5 py-3">Model</th>
                        <th className="text-left text-[11px] uppercase tracking-wider text-white/30 px-5 py-3">Requests</th>
                        <th className="text-left text-[11px] uppercase tracking-wider text-white/30 px-5 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageLogs.map(log => (
                        <tr key={log.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              {log.user.avatar_url ? (
                                <img src={log.user.avatar_url} className="w-6 h-6 rounded-full" alt="" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px]">
                                  {log.user.name?.[0]?.toUpperCase()}
                                </div>
                              )}
                              <span className="text-sm text-white/70">{log.user.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-sm text-white/50">{log.model.name}</td>
                          <td className="px-5 py-3 text-sm text-white/70 font-medium">{log.message_count}</td>
                          <td className="px-5 py-3 text-xs text-white/30">{log.date}</td>
                        </tr>
                      ))}
                      {usageLogs.length === 0 && (
                        <tr><td colSpan={4} className="text-center text-sm text-white/30 py-8">No usage logs</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Model Form Modal */}
      <AnimatePresence>
        {showModelForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && resetModelForm()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-strong rounded-2xl p-6 w-full max-w-lg mx-4 flex flex-col gap-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white/90">{editingModel ? 'Edit Model' : 'Add Model'}</h2>
                <button onClick={resetModelForm} className="p-2 rounded-lg hover:bg-white/5">
                  <X size={16} className="text-white/40" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">Display Name</label>
                  <input
                    value={modelForm.name}
                    onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })}
                    placeholder="GPT-4o"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-white/[0.12] transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-white/40 mb-1.5 block">Provider</label>
                    <select
                      value={modelForm.provider}
                      onChange={(e) => setModelForm({ ...modelForm, provider: e.target.value })}
                      className="w-full rounded-xl border border-white/[0.06] bg-white px-4 py-2.5 text-sm text-black outline-none"
                    >
                      {['openai', 'anthropic', 'google', 'mistral', 'groq', 'openrouter'].map(p => (
                        <option key={p} value={p} className="text-black">{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 mb-1.5 block">Model ID</label>
                    <input
                      value={modelForm.model_id}
                      onChange={(e) => setModelForm({ ...modelForm, model_id: e.target.value })}
                      placeholder="gpt-4o"
                      className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-white/[0.12] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">API Key {editingModel && '(leave blank to keep current)'}</label>
                  <input
                    value={modelForm.api_key}
                    onChange={(e) => setModelForm({ ...modelForm, api_key: e.target.value })}
                    placeholder="sk-..."
                    type="password"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-white/[0.12] transition-colors font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-white/40 mb-1.5 block">Requests Per Month (per user)</label>
                    <input
                      type="number"
                      value={modelForm.daily_limit}
                      onChange={(e) => setModelForm({ ...modelForm, daily_limit: parseInt(e.target.value) || 25 })}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-white/90 outline-none focus:border-white/[0.12] transition-colors"
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div
                        onClick={() => setModelForm({ ...modelForm, is_active: !modelForm.is_active })}
                        className={cn(
                          'w-10 h-6 rounded-full transition-colors relative cursor-pointer',
                          modelForm.is_active ? 'bg-green-500/30' : 'bg-white/10'
                        )}
                      >
                        <div className={cn(
                          'w-4 h-4 rounded-full bg-white absolute top-1 transition-transform',
                          modelForm.is_active ? 'translate-x-5' : 'translate-x-1'
                        )} />
                      </div>
                      <span className="text-sm text-white/60">Active</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={resetModelForm} className="px-4 py-2 rounded-xl text-sm text-white/40 hover:text-white/60 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={editingModel ? handleUpdateModel : handleCreateModel}
                  disabled={formLoading || !modelForm.name || !modelForm.model_id || (!editingModel && !modelForm.api_key)}
                  className="px-5 py-2 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  {formLoading ? 'Saving...' : editingModel ? 'Update' : 'Add Model'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showUserLimitsModal && selectedUserForLimits && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && closeUserLimitsModal()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="glass-strong mx-4 flex w-full max-w-3xl flex-col gap-5 rounded-2xl p-6"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white/90">User Monthly Request Limits</h2>
                  <p className="text-sm text-white/40">{selectedUserForLimits.email}</p>
                </div>
                <button onClick={closeUserLimitsModal} className="rounded-lg p-2 hover:bg-white/5">
                  <X size={16} className="text-white/40" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                <span className="text-xs uppercase tracking-wider text-white/30">Quick raise all</span>
                <button onClick={() => applyQuickLimitToAll(50)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black hover:bg-white/90">50</button>
                <button onClick={() => applyQuickLimitToAll(100)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black hover:bg-white/90">100</button>
                <div className="flex items-center gap-2">
                  <input
                    value={quickLimitValue}
                    onChange={(e) => setQuickLimitValue(e.target.value)}
                    placeholder="Custom"
                    className="w-24 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-white/90 outline-none"
                  />
                  <button
                    onClick={() => {
                      const parsed = parseInt(quickLimitValue, 10);
                      if (Number.isFinite(parsed) && parsed > 0) applyQuickLimitToAll(parsed);
                    }}
                    className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-white/70 hover:bg-white/[0.06]"
                  >
                    Apply
                  </button>
                </div>
              </div>

              <div className="max-h-[55vh] overflow-y-auto rounded-2xl border border-white/[0.06]">
                <table className="w-full">
                  <thead className="sticky top-0 bg-black/70 backdrop-blur-xl">
                    <tr className="border-b border-white/[0.06]">
                      <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-white/30">Model</th>
                      <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-white/30">Provider</th>
                      <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-white/30">Default / Month</th>
                      <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-white/30">Custom / Month</th>
                      <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-white/30">Effective / Month</th>
                    </tr>
                  </thead>
                  <tbody>
                    {limitsLoading ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-sm text-white/40">Loading limits...</td>
                      </tr>
                    ) : userModelLimits.map((item) => (
                      <tr key={item.model_id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                        <td className="px-4 py-3 text-sm text-white/80">{item.model_name}</td>
                        <td className="px-4 py-3 text-sm capitalize text-white/45">{item.provider}</td>
                        <td className="px-4 py-3 text-sm text-white/45">{item.default_limit}</td>
                        <td className="px-4 py-3">
                          <input
                            value={item.custom_limit ?? ''}
                            onChange={(e) => handleUserLimitChange(item.model_id, e.target.value)}
                            placeholder="Use default"
                            className="w-28 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-white/90 outline-none"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-white/75">{item.effective_limit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={closeUserLimitsModal} className="px-4 py-2 text-sm text-white/40 transition-colors hover:text-white/60">Cancel</button>
                <button
                  onClick={handleSaveUserLimits}
                  disabled={limitsLoading}
                  className="rounded-xl bg-white px-5 py-2 text-sm font-medium text-black transition-all hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {limitsLoading ? 'Saving...' : 'Save Limits'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

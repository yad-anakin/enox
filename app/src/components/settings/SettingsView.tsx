'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { usersAPI } from '@/lib/api';
import { motion } from 'framer-motion';
import { User, BarChart3, Cpu, KeyRound, ShieldCheck, ArrowRight, ToggleLeft, ToggleRight, CheckCircle2, MessageSquare, Bot } from 'lucide-react';
import { useRouter } from 'next/navigation';


export function SettingsView() {
  const { user, setUser, useOwnKeys, setUseOwnKeys, usage, apiKeys, setUsage, setApiKeys, chats } = useStore();
  const router = useRouter();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
  }, [user?.name]);

  // Refresh usage and api keys in background on mount
  useEffect(() => {
    usersAPI.getUsage().then(setUsage).catch(() => {});
    usersAPI.getApiKeys().then(setApiKeys).catch(() => {});
  }, [setUsage, setApiKeys]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const updated = await usersAPI.updateMe({ name: name.trim() });
      setUser(updated);
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const connectedKeys = apiKeys.filter((k) => k.has_key);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 md:p-8"
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06]">
              <ShieldCheck size={20} className="text-white/70" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white/90">Settings</h1>
              <p className="text-sm text-white/35">Manage your profile, usage, and provider keys.</p>
            </div>
          </div>
        </motion.div>

        {/* Profile */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-2xl p-6"
        >
          <div className="mb-6 flex items-center gap-3">
            <User size={18} className="text-white/40" />
            <h2 className="text-base font-semibold text-white/90">Profile</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-[140px,1fr]">
            <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-white/[0.04] border border-white/[0.06]">
              <span className="text-3xl text-white/45">{user?.name?.[0]?.toUpperCase()}</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs text-white/40">Display Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-sm text-white/90 outline-none transition-colors focus:border-white/[0.12]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs text-white/40">Email</label>
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-2.5 text-sm text-white/40">
                  {user?.email}
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving || name.trim() === user?.name}
                className="rounded-xl bg-white px-5 py-2 text-sm font-medium text-black transition-all hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </motion.div>

        {/* API Key Mode Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {useOwnKeys ? (
                <ToggleRight size={18} className="text-white/70" />
              ) : (
                <ToggleLeft size={18} className="text-white/40" />
              )}
              <div>
                <h2 className="text-base font-semibold text-white/90">API Key Mode</h2>
                <p className="text-sm text-white/35">
                  {useOwnKeys ? 'Using your own API keys for chat requests' : 'Using platform default keys for chat requests'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setUseOwnKeys(!useOwnKeys)}
              className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${
                useOwnKeys ? 'bg-white/20' : 'bg-white/[0.06]'
              }`}
            >
              <div
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all duration-200 ${
                  useOwnKeys ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </motion.div>

        {/* Usage Summary */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-6"
        >
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 size={18} className="text-white/40" />
              <h2 className="text-base font-semibold text-white/90">This Month&apos;s Usage</h2>
            </div>

            <button
              onClick={() => router.push('/settings/usage')}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              View More <ArrowRight size={12} />
            </button>
          </div>

          {usage.length === 0 ? (
            <p className="text-sm text-white/30 text-center py-4">No usage data available</p>
          ) : (
            <div className="space-y-4">
              {usage.map((item) => (
                <div key={item.model.id} className="flex items-center gap-4">
                  <div className="flex items-center gap-2 min-w-[140px]">
                    <Cpu size={14} className="text-white/30" />
                    <span className="text-sm text-white/70">{item.model.name}</span>
                  </div>

                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-white/20 transition-all duration-500"
                        style={{ width: `${Math.min((item.used / item.limit) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  <span className="text-xs text-white/40 min-w-[60px] text-right">
                    {item.used}/{item.limit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Recent Chats */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="glass rounded-2xl p-6"
        >
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare size={18} className="text-white/40" />
              <h2 className="text-base font-semibold text-white/90">Recent Chats</h2>
            </div>
            <button
              onClick={() => router.push('/history')}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              View More <ArrowRight size={12} />
            </button>
          </div>

          {chats.length === 0 ? (
            <p className="text-sm text-white/30 text-center py-4">No conversations yet</p>
          ) : (
            <div className="space-y-2">
              {chats.slice(0, 5).map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => router.push('/chat')}
                  className="w-full flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left hover:bg-white/[0.04] transition-colors"
                >
                  <MessageSquare size={14} className="text-white/25 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/70 truncate">{chat.title || 'New Chat'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-white/25">{chat.model?.name}</span>
                      {chat.agent && (
                        <span className="text-[9px] text-white/15 flex items-center gap-0.5">
                          <Bot size={8} /> {chat.agent.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-white/15 shrink-0">
                    {new Date(chat.updated_at).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {/* Connected API Keys (summary only) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-2xl p-6"
        >
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <KeyRound size={18} className="text-white/40" />
              <div>
                <h2 className="text-base font-semibold text-white/90">My API Keys</h2>
                <p className="text-sm text-white/35">
                  {connectedKeys.length > 0
                    ? `${connectedKeys.length} provider${connectedKeys.length > 1 ? 's' : ''} connected`
                    : 'No keys connected yet'}
                </p>
              </div>
            </div>

            <button
              onClick={() => router.push('/settings/api-keys')}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              View More <ArrowRight size={12} />
            </button>
          </div>

          {connectedKeys.length === 0 ? (
            <button
              onClick={() => router.push('/settings/api-keys')}
              className="w-full rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] p-5 text-center hover:bg-white/[0.04] transition-colors"
            >
              <KeyRound size={20} className="mx-auto mb-2 text-white/20" />
              <p className="text-sm text-white/40">Add your own API keys to get started</p>
            </button>
          ) : (
            <div className="space-y-2">
              {connectedKeys.map((item) => (
                <div key={item.provider} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                  <CheckCircle2 size={14} className="text-green-400/70" />
                  <span className="text-sm font-medium capitalize text-white/80 flex-1">{item.provider}</span>
                  <span className="text-[11px] text-white/30">
                    {item.updated_at ? new Date(item.updated_at).toLocaleDateString() : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { usersAPI } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { motion } from 'framer-motion';
import { KeyRound, ArrowLeft, CheckCircle2, Circle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UserApiKey {
  provider: string;
  has_key: boolean;
  api_key: string;
  updated_at: string | null;
}

export function ApiKeysView() {
  const router = useRouter();
  const { apiKeys: storeKeys, setApiKeys: setStoreKeys } = useStore();
  const [apiKeys, setApiKeys] = useState<UserApiKey[]>(storeKeys);
  const [saving, setSaving] = useState(false);

  // Sync when store data arrives asynchronously
  useEffect(() => {
    if (storeKeys.length > 0 && apiKeys.length === 0) {
      setApiKeys(storeKeys);
    }
  }, [storeKeys]);

  const handleChange = (provider: string, value: string) => {
    setApiKeys((current) =>
      current.map((item) =>
        item.provider === provider
          ? { ...item, api_key: value, has_key: Boolean(value.trim()) }
          : item
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await usersAPI.updateApiKeys({
        keys: apiKeys.map((item) => ({ provider: item.provider, api_key: item.api_key.trim() })),
      });
      setApiKeys(updated);
      setStoreKeys(updated);
    } catch (err) {
      console.error('Failed to save api keys:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 md:p-8"
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/settings')}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/[0.1] transition-colors"
            >
              <ArrowLeft size={16} className="text-white/60" />
            </button>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06]">
              <KeyRound size={20} className="text-white/70" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white/90">API Keys</h1>
              <p className="text-sm text-white/35">Manage your provider API keys for chat requests</p>
            </div>
          </div>
        </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="space-y-4"
            >
              {apiKeys.map((item, i) => (
                <motion.div
                  key={item.provider}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.03 }}
                  className="glass rounded-2xl p-5"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {item.has_key ? (
                        <CheckCircle2 size={16} className="text-green-400/70" />
                      ) : (
                        <Circle size={16} className="text-white/20" />
                      )}
                      <div>
                        <p className="text-sm font-medium capitalize text-white/85">{item.provider}</p>
                        <p className="text-xs text-white/35">
                          {item.updated_at
                            ? `Last updated ${new Date(item.updated_at).toLocaleString()}`
                            : 'No key saved yet'}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-wider ${
                        item.has_key
                          ? 'bg-green-500/10 text-green-400/70'
                          : 'bg-white/[0.06] text-white/35'
                      }`}
                    >
                      {item.has_key ? 'Connected' : 'Empty'}
                    </span>
                  </div>

                  <input
                    type="password"
                    value={item.api_key}
                    onChange={(e) => handleChange(item.provider, e.target.value)}
                    placeholder={`Paste your ${item.provider} API key`}
                    className="w-full rounded-xl border border-white/[0.06] bg-black/30 px-4 py-2.5 text-sm text-white/90 outline-none transition-colors focus:border-white/[0.12]"
                  />
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex justify-end"
            >
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-white px-6 py-2.5 text-sm font-medium text-black transition-all hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {saving ? 'Saving Keys...' : 'Save API Keys'}
              </button>
            </motion.div>
      </div>
    </div>
  );
}

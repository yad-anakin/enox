'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import { modelsAPI, usersAPI, agentsAPI, chatAPI, seedAuthCache } from '@/lib/api';
import { LoginScreen } from '@/components/auth/LoginScreen';
import { EnoxLogo } from '@/components/common/EnoxLogo';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, setUser, setModels, setAgents, setChats, setUsage, setApiKeys } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAllData = async () => {
      const [models, agents, historyRes] = await Promise.all([
        modelsAPI.list(),
        agentsAPI.list(),
        chatAPI.getHistory(),
      ]);
      setModels(models);
      setAgents(agents);
      setChats(historyRes.chats || historyRes);
      // Load usage and API keys in background (non-blocking)
      usersAPI.getUsage().then(setUsage).catch(() => {});
      usersAPI.getApiKeys().then(setApiKeys).catch(() => {});
    };

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        // Pre-seed auth cache so all API calls skip redundant getSession()
        seedAuthCache(session.access_token);
        try {
          // Parallelize profile + data loading (was sequential before)
          const [profile] = await Promise.all([
            usersAPI.getMe(),
            loadAllData(),
          ]);
          setUser(profile);
        } catch (err) {
          console.error('Init error:', err);
        }
      }
      setLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.access_token) {
        seedAuthCache(session.access_token);
        try {
          const [profile] = await Promise.all([
            usersAPI.getMe(),
            loadAllData(),
          ]);
          setUser(profile);
        } catch (err) {
          console.error('Auth change error:', err);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, setModels, setAgents, setChats, setUsage, setApiKeys]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl glass-strong animate-pulse">
            <EnoxLogo className="h-6 w-6 text-white/80" />
          </div>
          <span className="text-sm text-white/50">Loading Enox AI...</span>
        </div>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  return <>{children}</>;
}

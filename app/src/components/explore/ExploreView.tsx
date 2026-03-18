'use client';

import { useState, useEffect } from 'react';
import { agentsAPI } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { motion } from 'framer-motion';
import { Bot, Globe, MessageSquare, Search, Sparkles, PanelLeft } from 'lucide-react';
import type { Agent } from '@/store/useStore';
import { useRouter } from 'next/navigation';

export function ExploreView() {
  const { setSelectedAgentId, setSelectedModelId, setActiveChatId, setMessages, sidebarOpen, setSidebarOpen } = useStore();
  const router = useRouter();
  const [publicAgents, setPublicAgents] = useState<Agent[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const agents = await agentsAPI.listPublic();
        setPublicAgents(agents);
      } catch (err) {
        console.error('Failed to load public agents:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = publicAgents.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleChat = (agent: Agent) => {
    setSelectedAgentId(agent.id);
    setSelectedModelId(agent.model.id);
    setActiveChatId(null);
    setMessages([]);
    router.push(agent.username ? `/chat/${agent.username}` : '/chat');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-6 py-6 border-b border-white/[0.06] shrink-0 bg-gradient-to-b from-white/[0.02] to-transparent">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-white/55 transition-all hover:bg-white/[0.06] md:hidden shrink-0"
              >
                <PanelLeft size={18} />
              </button>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium text-cyan-300">
                <Sparkles size={12} />
                Community agents
              </div>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Explore Agents</h1>
            <p className="mt-1 text-sm text-white/45">Discover polished public agents with clearer descriptions, models, and one-click chat.</p>
          </div>
          <div className="hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-right md:block">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/25">Available</p>
            <p className="mt-1 text-2xl font-semibold text-white">{filtered.length}</p>
          </div>
        </div>

        <div className="relative max-w-xl">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="w-full rounded-2xl border border-white/[0.08] bg-[#111111] py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/25 outline-none transition-colors focus:border-cyan-400/40 focus:bg-[#141414]"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-3">
            <Globe size={24} className="text-white/20" />
            <p className="text-sm text-white/30">{search ? 'No agents match your search' : 'No public agents yet'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 max-w-6xl">
            {filtered.map((agent, i) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="group relative overflow-hidden rounded-[26px] border border-white/[0.06] bg-[#080808] p-4 transition-all duration-300 hover:border-white/[0.12] hover:bg-[#0b0b0b]"
              >
                <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-60" />

                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                      <Bot size={17} className="text-white/80" />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-white">{agent.name}</h3>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/32">Public agent</p>
                    </div>
                  </div>
                  <div className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white/45">
                    Live
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-white/45 capitalize">
                    {agent.model.provider}
                  </span>
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/72">
                    {agent.model.name}
                  </span>
                </div>

                <p className="min-h-[40px] text-sm leading-5 text-white/46 line-clamp-2">
                  {agent.description || 'Purpose-built assistant with a focused prompt, model, and chat flow.'}
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/28">
                    <Globe size={12} className="text-white/45" />
                    Ready to chat
                  </div>
                  <button
                    onClick={() => handleChat(agent)}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white px-3 py-1.5 text-xs font-medium text-black transition-all hover:bg-white/92"
                  >
                    <MessageSquare size={12} />
                    Chat
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

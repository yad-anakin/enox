'use client';

import { useStore } from '@/store/useStore';
import { agentsAPI } from '@/lib/api';
import { motion } from 'framer-motion';
import { Plus, Bot, Globe, Lock, Pencil, Trash2, MessageSquare, PanelLeft } from 'lucide-react';
import type { Agent } from '@/store/useStore';
import { useRouter } from 'next/navigation';

export function AgentsView() {
  const { agents, setAgents, setSelectedAgentId, setSelectedModelId, setActiveChatId, setMessages, sidebarOpen, setSidebarOpen } = useStore();
  const router = useRouter();

  const handleDelete = async (id: string) => {
    try {
      await agentsAPI.delete(id);
      setAgents(agents.filter(a => a.id !== id));
    } catch (err) {
      console.error('Delete agent error:', err);
    }
  };

  const handleChatWithAgent = (agent: Agent) => {
    setSelectedAgentId(agent.id);
    setSelectedModelId(agent.model.id);
    setActiveChatId(null);
    setMessages([]);
    router.push(agent.username ? `/chat/${agent.username}` : '/chat');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="h-16 pt-2 flex items-center justify-between px-6 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-white/55 transition-all hover:bg-white/[0.06] md:hidden shrink-0"
          >
            <PanelLeft size={18} />
          </button>
          <h1 className="text-lg font-semibold text-white/90">My Agents</h1>
        </div>
        <button
          onClick={() => router.push('/agents/studio')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-all active:scale-[0.98]"
        >
          <Plus size={16} />
          Create Agent
        </button>
      </div>

      {/* Agent grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-16 h-16 rounded-2xl glass-strong flex items-center justify-center">
              <Bot size={28} className="text-white/30" />
            </div>
            <p className="text-sm text-white/30">No agents yet. Create your first AI agent.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 max-w-6xl">
            {agents.map((agent, i) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group relative overflow-hidden rounded-[26px] border border-white/[0.06] bg-[#080808] p-4 transition-all duration-300 hover:border-white/[0.12] hover:bg-[#0b0b0b]"
              >
                <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-60" />
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                      <Bot size={17} className="text-white/80" />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-white">{agent.name}</h3>
                      <div className="mt-1 flex items-center gap-1.5">
                        {agent.is_public ? (
                          <Globe size={10} className="text-white/55" />
                        ) : (
                          <Lock size={10} className="text-white/35" />
                        )}
                        <span className="text-[11px] uppercase tracking-[0.18em] text-white/35">{agent.is_public ? 'Public' : 'Private'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => router.push(`/agents/studio?edit=${agent.id}`)}
                      className="p-2 rounded-xl border border-transparent bg-white/[0.02] hover:border-white/[0.08] hover:bg-white/[0.05] transition-colors"
                    >
                      <Pencil size={12} className="text-white/45" />
                    </button>
                    <button onClick={() => handleDelete(agent.id)} className="p-2 rounded-xl border border-transparent bg-white/[0.02] hover:border-white/[0.08] hover:bg-white/[0.05] transition-colors">
                      <Trash2 size={12} className="text-white/35" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-white/45">{agent.model.provider}</span>
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/72">{agent.model.name}</span>
                </div>

                <p className="mt-3 min-h-[40px] text-sm leading-5 text-white/46 line-clamp-2">
                  {agent.description || 'Custom agent with a dedicated prompt, settings, and model configuration.'}
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-white/28">Ready in chat</span>
                  <button
                    onClick={() => handleChatWithAgent(agent)}
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

'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Bot, Compass, Settings, Plus, PanelLeftClose,
  PanelLeft, LogOut, Trash2, FileText, ScrollText,
} from 'lucide-react';
import { chatAPI } from '@/lib/api';
import { EnoxLogo } from '@/components/common/EnoxLogo';
import { useRouter, usePathname } from 'next/navigation';

export function Sidebar() {
  const {
    sidebarOpen, setSidebarOpen,
    user, chats, setChats, activeChatId, setActiveChatId,
    setMessages, setSelectedAgentId, setIsStreaming,
    agents, selectedAgentId,
  } = useStore(useShallow((s) => ({
    sidebarOpen: s.sidebarOpen, setSidebarOpen: s.setSidebarOpen,
    user: s.user, chats: s.chats, setChats: s.setChats,
    activeChatId: s.activeChatId, setActiveChatId: s.setActiveChatId,
    setMessages: s.setMessages, setSelectedAgentId: s.setSelectedAgentId,
    setIsStreaming: s.setIsStreaming,
    agents: s.agents, selectedAgentId: s.selectedAgentId,
  })));
  const router = useRouter();
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');

    const updateViewport = (event?: MediaQueryListEvent) => {
      setIsMobile(event?.matches ?? mediaQuery.matches);
    };

    updateViewport();
    mediaQuery.addEventListener('change', updateViewport);

    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, []);

  const navItems = [
    { path: '/chat', icon: MessageSquare, label: 'Chat' },
    { path: '/agents', icon: Bot, label: 'Agents' },
    { path: '/explore', icon: Compass, label: 'Explore' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  const navigate = (path: string) => {
    router.push(path);
    if (isMobile) setSidebarOpen(false);
  };

  const handleNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setSelectedAgentId(null);
    setIsStreaming(false);
    navigate('/chat');
  };

  const handleSelectChat = (chatId: string) => {
    const chat = chats.find(c => c.id === chatId);
    const target = chat?.agent?.username ? `/chat/${chat.agent.username}` : '/chat';

    if (activeChatId === chatId) { navigate(target); return; }

    // Set state + navigate — ChatView / AgentPage will fetch messages
    setActiveChatId(chatId);
    setSelectedAgentId(chat?.agent?.id || null);
    setMessages([]);
    setIsStreaming(false);
    navigate(target);
  };

  const handleDeleteChat = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    // Optimistic: remove from UI immediately
    setChats(chats.filter(c => c.id !== chatId));
    if (activeChatId === chatId) {
      setActiveChatId(null);
      setMessages([]);
      setSelectedAgentId(null);
    }
    // Fire-and-forget API call
    chatAPI.deleteChat(chatId).catch((err) => {
      console.error('Failed to delete chat:', err);
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleOpenView = (path: string) => {
    setProfileMenuOpen(false);
    navigate(path);
  };

  const collapsedProfileIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 48 48" className="h-[18px] w-[18px] text-white/70">
      <defs>
        <mask id="sidebarProfileMask">
          <g fill="none" strokeLinejoin="round" strokeWidth="4">
            <path fill="#fff" stroke="#fff" d="M24 44c11.046 0 20-8.954 20-20S35.046 4 24 4S4 12.954 4 24s8.954 20 20 20Z" />
            <path stroke="#000" strokeLinecap="round" d="M31 31s-2 4-7 4s-7-4-7-4m16-11h-4m-12-2v4" />
          </g>
        </mask>
      </defs>
      <path fill="currentColor" d="M0 0h48v48H0z" mask="url(#sidebarProfileMask)" />
    </svg>
  );

  return (
    <>
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.button
            type="button"
            aria-label="Close sidebar"
            className="fixed inset-0 z-30 bg-black/25 backdrop-blur-md md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>
      <motion.aside
        className="fixed left-0 top-0 z-40 flex h-screen min-h-screen flex-col border-r border-white/[0.08] bg-black supports-[height:100dvh]:h-[100dvh] supports-[height:100dvh]:min-h-[100dvh]"
        animate={isMobile ? { width: 280, x: sidebarOpen ? 0 : -280 } : { width: sidebarOpen ? 280 : 72, x: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
      <div className="flex h-16 shrink-0 items-center justify-between p-4">
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5">
                <EnoxLogo className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-[13px] font-semibold tracking-tight">Enox AI</span>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-white/5 transition-colors"
        >
          {sidebarOpen ? <PanelLeftClose size={18} className="text-white/50" /> : <PanelLeft size={18} className="text-white/50" />}
        </button>
      </div>

      <div className="px-3 mb-2 shrink-0">
        <button
          onClick={handleNewChat}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all duration-200',
            'bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.06]',
            !sidebarOpen && 'justify-center'
          )}
        >
          <Plus size={16} className="text-white/70 shrink-0" />
          {sidebarOpen && <span className="text-sm text-white/70">New chat</span>}
        </button>
      </div>

      <nav className="px-3 space-y-1 mb-4 shrink-0">
        {navItems.map(item => (
          <button
            key={item.path}
            onClick={() => {
              if (item.path === '/chat') {
                handleNewChat();
                return;
              }
              navigate(item.path);
            }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200',
              pathname === item.path || pathname.startsWith(item.path + '/')
                ? 'bg-white/[0.08] text-white'
                : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]',
              !sidebarOpen && 'justify-center'
            )}
          >
            <item.icon size={18} className="shrink-0" />
            {sidebarOpen && <span className="text-sm">{item.label}</span>}
          </button>
        ))}
      </nav>

      {sidebarOpen && (
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-4 min-h-0">
          {/* Agents section (max 2) */}
          {agents.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-white/20 px-3 mb-2">Agents</p>
              <div className="space-y-0.5">
                {agents.slice(0, 2).map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      setSelectedAgentId(agent.id);
                      setActiveChatId(null);
                      setMessages([]);
                      navigate(agent.username ? `/chat/${agent.username}` : '/chat');
                    }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left',
                      selectedAgentId === agent.id
                        ? 'bg-white/[0.08] text-white'
                        : 'text-white/40 hover:bg-white/[0.04] hover:text-white/60'
                    )}
                  >
                    <Bot size={14} className="shrink-0" />
                    <span className="text-sm truncate">{agent.name}</span>
                  </button>
                ))}
              </div>
              {agents.length > 2 && (
                <button
                  onClick={() => navigate('/agents')}
                  className="w-full mt-1 px-3 py-1.5 text-[10px] text-white/25 hover:text-white/50 transition-colors text-left"
                >
                  View all agents →
                </button>
              )}
            </div>
          )}

          {/* Recent chats (max 5) */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/20 px-3 mb-2">Recent</p>
            <div className="space-y-0.5">
              {chats.slice(0, 5).map(chat => (
                <div
                  key={chat.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectChat(chat.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSelectChat(chat.id); }}
                  className={cn(
                    'w-full group flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left cursor-pointer',
                    activeChatId === chat.id
                      ? 'bg-white/[0.08] text-white'
                      : 'text-white/40 hover:bg-white/[0.04] hover:text-white/60'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm truncate block">{chat.title || 'New Chat'}</span>
                    {chat.agent && (
                      <span className="text-[9px] text-white/20 flex items-center gap-1 mt-0.5">
                        <Bot size={8} className="shrink-0" />
                        {chat.agent.name}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleDeleteChat(e, chat.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all shrink-0"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            {chats.length > 5 && (
              <button
                onClick={() => navigate('/history')}
                className="w-full mt-1 px-3 py-1.5 text-[10px] text-white/25 hover:text-white/50 transition-colors text-left"
              >
                View history →
              </button>
            )}
            {chats.length === 0 && (
              <p className="px-3 text-[11px] text-white/15">No chats yet</p>
            )}
          </div>
        </div>
      )}

      <div className="relative shrink-0 border-t border-white/[0.06] p-3">
        <AnimatePresence>
          {sidebarOpen && profileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-[calc(100%-8px)] left-3 right-3 z-50 rounded-2xl border border-white/[0.08] bg-black/95 p-2 backdrop-blur-xl"
            >
              {[
                { path: '/settings', label: 'Settings', icon: Settings },
                { path: '/privacy', label: 'Privacy Policy', icon: FileText },
                { path: '/terms', label: 'Terms of Service', icon: ScrollText },
              ].map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleOpenView(item.path)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  <item.icon size={15} />
                  <span>{item.label}</span>
                </button>
              ))}
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <LogOut size={15} />
                <span>Sign out</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => {
            if (!sidebarOpen) {
              handleOpenView('/settings');
              return;
            }
            setProfileMenuOpen((current) => !current);
          }}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors hover:bg-white/[0.04]',
            !sidebarOpen && 'justify-center'
          )}
        >
          {sidebarOpen ? user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-lg shrink-0 border border-white/[0.08] object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/[0.08] flex items-center justify-center shrink-0">
              <span className="text-xs text-white/60">{user?.name?.[0]?.toUpperCase()}</span>
            </div>
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/10">
              {collapsedProfileIcon}
            </div>
          )}
          {sidebarOpen && (
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm text-white/80 truncate">{user?.name}</p>
              <p className="text-xs text-white/30 truncate">{user?.email}</p>
            </div>
          )}
        </button>
      </div>
      </motion.aside>
    </>
  );
}

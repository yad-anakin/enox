'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { chatAPI } from '@/lib/api';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  MessageSquare, Trash2, Pencil, Check, X,
  ChevronLeft, ChevronRight, Bot, CheckSquare, Square,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface HistoryChat {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  model: { id: string; name: string; provider: string };
  agent: { id: string; name: string; username?: string | null } | null;
}

const PAGE_SIZE = 10;

export function ChatHistory() {
  const router = useRouter();
  const { setActiveChatId, setMessages, chats, setChats, setSelectedAgentId, setIsStreaming } = useStore();

  const [allChats, setAllChats] = useState<HistoryChat[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await chatAPI.getHistory(p * PAGE_SIZE, PAGE_SIZE);
      setAllChats(res.chats || res);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(page);
  }, [page, fetchPage]);

  const handleSelectChat = (chat: HistoryChat) => {
    const target = chat.agent?.username ? `/chat/${chat.agent.username}` : '/chat';

    // Set state + navigate — the target page will fetch messages
    setActiveChatId(chat.id);
    setSelectedAgentId(chat.agent?.id || null);
    setMessages([]);
    setIsStreaming(false);
    router.push(target);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === allChats.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allChats.map(c => c.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (!selected.size) return;
    setDeleting(true);
    const ids = Array.from(selected);
    try {
      await Promise.all(ids.map(id => chatAPI.deleteChat(id)));
      setAllChats(prev => prev.filter(c => !selected.has(c.id)));
      setChats(chats.filter(c => !selected.has(c.id)));
      setSelected(new Set());
      const newTotal = total - ids.length;
      setTotal(newTotal);
      const newTotalPages = Math.ceil(newTotal / PAGE_SIZE);
      if (page >= newTotalPages && page > 0) setPage(page - 1);
    } catch (err) {
      console.error('Failed to delete chats:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleStartRename = (chat: HistoryChat) => {
    setEditingId(chat.id);
    setEditTitle(chat.title || '');
  };

  const handleConfirmRename = async () => {
    if (!editingId || !editTitle.trim()) return;
    try {
      await chatAPI.renameChat(editingId, editTitle.trim());
      setAllChats(prev => prev.map(c => c.id === editingId ? { ...c, title: editTitle.trim() } : c));
      setChats(chats.map(c => c.id === editingId ? { ...c, title: editTitle.trim() } : c));
    } catch (err) {
      console.error('Rename failed:', err);
    } finally {
      setEditingId(null);
      setEditTitle('');
    }
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditTitle('');
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/chat')} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-colors">
              <ChevronLeft size={14} className="text-white/50" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-white/90">Chat History</h1>
              <p className="text-xs text-white/30">{total} conversation{total !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all"
            >
              {selected.size === allChats.length && allChats.length > 0 ? <CheckSquare size={12} /> : <Square size={12} />}
              {selected.size === allChats.length && allChats.length > 0 ? 'Deselect all' : 'Select all'}
            </button>
            {selected.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-400/80 hover:bg-red-500/20 transition-all disabled:opacity-50"
              >
                <Trash2 size={11} />
                Delete {selected.size}
              </button>
            )}
          </div>
        </motion.div>

        {/* Chat list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-white/10 border-t-white/50 rounded-full animate-spin" />
          </div>
        ) : allChats.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare size={24} className="mx-auto mb-3 text-white/15" />
            <p className="text-sm text-white/30">No conversations yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {allChats.map((chat) => (
              <motion.div
                key={chat.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'group flex items-center gap-3 rounded-xl border px-4 py-3 transition-all',
                  selected.has(chat.id)
                    ? 'border-white/[0.12] bg-white/[0.06]'
                    : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                )}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggleSelect(chat.id)}
                  className="shrink-0 text-white/30 hover:text-white/60 transition-colors"
                >
                  {selected.has(chat.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>

                {/* Content */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => editingId !== chat.id && handleSelectChat(chat)}
                >
                  {editingId === chat.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmRename(); if (e.key === 'Escape') handleCancelRename(); }}
                        className="flex-1 bg-transparent text-sm text-white/80 outline-none border-b border-white/20 pb-0.5"
                        autoFocus
                      />
                      <button onClick={handleConfirmRename} className="p-1 hover:bg-white/10 rounded transition-colors">
                        <Check size={12} className="text-green-400/70" />
                      </button>
                      <button onClick={handleCancelRename} className="p-1 hover:bg-white/10 rounded transition-colors">
                        <X size={12} className="text-white/40" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-white/70 truncate">{chat.title || 'New Chat'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-white/20">{chat.model?.name}</span>
                        {chat.agent && (
                          <span className="text-[9px] text-white/15 flex items-center gap-0.5">
                            <Bot size={8} /> {chat.agent.name}
                          </span>
                        )}
                        <span className="text-[9px] text-white/15">
                          {new Date(chat.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Actions */}
                {editingId !== chat.id && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStartRename(chat); }}
                      className="p-1.5 hover:bg-white/10 rounded transition-colors"
                    >
                      <Pencil size={12} className="text-white/40" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAllChats(prev => prev.filter(c => c.id !== chat.id));
                        setChats(chats.filter(c => c.id !== chat.id));
                        chatAPI.deleteChat(chat.id).catch(() => {});
                      }}
                      className="p-1.5 hover:bg-white/10 rounded transition-colors"
                    >
                      <Trash2 size={12} className="text-white/40" />
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all disabled:opacity-20 disabled:pointer-events-none"
            >
              <ChevronLeft size={12} /> Previous
            </button>
            <span className="text-[11px] text-white/30">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all disabled:opacity-20 disabled:pointer-events-none"
            >
              Next <ChevronRight size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

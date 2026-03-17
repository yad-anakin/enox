'use client';

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ArrowLeft, Pin, PinOff, Check, Cpu } from 'lucide-react';
import { useRouter } from 'next/navigation';

const PROVIDER_COLORS: Record<string, string> = {
  openai: 'bg-green-500/15 text-green-400 border-green-500/20',
  anthropic: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  google: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  mistral: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  groq: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  openrouter: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
};

const PROVIDER_ICONS: Record<string, string> = {
  openai: '◐',
  anthropic: '◈',
  google: '◆',
  mistral: '◇',
  groq: '⚡',
  openrouter: '◎',
};

export function ModelsView() {
  const router = useRouter();
  const {
    models, selectedModelId, setSelectedModelId,
    pinnedModelIds, setPinnedModelIds,
    setRecentModelId,
    usage,
  } = useStore();
  const [filter, setFilter] = useState<string>('all');

  const usageMap = Object.fromEntries(usage.map((item) => [item.model.id, item]));

  const providers = Array.from(new Set(models.map((m) => m.provider)));
  const filtered = filter === 'all' ? models : models.filter((m) => m.provider === filter);

  const togglePin = (id: string) => {
    if (pinnedModelIds.includes(id)) {
      setPinnedModelIds(pinnedModelIds.filter((p) => p !== id));
    } else if (pinnedModelIds.length < 3) {
      setPinnedModelIds([...pinnedModelIds, id]);
    }
  };

  const handleSelect = (id: string) => {
    setSelectedModelId(id);
    setRecentModelId(id);
    router.push('/chat');
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/[0.1] transition-colors"
            >
              <ArrowLeft size={16} className="text-white/60" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-white/90">All Models</h1>
              <p className="text-sm text-white/35">
                Pin up to 3 models for quick switching. Click a model to start chatting.
              </p>
            </div>
          </div>

          {/* Pinned indicator */}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-white/25">Pinned:</span>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => {
                const id = pinnedModelIds[i];
                const model = id ? models.find((m) => m.id === id) : null;
                return (
                  <div
                    key={i}
                    className={cn(
                      'h-6 rounded-md border text-[10px] flex items-center gap-1 px-2 transition-all',
                      model
                        ? PROVIDER_COLORS[model.provider] || 'bg-white/[0.06] text-white/50 border-white/[0.08]'
                        : 'border-dashed border-white/[0.08] text-white/15'
                    )}
                  >
                    {model ? (
                      <>
                        <span>{PROVIDER_ICONS[model.provider] || '●'}</span>
                        <span className="max-w-[60px] truncate">{model.name}</span>
                      </>
                    ) : (
                      <span>Empty</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0',
              filter === 'all'
                ? 'bg-white/[0.08] text-white'
                : 'text-white/30 hover:text-white/50 hover:bg-white/[0.03]'
            )}
          >
            All ({models.length})
          </button>
          {providers.map((p) => (
            <button
              key={p}
              onClick={() => setFilter(p)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize shrink-0',
                filter === p
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/30 hover:text-white/50 hover:bg-white/[0.03]'
              )}
            >
              {p} ({models.filter((m) => m.provider === p).length})
            </button>
          ))}
        </div>

        {/* Model grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((model, i) => {
            const isPinned = pinnedModelIds.includes(model.id);
            const isSelected = selectedModelId === model.id;
            const colorClass = PROVIDER_COLORS[model.provider] || 'bg-white/[0.06] text-white/50 border-white/[0.08]';
            const usageItem = usageMap[model.id];
            const totalRequests = usageItem?.total_used ?? ((usageItem?.platform_used || 0) + (usageItem?.own_key_used || 0));

            return (
              <motion.div
                key={model.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className={cn(
                  'glass rounded-2xl p-4 flex flex-col gap-3 group transition-all hover:bg-white/[0.03] cursor-pointer relative',
                  isSelected && 'ring-1 ring-white/[0.12]'
                )}
                onClick={() => handleSelect(model.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center text-xs border', colorClass)}>
                      {PROVIDER_ICONS[model.provider] || '●'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/85">{model.name}</p>
                      <p className="text-[10px] text-white/30 capitalize">{model.provider} · {model.model_id}</p>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="h-5 w-5 rounded-full bg-white/10 flex items-center justify-center">
                      <Check size={10} className="text-white/70" />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-auto">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-white/20">{model.daily_limit} req/month</span>
                    <span className="text-[10px] text-white/30">{totalRequests} your requests this month</span>
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); togglePin(model.id); }}
                    className={cn(
                      'flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] transition-all',
                      isPinned
                        ? 'bg-white/[0.08] text-white/60'
                        : 'opacity-0 group-hover:opacity-100 text-white/25 hover:text-white/50 hover:bg-white/[0.04]',
                      pinnedModelIds.length >= 3 && !isPinned && 'hidden'
                    )}
                  >
                    {isPinned ? <PinOff size={9} /> : <Pin size={9} />}
                    {isPinned ? 'Unpin' : 'Pin'}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Cpu size={24} className="text-white/15" />
            <p className="text-sm text-white/25">No models found</p>
          </div>
        )}
      </div>
    </div>
  );
}

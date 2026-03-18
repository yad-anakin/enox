'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { ChevronDown, Grid2X2, Clock, PanelLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

const PROVIDER_DOTS: Record<string, string> = {
  openai: 'bg-green-400',
  anthropic: 'bg-orange-400',
  google: 'bg-blue-400',
  mistral: 'bg-purple-400',
  groq: 'bg-yellow-400',
  openrouter: 'bg-pink-400',
};

export function ModelSelector() {
  const {
    models, selectedModelId, setSelectedModelId,
    sidebarOpen, setSidebarOpen,
    pinnedModelIds, recentModelId, setRecentModelId,
  } = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedModel = models.find((m) => m.id === selectedModelId);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Build dropdown list: recent (if exists) + 3 pinned/latest
  const dropdownModels = useMemo(() => {
    const ids = new Set<string>();
    const pinned: typeof models = [];
    let recent: (typeof models)[0] | null = null;

    // Recent model (separate section)
    if (recentModelId) {
      const m = models.find((mod) => mod.id === recentModelId);
      if (m) { recent = m; ids.add(m.id); }
    }

    // Pinned models (max 3)
    for (const id of pinnedModelIds.slice(0, 3)) {
      const m = models.find((mod) => mod.id === id);
      if (m && !ids.has(m.id)) { ids.add(m.id); pinned.push(m); }
    }

    // Fill to 3 with latest
    if (pinned.length < 3) {
      for (const m of models) {
        if (pinned.length >= 3) break;
        if (!ids.has(m.id)) { ids.add(m.id); pinned.push(m); }
      }
    }

    return { recent, pinned };
  }, [models, pinnedModelIds, recentModelId]);

  const handleSelect = (id: string) => {
    setSelectedModelId(id);
    setRecentModelId(id);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-white/55 transition-all hover:bg-white/[0.06] md:hidden shrink-0"
      >
        <PanelLeft size={18} />
      </button>

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 h-8 px-3 rounded-lg border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] transition-all"
        >
          <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', PROVIDER_DOTS[selectedModel?.provider || ''] || 'bg-white/30')} />
          <span className="text-[12px] text-white/70 max-w-[140px] truncate">
            {selectedModel?.name || 'Select model'}
          </span>
          <ChevronDown size={12} className={cn('text-white/25 transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1.5 z-50 w-56 rounded-xl border border-white/[0.08] bg-[#0a0a0a] overflow-hidden">
            {/* Recent */}
            {dropdownModels.recent && (
              <>
                <div className="px-3 pt-2.5 pb-1">
                  <span className="text-[9px] uppercase tracking-widest text-white/20 flex items-center gap-1">
                    <Clock size={8} /> Recent
                  </span>
                </div>
                <div className="px-1.5">
                  <ModelRow
                    model={dropdownModels.recent}
                    isSelected={selectedModelId === dropdownModels.recent.id}
                    onSelect={handleSelect}
                  />
                </div>
                <div className="mx-3 my-1 border-t border-white/[0.04]" />
              </>
            )}

            {/* Pinned / Default */}
            <div className="px-1.5 pb-1.5 pt-0.5">
              {dropdownModels.pinned.map((m) => (
                <ModelRow
                  key={m.id}
                  model={m}
                  isSelected={selectedModelId === m.id}
                  onSelect={handleSelect}
                />
              ))}
            </div>

            {/* All models link */}
            <div className="border-t border-white/[0.04]">
              <button
                onClick={() => { setOpen(false); router.push('/models'); }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] text-white/25 hover:text-white/50 hover:bg-white/[0.03] transition-all"
              >
                <Grid2X2 size={10} />
                All Models
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ModelRow({ model, isSelected, onSelect }: {
  model: { id: string; name: string; provider: string };
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(model.id)}
      className={cn(
        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all text-left',
        isSelected
          ? 'bg-white/[0.08] text-white/90'
          : 'text-white/45 hover:bg-white/[0.04] hover:text-white/70'
      )}
    >
      <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', PROVIDER_DOTS[model.provider] || 'bg-white/30')} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium truncate">{model.name}</p>
        <p className="text-[9px] text-white/20 capitalize">{model.provider}</p>
      </div>
    </button>
  );
}


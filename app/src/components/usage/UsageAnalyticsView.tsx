'use client';

import { motion } from 'framer-motion';
import { BarChart3, ArrowLeft, Cpu, TrendingUp, Zap, Key, Building2, PanelLeft } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useRouter } from 'next/navigation';

const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10b981',
  anthropic: '#f59e0b',
  google: '#3b82f6',
  mistral: '#8b5cf6',
  groq: '#ef4444',
  openrouter: '#06b6d4',
};

function getColor(provider: string) {
  return PROVIDER_COLORS[provider] || '#6b7280';
}

export function UsageAnalyticsView() {
  const router = useRouter();
  const { usage, sidebarOpen, setSidebarOpen } = useStore();

  const totalRequests = usage.reduce((sum, u) => sum + (u.total_used ?? ((u.platform_used || 0) + (u.own_key_used || 0))), 0);
  const totalLimit = usage.reduce((sum, u) => sum + u.limit, 0);
  const totalRemaining = usage.reduce((sum, u) => sum + u.remaining, 0);
  const totalOwnKey = usage.reduce((sum, u) => sum + (u.own_key_used || 0), 0);
  const totalPlatform = usage.reduce((sum, u) => sum + (u.platform_used || 0), 0);
  const maxLimit = Math.max(...usage.map((u) => u.limit), 1);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-gradient-to-br from-[#151515] via-[#101010] to-[#0b0b0b] p-6 md:p-8"
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] transition-colors md:hidden shrink-0"
            >
              <PanelLeft size={18} className="text-white/60" />
            </button>
            <button
              onClick={() => router.push('/settings')}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
            >
              <ArrowLeft size={16} className="text-white/60" />
            </button>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/15 bg-cyan-400/10">
              <BarChart3 size={20} className="text-cyan-300" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Usage Analytics</h1>
              <p className="text-sm text-white/45">Monthly request activity, platform quota usage, and key-source breakdown.</p>
            </div>
          </div>
        </motion.div>

            {/* Summary Cards */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
            >
              {[
                { label: 'Total Requests', value: totalRequests, icon: Zap, color: 'text-cyan-300', tone: 'from-cyan-400/12 to-cyan-400/0' },
                { label: 'Platform Usage', value: totalPlatform, icon: Building2, color: 'text-violet-300', tone: 'from-violet-400/12 to-violet-400/0' },
                { label: 'Monthly Limit', value: totalLimit, icon: TrendingUp, color: 'text-emerald-300', tone: 'from-emerald-400/12 to-emerald-400/0' },
                { label: 'Remaining', value: totalRemaining, icon: BarChart3, color: 'text-amber-300', tone: 'from-amber-400/12 to-amber-400/0' },
              ].map((card) => (
                <div key={card.label} className={`rounded-[24px] border border-white/[0.08] bg-gradient-to-br ${card.tone} bg-[#101010] p-5`}>
                  <div className="flex items-center gap-2 mb-3">
                    <card.icon size={14} className={card.color} />
                    <span className="text-xs text-white/40 uppercase tracking-[0.18em]">{card.label}</span>
                  </div>
                  <p className="text-3xl font-semibold tracking-tight text-white">{card.value}</p>
                </div>
              ))}
            </motion.div>

            {/* API Key Breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.07 }}
              className="rounded-[28px] border border-white/[0.08] bg-[#101010] p-6"
            >
              <h2 className="text-base font-semibold text-white/90 mb-5">API Key Breakdown</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <div className="rounded-2xl border border-violet-400/15 bg-violet-400/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 size={13} className="text-white/40" />
                    <span className="text-xs text-white/50">Platform Key</span>
                  </div>
                  <p className="text-2xl font-semibold text-white">{totalPlatform}</p>
                  <p className="text-[10px] text-white/35 mt-1">requests that consume monthly platform quota</p>
                </div>
                <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Key size={13} className="text-white/40" />
                    <span className="text-xs text-white/50">Your API Key</span>
                  </div>
                  <p className="text-2xl font-semibold text-white">{totalOwnKey}</p>
                  <p className="text-[10px] text-white/35 mt-1">requests using your own key without reducing platform quota</p>
                </div>
              </div>
              {totalOwnKey > 0 && (
                <div>
                  <p className="text-[11px] text-white/30 mb-3 uppercase tracking-wider">Your key usage by model</p>
                  <div className="space-y-2">
                    {usage.filter((u) => (u.own_key_used || 0) > 0).map((item) => (
                      <div key={item.model.id} className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.01] px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: getColor(item.model.provider) }} />
                          <span className="text-xs text-white/60">{item.model.name}</span>
                        </div>
                        <span className="text-xs text-white/40">{item.own_key_used} requests</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Bar Chart */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-[28px] border border-white/[0.08] bg-[#101010] p-6"
            >
              <h2 className="text-base font-semibold text-white/90 mb-6">Requests by Model</h2>

              {usage.length === 0 ? (
                <p className="text-sm text-white/30 text-center py-8">No usage data available</p>
              ) : (
                <div className="space-y-5">
                  {usage.map((item) => {
                    const totalByModel = item.total_used ?? ((item.platform_used || 0) + (item.own_key_used || 0));
                    const pct = item.limit > 0 ? Math.round((item.used / item.limit) * 100) : 0;
                    const barWidth = (item.limit / maxLimit) * 100;
                    const fillWidth = item.limit > 0 ? (item.used / item.limit) * 100 : 0;

                    return (
                      <div key={item.model.id}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: getColor(item.model.provider) }}
                            />
                            <span className="text-sm text-white/80">{item.model.name}</span>
                            <span className="text-[10px] text-white/30 uppercase">{item.model.provider}</span>
                          </div>
                          <span className="text-xs text-white/50">
                            {totalByModel} total · {item.used}/{item.limit} platform quota ({pct}%)
                          </span>
                        </div>

                        <div
                          className="h-6 rounded-xl bg-white/[0.04] overflow-hidden relative"
                          style={{ width: `${barWidth}%` }}
                        >
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(fillWidth, 100)}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            className="h-full rounded-xl"
                            style={{
                              backgroundColor: getColor(item.model.provider),
                              opacity: 0.6,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* Donut / Pie breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-[28px] border border-white/[0.08] bg-[#101010] p-6"
            >
              <h2 className="text-base font-semibold text-white/90 mb-6">Usage Distribution</h2>

              {totalRequests === 0 ? (
                <p className="text-sm text-white/30 text-center py-8">No requests made yet this month</p>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-8">
                  {/* SVG Donut */}
                  <div className="relative w-40 h-40 shrink-0">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      {(() => {
                        let offset = 0;
                        const circumference = 2 * Math.PI * 38;
                        return usage
                          .filter((u) => (u.total_used ?? ((u.platform_used || 0) + (u.own_key_used || 0))) > 0)
                          .map((item) => {
                            const itemTotal = item.total_used ?? ((item.platform_used || 0) + (item.own_key_used || 0));
                            const pct = itemTotal / totalRequests;
                            const dash = pct * circumference;
                            const gap = circumference - dash;
                            const el = (
                              <circle
                                key={item.model.id}
                                cx="50"
                                cy="50"
                                r="38"
                                fill="none"
                                stroke={getColor(item.model.provider)}
                                strokeWidth="10"
                                strokeDasharray={`${dash} ${gap}`}
                                strokeDashoffset={-offset}
                                strokeLinecap="round"
                                opacity={0.7}
                              />
                            );
                            offset += dash;
                            return el;
                          });
                      })()}
                      {/* Empty background ring */}
                      <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="10" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <span className="text-xl font-semibold text-white/90">{totalRequests}</span>
                      <span className="text-[10px] text-white/35 uppercase">requests</span>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex-1 space-y-3">
                    {usage
                      .filter((u) => (u.total_used ?? ((u.platform_used || 0) + (u.own_key_used || 0))) > 0)
                      .sort((a, b) => (b.total_used ?? ((b.platform_used || 0) + (b.own_key_used || 0))) - (a.total_used ?? ((a.platform_used || 0) + (a.own_key_used || 0))))
                      .map((item) => (
                        <div key={item.model.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: getColor(item.model.provider) }}
                            />
                            <span className="text-sm text-white/70">{item.model.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-white/60">{item.total_used ?? ((item.platform_used || 0) + (item.own_key_used || 0))}</span>
                            <span className="text-xs text-white/30 min-w-[40px] text-right">
                              {Math.round(((item.total_used ?? ((item.platform_used || 0) + (item.own_key_used || 0))) / totalRequests) * 100)}%
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Per-model detail cards */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-[28px] border border-white/[0.08] bg-[#101010] p-6"
            >
              <h2 className="text-base font-semibold text-white/90 mb-6">Model Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {usage.map((item) => {
                  const totalByModel = item.total_used ?? ((item.platform_used || 0) + (item.own_key_used || 0));
                  const pct = item.limit > 0 ? Math.round((item.used / item.limit) * 100) : 0;
                  return (
                    <div
                      key={item.model.id}
                      className="rounded-[24px] border border-white/[0.08] bg-gradient-to-b from-[#141414] to-[#0d0d0d] p-4"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Cpu size={14} style={{ color: getColor(item.model.provider) }} />
                        <span className="text-sm font-medium text-white/85">{item.model.name}</span>
                        <span className="ml-auto text-[10px] text-white/30 uppercase">{item.model.provider}</span>
                      </div>

                      <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden mb-3">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(pct, 100)}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: getColor(item.model.provider), opacity: 0.5 }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-white/40">
                        <span>{totalByModel} total</span>
                        <span>{item.used} platform</span>
                        <span>{item.remaining} remaining</span>
                        <span>{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
      </div>
    </div>
  );
}

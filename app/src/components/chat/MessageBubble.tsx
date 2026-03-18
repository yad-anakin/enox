'use client';

import { useState, useEffect, useRef, memo } from 'react';
import { cn } from '@/lib/utils';
import { Copy, Check, RefreshCw, Activity, BarChart3, AlertTriangle, CheckCircle2, Info, TrendingUp, TrendingDown, Minus, Brain, ChevronDown } from 'lucide-react';
import type { Message } from '@/store/useStore';
import ReactMarkdown from 'react-markdown';
import { EnoxLogo } from '@/components/common/EnoxLogo';

interface Props {
  message: Message;
  isStreaming?: boolean;
  thinkingStartTime?: number | null;
  thinkingDone?: number | null;
  thinkingContent?: string;
  onRegenerate?: () => void;
}

function ShimmerPlaceholder() {
  return (
    <div className="flex flex-col gap-2.5 py-1">
      {[85, 70, 50].map((width, i) => (
        <div
          key={i}
          className="h-3 rounded-full animate-shimmer"
          style={{
            width: `${width}%`,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.04) 75%)',
            backgroundSize: '200% 100%',
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}

function extractCodeText(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(extractCodeText).join('');
  if (children && typeof children === 'object' && 'props' in children) {
    return extractCodeText((children as { props?: { children?: React.ReactNode } }).props?.children);
  }
  return '';
}

function CodeBlock({ children, className }: { children?: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const rawCode = extractCodeText(children).replace(/\n$/, '');
  const language = className?.replace('language-', '') || 'code';

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(rawCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0b0b]">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#111111] px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-[11px] uppercase tracking-[0.18em] text-white/35">{language}</span>
        </div>
        <button
          onClick={handleCopyCode}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-white/40 transition-colors hover:bg-white/5 hover:text-white/75"
        >
          {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy code'}
        </button>
      </div>
      <pre className="overflow-x-auto bg-[#0b0b0b] px-4 py-4 text-[13px] leading-6 text-white/88">
        <code className="block whitespace-pre">{rawCode}</code>
      </pre>
    </div>
  );
}

function shouldRenderAsCodeBlock(rawCode: string, className?: string) {
  if (className?.startsWith('language-')) return true;
  return rawCode.includes('\n');
}

function extractPlainText(children: React.ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(extractPlainText).join('');
  if (children && typeof children === 'object' && 'props' in children) {
    return extractPlainText((children as { props?: { children?: React.ReactNode } }).props?.children);
  }
  return '';
}

function renderCallout(children: React.ReactNode) {
  const text = extractPlainText(children).trim();
  const match = text.match(/^(status|usage|analytics|analysis|warning|success|error|info|summary)\s*:\s*(.+)$/i);
  if (!match) return null;

  const label = match[1].toLowerCase();
  const content = match[2];

  const variants = {
    status: {
      icon: Activity,
      wrapper: 'border-blue-500/15 bg-blue-500/8',
      badge: 'bg-blue-500/12 text-blue-300/85 border-blue-400/15',
    },
    usage: {
      icon: BarChart3,
      wrapper: 'border-violet-500/15 bg-violet-500/8',
      badge: 'bg-violet-500/12 text-violet-300/85 border-violet-400/15',
    },
    analytics: {
      icon: BarChart3,
      wrapper: 'border-fuchsia-500/15 bg-fuchsia-500/8',
      badge: 'bg-fuchsia-500/12 text-fuchsia-300/85 border-fuchsia-400/15',
    },
    analysis: {
      icon: BarChart3,
      wrapper: 'border-fuchsia-500/15 bg-fuchsia-500/8',
      badge: 'bg-fuchsia-500/12 text-fuchsia-300/85 border-fuchsia-400/15',
    },
    warning: {
      icon: AlertTriangle,
      wrapper: 'border-amber-500/15 bg-amber-500/8',
      badge: 'bg-amber-500/12 text-amber-300/85 border-amber-400/15',
    },
    success: {
      icon: CheckCircle2,
      wrapper: 'border-emerald-500/15 bg-emerald-500/8',
      badge: 'bg-emerald-500/12 text-emerald-300/85 border-emerald-400/15',
    },
    error: {
      icon: AlertTriangle,
      wrapper: 'border-rose-500/15 bg-rose-500/8',
      badge: 'bg-rose-500/12 text-rose-300/85 border-rose-400/15',
    },
    info: {
      icon: Info,
      wrapper: 'border-cyan-500/15 bg-cyan-500/8',
      badge: 'bg-cyan-500/12 text-cyan-300/85 border-cyan-400/15',
    },
    summary: {
      icon: Info,
      wrapper: 'border-white/[0.08] bg-white/[0.03]',
      badge: 'bg-white/[0.05] text-white/70 border-white/[0.08]',
    },
  } as const;

  const variant = variants[label as keyof typeof variants] || variants.info;
  const Icon = variant.icon;

  return (
    <div className={cn('my-4 rounded-2xl border px-4 py-3', variant.wrapper)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-black/20">
          <Icon size={15} className="text-white/70" />
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn('mb-2 inline-flex items-center rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.16em]', variant.badge)}>
            {label}
          </div>
          <p className="m-0 text-sm leading-6 text-white/80 break-words [overflow-wrap:anywhere]">{content}</p>
        </div>
      </div>
    </div>
  );
}

type MetricRow = {
  metric: string;
  current: string;
  previous: string;
  trend: string;
};

type GenericTableData = {
  title?: string;
  headers: string[];
  rows: string[][];
};

function parseGenericMarkdownTable(text: string): GenericTableData | null {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 3) return null;

  const tableStart = lines.findIndex((line) => line.includes('|'));
  if (tableStart === -1 || lines.length - tableStart < 3) return null;

  const parseLine = (line: string) => line.split('|').map((cell) => cell.trim()).filter(Boolean);
  const title = lines.slice(0, tableStart).join(' ') || undefined;
  const tableLines = lines.slice(tableStart).filter((line) => line.includes('|'));
  const headers = parseLine(tableLines[0]);
  const separator = tableLines[1].replace(/[|:\-\s]/g, '');

  if (headers.length < 2 || separator.length > 0) return null;

  const rows = tableLines.slice(2)
    .map(parseLine)
    .filter((cells) => cells.length >= headers.length)
    .map((cells) => headers.map((_, index) => cells[index] || ''));

  return rows.length ? { title, headers, rows } : null;
}

function renderGenericMarkdownTable(children: React.ReactNode) {
  const table = parseGenericMarkdownTable(extractPlainText(children).trim());
  if (!table) return null;

  return (
    <div className="my-5 overflow-hidden rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))]">
      {table.title ? <div className="border-b border-white/[0.06] px-4 py-3 sm:px-5"><h3 className="m-0 text-sm font-semibold tracking-tight text-white/90">{table.title}</h3></div> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead className="bg-white/[0.04]"><tr className="border-b border-white/[0.06]">{table.headers.map((header) => <th key={header} className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-white/45 sm:px-5">{header}</th>)}</tr></thead>
          <tbody>{table.rows.map((row, rowIndex) => <tr key={`${row.join('-')}-${rowIndex}`} className="border-t border-white/[0.06] align-top">{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`} className="px-4 py-3 text-white/78 break-words [overflow-wrap:anywhere] sm:px-5">{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function parseMetricTable(text: string): MetricRow[] | null {
  const normalized = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const tableLines = normalized.filter((line) => line.includes('|'));
  if (tableLines.length < 3) return null;

  const parseLine = (line: string) => line.split('|').map((cell) => cell.trim()).filter(Boolean);
  const header = parseLine(tableLines[0]).map((cell) => cell.toLowerCase());
  const separator = tableLines[1].replace(/[|:\-\s]/g, '');

  if (!header.includes('metric') || !header.includes('current') || !header.includes('previous') || !header.includes('trend')) {
    return null;
  }

  if (separator.length > 0) return null;

  const metricIndex = header.indexOf('metric');
  const currentIndex = header.indexOf('current');
  const previousIndex = header.indexOf('previous');
  const trendIndex = header.indexOf('trend');

  const rows = tableLines.slice(2).map((line) => {
    const cells = parseLine(line);
    if (cells.length < 4) return null;
    return {
      metric: cells[metricIndex] || '',
      current: cells[currentIndex] || '',
      previous: cells[previousIndex] || '',
      trend: cells[trendIndex] || '',
    } satisfies MetricRow;
  }).filter((row): row is MetricRow => Boolean(row));

  return rows.length > 0 ? rows : null;
}

function getTrendMeta(trend: string) {
  const normalized = trend.trim().toLowerCase();

  if (normalized.includes('▲') || normalized.includes('up') || normalized.includes('increase') || normalized.includes('growth')) {
    return {
      icon: TrendingUp,
      line: 'from-emerald-500/80 via-emerald-300/60 to-emerald-500/20',
      badge: 'bg-emerald-500/12 text-emerald-300 border-emerald-400/15',
      label: 'Up',
    };
  }

  if (normalized.includes('▼') || normalized.includes('down') || normalized.includes('decrease') || normalized.includes('drop')) {
    return {
      icon: TrendingDown,
      line: 'from-rose-500/80 via-rose-300/60 to-rose-500/20',
      badge: 'bg-rose-500/12 text-rose-300 border-rose-400/15',
      label: 'Down',
    };
  }

  return {
    icon: Minus,
    line: 'from-white/30 via-white/10 to-white/5',
    badge: 'bg-white/[0.05] text-white/60 border-white/[0.08]',
    label: 'Flat',
  };
}

function parseNumericValue(value: string) {
  const cleaned = value.replace(/,/g, '').trim();
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function getMetricKind(metric: string, current: string) {
  const normalized = `${metric} ${current}`.toLowerCase();
  if (normalized.includes('%') || normalized.includes('rate') || normalized.includes('retention') || normalized.includes('conversion')) {
    return 'rate';
  }
  if (normalized.includes('time') || normalized.includes('latency') || normalized.includes('response')) {
    return 'latency';
  }
  if (normalized.includes('failed') || normalized.includes('error') || normalized.includes('downtime')) {
    return 'failure';
  }
  return 'count';
}

function isHigherBetter(kind: string) {
  return kind !== 'latency' && kind !== 'failure';
}

function getMetricVisualMeta(row: MetricRow) {
  const kind = getMetricKind(row.metric, row.current);
  const baseTrend = getTrendMeta(row.trend);
  const higherBetter = isHigherBetter(kind);
  const currentValue = parseNumericValue(row.current);
  const previousValue = parseNumericValue(row.previous);
  const delta = currentValue !== null && previousValue !== null ? currentValue - previousValue : null;
  const improved = delta === null ? baseTrend.label !== 'Down' : higherBetter ? delta >= 0 : delta <= 0;

  const positive = {
    text: 'text-emerald-300',
    soft: 'bg-emerald-500/12',
    border: 'border-emerald-400/15',
    graph: 'from-emerald-500/90 via-emerald-300/65 to-emerald-500/25',
    stroke: 'rgba(52, 211, 153, 0.95)',
    fill: 'rgba(16, 185, 129, 0.95)',
    solid: 'bg-emerald-400/90',
  };

  const negative = {
    text: 'text-rose-300',
    soft: 'bg-rose-500/12',
    border: 'border-rose-400/15',
    graph: 'from-rose-500/90 via-rose-300/65 to-rose-500/25',
    stroke: 'rgba(251, 113, 133, 0.95)',
    fill: 'rgba(244, 63, 94, 0.95)',
    solid: 'bg-rose-400/90',
  };

  const neutral = {
    text: 'text-white/70',
    soft: 'bg-white/[0.05]',
    border: 'border-white/[0.08]',
    graph: 'from-white/40 via-white/15 to-white/5',
    stroke: 'rgba(255,255,255,0.75)',
    fill: 'rgba(255,255,255,0.75)',
    solid: 'bg-white/40',
  };

  const palette = delta === null ? neutral : improved ? positive : negative;
  const progress = currentValue === null
    ? 0.5
    : kind === 'rate' || kind === 'failure'
      ? Math.max(0, Math.min(1, currentValue / 100))
      : previousValue && previousValue > 0
        ? Math.max(0.15, Math.min(1, currentValue / (Math.max(currentValue, previousValue) * 1.1)))
        : 0.65;

  const series = buildMetricSeries(currentValue, previousValue, improved);

  return { kind, higherBetter, currentValue, previousValue, delta, improved, palette, progress, baseTrend, series };
}

function RingMetric({ progress, stroke }: { progress: number; stroke: string }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - circumference * progress;

  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
        <circle cx="28" cy="28" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] text-white/70">
        {Math.round(progress * 100)}%
      </div>
    </div>
  );
}

function buildMetricSeries(current: number | null, previous: number | null, improved: boolean) {
  const safeCurrent = current ?? 50;
  const safePrevious = previous ?? safeCurrent * 0.92;
  const mid = (safeCurrent + safePrevious) / 2;
  const drift = Math.max(Math.abs(safeCurrent - safePrevious) * 0.35, Math.max(safeCurrent, safePrevious) * 0.04, 1);

  const series = [
    safePrevious * 0.92,
    safePrevious,
    mid - drift * 0.5,
    mid,
    mid + (improved ? drift * 0.35 : -drift * 0.35),
    safeCurrent * 0.96,
    safeCurrent,
  ];

  return series.map((value) => Math.max(value, 0.1));
}

function buildSparkPath(values: number[]) {
  const width = 240;
  const height = 64;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 12) - 6;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

function buildAreaPath(values: number[]) {
  const linePath = buildSparkPath(values);
  return `${linePath} L 240 64 L 0 64 Z`;
}

function SparklineMetric({ values, stroke, fill }: { values: number[]; stroke: string; fill: string }) {
  const linePath = buildSparkPath(values);
  const areaPath = buildAreaPath(values);

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2">
      <svg viewBox="0 0 240 64" className="h-14 w-full">
        <defs>
          <linearGradient id={`area-${stroke.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fill} stopOpacity="0.42" />
            <stop offset="100%" stopColor={fill} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#area-${stroke.replace(/[^a-zA-Z0-9]/g, '')})`} />
        <path d={linePath} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function ComparisonBars({ current, previous, currentLabel, previousLabel, accentClass }: { current: number | null; previous: number | null; currentLabel: string; previousLabel: string; accentClass: string }) {
  const max = Math.max(current ?? 0, previous ?? 0, 1);
  const currentWidth = `${((current ?? 0) / max) * 100}%`;
  const previousWidth = `${((previous ?? 0) / max) * 100}%`;

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] text-white/40">
          <span>{previousLabel}</span>
          <span>{previous ?? '—'}</span>
        </div>
        <div className="h-2 rounded-full bg-white/[0.05]">
          <div className="h-2 rounded-full bg-white/20" style={{ width: previousWidth }} />
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] text-white/55">
          <span>{currentLabel}</span>
          <span>{current ?? '—'}</span>
        </div>
        <div className="h-2 rounded-full bg-white/[0.05]">
          <div className={cn('h-2 rounded-full', accentClass)} style={{ width: currentWidth }} />
        </div>
      </div>
    </div>
  );
}

function renderMetricTable(children: React.ReactNode) {
  const text = extractPlainText(children).trim();
  const rows = parseMetricTable(text);
  if (!rows) return null;

  return (
    <div className="my-6 overflow-hidden rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-4 backdrop-blur-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.05]">
            <BarChart3 size={16} className="text-white/70" />
          </div>
          <div>
            <p className="text-sm font-medium text-white/90">Key Performance Metrics</p>
            <p className="text-xs text-white/35">Live-style analytics summary</p>
          </div>
        </div>
        <div className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/40">
          Dashboard
        </div>
      </div>
      <div className="grid gap-3">
        {rows.map((row) => {
          const trend = getTrendMeta(row.trend);
          const TrendIcon = trend.icon;
          const visual = getMetricVisualMeta(row);
          const trendLabel = visual.higherBetter ? trend.label : trend.label === 'Up' ? 'Higher' : trend.label === 'Down' ? 'Lower' : trend.label;

          return (
            <div key={`${row.metric}-${row.current}-${row.previous}`} className="group relative overflow-hidden rounded-[26px] border border-white/[0.07] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),rgba(255,255,255,0.015)_45%,rgba(0,0,0,0.24)_100%)] p-4">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-medium text-white/92 break-words [overflow-wrap:anywhere]">{row.metric}</div>
                    <div className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white/38">
                      KPI
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/38">
                    <span>Previous {row.previous}</span>
                    <span className="h-1 w-1 rounded-full bg-white/20" />
                    <span>Current {row.current}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <div className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]', visual.palette.soft, visual.palette.border, visual.palette.text)}>
                      <TrendIcon size={12} />
                      {trendLabel}
                    </div>
                    {visual.delta !== null && (
                      <span className={cn('rounded-full border px-2.5 py-1 text-[11px]', visual.palette.border, visual.palette.text)}>
                        {visual.delta > 0 ? '+' : ''}{visual.delta.toFixed(visual.kind === 'count' ? 0 : 1)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="rounded-[22px] border border-white/[0.06] bg-black/20 px-4 py-3 md:min-w-[160px]">
                  <div className="flex items-center gap-3">
                    {(visual.kind === 'rate' || visual.kind === 'failure') ? (
                      <RingMetric progress={visual.progress} stroke={visual.palette.stroke} />
                    ) : null}
                    <div className="text-right">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/30">Current</div>
                      <div className="mt-1 text-2xl font-semibold tracking-tight text-white/95">{row.current}</div>
                      <div className="mt-1 text-[11px] text-white/35">{visual.improved ? 'Healthy trend' : 'Needs attention'}</div>
                    </div>
                  </div>
                </div>
              </div>
              {visual.kind === 'count' ? (
                <SparklineMetric values={visual.series} stroke={visual.palette.stroke} fill={visual.palette.fill} />
              ) : null}
              {visual.kind === 'latency' ? (
                <ComparisonBars
                  current={visual.currentValue}
                  previous={visual.previousValue}
                  currentLabel="Current latency"
                  previousLabel="Previous latency"
                  accentClass={visual.palette.solid}
                />
              ) : null}
              {visual.kind === 'rate' ? (
                <ComparisonBars
                  current={visual.currentValue}
                  previous={visual.previousValue}
                  currentLabel="Current rate"
                  previousLabel="Previous rate"
                  accentClass={visual.palette.solid}
                />
              ) : null}
              {visual.kind === 'failure' ? (
                <ComparisonBars
                  current={visual.currentValue}
                  previous={visual.previousValue}
                  currentLabel="Current failure rate"
                  previousLabel="Previous failure rate"
                  accentClass={visual.palette.solid}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ThinkingIndicator({ startTime, doneTime, content }: { startTime?: number | null; doneTime?: number | null; content?: string }) {
  const [elapsed, setElapsed] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const contentEndRef = useRef<HTMLDivElement>(null);
  const isThinking = !!startTime;
  const isDone = doneTime != null;
  const hasContent = !!content?.trim();
  const canExpand = isThinking || isDone;

  useEffect(() => {
    if (!startTime) return;
    setElapsed(0);
    setExpanded(true);
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 100);
    return () => clearInterval(interval);
  }, [startTime]);

  // Auto-scroll thinking content while streaming
  useEffect(() => {
    if (expanded && isThinking && contentEndRef.current) {
      contentEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [content, expanded, isThinking]);

  if (!isThinking && !isDone) return null;

  const displayTime = isDone ? doneTime : elapsed;

  return (
    <div className="mb-3">
      {/* Header button */}
      <button
        onClick={() => canExpand && setExpanded(!expanded)}
        className={cn(
          'flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition-all w-full text-left',
          isThinking
            ? 'bg-white/[0.04] border border-white/[0.08] text-white/60'
            : canExpand
            ? 'bg-white/[0.03] border border-white/[0.06] text-white/40 hover:bg-white/[0.05] cursor-pointer'
            : 'bg-white/[0.03] border border-white/[0.06] text-white/40'
        )}
      >
        <Brain size={14} className={cn(
          isThinking ? 'animate-pulse text-white/70' : 'text-white/40'
        )} />
        <span className="font-medium">
          {isThinking ? 'Thinking' : `Thought for ${displayTime}s`}
        </span>
        {isThinking && (
          <span className="tabular-nums text-white/40">{displayTime}s</span>
        )}
        {isThinking && (
          <span className="flex gap-0.5">
            <span className="h-1 w-1 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="h-1 w-1 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="h-1 w-1 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        )}
        <span className="ml-auto">
          {canExpand && (
            <ChevronDown size={12} className={cn(
              'transition-transform duration-200',
              !expanded && '-rotate-90'
            )} />
          )}
        </span>
      </button>

      {/* Expandable thinking content container */}
      {expanded && canExpand && (
        <div className="mt-1.5 overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent">
          {/* Top gradient accent line */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent px-4 py-3">
            <p className="text-xs leading-5 text-white/40 whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-mono">
              {hasContent ? content : 'This model completed a reasoning pass before answering, but it did not expose raw intermediate thought tokens for display in the UI. The time shown above reflects the model\'s internal thinking duration before the first answer token was streamed.'}
              {isThinking && (
                <span className="ml-0.5 inline-block h-3 w-1 rounded-full bg-white/40 align-middle animate-pulse" />
              )}
            </p>
            <div ref={contentEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}

export const MessageBubble = memo(function MessageBubble({ message, isStreaming, thinkingStartTime, thinkingDone, thinkingContent, onRegenerate }: Props) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        'flex flex-col',
        isUser ? 'items-end' : 'items-start',
        // Only animate entrance for non-streaming messages
        !isStreaming && 'animate-in fade-in slide-in-from-bottom-1 duration-200'
      )}
    >
      {/* AI logo above assistant text — hidden during streaming (StreamingStatus shows it instead) */}
      {!isUser && !isStreaming && (
        <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06]">
          <EnoxLogo className="h-[16px] w-[16px] text-white/70" />
        </div>
      )}

      <div className={cn('max-w-full min-w-0', isUser ? 'max-w-[85%]' : 'w-full')}>
        <div
          className={cn(
            'inline-block max-w-full min-w-0 rounded-2xl px-4 py-3',
            isUser
              ? 'bg-white/[0.08] text-white/90'
              : 'text-white/80'
          )}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content}</p>
          ) : (
            <div className={cn(
              'prose prose-invert prose-sm max-w-none break-words [overflow-wrap:anywhere] [&_*]:max-w-full [&_p]:leading-relaxed [&_p]:break-words [&_p]:[overflow-wrap:anywhere] [&_li]:break-words [&_li]:[overflow-wrap:anywhere] [&_ol]:break-words [&_ul]:break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:whitespace-pre [&_code]:break-words',
              isStreaming && 'text-white/90'
            )}>
              {(thinkingStartTime || thinkingDone) && (
                <ThinkingIndicator startTime={thinkingStartTime} doneTime={thinkingDone} content={thinkingContent} />
              )}
              {!message.content && isStreaming ? (
                thinkingStartTime ? null : <ShimmerPlaceholder />
              ) : isStreaming ? (
                <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-relaxed">
                  {message.content}
                  <span className="ml-0.5 inline-block h-4 w-1.5 rounded-full bg-white/70 align-middle animate-pulse" />
                </p>
              ) : (
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => <h1 className="mb-4 mt-1 text-2xl font-semibold tracking-tight text-white/95">{children}</h1>,
                    h2: ({ children }) => <h2 className="mb-3 mt-5 text-xl font-semibold tracking-tight text-white/92">{children}</h2>,
                    h3: ({ children }) => <h3 className="mb-2 mt-4 text-base font-semibold tracking-tight text-white/90">{children}</h3>,
                    p: ({ children }) => {
                      const metricTable = renderMetricTable(children);
                      if (metricTable) return metricTable;
                      const genericTable = renderGenericMarkdownTable(children);
                      if (genericTable) return genericTable;
                      const callout = renderCallout(children);
                      if (callout) return callout;
                      return <p className="my-3 leading-7 text-white/82 break-words [overflow-wrap:anywhere]">{children}</p>;
                    },
                    ul: ({ children }) => <ul className="my-3 space-y-2 pl-1">{children}</ul>,
                    ol: ({ children }) => <ol className="my-3 space-y-2 pl-1">{children}</ol>,
                    li: ({ children }) => (
                      <li className="flex items-start gap-2 text-white/80 break-words [overflow-wrap:anywhere]">
                        <span className="mt-[7px] flex h-1.5 w-1.5 shrink-0 rounded-full bg-white/30" />
                        <span className="min-w-0 flex-1 leading-7">{children}</span>
                      </li>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="my-4 rounded-r-2xl rounded-l-md border-l-2 border-white/15 bg-white/[0.03] px-4 py-3 text-white/72">
                        {children}
                      </blockquote>
                    ),
                    hr: () => <div className="my-5 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />,
                    table: ({ children }) => (
                      <div className="my-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[420px] border-collapse text-left text-sm">{children}</table>
                        </div>
                      </div>
                    ),
                    thead: ({ children }) => <thead className="bg-white/[0.04]">{children}</thead>,
                    tbody: ({ children }) => <tbody>{children}</tbody>,
                    tr: ({ children }) => <tr className="border-t border-white/[0.06]">{children}</tr>,
                    th: ({ children }) => <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">{children}</th>,
                    td: ({ children }) => <td className="px-4 py-3 align-top text-white/78 break-words [overflow-wrap:anywhere]">{children}</td>,
                    strong: ({ children }) => <strong className="font-semibold text-white/92">{children}</strong>,
                    pre: ({ children }) => <>{children}</>,
                    code: ({ className, children }) => {
                      const rawCode = extractCodeText(children).replace(/\n$/, '');
                      const isBlockCode = shouldRenderAsCodeBlock(rawCode, className);

                      return !isBlockCode ? (
                        <code className="rounded-md border border-white/[0.08] bg-white/[0.05] px-1.5 py-0.5 text-[12px] text-white/85 break-all">
                          {children}
                        </code>
                      ) : (
                        <CodeBlock className={className}>{children}</CodeBlock>
                      );
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              )}
            </div>
          )}
        </div>

        {!isUser && message.content && !isStreaming && (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors text-[11px] text-white/35 hover:text-white/70"
              >
                <RefreshCw size={12} />
                Regenerate
              </button>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors text-[11px] text-white/35 hover:text-white/70"
            >
              {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

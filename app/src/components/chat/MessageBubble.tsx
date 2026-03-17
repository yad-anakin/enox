'use client';

import { useState, memo } from 'react';
import { cn } from '@/lib/utils';
import { Copy, Check } from 'lucide-react';
import type { Message } from '@/store/useStore';
import ReactMarkdown from 'react-markdown';
import { EnoxLogo } from '@/components/common/EnoxLogo';

interface Props {
  message: Message;
  isStreaming?: boolean;
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

export const MessageBubble = memo(function MessageBubble({ message, isStreaming }: Props) {
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

      {/* Content */}
      <div className={cn('group max-w-full', isUser ? 'max-w-[85%]' : 'w-full')}>
        <div
          className={cn(
            'inline-block max-w-full rounded-2xl px-4 py-3',
            isUser
              ? 'bg-white/[0.08] text-white/90'
              : 'text-white/80'
          )}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className={cn(
              'prose prose-invert prose-sm max-w-none [&_p]:leading-relaxed [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-white/[0.06] [&_pre]:bg-white/[0.04] [&_code]:rounded [&_code]:bg-white/[0.04] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_code]:text-white/80',
              isStreaming && 'text-white/90'
            )}>
              {!message.content && isStreaming ? (
                <ShimmerPlaceholder />
              ) : isStreaming ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.content}
                  <span className="ml-0.5 inline-block h-4 w-1.5 rounded-full bg-white/70 align-middle animate-pulse" />
                </p>
              ) : (
                <ReactMarkdown>{message.content}</ReactMarkdown>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {!isUser && message.content && !isStreaming && (
          <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} className="text-white/30" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

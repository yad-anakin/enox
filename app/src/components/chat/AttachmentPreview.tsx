'use client';

import { X, Image as ImageIcon, Mic, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Attachment {
  id: string;
  type: 'image' | 'voice' | 'file';
  mimeType: string;
  data: string; // base64
  name: string;
  preview?: string; // data URL for image preview
  size?: number;
}

interface AttachmentPreviewProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentChip({ attachment, onRemove }: { attachment: Attachment; onRemove: () => void }) {
  const icon = attachment.type === 'image' ? ImageIcon
    : attachment.type === 'voice' ? Mic
    : FileText;
  const Icon = icon;

  const colors = attachment.type === 'image'
    ? 'border-blue-500/20 bg-blue-500/10'
    : attachment.type === 'voice'
    ? 'border-emerald-500/20 bg-emerald-500/10'
    : 'border-white/[0.1] bg-white/[0.05]';

  const iconColor = attachment.type === 'image'
    ? 'text-blue-400'
    : attachment.type === 'voice'
    ? 'text-emerald-400'
    : 'text-white/50';

  return (
    <div className={cn('group relative flex items-center gap-2 rounded-xl border px-3 py-2 transition-all', colors)}>
      {attachment.type === 'image' && attachment.preview ? (
        <img
          src={attachment.preview}
          alt={attachment.name}
          className="h-8 w-8 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/20">
          <Icon size={14} className={iconColor} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-white/70 max-w-[120px]">{attachment.name}</p>
        {attachment.size && (
          <p className="text-[10px] text-white/30">{formatSize(attachment.size)}</p>
        )}
      </div>
      <button
        onClick={onRemove}
        className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-white/40 transition-colors hover:bg-white/20 hover:text-white/70"
      >
        <X size={10} />
      </button>
    </div>
  );
}

export function AttachmentPreview({ attachments, onRemove }: AttachmentPreviewProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-1 pb-2">
      {attachments.map((att) => (
        <AttachmentChip key={att.id} attachment={att} onRemove={() => onRemove(att.id)} />
      ))}
    </div>
  );
}

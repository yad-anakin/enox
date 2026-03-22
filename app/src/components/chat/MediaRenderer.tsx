'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { Download, Play, Pause, Volume2, Image as ImageIcon, Film, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MediaItem {
  type: 'image' | 'audio' | 'video';
  mimeType: string;
  data: string; // base64
}

function dataUrl(mimeType: string, data: string) {
  return `data:${mimeType};base64,${data}`;
}

/** Decode base64 to Uint8Array */
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Wrap raw PCM samples (16-bit LE, mono) in a WAV container */
function wrapPcmInWav(pcm: Uint8Array, sampleRate = 24000): Uint8Array {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcm.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const out = new Uint8Array(buffer);

  // RIFF header
  out.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  view.setUint32(4, 36 + dataSize, true);
  out.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"
  // fmt sub-chunk
  out.set([0x66, 0x6D, 0x74, 0x20], 12); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  // data sub-chunk
  out.set([0x64, 0x61, 0x74, 0x61], 36); // "data"
  view.setUint32(40, dataSize, true);
  out.set(pcm, 44);

  return out;
}

/** Build a Blob URL from base64 audio, auto-wrapping raw PCM in WAV if needed */
function buildAudioBlob(mimeType: string, b64Data: string): { url: string; mime: string } {
  if (!b64Data || b64Data.length === 0) {
    console.error('[audio] buildAudioBlob called with empty data');
    // Return a silent WAV so the component doesn't crash
    const silent = wrapPcmInWav(new Uint8Array(4800), 24000); // 0.1s silence
    const blob = new Blob([silent.buffer.slice(silent.byteOffset, silent.byteOffset + silent.byteLength) as ArrayBuffer], { type: 'audio/wav' });
    return { url: URL.createObjectURL(blob), mime: 'audio/wav' };
  }
  console.log(`[audio] buildAudioBlob: mimeType=${mimeType}, b64 length=${b64Data.length}`);
  const bytes = b64ToBytes(b64Data);

  // Trust the mimeType for known playable formats
  if (mimeType === 'audio/mpeg' || mimeType === 'audio/mp3') {
    const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: 'audio/mpeg' });
    return { url: URL.createObjectURL(blob), mime: 'audio/mpeg' };
  }

  // Check if already a valid RIFF/WAV
  const hasRiff = bytes.length > 44 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
    bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45;  // WAVE

  if (hasRiff) {
    // Already WAV — use as-is
    const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: 'audio/wav' });
    return { url: URL.createObjectURL(blob), mime: 'audio/wav' };
  }

  // Check for MP3 (starts with ID3 or 0xFF 0xFB)
  const isMp3 = (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || // ID3
                (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0);                // sync
  if (isMp3) {
    const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: 'audio/mpeg' });
    return { url: URL.createObjectURL(blob), mime: 'audio/mpeg' };
  }

  // Raw PCM — wrap in WAV (extract sample rate from mimeType if present)
  const rateMatch = mimeType.match(/rate=(\d+)/);
  const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;
  const wavBytes = wrapPcmInWav(bytes, sampleRate);
  const blob = new Blob([wavBytes.buffer.slice(wavBytes.byteOffset, wavBytes.byteOffset + wavBytes.byteLength) as ArrayBuffer], { type: 'audio/wav' });
  return { url: URL.createObjectURL(blob), mime: 'audio/wav' };
}

function InlineImage({ item }: { item: MediaItem }) {
  const [expanded, setExpanded] = useState(false);
  const src = dataUrl(item.mimeType, item.data);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = src;
    a.download = `generated-image.${item.mimeType.split('/')[1] || 'png'}`;
    a.click();
  };

  return (
    <div className="my-3 group relative">
      <div
        className={cn(
          'overflow-hidden rounded-2xl border border-white/[0.08] bg-black/30 cursor-pointer transition-all',
          expanded ? 'max-w-full' : 'max-w-md'
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <img
          src={src}
          alt="Generated image"
          className={cn('w-full object-contain', expanded ? 'max-h-[80vh]' : 'max-h-[400px]')}
        />
      </div>
      <div className="mt-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors text-[11px] text-white/35 hover:text-white/70"
        >
          <Download size={12} />
          Download
        </button>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors text-[11px] text-white/35 hover:text-white/70"
        >
          <Maximize2 size={12} />
          {expanded ? 'Shrink' : 'Expand'}
        </button>
      </div>
    </div>
  );
}

function InlineAudio({ item }: { item: MediaItem }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playError, setPlayError] = useState(false);

  // Build a Blob URL — much more reliable than data: URLs for audio in Chrome/iOS
  // NOTE: We intentionally do NOT revoke blob URLs in useEffect because React Strict Mode
  // unmounts→remounts components in dev, which revokes the URL before the audio element loads.
  // Blob URLs are freed when the page/tab closes, so the memory impact is negligible.
  const audioBlob = useMemo(() => buildAudioBlob(item.mimeType, item.data), [item.mimeType, item.data]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => {
        setPlaying(true);
      }).catch((err) => {
        console.warn('[audio] playback failed:', err.message);
        setPlayError(true);
      });
    }
  }, [playing]);

  const handleDownload = () => {
    const ext = audioBlob.mime.includes('mpeg') ? 'mp3' : 'wav';
    const a = document.createElement('a');
    a.href = audioBlob.url;
    a.download = `generated-audio.${ext}`;
    a.click();
  };

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="my-3 max-w-sm">
      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
        <button
          onClick={togglePlay}
          disabled={playError}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all',
            playError ? 'bg-red-500/10 text-red-400/50 cursor-not-allowed' : 'bg-white/10 text-white/70 hover:bg-white/15'
          )}
        >
          {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Volume2 size={12} className="text-white/30" />
            <span className="text-[11px] text-white/40">
              {playError ? 'Playback error — try downloading' : 'Generated Audio'}
            </span>
          </div>
          <div className="relative h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/40 transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-white/30 tabular-nums">{formatTime(duration * progress)}</span>
            <span className="text-[10px] text-white/30 tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>
        <button
          onClick={handleDownload}
          className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
        >
          <Download size={14} />
        </button>
      </div>
      <audio
        ref={audioRef}
        src={audioBlob.url}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration)}
        onTimeUpdate={(e) => {
          const audio = e.target as HTMLAudioElement;
          if (audio.duration) setProgress(audio.currentTime / audio.duration);
        }}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onError={() => setPlayError(true)}
      />
    </div>
  );
}

function InlineVideo({ item }: { item: MediaItem }) {
  const src = dataUrl(item.mimeType, item.data);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = src;
    a.download = `generated-video.${item.mimeType.split('/')[1] || 'mp4'}`;
    a.click();
  };

  return (
    <div className="my-3 group relative max-w-lg">
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/30">
        <video
          src={src}
          controls
          playsInline
          className="w-full max-h-[400px]"
        />
      </div>
      <div className="mt-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors text-[11px] text-white/35 hover:text-white/70"
        >
          <Download size={12} />
          Download
        </button>
      </div>
    </div>
  );
}

export function MediaRenderer({ items }: { items: MediaItem[] }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        if (item.type === 'image' || item.mimeType.startsWith('image/')) {
          return <InlineImage key={i} item={item} />;
        }
        if (item.type === 'audio' || item.mimeType.startsWith('audio/')) {
          return <InlineAudio key={i} item={item} />;
        }
        if (item.type === 'video' || item.mimeType.startsWith('video/')) {
          return <InlineVideo key={i} item={item} />;
        }
        return null;
      })}
    </div>
  );
}

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceRecorderProps {
  onRecorded: (blob: Blob, mimeType: string) => void;
  disabled?: boolean;
}

// Get the best supported audio MIME type — prioritize MP4/AAC for iOS compatibility
function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  // MP4/AAC works on iOS Safari, Chrome, and most browsers
  const types = [
    'audio/mp4',
    'audio/aac',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

export function VoiceRecorder({ onRecorded, disabled }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setDuration(0);
    setRecording(false);
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    try {
      const mimeType = getSupportedMimeType();
      if (!mimeType) {
        console.error('No supported audio MIME type found');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        // Convert non-MP4 formats to a universally playable format
        // For iOS: if we got webm, we still send it — the backend handles it
        // The mimeType tells the backend what format to expect
        const finalMime = mimeType.split(';')[0]; // strip codecs
        onRecorded(blob, finalMime);
        cleanup();
      };

      recorder.start(100); // collect data every 100ms for smooth UX
      setRecording(true);

      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      cleanup();
    }
  }, [onRecorded, cleanup]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (recording) {
    return (
      <button
        onClick={stopRecording}
        className="flex items-center gap-2 rounded-xl px-3 py-2 bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all duration-200"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        <span className="text-xs font-medium tabular-nums">{formatDuration(duration)}</span>
        <Square size={12} />
      </button>
    );
  }

  return (
    <button
      onClick={startRecording}
      disabled={disabled}
      title="Record voice message"
      className={cn(
        'p-2 rounded-xl transition-all duration-200',
        disabled
          ? 'bg-white/5 text-white/20 cursor-not-allowed'
          : 'bg-white/[0.06] text-white/50 hover:bg-white/[0.1] hover:text-white/70 border border-white/[0.06]'
      )}
    >
      <Mic size={16} />
    </button>
  );
}

'use client';

import { Suspense } from 'react';
import { AgentStudio } from '@/components/agents/AgentStudio';

export default function AgentStudioPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
      </div>
    }>
      <AgentStudio />
    </Suspense>
  );
}

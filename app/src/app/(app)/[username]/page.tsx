'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function LegacyAgentRedirect() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;

  useEffect(() => {
    router.replace(`/chat/${username}`);
  }, [username, router]);

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-white/10 border-t-white/50 rounded-full animate-spin" />
    </div>
  );
}

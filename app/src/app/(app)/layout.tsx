'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { Sidebar } from '@/components/layout/Sidebar';

function AppLayout({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateViewport = (event?: MediaQueryListEvent) => {
      const matches = event?.matches ?? mediaQuery.matches;
      setIsMobile(matches);
      if (matches) setSidebarOpen(false);
    };
    updateViewport();
    mediaQuery.addEventListener('change', updateViewport);
    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, [setSidebarOpen]);

  return (
    <div className="h-screen min-h-screen w-screen bg-background supports-[height:100dvh]:h-[100dvh] supports-[height:100dvh]:min-h-[100dvh]">
      <Sidebar />
      <main
        className="fixed top-0 right-0 bottom-0 z-30 flex flex-col transition-all duration-300 bg-background"
        style={{
          left: isMobile ? '0px' : sidebarOpen ? '280px' : '72px',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex-1 flex flex-col min-h-0">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function AppRouteLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppLayout>{children}</AppLayout>
    </AuthProvider>
  );
}

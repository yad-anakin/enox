'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { Sidebar } from './Sidebar';
import { ChatView } from '@/components/chat/ChatView';
import { AgentsView } from '@/components/agents/AgentsView';
import { ExploreView } from '@/components/explore/ExploreView';
import { SettingsView } from '@/components/settings/SettingsView';
import { PrivacyPolicyView } from '@/components/legal/PrivacyPolicyView';
import { TermsOfServiceView } from '@/components/legal/TermsOfServiceView';
import { UsageAnalyticsView } from '@/components/usage/UsageAnalyticsView';
import { AnimatePresence, motion } from 'framer-motion';
import { PanelLeft } from 'lucide-react';

export function AppShell() {
  const { activeView, sidebarOpen, setSidebarOpen } = useStore();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');

    const updateViewport = (event?: MediaQueryListEvent) => {
      const matches = event?.matches ?? mediaQuery.matches;
      setIsMobile(matches);
      if (matches) {
        setSidebarOpen(false);
      }
    };

    updateViewport();

    mediaQuery.addEventListener('change', updateViewport);
    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, [setSidebarOpen]);

  const renderView = () => {
    switch (activeView) {
      case 'chat':
        return <ChatView key="chat" />;
      case 'agents':
        return <AgentsView key="agents" />;
      case 'explore':
        return <ExploreView key="explore" />;
      case 'settings':
        return <SettingsView key="settings" />;
      case 'privacy':
        return <PrivacyPolicyView key="privacy" />;
      case 'terms':
        return <TermsOfServiceView key="terms" />;
      case 'usage':
        return <UsageAnalyticsView key="usage" />;
      default:
        return <ChatView key="chat" />;
    }
  };

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
        {/* Mobile sidebar toggle — visible on small screens across all pages */}
        <div className="h-12 flex items-center px-4 border-b border-white/[0.06] shrink-0 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-white/50 transition-all hover:bg-white/[0.06]"
          >
            <PanelLeft size={14} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col min-h-0"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

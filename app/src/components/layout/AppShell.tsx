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
    <div className="h-screen w-screen flex overflow-hidden bg-background">
      <Sidebar />
      <main
        className="flex-1 flex flex-col min-w-0 transition-all duration-300"
        style={{ marginLeft: isMobile ? '0px' : sidebarOpen ? '280px' : '72px' }}
      >
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

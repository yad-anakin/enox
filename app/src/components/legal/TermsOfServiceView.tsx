'use client';

import { motion } from 'framer-motion';
import { ScrollText, Shield, Bot, Gauge, Ban, PanelLeft } from 'lucide-react';
import { useStore } from '@/store/useStore';

const sections = [
  {
    icon: Bot,
    title: 'Using Enox',
    body: 'You may use Enox to create chats, configure agents, and access supported AI models for lawful business or personal workflows. You are responsible for the prompts, agent instructions, and content you submit.',
  },
  {
    icon: Gauge,
    title: 'Limits and Availability',
    body: 'Model access may be subject to monthly usage limits, maintenance windows, and provider availability. Limits can vary by model and may be customized by administrators for specific users.',
  },
  {
    icon: Shield,
    title: 'Account Responsibilities',
    body: 'You are responsible for maintaining access to your account and for any provider API keys you add. Do not upload or submit credentials you are not authorized to use.',
  },
  {
    icon: Ban,
    title: 'Restricted Conduct',
    body: 'You may not use Enox to abuse providers, bypass restrictions, generate harmful content intentionally, or interfere with the service, data, or accounts of other users.',
  },
  {
    icon: ScrollText,
    title: 'Service Changes',
    body: 'Features, models, and policies may evolve over time. Continued use of Enox means you accept reasonable updates to the product experience, limits, and service terms.',
  },
];

export function TermsOfServiceView() {
  const { sidebarOpen, setSidebarOpen } = useStore();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 md:p-8">
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-white/55 transition-all hover:bg-white/[0.06] md:hidden shrink-0"
            >
              <PanelLeft size={18} />
            </button>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06]">
              <ScrollText size={20} className="text-white/70" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white/90">Terms of Service</h1>
              <p className="text-sm text-white/35">The main rules for using Enox chats, agents, models, and account features.</p>
            </div>
          </div>
          <p className="text-sm leading-7 text-white/55">
            These terms outline acceptable use of the Enox platform, including chats, agents, model access, account security, and provider-key integrations.
          </p>
        </motion.div>

        <div className="grid gap-4">
          {sections.map((section, index) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass rounded-2xl p-6"
            >
              <div className="mb-3 flex items-center gap-3">
                <section.icon size={18} className="text-white/55" />
                <h2 className="text-base font-semibold text-white/85">{section.title}</h2>
              </div>
              <p className="text-sm leading-7 text-white/50">{section.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

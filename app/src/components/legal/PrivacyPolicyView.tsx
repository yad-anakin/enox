'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, Database, Lock, Bell, Globe, PanelLeft } from 'lucide-react';
import { useStore } from '@/store/useStore';

const sections = [
  {
    icon: ShieldCheck,
    title: 'Overview',
    body: 'Enox protects your account data, chat history, usage information, and workspace preferences so you can use the platform securely. We only process the information needed to deliver AI chats, agent workflows, and account management.',
  },
  {
    icon: Database,
    title: 'Data We Store',
    body: 'We store your profile details, chat history, saved agents, usage records, and any provider API keys you add in settings so your account and agents can function properly across sessions.',
  },
  {
    icon: Lock,
    title: 'Security',
    body: 'Provider keys are stored server-side and are never exposed in the client UI. Access to user data is protected with authentication, role checks, and row-level policies where applicable.',
  },
  {
    icon: Bell,
    title: 'Usage and Limits',
    body: 'We record model usage counts to enforce monthly limits, improve reliability, and support account administration. Admins may configure model-level and user-level usage limits to keep the service stable.',
  },
  {
    icon: Globe,
    title: 'Third-Party Services',
    body: 'When you use AI models, your prompts may be processed by the provider backing the selected model. If you add your own provider key, your requests may use that provider key for your chats and agents.',
  },
];

export function PrivacyPolicyView() {
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
              <ShieldCheck size={20} className="text-white/70" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white/90">Privacy Policy</h1>
              <p className="text-sm text-white/35">How Enox handles your account data, conversations, usage, and provider keys.</p>
            </div>
          </div>
          <p className="text-sm leading-7 text-white/55">
            This policy explains what information Enox stores, how it is used inside the product, and how we protect data associated with your profile, chats, agents, and model usage.
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

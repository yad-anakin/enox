'use client';

import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { EnoxLogo } from '@/components/common/EnoxLogo';
import { Bot, Sparkles, Zap, Shield, MessageSquare, Globe } from 'lucide-react';

const features = [
  { icon: MessageSquare, title: 'Multi-Model Chat', desc: 'Access GPT-4o, Claude, Gemini, Mistral and more from one unified interface.' },
  { icon: Bot, title: 'Custom AI Agents', desc: 'Build purpose-built agents with dedicated prompts, models and conversation flows.' },
  { icon: Zap, title: 'Real-Time Streaming', desc: 'Lightning-fast responses with live token streaming and thinking visualization.' },
  { icon: Globe, title: 'Explore Community', desc: 'Discover and chat with public agents created by the Enox community.' },
  { icon: Shield, title: 'Bring Your Own Keys', desc: 'Use platform credits or connect your own API keys for unlimited access.' },
  { icon: Sparkles, title: 'Premium Experience', desc: 'Beautiful dark interface, usage analytics, and seamless cross-device experience.' },
];

export function LoginScreen() {
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  return (
    <div className="min-h-screen w-screen bg-background relative overflow-x-hidden overflow-y-auto">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:72px_72px]" />
      <div className="pointer-events-none fixed top-[-20%] left-1/2 -translate-x-1/2 w-[900px] h-[900px] bg-gradient-to-b from-white/[0.03] to-transparent rounded-full blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-gradient-to-t from-white/[0.02] to-transparent rounded-full blur-3xl" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center w-full">

        {/* Hero Section */}
        <section className="flex flex-col items-center text-center pt-20 pb-12 px-6 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="flex flex-col items-center gap-5"
          >
            <div className="w-20 h-20 rounded-3xl glass-strong flex items-center justify-center border border-white/[0.08]">
              <EnoxLogo className="w-10 h-10 text-white" />
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-[11px] font-medium text-white/50 uppercase tracking-[0.2em]">
                <Sparkles size={12} className="text-white/40" />
                AI Platform
              </div>
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-gradient leading-tight">
                Enox AI
              </h1>
              <p className="text-lg md:text-xl text-white/40 max-w-xl leading-relaxed">
                Your premium gateway to the world&apos;s leading AI models. Chat, create agents, and build intelligent workflows — all in one place.
              </p>
            </div>

            {/* CTA Button */}
            <motion.button
              onClick={handleGoogleLogin}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-4 flex items-center justify-center gap-3 px-8 py-3.5 rounded-2xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-all duration-200 active:scale-[0.98]"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
              </svg>
              Get Started with Google
            </motion.button>
          </motion.div>
        </section>

        {/* Features Grid */}
        <section className="w-full max-w-5xl mx-auto px-6 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <p className="text-center text-[11px] uppercase tracking-[0.25em] text-white/25 mb-8">
              Everything you need
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 + i * 0.07 }}
                  className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]"
                >
                  <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
                      <f.icon size={18} className="text-white/50" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white/85 mb-1">{f.title}</h3>
                      <p className="text-xs leading-5 text-white/35">{f.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Bottom CTA */}
        <section className="w-full max-w-2xl mx-auto px-6 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="glass-strong rounded-3xl p-8 md:p-10 flex flex-col items-center text-center gap-5"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/[0.06] flex items-center justify-center">
              <EnoxLogo className="w-6 h-6 text-white/80" />
            </div>
            <h2 className="text-xl md:text-2xl font-semibold text-white/90">Ready to get started?</h2>
            <p className="text-sm text-white/40 max-w-md">
              Sign in with Google to access all models, create custom agents, and start chatting instantly. No credit card required.
            </p>
            <button
              onClick={handleGoogleLogin}
              className="flex items-center justify-center gap-3 px-8 py-3 rounded-2xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-all duration-200 active:scale-[0.98]"
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>
            <p className="text-[10px] text-white/15">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </p>
          </motion.div>
        </section>

      </div>
    </div>
  );
}

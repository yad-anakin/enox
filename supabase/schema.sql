-- ============================================
-- ENOX AI PLATFORM — Supabase Database Schema
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- USERS
-- ============================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- MODELS (Admin-managed AI models)
-- ============================================
CREATE TABLE public.models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google', 'mistral', 'groq', 'openrouter')),
  model_id TEXT NOT NULL, -- e.g. gpt-4o, claude-3-opus
  api_key TEXT NOT NULL,  -- encrypted, server-only access
  daily_limit INTEGER NOT NULL DEFAULT 25,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- AGENTS
-- ============================================
CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  description TEXT,
  system_prompt TEXT NOT NULL,
  model_id UUID NOT NULL REFERENCES public.models(id) ON DELETE RESTRICT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  temperature DOUBLE PRECISION DEFAULT 0.7,
  top_p DOUBLE PRECISION DEFAULT 0.95,
  max_tokens INTEGER DEFAULT 4096,
  use_own_key BOOLEAN DEFAULT false,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- CHATS
-- ============================================
CREATE TABLE public.chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  model_id UUID NOT NULL REFERENCES public.models(id) ON DELETE RESTRICT,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- MESSAGES
-- ============================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- USAGE LOGS
-- ============================================
CREATE TABLE public.usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  message_count INTEGER NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(user_id, model_id, date)
);

-- ============================================
-- USER MODEL LIMITS
-- ============================================
CREATE TABLE public.user_model_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  daily_limit INTEGER NOT NULL CHECK (daily_limit > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, model_id)
);

-- ============================================
-- USER API KEYS
-- ============================================
CREATE TABLE public.user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google', 'mistral', 'groq', 'openrouter')),
  api_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_agents_user_id ON public.agents(user_id);
CREATE INDEX idx_agents_is_public ON public.agents(is_public) WHERE is_public = true;
CREATE INDEX idx_chats_user_id ON public.chats(user_id);
CREATE INDEX idx_chats_agent_id ON public.chats(agent_id);
CREATE INDEX idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);
CREATE INDEX idx_usage_logs_user_date ON public.usage_logs(user_id, date);
CREATE INDEX idx_user_model_limits_user_id ON public.user_model_limits(user_id);
CREATE INDEX idx_user_model_limits_model_id ON public.user_model_limits(model_id);
CREATE INDEX idx_user_api_keys_user_id ON public.user_api_keys(user_id);
CREATE INDEX idx_user_api_keys_provider ON public.user_api_keys(provider);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_models_updated_at BEFORE UPDATE ON public.models
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON public.chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_user_model_limits_updated_at BEFORE UPDATE ON public.user_model_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_user_api_keys_updated_at BEFORE UPDATE ON public.user_api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Handle new user signup (auto-create profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Increment usage log (upsert)
CREATE OR REPLACE FUNCTION public.increment_usage(p_user_id UUID, p_model_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO public.usage_logs (user_id, model_id, message_count, date)
  VALUES (p_user_id, p_model_id, 1, CURRENT_DATE)
  ON CONFLICT (user_id, model_id, date)
  DO UPDATE SET message_count = usage_logs.message_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_user_id UUID, p_model_id UUID)
RETURNS JSON AS $$
DECLARE
  v_limit INTEGER;
  v_used INTEGER;
BEGIN
  SELECT daily_limit INTO v_limit FROM public.models WHERE id = p_model_id;
  SELECT COALESCE(message_count, 0) INTO v_used
    FROM public.usage_logs
    WHERE user_id = p_user_id AND model_id = p_model_id AND date = CURRENT_DATE;

  RETURN json_build_object(
    'allowed', COALESCE(v_used, 0) < COALESCE(v_limit, 25),
    'used', COALESCE(v_used, 0),
    'limit', COALESCE(v_limit, 25),
    'remaining', GREATEST(COALESCE(v_limit, 25) - COALESCE(v_used, 0), 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_model_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

-- USERS policies
CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins have full access to users"
  ON public.users FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- MODELS policies (public read for active, admin write)
CREATE POLICY "Anyone can read active models"
  ON public.models FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins have full access to models"
  ON public.models FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- AGENTS policies
CREATE POLICY "Users can CRUD own agents"
  ON public.agents FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read public agents"
  ON public.agents FOR SELECT
  USING (is_public = true);

CREATE POLICY "Admins have full access to agents"
  ON public.agents FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- CHATS policies
CREATE POLICY "Users can CRUD own chats"
  ON public.chats FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admins have full access to chats"
  ON public.chats FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- MESSAGES policies
CREATE POLICY "Users can access messages of own chats"
  ON public.messages FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.chats WHERE id = messages.chat_id AND user_id = auth.uid())
  );

CREATE POLICY "Admins have full access to messages"
  ON public.messages FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- USAGE LOGS policies
CREATE POLICY "Users can read own usage"
  ON public.usage_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins have full access to usage_logs"
  ON public.usage_logs FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins have full access to user_model_limits"
  ON public.user_model_limits FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can manage own api keys"
  ON public.user_api_keys FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admins have full access to user_api_keys"
  ON public.user_api_keys FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- SERVICE ROLE access for backend
-- Models api_key column should NEVER be exposed via client
-- Backend uses service_role key to access api_keys
-- ============================================

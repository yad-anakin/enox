const { supabase } = require('./supabase');

const PROVIDERS = ['openai', 'anthropic', 'google', 'mistral', 'groq', 'openrouter'];

async function getUserApiKeys(userId) {
  const { data, error } = await supabase
    .from('user_api_keys')
    .select('provider, api_key, updated_at')
    .eq('user_id', userId);

  if (error) {
    console.error('User API keys fetch error:', error);
    throw new Error('Failed to fetch user API keys');
  }

  const map = Object.fromEntries((data || []).map((item) => [item.provider, item]));

  return PROVIDERS.map((provider) => ({
    provider,
    has_key: Boolean(map[provider]?.api_key),
    api_key: map[provider]?.api_key || '',
    updated_at: map[provider]?.updated_at || null,
  }));
}

async function getEffectiveApiKey(userId, provider, fallbackApiKey) {
  const { data, error } = await supabase
    .from('user_api_keys')
    .select('api_key')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle();

  if (error) {
    console.error('User API key fetch error:', error);
    throw new Error('Failed to fetch user API key');
  }

  const userKey = data?.api_key?.trim() || null;
  return {
    apiKey: userKey || fallbackApiKey,
    isUserKey: Boolean(userKey),
  };
}

module.exports = { PROVIDERS, getUserApiKeys, getEffectiveApiKey };

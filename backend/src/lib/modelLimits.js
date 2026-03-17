const { supabase } = require('./supabase');

async function getEffectiveLimit(userId, modelId) {
  const { data: model, error: modelError } = await supabase
    .from('models')
    .select('daily_limit')
    .eq('id', modelId)
    .single();

  if (modelError) {
    console.error('Model limit lookup error:', modelError);
    throw new Error('Failed to fetch model limit');
  }

  const { data: override, error: overrideError } = await supabase
    .from('user_model_limits')
    .select('daily_limit')
    .eq('user_id', userId)
    .eq('model_id', modelId)
    .maybeSingle();

  if (overrideError) {
    console.error('User model limit lookup error:', overrideError);
    throw new Error('Failed to fetch user model limit');
  }

  return override?.daily_limit ?? model?.daily_limit ?? 25;
}

async function getUserLimitOverrides(userId) {
  const { data, error } = await supabase
    .from('user_model_limits')
    .select('id, model_id, daily_limit')
    .eq('user_id', userId);

  if (error) {
    console.error('User model limits list error:', error);
    throw new Error('Failed to fetch user model limits');
  }

  return data || [];
}

module.exports = { getEffectiveLimit, getUserLimitOverrides };

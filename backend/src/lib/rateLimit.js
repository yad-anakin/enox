const { supabase } = require('./supabase');

async function checkRateLimit(userId, modelId) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().split('T')[0];
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().split('T')[0];

  // Parallel: fetch model limit + user override + current monthly usage all at once
  const [modelResult, overrideResult, usageResult] = await Promise.all([
    supabase.from('models').select('daily_limit').eq('id', modelId).single(),
    supabase.from('user_model_limits').select('daily_limit').eq('user_id', userId).eq('model_id', modelId).maybeSingle(),
    supabase.from('usage_logs').select('message_count, own_key_count').eq('user_id', userId).eq('model_id', modelId).gte('date', monthStart).lt('date', nextMonthStart),
  ]);

  if (modelResult.error) {
    console.error('Rate limit model error:', modelResult.error);
    throw new Error('Failed to check rate limit');
  }

  const limit = overrideResult.data?.daily_limit ?? modelResult.data?.daily_limit ?? 25;
  const used = (usageResult.data || []).reduce((sum, row) => {
    const messageCount = row.message_count || 0;
    const ownKeyCount = row.own_key_count || 0;
    return sum + Math.max(messageCount - ownKeyCount, 0);
  }, 0);

  return {
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(limit - used, 0),
  };
}

async function incrementUsage(userId, modelId, usedOwnKey = false) {
  const today = new Date().toISOString().split('T')[0];

  const { data: existing } = await supabase
    .from('usage_logs')
    .select('id, message_count, own_key_count')
    .eq('user_id', userId)
    .eq('model_id', modelId)
    .eq('date', today)
    .maybeSingle();

  if (existing) {
    const updates = { message_count: existing.message_count + 1 };
    if (usedOwnKey) updates.own_key_count = (existing.own_key_count || 0) + 1;
    await supabase.from('usage_logs').update(updates).eq('id', existing.id);
  } else {
    await supabase.from('usage_logs').insert({
      user_id: userId,
      model_id: modelId,
      date: today,
      message_count: 1,
      own_key_count: usedOwnKey ? 1 : 0,
    });
  }
}

module.exports = { checkRateLimit, incrementUsage };

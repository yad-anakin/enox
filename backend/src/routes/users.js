const express = require('express');
const { z } = require('zod');
const { supabase } = require('../lib/supabase');
const { getUserLimitOverrides } = require('../lib/modelLimits');
const { PROVIDERS, getUserApiKeys } = require('../lib/userApiKeys');

const router = express.Router();

const userApiKeysSchema = z.object({
  keys: z.array(z.object({
    provider: z.string().refine((v) => PROVIDERS.includes(v), { message: 'Invalid provider' }),
    api_key: z.string().trim(),
  })),
});

// GET /api/users/me — Get current user profile
router.get('/me', async (req, res) => {
  res.json(req.user);
});

// PATCH /api/users/me — Update profile
router.patch('/me', async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(100).optional(),
      avatar_url: z.string().url().optional(),
    });
    const body = schema.parse(req.body);

    const { data, error } = await supabase
      .from('users')
      .update(body)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET /api/users/me/usage — Get all usage for current user
router.get('/me/usage', async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().split('T')[0];
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().split('T')[0];
    const overrides = await getUserLimitOverrides(req.user.id);
    const overrideMap = Object.fromEntries(overrides.map((item) => [item.model_id, item.daily_limit]));

    const { data: usage, error } = await supabase
      .from('usage_logs')
      .select(`
        message_count, own_key_count, date,
        model:models(id, name, provider, daily_limit)
      `)
      .eq('user_id', req.user.id)
      .gte('date', monthStart)
      .lt('date', nextMonthStart);

    if (error) throw error;

    // Also get all active models to show ones with no usage
    const { data: models } = await supabase
      .from('models')
      .select('id, name, provider, daily_limit')
      .eq('is_active', true);

    const usageMap = {};
    (usage || []).forEach(u => {
      const limit = overrideMap[u.model.id] ?? u.model.daily_limit;
      if (!usageMap[u.model.id]) {
        usageMap[u.model.id] = {
          model: u.model,
          used: 0,
          total_used: 0,
          own_key_used: 0,
          platform_used: 0,
          limit,
          remaining: limit,
        };
      }
      const messageCount = u.message_count || 0;
      const ownKeyCount = u.own_key_count || 0;
      const platformCount = Math.max(messageCount - ownKeyCount, 0);
      usageMap[u.model.id].used += platformCount;
      usageMap[u.model.id].total_used += messageCount;
      usageMap[u.model.id].own_key_used += u.own_key_count || 0;
      usageMap[u.model.id].platform_used += platformCount;
      usageMap[u.model.id].remaining = Math.max(limit - usageMap[u.model.id].platform_used, 0);
    });

    // Add models with no usage today
    (models || []).forEach(m => {
      if (!usageMap[m.id]) {
        const limit = overrideMap[m.id] ?? m.daily_limit;
        usageMap[m.id] = {
          model: m,
          used: 0,
          total_used: 0,
          own_key_used: 0,
          platform_used: 0,
          limit,
          remaining: limit,
        };
      }
    });

    res.json(Object.values(usageMap));
  } catch (err) {
    console.error('Usage error:', err);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

// GET /api/users/me/api-keys — Get current user API keys
router.get('/me/api-keys', async (req, res) => {
  try {
    const keys = await getUserApiKeys(req.user.id);
    res.json(keys);
  } catch (err) {
    console.error('Get api keys error:', err);
    res.status(500).json({ error: 'Failed to fetch api keys' });
  }
});

// PUT /api/users/me/api-keys — Replace current user API keys
router.put('/me/api-keys', async (req, res) => {
  try {
    const body = userApiKeysSchema.parse(req.body);

    const { error: deleteError } = await supabase
      .from('user_api_keys')
      .delete()
      .eq('user_id', req.user.id);

    if (deleteError) throw deleteError;

    const rows = body.keys
      .filter((item) => item.api_key)
      .map((item) => ({
        user_id: req.user.id,
        provider: item.provider,
        api_key: item.api_key,
      }));

    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from('user_api_keys')
        .insert(rows);

      if (insertError) throw insertError;
    }

    const keys = await getUserApiKeys(req.user.id);
    res.json(keys);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('Update api keys error:', err);
    res.status(500).json({ error: 'Failed to update api keys' });
  }
});

module.exports = router;

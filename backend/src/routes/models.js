const express = require('express');
const { supabase } = require('../lib/supabase');
const { getEffectiveLimit } = require('../lib/modelLimits');

const router = express.Router();

// GET /api/models — List active models (no api_key exposed)
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('models')
      .select('id, name, provider, model_id, daily_limit, max_tokens, is_active, created_at')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('List models error:', err);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// GET /api/models/:id/usage — Get user's usage for a specific model
router.get('/:id/usage', async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().split('T')[0];
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('usage_logs')
      .select('message_count, own_key_count, date')
      .eq('user_id', req.user.id)
      .eq('model_id', req.params.id)
      .gte('date', monthStart)
      .lt('date', nextMonthStart);

    const used = (data || []).reduce((sum, row) => {
      const messageCount = row.message_count || 0;
      const ownKeyCount = row.own_key_count || 0;
      return sum + Math.max(messageCount - ownKeyCount, 0);
    }, 0);
    const limit = await getEffectiveLimit(req.user.id, req.params.id);

    res.json({
      used,
      limit,
      remaining: Math.max(limit - used, 0),
    });
  } catch (err) {
    console.error('Model usage error:', err);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

module.exports = router;

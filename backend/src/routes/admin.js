const express = require('express');
const { z } = require('zod');
const { supabase } = require('../lib/supabase');
const { adminMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(adminMiddleware);

const modelSchema = z.object({
  name: z.string().min(1).max(100),
  provider: z.enum(['openai', 'anthropic', 'google', 'mistral', 'groq', 'openrouter']),
  model_id: z.string().min(1),
  api_key: z.string().min(1),
  daily_limit: z.number().int().min(1).default(25),
  max_tokens: z.number().int().min(256).max(10000).default(4096),
  is_active: z.boolean().default(true),
});

const userModelLimitsSchema = z.object({
  limits: z.array(z.object({
    model_id: z.string().uuid(),
    daily_limit: z.number().int().min(1),
    max_tokens: z.number().int().min(256).max(10000).optional(),
  })).default([]),
});

// ============================================
// MODELS MANAGEMENT
// ============================================

// GET /api/admin/models — List all models (with api_key masked)
router.get('/models', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('models')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Mask API keys
    const masked = data.map(m => ({
      ...m,
      api_key: m.api_key ? `${m.api_key.substring(0, 8)}...${m.api_key.slice(-4)}` : '***',
    }));

    res.json(masked);
  } catch (err) {
    console.error('Admin list models error:', err);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// POST /api/admin/models — Create model
router.post('/models', async (req, res) => {
  try {
    const body = modelSchema.parse(req.body);
    const { data, error } = await supabase
      .from('models')
      .insert(body)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ ...data, api_key: '***' });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('Admin create model error:', err);
    res.status(500).json({ error: 'Failed to create model' });
  }
});

// PATCH /api/admin/models/:id — Update model
router.patch('/models/:id', async (req, res) => {
  try {
    const body = modelSchema.partial().parse(req.body);
    const { data, error } = await supabase
      .from('models')
      .update(body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ ...data, api_key: '***' });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('Admin update model error:', err);
    res.status(500).json({ error: 'Failed to update model' });
  }
});

// DELETE /api/admin/models/:id — Delete model
router.delete('/models/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('models')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Admin delete model error:', err);
    res.status(500).json({ error: 'Failed to delete model' });
  }
});

// ============================================
// USERS MANAGEMENT
// ============================================

// GET /api/admin/users — List all users
router.get('/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Admin list users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PATCH /api/admin/users/:id — Update user (role, etc.)
router.patch('/users/:id', async (req, res) => {
  try {
    const schema = z.object({
      role: z.enum(['user', 'admin']).optional(),
      name: z.string().optional(),
    });
    const body = schema.parse(req.body);

    const { data, error } = await supabase
      .from('users')
      .update(body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Admin update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// GET /api/admin/users/:id/model-limits — Get effective per-model limits for a user
router.get('/users/:id/model-limits', async (req, res) => {
  try {
    const [{ data: models, error: modelsError }, { data: overrides, error: overridesError }] = await Promise.all([
      supabase
        .from('models')
        .select('id, name, provider, daily_limit, max_tokens, is_active')
        .order('name'),
      supabase
        .from('user_model_limits')
        .select('model_id, daily_limit, max_tokens')
        .eq('user_id', req.params.id),
    ]);

    if (modelsError) throw modelsError;
    if (overridesError) throw overridesError;

    const overrideMap = Object.fromEntries((overrides || []).map((item) => [item.model_id, item]));

    res.json((models || []).map((model) => {
      const override = overrideMap[model.id];
      return {
        model_id: model.id,
        model_name: model.name,
        provider: model.provider,
        is_active: model.is_active,
        default_limit: model.daily_limit,
        default_max_tokens: model.max_tokens,
        custom_limit: override?.daily_limit ?? null,
        custom_max_tokens: override?.max_tokens ?? null,
        effective_limit: override?.daily_limit ?? model.daily_limit,
        effective_max_tokens: override?.max_tokens ?? model.max_tokens,
      };
    }));
  } catch (err) {
    console.error('Admin user model limits error:', err);
    res.status(500).json({ error: 'Failed to fetch user model limits' });
  }
});

// PUT /api/admin/users/:id/model-limits — Replace custom per-model limits for a user
router.put('/users/:id/model-limits', async (req, res) => {
  try {
    const body = userModelLimitsSchema.parse(req.body);

    const { error: deleteError } = await supabase
      .from('user_model_limits')
      .delete()
      .eq('user_id', req.params.id);

    if (deleteError) throw deleteError;

    if (body.limits.length > 0) {
      const rows = body.limits.map((item) => ({
        user_id: req.params.id,
        model_id: item.model_id,
        daily_limit: item.daily_limit,
        ...(item.max_tokens ? { max_tokens: item.max_tokens } : {}),
      }));

      const { error: insertError } = await supabase
        .from('user_model_limits')
        .insert(rows);

      if (insertError) throw insertError;
    }

    const { data: overrides, error: overridesError } = await supabase
      .from('user_model_limits')
      .select('model_id, daily_limit')
      .eq('user_id', req.params.id);

    if (overridesError) throw overridesError;

    res.json(overrides || []);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('Admin update user model limits error:', err);
    res.status(500).json({ error: 'Failed to update user model limits' });
  }
});

// ============================================
// USAGE / ANALYTICS
// ============================================

// GET /api/admin/usage — Get all usage logs
router.get('/usage', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('usage_logs')
      .select(`
        id, message_count, date,
        user:users(id, name, email, avatar_url),
        model:models(id, name, provider)
      `)
      .eq('date', targetDate)
      .order('message_count', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Admin usage error:', err);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

// GET /api/admin/stats — Dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().split('T')[0];
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().split('T')[0];

    const [usersRes, modelsRes, agentsRes, monthUsageRes] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('models').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('agents').select('id', { count: 'exact', head: true }),
      supabase.from('usage_logs').select('message_count').gte('date', monthStart).lt('date', nextMonthStart),
    ]);

    const monthlyRequests = (monthUsageRes.data || []).reduce((sum, r) => sum + r.message_count, 0);

    res.json({
      totalUsers: usersRes.count || 0,
      activeModels: modelsRes.count || 0,
      totalAgents: agentsRes.count || 0,
      monthlyRequests,
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;

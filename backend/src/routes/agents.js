const express = require('express');
const { z } = require('zod');
const { supabase } = require('../lib/supabase');

const router = express.Router();

const usernameRegex = /^[a-z0-9_]{3,30}$/;

const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  username: z.string().min(3).max(30).regex(usernameRegex, 'Username must be 3-30 chars, lowercase letters, numbers, underscores only'),
  description: z.string().max(500).optional(),
  system_prompt: z.string().min(1).max(10000),
  model_id: z.string().uuid(),
  is_public: z.boolean().optional().default(false),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  top_p: z.number().min(0).max(1).optional().default(0.95),
  max_tokens: z.number().int().min(256).max(131072).optional().default(4096),
  use_own_key: z.boolean().optional().default(false),
});

const updateAgentSchema = createAgentSchema.partial();

// GET /api/agents — List user's agents
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('agents')
      .select(`
        id, name, username, description, system_prompt, is_public, temperature, top_p, max_tokens, use_own_key, created_at, updated_at, user_id,
        model:models(id, name, provider),
        creator:users(name, avatar_url)
      `)
      .eq('user_id', req.user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('List agents error:', err);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// GET /api/agents/:id — Get single agent
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('agents')
      .select(`
        id, name, username, description, system_prompt, is_public, temperature, top_p, max_tokens, use_own_key, created_at, updated_at, user_id,
        model:models(id, name, provider),
        creator:users(name, avatar_url)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Agent not found' });

    // Check access
    if (data.user_id !== req.user.id && !data.is_public) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(data);
  } catch (err) {
    console.error('Get agent error:', err);
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
});

// POST /api/agents — Create agent
router.post('/', async (req, res) => {
  try {
    const body = createAgentSchema.parse(req.body);

    // Check username uniqueness
    const { data: existing } = await supabase
      .from('agents')
      .select('id')
      .eq('username', body.username)
      .maybeSingle();
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const { data, error } = await supabase
      .from('agents')
      .insert({ ...body, user_id: req.user.id })
      .select(`
        id, name, username, description, system_prompt, is_public, temperature, top_p, max_tokens, use_own_key, created_at, updated_at, user_id,
        model:models(id, name, provider),
        creator:users(name, avatar_url)
      `)
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('Create agent error:', err);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

// PATCH /api/agents/:id — Update agent
router.patch('/:id', async (req, res) => {
  try {
    const body = updateAgentSchema.parse(req.body);

    // If updating username, check uniqueness (exclude self)
    if (body.username) {
      const { data: existing } = await supabase
        .from('agents')
        .select('id')
        .eq('username', body.username)
        .neq('id', req.params.id)
        .maybeSingle();
      if (existing) {
        return res.status(409).json({ error: 'Username already taken' });
      }
    }

    const { data, error } = await supabase
      .from('agents')
      .update(body)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select(`
        id, name, username, description, system_prompt, is_public, temperature, top_p, max_tokens, use_own_key, created_at, updated_at, user_id,
        model:models(id, name, provider),
        creator:users(name, avatar_url)
      `)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Agent not found' });

    res.json(data);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('Update agent error:', err);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

// DELETE /api/agents/:id — Delete agent
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Delete agent error:', err);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

module.exports = router;

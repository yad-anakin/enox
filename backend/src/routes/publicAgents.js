const express = require('express');
const { supabase } = require('../lib/supabase');

const router = express.Router();

// GET /api/agents/public — List all public agents
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('agents')
      .select(`
        id, name, username, description, is_public, use_own_key, created_at,
        model:models(id, name, provider),
        user:users(name, avatar_url)
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Public agents error:', err);
    res.status(500).json({ error: 'Failed to fetch public agents' });
  }
});

// GET /api/agents/public/u/:username — Get a public agent by username
router.get('/u/:username', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('agents')
      .select(`
        id, name, username, description, system_prompt, is_public, use_own_key, created_at, user_id,
        model:models(id, name, provider),
        creator:users(name, avatar_url)
      `)
      .eq('username', req.params.username)
      .eq('is_public', true)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Agent not found' });
    res.json(data);
  } catch (err) {
    console.error('Public agent by username error:', err);
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
});

// GET /api/agents/public/:id — Get a public agent by ID
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('agents')
      .select(`
        id, name, username, description, system_prompt, is_public, use_own_key, created_at, user_id,
        model:models(id, name, provider),
        creator:users(name, avatar_url)
      `)
      .eq('id', req.params.id)
      .eq('is_public', true)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Agent not found' });
    res.json(data);
  } catch (err) {
    console.error('Public agent error:', err);
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
});

module.exports = router;

const express = require('express');
const { z } = require('zod');
const { supabase } = require('../lib/supabase');
const { generateImage, generateTTS, generateVideo } = require('../lib/aiProvider');
const { checkRateLimit, incrementUsage } = require('../lib/rateLimit');

const router = express.Router();

// ── POST /api/generate/image — Generate image from prompt ──
const imageSchema = z.object({
  modelId: z.string().uuid(),
  prompt: z.string().min(1).max(4000),
  useOwnKeys: z.boolean().optional().default(false),
  count: z.number().int().min(1).max(4).optional().default(1),
  aspectRatio: z.string().optional().default('1:1'),
  size: z.string().optional().default('1024x1024'),
});

router.post('/image', async (req, res) => {
  try {
    const body = imageSchema.parse(req.body);
    const userId = req.user.id;

    const effectiveUsingOwnKey = Boolean(body.useOwnKeys);

    const [modelResult, rateLimit, userKeyMap] = await Promise.all([
      supabase.from('models').select('*').eq('id', body.modelId).eq('is_active', true).single(),
      effectiveUsingOwnKey
        ? Promise.resolve({ allowed: true })
        : checkRateLimit(userId, body.modelId),
      effectiveUsingOwnKey
        ? supabase.from('user_api_keys').select('provider, api_key').eq('user_id', userId).then(r => {
            const map = {};
            (r.data || []).forEach(k => { map[k.provider] = k.api_key?.trim() || null; });
            return map;
          })
        : Promise.resolve(null),
    ]);

    const model = modelResult.data;
    if (!model) return res.status(404).json({ error: 'Model not found or inactive' });
    if (!rateLimit.allowed) return res.status(429).json({ error: 'Rate limit exceeded' });

    // Only google and openai support image generation
    if (!['google', 'openai'].includes(model.provider)) {
      return res.status(400).json({ error: `Image generation is not supported for ${model.provider}. Use a Google or OpenAI model.` });
    }

    let apiKey, actuallyUsedOwnKey;
    if (effectiveUsingOwnKey) {
      const userKey = userKeyMap?.[model.provider];
      if (userKey) { apiKey = userKey; actuallyUsedOwnKey = true; }
      else return res.status(400).json({ error: `No ${model.provider} API key found.` });
    } else {
      if (!model.api_key?.trim()) return res.status(400).json({ error: `Platform doesn't support ${model.name} for image generation yet.` });
      apiKey = model.api_key;
      actuallyUsedOwnKey = false;
    }

    const images = await generateImage(model.provider, apiKey, body.prompt, {
      count: body.count,
      aspectRatio: body.aspectRatio,
      size: body.size,
    });

    incrementUsage(userId, body.modelId, actuallyUsedOwnKey).catch(e => console.error('Image gen usage error:', e));

    res.json({ images });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Invalid request', details: err.errors });
    console.error('Image generation error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate image' });
  }
});

// ── POST /api/generate/tts — Text-to-Speech ──
const ttsSchema = z.object({
  modelId: z.string().uuid(),
  text: z.string().min(1).max(4096),
  useOwnKeys: z.boolean().optional().default(false),
  voice: z.string().optional(),
});

router.post('/tts', async (req, res) => {
  try {
    const body = ttsSchema.parse(req.body);
    const userId = req.user.id;

    const effectiveUsingOwnKey = Boolean(body.useOwnKeys);

    const [modelResult, rateLimit, userKeyMap] = await Promise.all([
      supabase.from('models').select('*').eq('id', body.modelId).eq('is_active', true).single(),
      effectiveUsingOwnKey
        ? Promise.resolve({ allowed: true })
        : checkRateLimit(userId, body.modelId),
      effectiveUsingOwnKey
        ? supabase.from('user_api_keys').select('provider, api_key').eq('user_id', userId).then(r => {
            const map = {};
            (r.data || []).forEach(k => { map[k.provider] = k.api_key?.trim() || null; });
            return map;
          })
        : Promise.resolve(null),
    ]);

    const model = modelResult.data;
    if (!model) return res.status(404).json({ error: 'Model not found or inactive' });
    if (!rateLimit.allowed) return res.status(429).json({ error: 'Rate limit exceeded' });

    if (!['google', 'openai'].includes(model.provider)) {
      return res.status(400).json({ error: `TTS is not supported for ${model.provider}. Use a Google or OpenAI model.` });
    }

    let apiKey, actuallyUsedOwnKey;
    if (effectiveUsingOwnKey) {
      const userKey = userKeyMap?.[model.provider];
      if (userKey) { apiKey = userKey; actuallyUsedOwnKey = true; }
      else return res.status(400).json({ error: `No ${model.provider} API key found.` });
    } else {
      if (!model.api_key?.trim()) return res.status(400).json({ error: `Platform doesn't support ${model.name} for TTS yet.` });
      apiKey = model.api_key;
      actuallyUsedOwnKey = false;
    }

    const audio = await generateTTS(model.provider, apiKey, body.text, {
      voice: body.voice,
    });

    incrementUsage(userId, body.modelId, actuallyUsedOwnKey).catch(e => console.error('TTS usage error:', e));

    res.json({ audio });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Invalid request', details: err.errors });
    console.error('TTS error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate speech' });
  }
});

// ── POST /api/generate/video — Video Generation ──
const videoSchema = z.object({
  modelId: z.string().uuid(),
  prompt: z.string().min(1).max(4000),
  useOwnKeys: z.boolean().optional().default(false),
  aspectRatio: z.string().optional().default('16:9'),
});

router.post('/video', async (req, res) => {
  // Increase timeout for video generation (5 min polling)
  req.setTimeout(360_000);
  res.setTimeout(360_000);

  try {
    const body = videoSchema.parse(req.body);
    const userId = req.user.id;

    const effectiveUsingOwnKey = Boolean(body.useOwnKeys);

    const [modelResult, rateLimit, userKeyMap] = await Promise.all([
      supabase.from('models').select('*').eq('id', body.modelId).eq('is_active', true).single(),
      effectiveUsingOwnKey
        ? Promise.resolve({ allowed: true })
        : checkRateLimit(userId, body.modelId),
      effectiveUsingOwnKey
        ? supabase.from('user_api_keys').select('provider, api_key').eq('user_id', userId).then(r => {
            const map = {};
            (r.data || []).forEach(k => { map[k.provider] = k.api_key?.trim() || null; });
            return map;
          })
        : Promise.resolve(null),
    ]);

    const model = modelResult.data;
    if (!model) return res.status(404).json({ error: 'Model not found or inactive' });
    if (!rateLimit.allowed) return res.status(429).json({ error: 'Rate limit exceeded' });

    if (model.provider !== 'google') {
      return res.status(400).json({ error: `Video generation is only supported for Google models (Veo).` });
    }

    let apiKey, actuallyUsedOwnKey;
    if (effectiveUsingOwnKey) {
      const userKey = userKeyMap?.[model.provider];
      if (userKey) { apiKey = userKey; actuallyUsedOwnKey = true; }
      else return res.status(400).json({ error: `No ${model.provider} API key found.` });
    } else {
      if (!model.api_key?.trim()) return res.status(400).json({ error: `Platform doesn't support ${model.name} for video generation yet.` });
      apiKey = model.api_key;
      actuallyUsedOwnKey = false;
    }

    const videos = await generateVideo(model.provider, apiKey, body.prompt, {
      aspectRatio: body.aspectRatio,
    });

    incrementUsage(userId, body.modelId, actuallyUsedOwnKey).catch(e => console.error('Video gen usage error:', e));

    res.json({ videos });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Invalid request', details: err.errors });
    console.error('Video generation error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate video' });
  }
});

module.exports = router;

const { supabase } = require('../lib/supabase');

// In-memory user profile cache (5min TTL) — avoids 2 DB calls per request
const profileCache = new Map();
const CACHE_TTL = 300_000;

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split(' ')[1];

    // Check cache first
    const cached = profileCache.get(token);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      req.user = cached.profile;
      req.token = token;
      return next();
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      profileCache.delete(token);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    if (profileError || !profile) {
      return res.status(401).json({ error: 'User profile not found' });
    }

    // Cache for subsequent requests
    profileCache.set(token, { profile, ts: Date.now() });

    req.user = profile;
    req.token = token;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { authMiddleware, adminMiddleware };

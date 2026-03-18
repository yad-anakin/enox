require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { authMiddleware } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');
const chatRoutes = require('./routes/chat');
const agentRoutes = require('./routes/agents');
const modelRoutes = require('./routes/models');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3001;

 const normalizeOrigin = (origin) => origin.replace(/\/$/, '').trim();

 const allowedOrigins = [
   process.env.FRONTEND_URL,
   process.env.ADMIN_URL,
   process.env.CORS_ORIGIN,
   process.env.CORS_ORIGINS,
 ]
   .filter(Boolean)
   .flatMap((value) => value.split(','))
   .map((origin) => origin.trim())
   .filter(Boolean)
   .map(normalizeOrigin);

 const fallbackOrigins = ['http://localhost:3000', 'http://localhost:3002'];

 const corsOptions = {
   origin(origin, callback) {
     if (!origin) {
       return callback(null, true);
     }

     const normalizedOrigin = normalizeOrigin(origin);
     const configuredOrigins = allowedOrigins.length ? allowedOrigins : fallbackOrigins;

     if (configuredOrigins.includes(normalizedOrigin)) {
       return callback(null, true);
     }

     return callback(new Error(`Origin not allowed by CORS: ${origin}`));
   },
   credentials: true,
   optionsSuccessStatus: 204,
 };

// Security
app.use(helmet({ contentSecurityPolicy: false }));
 app.use(cors(corsOptions));
 app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Public routes
app.use('/api/agents/public', require('./routes/publicAgents'));

// Protected routes
app.use('/api/chat', authMiddleware, chatRoutes);
app.use('/api/agents', authMiddleware, agentRoutes);
app.use('/api/models', authMiddleware, modelRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[Enox Backend] Running on port ${PORT}`);
});

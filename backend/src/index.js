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

// Security
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:3000', process.env.ADMIN_URL || 'http://localhost:3002'],
  credentials: true,
}));
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

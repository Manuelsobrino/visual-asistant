const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
}));

// Rate limiting - keeping this for API protection
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));

// Health check - useful for monitoring
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'visual-aid-backend',
    version: '2.0.0'
  });
});

// OpenAI config endpoint - helps frontend know we're ready
app.get('/api/config', (req, res) => {
  res.json({
    openai: {
      configured: !!process.env.OPENAI_API_KEY,
      model: 'gpt-4o-realtime-preview-2024-10-01'
    }
  });
});

// Optional: Proxy endpoint for WebSocket URL (if needed)
app.get('/api/realtime-url', (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OpenAI not configured' });
  }
  
  res.json({
    url: 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1'
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Simplified backend running on port ${PORT}`);
  console.log(`📡 OpenAI configured: ${!!process.env.OPENAI_API_KEY}`);
});
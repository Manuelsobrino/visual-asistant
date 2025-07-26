# Sprint 1: Backend Simplification

## 🎯 Sprint Goal
Strip down the existing backend to essentials and prepare for ChatGPT API integration. Remove unnecessary infrastructure while keeping useful components.

## ⏱️ Duration: 30 minutes

## 📋 Prerequisites
- Existing backend from Sprint 1
- OpenAI API key from [platform.openai.com](https://platform.openai.com)
- Node.js environment ready

## 🔧 Tasks Breakdown

### 1. Simplify Docker Setup (5 min)

#### Update `docker-compose.yml`
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    container_name: visual-aid-backend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - PORT=3000
    env_file:
      - ./backend/.env
    volumes:
      - ./backend:/usr/src/app
      - /usr/src/app/node_modules
    command: npm run dev

# Remove Redis and PostgreSQL - no longer needed!
```

### 2. Update Backend Dependencies (5 min)

#### Update `backend/package.json`
```json
{
  "name": "visual-aid-backend",
  "version": "2.0.0",
  "description": "Simplified backend for Visual Aid Assistant",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "dotenv": "^16.3.1",
    "openai": "^4.24.0",
    "express-rate-limit": "^7.1.5",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

### 3. Create Minimal Server (10 min)

#### Update `backend/server.js`
```javascript
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
```

### 4. Update Environment Variables (5 min)

#### Update `backend/.env`
```bash
# Server
NODE_ENV=development
PORT=3000

# Security
ALLOWED_ORIGINS=http://localhost:19000,http://localhost:19001,exp://192.168.1.100:19000

# OpenAI API
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_ORG_ID=org-your-org-id-here (optional)

# Removed: GEMINI_API_KEY, REDIS_URL, JWT_SECRET, DB configs
```

### 5. Clean Up Unused Files (5 min)

#### Remove these files/folders:
```bash
# From backend/src/
rm -rf services/geminiService.js
rm -rf services/redisService.js
rm -rf services/databaseService.js
rm -rf middleware/auth.js
rm -rf routes/vision.js
rm -rf routes/auth.js
rm -rf controllers/*

# Keep only:
# - server.js
# - package.json
# - .env
# - Dockerfile (simplified)
```

#### Update `backend/Dockerfile`
```dockerfile
FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

## 🧪 Testing

### 1. Start Simplified Backend
```bash
cd backend
npm install
npm run dev
```

### 2. Test Health Endpoint
```bash
curl http://localhost:3000/api/health
```

Expected:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T10:00:00.000Z",
  "service": "visual-aid-backend",
  "version": "2.0.0"
}
```

### 3. Test Config Endpoint
```bash
curl http://localhost:3000/api/config
```

Expected:
```json
{
  "openai": {
    "configured": true,
    "model": "gpt-4o-realtime-preview-2024-10-01"
  }
}
```

## ✅ Sprint Completion Checklist
- [ ] Docker compose simplified
- [ ] Dependencies updated
- [ ] Server reduced to essentials
- [ ] OpenAI API key configured
- [ ] Health endpoint working
- [ ] Old files removed
- [ ] Backend restarted successfully

## 💡 What We Achieved
1. **Removed 80% of backend complexity**
2. **Kept useful monitoring endpoints**
3. **Prepared for OpenAI integration**
4. **Maintained CORS and rate limiting**
5. **Clean, minimal codebase**

## 🚨 Common Issues

### Issue: Cannot find module errors
```bash
# Solution: Clean install
rm -rf node_modules package-lock.json
npm install
```

### Issue: OpenAI key not working
```bash
# Verify format
echo $OPENAI_API_KEY
# Should start with sk-
```

## 📝 Next Sprint
Sprint 2 will implement the WebSocket connection and voice streaming foundation.
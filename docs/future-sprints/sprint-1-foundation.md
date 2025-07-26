# Sprint 1: Foundation Architecture

## 🎯 Sprint Goal
Set up the complete backend infrastructure with Docker, Express server, and Gemini API integration to provide a solid foundation for the visual assistant application.

## ⏱️ Duration: 1 hour

## 📋 Prerequisites
- Docker and Docker Compose installed
- Node.js 18+ installed
- Gemini API key from [Google AI Studio](https://makersuite.google.com)
- Git repository cloned

## 🔧 Tasks Breakdown

### 1. Create Project Structure (10 min)
```bash
# From project root
mkdir -p backend/src/{routes,controllers,services,middleware,config}
mkdir -p frontend
mkdir -p nginx
```

### 2. Initialize Backend (15 min)

#### Create `backend/package.json`
```json
{
  "name": "visual-aid-backend",
  "version": "1.0.0",
  "description": "Backend for Visual Aid Assistant",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",
    "jsonwebtoken": "^9.0.2",
    "express-validator": "^7.0.1",
    "dotenv": "^16.3.1",
    "@google/generative-ai": "^0.7.1",
    "redis": "^4.6.12",
    "pg": "^8.11.3",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

#### Create `backend/server.js`
```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./src/routes/auth');
const visionRoutes = require('./src/routes/vision');
const healthRoutes = require('./src/routes/health');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vision', visionRoutes);
app.use('/api/health', healthRoutes);

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```

### 3. Create Core Services (15 min)

#### `backend/src/services/geminiService.js`
```javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is required');
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash"
    });
  }

  async generateResponse(prompt) {
    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('Gemini API error:', error);
      throw error;
    }
  }
}

module.exports = new GeminiService();
```

#### `backend/src/routes/health.js`
```javascript
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'visual-aid-backend'
  });
});

module.exports = router;
```

### 4. Docker Configuration (10 min)

#### Create `docker-compose.yml`
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
      - REDIS_URL=redis://redis:6379
    env_file:
      - ./backend/.env
    depends_on:
      - redis
    volumes:
      - ./backend:/usr/src/app
      - /usr/src/app/node_modules
    command: npm run dev

  redis:
    image: redis:7-alpine
    container_name: visual-aid-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

#### Create `backend/Dockerfile`
```dockerfile
FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

### 5. Environment Setup (5 min)

#### Create `backend/.env`
```bash
# Server
NODE_ENV=development
PORT=3000

# Security
JWT_SECRET=your-jwt-secret-change-this
ALLOWED_ORIGINS=http://localhost:19000,http://localhost:19001,http://localhost:3000

# Gemini API (Get your key at https://makersuite.google.com)
GEMINI_API_KEY=your-gemini-api-key-here

# Redis
REDIS_URL=redis://redis:6379

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 6. Initial Routes (5 min)

#### Create `backend/src/routes/auth.js`
```javascript
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

router.post('/device-login', async (req, res) => {
  const { deviceId } = req.body;
  
  if (!deviceId) {
    return res.status(400).json({ error: 'Device ID required' });
  }

  const token = jwt.sign(
    { deviceId, type: 'device' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({ token, deviceId });
});

module.exports = router;
```

#### Create `backend/src/middleware/errorHandler.js`
```javascript
module.exports = (err, req, res, next) => {
  console.error(err.stack);

  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};
```

## 🧪 Testing

### 1. Start Docker Services
```bash
cd backend
npm install
cd ..
docker-compose up -d
```

### 2. Test Health Endpoint
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T10:00:00.000Z",
  "service": "visual-aid-backend"
}
```

### 3. Test Device Login
```bash
curl -X POST http://localhost:3000/api/auth/device-login \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "test-device-123"}'
```

## ✅ Sprint Completion Checklist
- [ ] Project folders created
- [ ] Backend server running
- [ ] Docker containers up
- [ ] Health endpoint responding
- [ ] Gemini API key configured
- [ ] Auth endpoint working
- [ ] Redis connected
- [ ] Environment variables set

## 🚧 Common Issues & Solutions

### Issue: Docker not starting
```bash
# Solution: Check if ports are in use
lsof -i :3000
lsof -i :6379
```

### Issue: Gemini API key error
```bash
# Solution: Verify .env file has the key
cat backend/.env | grep GEMINI_API_KEY
```

### Issue: Cannot connect to Redis
```bash
# Solution: Check Redis container
docker ps
docker logs visual-aid-redis
```

## 📝 Next Sprint
Sprint 2 will build the voice-first mobile app with TensorFlow.js integration.
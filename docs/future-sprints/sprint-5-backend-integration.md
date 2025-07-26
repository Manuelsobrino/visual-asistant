# Sprint 5: Backend Integration

## 🎯 Sprint Goal
Connect the mobile app to the backend API, enabling Gemini AI to generate intelligent, context-aware responses while implementing proper authentication, caching, and error handling.

## ⏱️ Duration: 45 minutes

## 📋 Prerequisites
- Sprints 1-4 completed
- Backend running with Gemini API key
- Mobile app with voice commands working
- Docker containers active

## 🔧 Tasks Breakdown

### 1. Create API Client Service (10 min)

#### Create `frontend/src/services/api.js`
```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';

export class ApiService {
  constructor() {
    this.baseURL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
    this.token = null;
    this.deviceId = null;
    this.initializeDevice();
  }

  async initializeDevice() {
    // Generate unique device ID
    this.deviceId = Device.osBuildId || Device.modelId || 'unknown-device';
    
    // Load saved token
    try {
      this.token = await AsyncStorage.getItem('auth_token');
    } catch (error) {
      console.error('Failed to load token:', error);
    }
  }

  async authenticate() {
    try {
      const response = await this.request('/auth/device-login', {
        method: 'POST',
        body: JSON.stringify({ deviceId: this.deviceId })
      });

      if (response.token) {
        this.token = response.token;
        await AsyncStorage.setItem('auth_token', response.token);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      if (response.status === 401) {
        // Token expired, re-authenticate
        const authSuccess = await this.authenticate();
        if (authSuccess) {
          // Retry request with new token
          config.headers.Authorization = `Bearer ${this.token}`;
          const retryResponse = await fetch(url, config);
          return await this.handleResponse(retryResponse);
        }
      }
      
      return await this.handleResponse(response);
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async handleResponse(response) {
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'API request failed');
    }
    
    return data;
  }

  async processVision(detectedObjects, userQuery, context = {}) {
    return this.request('/vision/process', {
      method: 'POST',
      body: JSON.stringify({
        detectedObjects,
        userQuery,
        context
      })
    });
  }

  async checkHealth() {
    try {
      const response = await fetch(`${this.baseURL}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

### 2. Update Backend Vision Routes (10 min)

#### Update `backend/src/routes/vision.js`
```javascript
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const geminiService = require('../services/geminiService');
const { cacheService } = require('../services/cacheService');

router.post('/process',
  authenticate,
  [
    body('detectedObjects').isArray(),
    body('userQuery').isString().trim().notEmpty(),
    body('context').optional().isObject()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { detectedObjects, userQuery, context } = req.body;
      
      // Create cache key
      const cacheKey = `vision:${JSON.stringify({ 
        objects: detectedObjects.map(o => o.label).sort(), 
        query: userQuery.toLowerCase() 
      })}`;
      
      // Check cache
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json({ response: cached, cached: true });
      }

      // Generate response with Gemini
      const response = await geminiService.generateVisionResponse(
        detectedObjects,
        userQuery,
        context
      );

      // Cache for 5 minutes
      await cacheService.set(cacheKey, response, 300);

      res.json({ response, cached: false });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/stats', authenticate, async (req, res) => {
  // Return usage statistics
  res.json({
    requestsToday: 42,
    objectsDetected: 156,
    averageResponseTime: '1.2s'
  });
});

module.exports = router;
```

### 3. Enhance Gemini Service (10 min)

#### Update `backend/src/services/geminiService.js`
```javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { cacheService } = require('./cacheService');

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

  async generateVisionResponse(detectedObjects, userQuery, context = {}) {
    try {
      // Build detailed prompt
      const prompt = this.buildPrompt(detectedObjects, userQuery, context);
      
      // Generate response
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      
      // Post-process for voice
      return this.optimizeForVoice(response);
    } catch (error) {
      console.error('Gemini API error:', error);
      
      // Fallback response
      return this.generateFallbackResponse(detectedObjects, userQuery);
    }
  }

  buildPrompt(detectedObjects, userQuery, context) {
    const objectsList = detectedObjects.map(obj => 
      `- ${obj.label} at ${obj.spatialInfo?.horizontal || 'unknown position'} ` +
      `(${Math.round(obj.confidence * 100)}% confidence)`
    ).join('\n');

    return `You are a helpful visual assistant for blind users. 
Your responses should be:
1. Natural and conversational
2. Spatially descriptive
3. Safety-conscious
4. Brief but informative

Detected objects:
${objectsList}

User query: "${userQuery}"

Context:
- Time: ${new Date().toLocaleTimeString()}
- Total objects visible: ${detectedObjects.length}
- Previous command: ${context.previousCommand || 'none'}

Generate a helpful, natural response that answers the user's query.
Focus on spatial relationships and practical guidance.
Keep response under 50 words for clear voice output.`;
  }

  optimizeForVoice(text) {
    // Remove special characters that don't sound good
    return text
      .replace(/[*_~`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  generateFallbackResponse(detectedObjects, userQuery) {
    if (detectedObjects.length === 0) {
      return "I don't see any objects clearly. Try adjusting the camera.";
    }

    const mainObject = detectedObjects[0];
    return `I can see ${mainObject.label} ${mainObject.spatialInfo?.horizontal || 'in view'}. ` +
           `What would you like to know about it?`;
  }
}

module.exports = new GeminiService();
```

### 4. Update Response Generator to Use API (10 min)

#### Update `frontend/src/services/responseGenerator.js`
```javascript
export class ResponseGenerator {
  constructor(spatialService, apiService) {
    this.spatial = spatialService;
    this.api = apiService;
    this.useBackend = true; // Toggle for offline mode
  }

  async generateResponse(command, detections, context = {}) {
    const prioritizedObjects = this.spatial.prioritizeObjects(detections);
    
    // Enhance objects with spatial info
    const enhancedObjects = prioritizedObjects.map(obj => ({
      ...obj,
      spatialInfo: this.spatial.getObjectPosition(obj.bbox, context.imageSize)
    }));

    // Try backend first if available
    if (this.useBackend && command.type !== 'unknown') {
      try {
        const apiResponse = await this.api.processVision(
          enhancedObjects,
          command.originalText,
          {
            commandType: command.type,
            previousCommand: context.previousCommand,
            timestamp: new Date().toISOString()
          }
        );
        
        if (apiResponse && apiResponse.response) {
          return apiResponse.response;
        }
      } catch (error) {
        console.error('Backend request failed, using local response:', error);
      }
    }

    // Fall back to local response generation
    return this.generateLocalResponse(command, enhancedObjects);
  }

  async generateLocalResponse(command, objects) {
    // Existing response logic from Sprint 4
    switch (command.handler) {
      case 'findObject':
        return this.findObjectResponse(command.target, objects);
      case 'describeScene':
        return this.describeSceneResponse(objects);
      case 'countObjects':
        return this.countObjectsResponse(command.target, objects);
      case 'navigateToObject':
        return this.navigateResponse(command.target, objects);
      case 'identifyObject':
        return this.identifyResponse(objects);
      default:
        return this.defaultResponse(objects);
    }
  }

  // Keep all existing response methods from Sprint 4
  // ... (findObjectResponse, describeSceneResponse, etc.)
}
```

### 5. Update Main App with Backend Integration (5 min)

#### Update `frontend/App.js`
```javascript
import { ApiService } from './src/services/api';

// In App component
const [apiService] = useState(new ApiService());
const [backendConnected, setBackendConnected] = useState(false);

// Update responseGenerator initialization
const [responseGenerator] = useState(
  new ResponseGenerator(spatialService, apiService)
);

// Add to initializeApp
const checkBackendConnection = async () => {
  const isHealthy = await apiService.checkHealth();
  setBackendConnected(isHealthy);
  
  if (isHealthy) {
    const authenticated = await apiService.authenticate();
    if (authenticated) {
      console.log('Backend connected and authenticated');
      await voiceService.speak('Connected to AI assistant.');
    }
  } else {
    console.log('Running in offline mode');
    responseGenerator.useBackend = false;
  }
};

// Call in useEffect
useEffect(() => {
  initializeApp();
  checkBackendConnection();
}, []);

// Update status display
<View style={styles.debugInfo}>
  <Text style={styles.debugText}>
    Backend: {backendConnected ? '✅ Connected' : '❌ Offline'}
  </Text>
  <Text style={styles.debugText}>
    Status: {isReady ? 'Ready' : 'Initializing...'}
  </Text>
</View>
```

### 6. Create Error Handling Middleware (5 min)

#### Create `backend/src/middleware/errorHandler.js`
```javascript
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

module.exports = (err, req, res, next) => {
  logger.error({
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  // Handle specific errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: {
        message: 'Invalid request data',
        details: err.errors
      }
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: {
        message: 'Authentication required'
      }
    });
  }

  // Gemini API errors
  if (err.message?.includes('Gemini')) {
    return res.status(503).json({
      error: {
        message: 'AI service temporarily unavailable',
        fallback: true
      }
    });
  }

  // Default error
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { 
        stack: err.stack 
      })
    }
  });
};
```

## 🧪 Testing Backend Integration

### 1. Test Authentication
```bash
curl -X POST http://localhost:3000/api/auth/device-login \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "test-device"}'
```

### 2. Test Vision Processing
```bash
# Get token from auth response
TOKEN="your-jwt-token"

curl -X POST http://localhost:3000/api/vision/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "detectedObjects": [
      {
        "label": "laptop",
        "confidence": 0.95,
        "bbox": {"x": 100, "y": 100, "width": 200, "height": 150},
        "spatialInfo": {"horizontal": "center", "distance": "close"}
      }
    ],
    "userQuery": "Where is my laptop?",
    "context": {}
  }'
```

### 3. Test Cache Performance
- Make same request twice
- Second response should include `"cached": true`
- Response time should be < 50ms

### 4. Test Offline Mode
- Stop backend: `docker-compose stop backend`
- App should fall back to local responses
- Voice commands should still work

## ✅ Sprint Completion Checklist
- [ ] API client service created
- [ ] Authentication working
- [ ] Vision endpoint processing requests
- [ ] Gemini generating intelligent responses
- [ ] Caching implemented
- [ ] Error handling robust
- [ ] Offline fallback working
- [ ] Backend status indicator

## 🚧 Common Issues & Solutions

### Issue: Cannot connect to backend
```javascript
// For Android emulator, use:
this.baseURL = 'http://10.0.2.2:3000/api';

// For physical device on same network:
this.baseURL = 'http://YOUR_COMPUTER_IP:3000/api';
```

### Issue: Gemini API rate limit
```javascript
// Add retry logic in geminiService.js
async generateWithRetry(prompt, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await this.model.generateContent(prompt);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

### Issue: Token expiration
```javascript
// Add token refresh logic
if (response.status === 401) {
  await this.refreshToken();
  // Retry request
}
```

## 📝 Next Sprint
Sprint 6 will polish the demo with professional presentation features and optimize performance.
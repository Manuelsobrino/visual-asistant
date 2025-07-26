# Visual Aid Assistant - Technical Implementation Plan (TensorFlow.js)

## 🎯 Project Architecture Overview
**Framework**: React Native with Expo (SDK 50+)  
**Target Platform**: Android (API Level 24+)  
**Vision Stack**: TensorFlow.js + COCO-SSD Model  
**AI Stack**: Google Vertex AI (Gemini 2.5)  
**Voice Stack**: Expo Speech APIs  

### Why TensorFlow.js over ML Kit?
- **80+ detectable objects** including keys, wallet, phone, laptop, cup, etc.
- **Specific object recognition** vs ML Kit's 5 broad categories
- **Perfect for hackathon** - works out of the box
- **Lightweight model** (COCO-SSD lite_mobilenet_v2)
- **Real-time performance** on mobile devices

---

## 📦 Complete Dependency Matrix

### Core Framework Dependencies (Frontend)
```json
{
  "expo": "~50.0.0",
  "react": "18.2.0",
  "react-native": "0.73.0",
  "expo-camera": "~14.0.0",
  "expo-media-library": "~15.9.0",
  "expo-av": "~13.10.0",
  "expo-device": "~5.9.0"
}
```

### Backend Dependencies
```json
{
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
}
```

### Voice Processing Dependencies
```json
{
  "expo-speech": "~11.7.0",
  "expo-speech-recognition": "~1.0.0",
  "react-native-voice": "^3.2.4"
}
```

### Computer Vision Dependencies
```json
{
  "@tensorflow/tfjs": "^4.15.0",
  "@tensorflow/tfjs-react-native": "^0.8.0",
  "@tensorflow-models/coco-ssd": "^2.2.3",
  "expo-gl": "~13.6.0",
  "expo-gl-cpp": "~13.6.0",
  "expo-camera": "~14.0.0"
}
```

### AI/LLM Dependencies
```json
{
  "@google-cloud/aiplatform": "^3.15.0",
  "@google/generative-ai": "^0.7.1",
  "axios": "^1.6.0"
}
```

### Utility Dependencies
```json
{
  "react-native-device-info": "^10.11.0",
  "react-native-permissions": "^4.1.0",
  "@react-native-async-storage/async-storage": "^1.21.0",
  "react-native-haptic-feedback": "^2.2.0"
}
```

---

## 🏗️ Project Structure & File Organization

```
visual-aid-assistant/
├── frontend/                       # React Native Expo App
│   ├── package.json
│   ├── app.json
│   ├── App.js                     # Main app entry point
│   ├── src/
│   │   ├── components/
│   │   │   ├── CameraView.js      # Camera component with TensorFlow
│   │   │   ├── ObjectDetectionOverlay.js # Visual bounding boxes
│   │   │   ├── VoiceInterface.js  # Speech recognition & TTS
│   │   │   └── AIProcessor.js     # Backend API integration
│   │   ├── services/
│   │   │   ├── api.js             # Backend API client
│   │   │   ├── tensorflow.js      # TensorFlow.js object detection
│   │   │   ├── spatial.js         # Spatial positioning logic
│   │   │   ├── voice.js           # Voice processing service
│   │   │   └── permissions.js     # Permission handling
│   │   ├── utils/
│   │   │   ├── constants.js       # App constants
│   │   │   ├── helpers.js         # Utility functions
│   │   │   └── spatial-math.js    # Coordinate calculations
│   │   └── hooks/
│   │       ├── useCamera.js       # Camera management hook
│   │       ├── useVoice.js        # Voice processing hook
│   │       └── useObjectDetection.js  # TensorFlow integration hook
│   ├── assets/
│   │   └── sounds/
│   │       ├── listening.mp3      # Voice feedback sounds
│   │       └── found.mp3
│   └── config/
│       ├── camera.js              # Camera configuration
│       ├── tensorflow.js          # TensorFlow settings
│       └── api.js                 # API endpoint configuration
├── backend/                       # Node.js Express Backend
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js                  # Express server entry point
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js            # Authentication routes
│   │   │   ├── vision.js          # Vision processing routes
│   │   │   └── health.js          # Health check routes
│   │   ├── controllers/
│   │   │   ├── visionController.js # Vision API logic
│   │   │   └── authController.js  # Auth logic
│   │   ├── services/
│   │   │   ├── geminiService.js   # Gemini API integration
│   │   │   ├── cacheService.js    # Redis caching
│   │   │   └── rateLimiter.js    # Rate limiting logic
│   │   ├── middleware/
│   │   │   ├── auth.js            # JWT authentication
│   │   │   ├── errorHandler.js   # Error handling
│   │   │   └── validator.js       # Request validation
│   │   └── config/
│   │       ├── database.js        # Database configuration
│   │       ├── redis.js           # Redis configuration
│   │       └── gemini.js          # Gemini API config
│   └── .env.example               # Environment variables template
├── docker-compose.yml             # Docker orchestration
├── nginx/                         # Reverse proxy
│   ├── Dockerfile
│   └── nginx.conf
└── README.md                      # Project documentation
```

---

## 🔧 Technical Implementation Specifications

### 1. Camera & TensorFlow.js Integration

#### File: `frontend/src/services/tensorflow.js`
```javascript
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

export class TensorFlowService {
  constructor() {
    this.model = null;
    this.isReady = false;
  }

  async initialize() {
    // Wait for TensorFlow.js to initialize
    await tf.ready();
    
    // Load COCO-SSD model
    this.model = await cocoSsd.load({
      base: 'lite_mobilenet_v2' // Lightweight model for mobile
    });
    
    this.isReady = true;
  }

  async detectObjects(imageData) {
    if (!this.isReady) {
      throw new Error('TensorFlow model not initialized');
    }

    // Run detection
    const predictions = await this.model.detect(imageData);
    
    // Format predictions for our app
    return predictions.map(pred => ({
      label: pred.class,
      confidence: pred.score,
      boundingBox: {
        x: pred.bbox[0],
        y: pred.bbox[1],
        width: pred.bbox[2],
        height: pred.bbox[3]
      }
    }));
  }

  // COCO-SSD can detect these objects:
  // person, bicycle, car, motorcycle, airplane, bus, train, truck, boat,
  // traffic light, fire hydrant, stop sign, parking meter, bench, bird,
  // cat, dog, horse, sheep, cow, elephant, bear, zebra, giraffe, backpack,
  // umbrella, handbag, tie, suitcase, frisbee, skis, snowboard, sports ball,
  // kite, baseball bat, baseball glove, skateboard, surfboard, tennis racket,
  // bottle, wine glass, cup, fork, knife, spoon, bowl, banana, apple,
  // sandwich, orange, broccoli, carrot, hot dog, pizza, donut, cake,
  // chair, couch, potted plant, bed, dining table, toilet, tv, laptop,
  // mouse, remote, keyboard, cell phone, microwave, oven, toaster, sink,
  // refrigerator, book, clock, vase, scissors, teddy bear, hair drier, toothbrush
}
```

#### File: `frontend/src/components/CameraView.js`
```javascript
import React, { useRef, useState, useEffect } from 'react';
import { View, Platform } from 'react-native';
import { Camera } from 'expo-camera';
import * as GL from 'expo-gl';
import { GLView } from 'expo-gl';
import { TensorFlowService } from '../services/tensorflow';
import { cameraWithTensors } from '@tensorflow/tfjs-react-native';

const TensorCamera = cameraWithTensors(Camera);

export const CameraView = ({ onObjectsDetected }) => {
  const [tfService] = useState(new TensorFlowService());
  const [isModelReady, setIsModelReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const initializeTensorFlow = async () => {
      await tfService.initialize();
      setIsModelReady(true);
    };
    initializeTensorFlow();
  }, []);

  const processImage = async (images, updatePreview, gl) => {
    if (!isModelReady || isProcessing) return;
    
    const loop = async () => {
      if (!isProcessing) {
        setIsProcessing(true);
        
        try {
          const nextImageTensor = images.next().value;
          if (nextImageTensor) {
            const objects = await tfService.detectObjects(nextImageTensor);
            onObjectsDetected(objects);
            nextImageTensor.dispose();
          }
        } catch (error) {
          console.error('Detection error:', error);
        }
        
        setIsProcessing(false);
      }
      
      requestAnimationFrame(loop);
    };
    loop();
  };

  const textureDims = Platform.OS === 'ios' ? 
    { width: 1080, height: 1920 } : 
    { width: 1080, height: 1920 };

  if (!isModelReady) {
    return <View style={{ flex: 1, backgroundColor: 'black' }} />;
  }

  return (
    <TensorCamera
      style={{ flex: 1 }}
      type={Camera.Constants.Type.back}
      onReady={processImage}
      resizeHeight={200}
      resizeWidth={152}
      resizeDepth={3}
      autorender={true}
      cameraTextureHeight={textureDims.height}
      cameraTextureWidth={textureDims.width}
    />
  );
};
```

### 2. Spatial Processing Logic

#### File: `src/utils/spatial-math.js`
```javascript
export class SpatialProcessor {
  constructor(screenWidth = 375, screenHeight = 667) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
  }

  getDirection(boundingBox) {
    const centerX = boundingBox.x + boundingBox.width / 2;
    const position = centerX / this.screenWidth;
    
    if (position < 0.25) return "far to your left";
    if (position < 0.4) return "to your left";
    if (position < 0.6) return "directly in front of you";
    if (position < 0.75) return "to your right";
    return "far to your right";
  }

  estimateDistance(boundingBox) {
    const objectArea = boundingBox.width * boundingBox.height;
    const screenArea = this.screenWidth * this.screenHeight;
    const areaRatio = objectArea / screenArea;
    
    if (areaRatio > 0.3) return "very close";
    if (areaRatio > 0.15) return "about 2-3 feet away";
    if (areaRatio > 0.05) return "several feet away";
    return "across the room";
  }

  getVerticalPosition(boundingBox) {
    const centerY = boundingBox.y + boundingBox.height / 2;
    const position = centerY / this.screenHeight;
    
    if (position < 0.3) return "high up";
    if (position > 0.7) return "low down";
    return "at eye level";
  }

  findNearestObjects(targetObject, allObjects, maxDistance = 100) {
    const targetCenter = {
      x: targetObject.boundingBox.x + targetObject.boundingBox.width / 2,
      y: targetObject.boundingBox.y + targetObject.boundingBox.height / 2
    };

    return allObjects
      .filter(obj => obj.label !== targetObject.label)
      .map(obj => {
        const objCenter = {
          x: obj.boundingBox.x + obj.boundingBox.width / 2,
          y: obj.boundingBox.y + obj.boundingBox.height / 2
        };
        const distance = Math.sqrt(
          Math.pow(targetCenter.x - objCenter.x, 2) + 
          Math.pow(targetCenter.y - objCenter.y, 2)
        );
        return { ...obj, distance };
      })
      .filter(obj => obj.distance < maxDistance)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2);
  }
}
```

### 3. Backend API Client

#### File: `frontend/src/services/api.js`
```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export class ApiService {
  constructor() {
    this.token = null;
    this.loadToken();
  }

  async loadToken() {
    this.token = await AsyncStorage.getItem('authToken');
  }

  async setToken(token) {
    this.token = token;
    await AsyncStorage.setItem('authToken', token);
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
        ...options.headers,
      },
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
      if (response.status === 401) {
        // Handle token expiration
        await this.logout();
      }
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  async login(deviceId) {
    const response = await this.request('/auth/device-login', {
      method: 'POST',
      body: JSON.stringify({ deviceId }),
    });
    await this.setToken(response.token);
    return response;
  }

  async processVision(detectedObjects, userQuery) {
    return this.request('/vision/process', {
      method: 'POST',
      body: JSON.stringify({ detectedObjects, userQuery }),
    });
  }

  async logout() {
    await AsyncStorage.removeItem('authToken');
    this.token = null;
  }
}
```

### 4. Backend Architecture

#### File: `backend/server.js`
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
  max: 100 // limit each IP to 100 requests per windowMs
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
  console.log(`Server running on port ${PORT}`);
});
```

#### File: `backend/src/services/geminiService.js`
```javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { cacheService } = require('./cacheService');

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  }

  async generateSpatialGuidance(detectedObjects, targetObject, userQuery) {
    const spatialProcessor = new SpatialProcessor();
    
    // Find target object
    const target = detectedObjects.find(obj => 
      obj.label.toLowerCase().includes(targetObject.toLowerCase())
    );

    if (!target) {
      return `I don't see any ${targetObject} in the current view. Try moving the camera around the room.`;
    }

    // Get spatial data
    const direction = spatialProcessor.getDirection(target.boundingBox);
    const distance = spatialProcessor.estimateDistance(target.boundingBox);
    const verticalPos = spatialProcessor.getVerticalPosition(target.boundingBox);
    const nearbyObjects = spatialProcessor.findNearestObjects(target, detectedObjects);

    const prompt = `
You are a spatial navigation assistant for blind users. Generate a natural, helpful response.

Detected objects: ${detectedObjects.map(o => o.label).join(', ')}
Target object: ${target.label} (confidence: ${Math.round(target.confidence * 100)}%)
Direction: ${direction}
Distance: ${distance} 
Vertical position: ${verticalPos}
Nearby objects: ${nearbyObjects.map(o => o.label).join(', ')}

User query: "${userQuery}"

Provide specific, actionable spatial guidance in a conversational tone. Include:
1. Location relative to user's position
2. Distance estimation
3. Reference points from nearby objects
4. Encouragement/confirmation

Example: "I found your keys! They're on the coffee table about 3 feet to your right, next to your phone."

Response:`;

    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('Gemini API error:', error);
      return `I can see your ${target.label} ${direction}, ${distance}. ${nearbyObjects.length > 0 ? `It's near your ${nearbyObjects[0].label}.` : ''}`;
    }
  }
}

module.exports = new GeminiService();
```

### 4. Voice Processing System

#### File: `src/services/voice.js`
```javascript
import * as Speech from 'expo-speech';
import Voice from '@react-native-voice/voice';

export class VoiceService {
  constructor() {
    this.isListening = false;
    this.setupVoiceRecognition();
  }

  setupVoiceRecognition() {
    Voice.onSpeechStart = this.onSpeechStart;
    Voice.onSpeechEnd = this.onSpeechEnd;
    Voice.onSpeechResults = this.onSpeechResults;
    Voice.onSpeechError = this.onSpeechError;
  }

  async speak(text, options = {}) {
    const speechOptions = {
      language: 'en-US',
      pitch: 1.0,
      rate: 0.9,
      ...options
    };
    
    return Speech.speak(text, speechOptions);
  }

  async startListening() {
    if (this.isListening) return;
    
    try {
      this.isListening = true;
      await Voice.start('en-US');
    } catch (error) {
      console.error('Voice recognition error:', error);
      this.isListening = false;
    }
  }

  async stopListening() {
    if (!this.isListening) return;
    
    try {
      await Voice.stop();
      this.isListening = false;
    } catch (error) {
      console.error('Voice stop error:', error);
    }
  }

  onSpeechStart = () => {
    console.log('Speech recognition started');
  };

  onSpeechEnd = () => {
    this.isListening = false;
  };

  onSpeechResults = (event) => {
    const results = event.value;
    if (results && results.length > 0) {
      this.handleVoiceCommand(results[0]);
    }
  };

  onSpeechError = (error) => {
    console.error('Speech recognition error:', error);
    this.isListening = false;
  };

  parseVoiceCommand(text) {
    const lowerText = text.toLowerCase();
    
    // Command patterns
    const findPatterns = [
      /find my (\w+)/,
      /where (?:is|are) my (\w+)/,
      /locate my (\w+)/,
      /look for my (\w+)/
    ];

    for (const pattern of findPatterns) {
      const match = lowerText.match(pattern);
      if (match) {
        return {
          action: 'find',
          object: match[1],
          originalText: text
        };
      }
    }

    // General scan command
    if (lowerText.includes('what do you see') || lowerText.includes('scan')) {
      return {
        action: 'scan',
        object: null,
        originalText: text
      };
    }

    return {
      action: 'unknown',
      object: null,
      originalText: text
    };
  }
}
```

### 5. Main App Integration

#### File: `frontend/App.js`
```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { CameraView } from './src/components/CameraView';
import { ObjectDetectionOverlay } from './src/components/ObjectDetectionOverlay';
import { VoiceService } from './src/services/voice';
import { ApiService } from './src/services/api';
import * as Device from 'expo-device';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';

const { width, height } = Dimensions.get('window');

export default function App() {
  const [detectedObjects, setDetectedObjects] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [voiceService] = useState(new VoiceService());
  const [apiService] = useState(new ApiService());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isTfReady, setIsTfReady] = useState(false);

  useEffect(() => {
    // Initialize TensorFlow.js
    const initTf = async () => {
      await tf.ready();
      setIsTfReady(true);
    };
    initTf();

    // Authenticate with device ID
    const authenticate = async () => {
      try {
        const deviceId = Device.osInternalBuildId || Device.modelId;
        await apiService.login(deviceId);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Authentication failed:', error);
      }
    };
    authenticate();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Initialize voice commands
    voiceService.handleVoiceCommand = async (command) => {
      const parsedCommand = voiceService.parseVoiceCommand(command);
      
      if (parsedCommand.action === 'find' && parsedCommand.object) {
        setIsProcessing(true);
        
        try {
          const response = await apiService.processVision(
            detectedObjects,
            parsedCommand.originalText
          );
          
          await voiceService.speak(response.guidance);
        } catch (error) {
          await voiceService.speak("Sorry, I'm having trouble processing that request.");
        }
        
        setIsProcessing(false);
      } else if (parsedCommand.action === 'scan') {
        const objectList = detectedObjects.map(obj => obj.label).join(', ');
        await voiceService.speak(`I can see: ${objectList || 'no objects detected'}`);
      }
    };

    // Start listening for voice commands
    voiceService.startListening();

    return () => {
      voiceService.stopListening();
    };
  }, [detectedObjects, isAuthenticated]);

  const handleObjectsDetected = (objects) => {
    setDetectedObjects(objects);
  };

  if (!isTfReady || !isAuthenticated) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Initializing Visual Assistant...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView onObjectsDetected={handleObjectsDetected} />
      <ObjectDetectionOverlay 
        objects={detectedObjects}
        screenWidth={width}
        screenHeight={height}
      />
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <Text style={styles.processingText}>Processing...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  loadingText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  processingOverlay: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 20,
    alignItems: 'center',
  },
  processingText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
```

---

## 🐳 Docker Configuration

### File: `docker-compose.yml`
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    container_name: visual-aid-backend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/visual_aid
    env_file:
      - ./backend/.env
    depends_on:
      - redis
      - postgres
    networks:
      - app-network
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: visual-aid-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - app-network
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    container_name: visual-aid-postgres
    environment:
      - POSTGRES_DB=visual_aid
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - app-network
    restart: unless-stopped

  nginx:
    build: ./nginx
    container_name: visual-aid-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - backend
    networks:
      - app-network
    restart: unless-stopped

volumes:
  redis-data:
  postgres-data:

networks:
  app-network:
    driver: bridge
```

### File: `backend/Dockerfile`
```dockerfile
FROM node:18-alpine

# Install dumb-init to handle signals properly
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy app source
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Expose port
EXPOSE 3000

# Use dumb-init to run node
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
```

### File: `nginx/Dockerfile`
```dockerfile
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Expose ports
EXPOSE 80 443
```

### File: `nginx/nginx.conf`
```nginx
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:3000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

    server {
        listen 80;
        server_name localhost;

        # API routes
        location /api {
            limit_req zone=api_limit burst=20 nodelay;
            
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Health check endpoint
        location /health {
            proxy_pass http://backend/api/health;
            access_log off;
        }
    }
}
```

---

## 🔐 Backend Implementation Details

### File: `backend/src/controllers/visionController.js`
```javascript
const geminiService = require('../services/geminiService');
const { validationResult } = require('express-validator');
const { rateLimiter } = require('../services/rateLimiter');

exports.processVision = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { detectedObjects, userQuery } = req.body;
    const userId = req.user.id;

    // Check rate limit
    const allowed = await rateLimiter.checkLimit(userId);
    if (!allowed) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    // Process with Gemini
    const guidance = await geminiService.generateSpatialGuidance(
      detectedObjects,
      userQuery
    );

    // Log usage for analytics
    await logUsage(userId, detectedObjects.length);

    res.json({ guidance });
  } catch (error) {
    next(error);
  }
};

async function logUsage(userId, objectCount) {
  // Implementation for usage tracking
  console.log(`User ${userId} processed ${objectCount} objects`);
}
```

### File: `backend/src/middleware/auth.js`
```javascript
const jwt = require('jsonwebtoken');

exports.authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

### File: `backend/src/routes/auth.js`
```javascript
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

router.post('/device-login', [
  body('deviceId').notEmpty().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { deviceId } = req.body;
  
  // Create or get user by device ID
  const user = await findOrCreateUser(deviceId);
  
  // Generate JWT
  const token = jwt.sign(
    { id: user.id, deviceId },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({ token, user });
});

async function findOrCreateUser(deviceId) {
  // Implementation depends on your database choice
  return { id: deviceId, deviceId };
}

module.exports = router;
```

### File: `backend/.env.example`
```bash
# Server Configuration
NODE_ENV=production
PORT=3000

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this
ALLOWED_ORIGINS=http://localhost:19000,http://localhost:19001

# External APIs
GEMINI_API_KEY=your-gemini-api-key

# Database
DATABASE_URL=postgresql://postgres:password@postgres:5432/visual_aid

# Redis
REDIS_URL=redis://redis:6379

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### File: `backend/src/services/cacheService.js`
```javascript
const redis = require('redis');

class CacheService {
  constructor() {
    this.client = redis.createClient({
      url: process.env.REDIS_URL
    });
    
    this.client.on('error', (err) => console.error('Redis Client Error', err));
    this.client.connect();
  }

  async get(key) {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async del(key) {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }
}

module.exports = { cacheService: new CacheService() };
```

### File: `backend/src/services/rateLimiter.js`
```javascript
const { cacheService } = require('./cacheService');

class RateLimiter {
  constructor(windowMs = 900000, maxRequests = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  async checkLimit(userId) {
    const key = `rate_limit:${userId}`;
    const current = await cacheService.get(key) || 0;
    
    if (current >= this.maxRequests) {
      return false;
    }

    await cacheService.set(key, current + 1, Math.floor(this.windowMs / 1000));
    return true;
  }

  async getRemainingRequests(userId) {
    const key = `rate_limit:${userId}`;
    const current = await cacheService.get(key) || 0;
    return Math.max(0, this.maxRequests - current);
  }
}

module.exports = { rateLimiter: new RateLimiter() };
```

### File: `backend/src/routes/vision.js`
```javascript
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const visionController = require('../controllers/visionController');

router.post('/process', 
  authenticate,
  [
    body('detectedObjects').isArray(),
    body('userQuery').isString().trim().notEmpty()
  ],
  visionController.processVision
);

module.exports = router;
```

### File: `backend/package.json`
```json
{
  "name": "visual-aid-backend",
  "version": "1.0.0",
  "description": "Backend for Visual Aid Assistant",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest"
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
    "nodemon": "^3.0.2",
    "jest": "^29.7.0"
  }
}
```

---

## 🚀 Deployment Instructions

### Local Development

1. **Backend Setup**:
```bash
cd backend
cp .env.example .env
# Edit .env with your API keys
npm install
npm run dev
```

2. **Frontend Setup**:
```bash
cd frontend
npm install
# Create .env.local with EXPO_PUBLIC_API_URL=http://localhost:3000/api
expo start
```

### Docker Deployment

1. **Build and run with Docker Compose**:
```bash
# From project root
docker-compose up -d
```

2. **View logs**:
```bash
docker-compose logs -f backend
```

3. **Stop services**:
```bash
docker-compose down
```

### Production Deployment

1. **Environment Variables**:
   - Set strong JWT_SECRET
   - Configure ALLOWED_ORIGINS for your domain
   - Use production database credentials
   - Set up SSL certificates in nginx/ssl/

2. **Database Migrations**:
```bash
docker-compose exec backend npm run migrate
```

3. **Health Monitoring**:
   - Health check endpoint: `http://your-domain/health`
   - Monitor Redis memory usage
   - Set up logging aggregation

---

## ⚙️ Configuration Files

### File: `frontend/app.json`
```json
{
  "expo": {
    "name": "Visual Aid Assistant",
    "slug": "visual-aid-assistant",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "plugins": [
      [
        "expo-camera",
        {
          "cameraPermission": "Allow Visual Aid Assistant to access your camera to detect objects."
        }
      ],
      [
        "expo-av",
        {
          "microphonePermission": "Allow Visual Aid Assistant to access your microphone for voice commands."
        }
      ]
    ],
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FFFFFF"
      },
      "permissions": [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.VIBRATE"
      ]
    }
  }
}
```

### File: `frontend/package.json`
```json
{
  "name": "visual-aid-assistant-frontend",
  "version": "1.0.0",
  "main": "node_modules/expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web"
  },
  "dependencies": {
    "expo": "~50.0.0",
    "react": "18.2.0",
    "react-native": "0.73.0",
    "expo-camera": "~14.0.0",
    "expo-media-library": "~15.9.0",
    "expo-av": "~13.10.0",
    "expo-speech": "~11.7.0",
    "expo-device": "~5.9.0",
    "expo-gl": "~13.6.0",
    "expo-gl-cpp": "~13.6.0",
    "@tensorflow/tfjs": "^4.15.0",
    "@tensorflow/tfjs-react-native": "^0.8.0",
    "@tensorflow-models/coco-ssd": "^2.2.3",
    "@react-native-voice/voice": "^3.2.4",
    "react-native-permissions": "^4.1.0",
    "react-native-haptic-feedback": "^2.2.0",
    "@react-native-async-storage/async-storage": "^1.21.0"
  }
}
```

---

## 🚀 Implementation Priority & Testing

### Phase 1: Core Infrastructure (Priority 1)
1. **Camera setup** with basic preview
2. **ML Kit integration** with object detection
3. **Basic TTS** for voice output
4. **Simple spatial processing** (direction only)

### Phase 2: AI Integration (Priority 2)
1. **Gemini API integration** with basic prompts
2. **Voice command parsing** for "find X" commands
3. **Enhanced spatial processing** (distance, nearby objects)
4. **Error handling** and fallbacks

### Phase 3: Demo Features (Priority 3)
1. **Visual overlay** with bounding boxes
2. **Real-time performance optimization**
3. **Demo script preparation**
4. **Edge case handling**

### Testing Strategy
```bash
# Test object detection accuracy (COCO-SSD supported objects)
- cell phone, laptop, keyboard, mouse
- cup, bottle, bowl, fork, knife, spoon
- backpack, handbag, suitcase
- book, clock, scissors
- chair, couch, dining table, tv
- Various lighting conditions
- Different distances and angles

# Test voice recognition
- "Find my phone"
- "Where is my laptop?"
- "Look for my backpack"
- "Find my cup"
- Background noise tolerance

# Test spatial accuracy
- Object positioning accuracy
- Distance estimation validation
- Relative positioning correctness
```

---

**Key Success Metrics**: 
- Object detection latency < 2 seconds
- Voice response time < 3 seconds  
- Spatial accuracy > 80% for demo objects
- End-to-end pipeline functional on Android device

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 18+
- Docker and Docker Compose
- Expo CLI (`npm install -g expo-cli`)
- Android Studio (for Android development)
- Gemini API Key from Google Cloud

### Setup Steps

1. **Clone and setup project structure**:
```bash
mkdir visual-aid-assistant
cd visual-aid-assistant
mkdir frontend backend nginx
```

2. **Setup Backend**:
```bash
cd backend
npm init -y
# Copy backend files from plan
cp .env.example .env
# Add your GEMINI_API_KEY to .env
```

3. **Setup Frontend**:
```bash
cd ../frontend
expo init . --template blank
# Copy frontend files from plan
```

4. **Start with Docker**:
```bash
cd ..
docker-compose up -d
```

5. **Start Frontend**:
```bash
cd frontend
npm install
expo start
```

6. **Test the app**:
- Scan QR code with Expo Go app on Android
- Grant camera and microphone permissions
- Say "Find my keys" to test object detection

### Troubleshooting

- **Backend not connecting**: Check Docker logs with `docker-compose logs backend`
- **Redis errors**: Ensure Redis container is running with `docker ps`
- **Camera not working**: Check permissions in Android settings
- **API errors**: Verify GEMINI_API_KEY is set correctly
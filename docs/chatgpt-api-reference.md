# ChatGPT Advanced Voice & Vision API Implementation Guide

## Overview

This guide covers implementing OpenAI's Realtime API (Advanced Voice Mode) and Vision capabilities to create voice-enabled applications with computer vision features.

## Available APIs

### 1. Realtime API (Advanced Voice Mode)
- **Purpose**: Real-time speech-to-speech conversations
- **Technology**: WebSocket-based connection to GPT-4o
- **Capabilities**: Natural voice interactions, interruption handling, function calling
- **Release**: October 2024 (Public Beta)

### 2. Chat Completions API with Audio
- **Purpose**: Audio input/output in traditional request-response format
- **Technology**: HTTP-based API calls
- **Use Case**: When low-latency isn't required
- **Release**: October 2024

### 3. Vision API
- **Purpose**: Image understanding and analysis
- **Technology**: Part of GPT-4o multimodal capabilities
- **Integration**: Works with both Realtime and Chat Completions APIs

## Authentication & Setup

### API Key Requirements
```javascript
// Environment variables needed
OPENAI_API_KEY=your_api_key_here
OPENAI_ORG_ID=your_org_id_here (optional)
```

### Pricing Structure
- **Text Input**: $5 per 1M tokens
- **Text Output**: $20 per 1M tokens
- **Audio Input**: $100 per 1M tokens (~$0.06/minute)
- **Audio Output**: $200 per 1M tokens (~$0.24/minute)
- **Cached Audio Input**: $20 per 1M tokens (50% discount)

## Realtime API Implementation

### WebSocket Connection Setup

```javascript
const WebSocket = require('ws');

const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';

const ws = new WebSocket(OPENAI_REALTIME_URL, {
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'OpenAI-Beta': 'realtime=v1'
  }
});

ws.on('open', () => {
  console.log('Connected to OpenAI Realtime API');
  
  // Send session configuration
  ws.send(JSON.stringify({
    type: 'session.update',
    session: {
      modalities: ['text', 'audio'],
      instructions: 'You are a helpful assistant.',
      voice: 'alloy',
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      input_audio_transcription: {
        model: 'whisper-1'
      }
    }
  }));
});
```

### Audio Input Handling

```javascript
// Send audio data
function sendAudioData(audioBuffer) {
  const base64Audio = audioBuffer.toString('base64');
  
  ws.send(JSON.stringify({
    type: 'input_audio_buffer.append',
    audio: base64Audio
  }));
}

// Commit audio input for processing
function commitAudio() {
  ws.send(JSON.stringify({
    type: 'input_audio_buffer.commit'
  }));
}
```

### Function Calling Setup

```javascript
// Define functions the AI can call
const tools = [
  {
    type: 'function',
    name: 'get_weather',
    description: 'Get current weather for a location',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'The city and state/country'
        }
      },
      required: ['location']
    }
  }
];

// Include tools in session update
ws.send(JSON.stringify({
  type: 'session.update',
  session: {
    tools: tools,
    tool_choice: 'auto'
  }
}));
```

### Response Handling

```javascript
ws.on('message', (data) => {
  const event = JSON.parse(data.toString());
  
  switch(event.type) {
    case 'response.audio.delta':
      // Stream audio output
      playAudioChunk(Buffer.from(event.delta, 'base64'));
      break;
      
    case 'response.function_call_arguments.done':
      // Handle function calls
      handleFunctionCall(event.name, event.arguments);
      break;
      
    case 'response.done':
      console.log('Response completed');
      break;
      
    case 'error':
      console.error('API Error:', event.error);
      break;
  }
});
```

## Vision Integration

### Image Input with Realtime API

```javascript
// Send image for analysis
function sendImageForAnalysis(imageBase64) {
  ws.send(JSON.stringify({
    type: 'conversation.item.create',
    item: {
      type: 'message',
      role: 'user',
      content: [
        {
          type: 'input_image',
          image: imageBase64
        }
      ]
    }
  }));
  
  // Trigger response
  ws.send(JSON.stringify({
    type: 'response.create'
  }));
}
```

### Vision with Chat Completions API

```javascript
const OpenAI = require('openai');
const openai = new OpenAI();

async function analyzeImageWithVision(imageBase64, audioPrompt = null) {
  const messages = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Describe what you see in this image'
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${imageBase64}`
          }
        }
      ]
    }
  ];

  // Add audio if provided
  if (audioPrompt) {
    messages[0].content.push({
      type: 'input_audio',
      input_audio: {
        data: audioPrompt,
        format: 'wav'
      }
    });
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-audio-preview',
    messages: messages,
    modalities: ['text', 'audio'],
    audio: { voice: 'alloy', format: 'wav' }
  });

  return response;
}
```

## Audio Processing

### Recording Audio (Browser)

```javascript
class AudioRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
  }

  async startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true
      }
    });

    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=pcm'
    });

    this.mediaRecorder.ondataavailable = (event) => {
      this.audioChunks.push(event.data);
    };

    this.mediaRecorder.start(100); // 100ms chunks
  }

  stopRecording() {
    return new Promise((resolve) => {
      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        resolve(audioBlob);
      };
      this.mediaRecorder.stop();
    });
  }
}
```

### Audio Playback

```javascript
class AudioPlayer {
  constructor() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.audioQueue = [];
    this.isPlaying = false;
  }

  async playAudioChunk(audioBuffer) {
    this.audioQueue.push(audioBuffer);
    if (!this.isPlaying) {
      this.processQueue();
    }
  }

  async processQueue() {
    this.isPlaying = true;
    
    while (this.audioQueue.length > 0) {
      const buffer = this.audioQueue.shift();
      await this.playBuffer(buffer);
    }
    
    this.isPlaying = false;
  }

  async playBuffer(buffer) {
    const audioData = await this.audioContext.decodeAudioData(buffer);
    const source = this.audioContext.createBufferSource();
    source.buffer = audioData;
    source.connect(this.audioContext.destination);
    
    return new Promise((resolve) => {
      source.onended = resolve;
      source.start();
    });
  }
}
```

## Camera Integration

### Video Stream Setup

```javascript
class CameraHandler {
  constructor() {
    this.videoElement = null;
    this.canvas = null;
    this.context = null;
  }

  async initializeCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'environment' // Use back camera on mobile
      }
    });

    this.videoElement = document.createElement('video');
    this.videoElement.srcObject = stream;
    this.videoElement.play();

    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d');
  }

  captureFrame() {
    this.canvas.width = this.videoElement.videoWidth;
    this.canvas.height = this.videoElement.videoHeight;
    
    this.context.drawImage(this.videoElement, 0, 0);
    
    return this.canvas.toDataURL('image/jpeg', 0.8)
      .replace('data:image/jpeg;base64,', '');
  }

  startContinuousCapture(callback, interval = 1000) {
    setInterval(() => {
      const frameData = this.captureFrame();
      callback(frameData);
    }, interval);
  }
}
```

## Error Handling & Best Practices

### Connection Management

```javascript
class RealtimeAPIManager {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    this.ws = new WebSocket(OPENAI_REALTIME_URL, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    this.ws.on('close', () => {
      this.handleReconnect();
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
    }
  }
}
```

### Rate Limiting

```javascript
class RateLimiter {
  constructor(requestsPerMinute = 60) {
    this.requests = [];
    this.limit = requestsPerMinute;
  }

  async canMakeRequest() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < 60000);
    
    if (this.requests.length >= this.limit) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = 60000 - (now - oldestRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.requests.push(now);
    return true;
  }
}
```

## Complete Example: Voice + Vision App

```javascript
class VoiceVisionApp {
  constructor() {
    this.apiManager = new RealtimeAPIManager();
    this.audioRecorder = new AudioRecorder();
    this.audioPlayer = new AudioPlayer();
    this.cameraHandler = new CameraHandler();
    this.rateLimiter = new RateLimiter();
  }

  async initialize() {
    await this.apiManager.connect();
    await this.audioRecorder.startRecording();
    await this.cameraHandler.initializeCamera();

    // Send frames periodically for analysis
    this.cameraHandler.startContinuousCapture(
      (frameData) => this.processFrame(frameData),
      2000 // Every 2 seconds
    );
  }

  async processFrame(imageBase64) {
    if (await this.rateLimiter.canMakeRequest()) {
      this.apiManager.sendImageForAnalysis(imageBase64);
    }
  }

  async handleVoiceCommand(audioBuffer) {
    this.apiManager.sendAudioData(audioBuffer);
    this.apiManager.commitAudio();
  }
}

// Usage
const app = new VoiceVisionApp();
app.initialize();
```

## Deployment Considerations

### Security
- Store API keys securely (environment variables, not in code)
- Implement proper authentication for your app
- Use HTTPS for all communications
- Consider rate limiting on your server

### Performance
- Implement audio buffering for smooth playback
- Optimize image compression before sending
- Use WebRTC for real-time audio streaming
- Cache responses when appropriate

### Mobile Considerations
- Handle permissions for camera and microphone
- Optimize for battery usage
- Handle network connectivity changes
- Consider offline fallbacks

## Useful Libraries

### Audio Processing
- **Web Audio API**: Native browser audio processing
- **RecordRTC**: Cross-browser audio/video recording
- **AudioWorklet**: Low-latency audio processing

### WebSocket Management
- **ws** (Node.js): WebSocket client/server
- **socket.io**: Real-time communication
- **reconnecting-websocket**: Auto-reconnecting WebSocket

### Image Processing
- **Canvas API**: Image manipulation in browser
- **jimp**: Image processing in Node.js
- **sharp**: High-performance image processing

## Resources

- [OpenAI Realtime API Documentation](https://platform.openai.com/docs/guides/realtime)
- [LiveKit Multimodal Agent Framework](https://github.com/livekit/agents)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [WebRTC Documentation](https://webrtc.org/getting-started/)

## Support

For issues and questions:
- OpenAI Developer Forum
- OpenAI Discord Community
- Stack Overflow (tag: openai-api)
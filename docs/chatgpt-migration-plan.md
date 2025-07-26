# Visual Aid Assistant - ChatGPT API Migration Plan

## 🎯 Mission
Transform the Visual Aid Assistant from a complex microservices architecture to a streamlined ChatGPT Realtime API implementation, maintaining the core vision of helping blind users navigate through voice and camera while dramatically reducing development time.

## 🏗️ Architecture Transformation

### Current Architecture (6 hours)
```
Mobile App → TensorFlow.js → Express → Gemini API
     ↓            ↓            ↓          ↓
expo-speech   COCO-SSD    Docker    Redis/PostgreSQL
```

### New Architecture (2-3 hours)
```
Mobile App → WebSocket → OpenAI Realtime API
     ↓                        ↓
Camera Capture         GPT-4o (Voice + Vision)
```

## 📊 Comparison Overview

| Aspect | Original Plan | ChatGPT API | Impact |
|--------|--------------|-------------|---------|
| **Dev Time** | 6 hours | 2-3 hours | -60% time |
| **Voice Quality** | Robotic TTS | Natural human voice | 10x better |
| **Infrastructure** | Docker, Redis, PostgreSQL | None needed | -90% complexity |
| **Response Time** | 2-3 seconds | <500ms | 4x faster |
| **Code Lines** | ~2000 | ~500 | -75% code |
| **Cost (Demo)** | $20-50/month hosting | $5-10 total | -80% cost |

## 🔄 Migration Strategy

### What We Keep (40% of existing work)
- ✅ React Native/Expo project setup
- ✅ Camera integration and permissions
- ✅ Basic project structure
- ✅ App configuration files
- ✅ Development environment

### What We Replace
- ❌ TensorFlow.js/COCO-SSD → ✅ GPT-4V vision
- ❌ expo-speech/voice → ✅ Realtime voice API
- ❌ Express/Docker backend → ✅ Direct WebSocket
- ❌ Gemini API → ✅ GPT-4o
- ❌ Redis caching → ✅ Built-in streaming

### What's New
- 🆕 WebSocket connection manager
- 🆕 Audio streaming handlers
- 🆕 Real-time voice interruptions
- 🆕 Function calling for actions

## 🚀 Implementation Phases

### Phase 1: Foundation Refactor (45 min)
- Strip backend to minimal proxy (optional)
- Set up OpenAI API credentials
- Clean up unnecessary dependencies
- Prepare WebSocket infrastructure

### Phase 2: Voice Pipeline (45 min)
- WebSocket connection to Realtime API
- Audio recording with proper format (PCM16)
- Streaming audio playback
- Voice activity detection

### Phase 3: Vision Integration (30 min)
- Camera frame capture (every 1-2 seconds)
- Base64 image encoding
- Vision prompts for spatial understanding
- Response coordination

### Phase 4: User Experience (30 min)
- Hardware button activation
- Voice command patterns
- Error recovery flows
- Accessibility features

### Phase 5: Demo Preparation (30 min)
- Visual overlay for demonstration
- Performance optimization
- Test scenarios
- Backup plans

## 🛠️ Technical Requirements

### API Setup
```
OPENAI_API_KEY=sk-... (required)
Model: gpt-4o-realtime-preview-2024-10-01
WebSocket: wss://api.openai.com/v1/realtime
```

### Key Dependencies
```json
{
  "expo": "~49.0.0",
  "expo-camera": "~13.4.4",
  "expo-av": "~13.4.1",
  "react-native-webrtc": "^1.106.1",
  "base64-arraybuffer": "^1.0.2"
}
```

### Audio Configuration
- Format: PCM16 (16-bit, mono)
- Sample Rate: 16kHz
- Streaming chunks: 100ms

## 💡 Key Features to Implement

### Core Functionality
1. **Voice Activation**: "Hey Assistant" or volume button
2. **Continuous Listening**: Real-time conversation
3. **Vision Description**: Spatial object understanding
4. **Navigation Guidance**: Directional instructions

### Demo Scenarios
1. **Object Finding**: "Where's my coffee?"
2. **Scene Description**: "What do you see?"
3. **Person Detection**: "Is anyone here?"
4. **Navigation**: "Guide me to the door"

## 🚨 Risk Mitigation

### Technical Risks
| Risk | Mitigation |
|------|------------|
| API Outage | Local fallback with basic TTS |
| Rate Limits | Client-side throttling |
| Network Issues | Reconnection logic |
| High Latency | Frame sampling optimization |

### Demo Risks
| Risk | Mitigation |
|------|------------|
| No Internet | Mobile hotspot backup |
| API Errors | Pre-recorded demo video |
| Audio Issues | Test on multiple devices |
| Timeout | Shorter demo scenarios |

## 📈 Success Metrics

### Development
- Working voice conversation: 1 hour
- Camera integration: 30 min
- Full demo ready: 2.5 hours

### Demo Performance
- Voice response time: <500ms
- Object detection accuracy: 80%+
- Natural conversation flow
- Zero UI interaction needed

## 🎯 Sprint Overview

### Sprint 1: Backend Simplification (30 min)
- Remove Docker/Redis dependencies
- Create minimal API proxy
- Set up environment variables
- Test OpenAI connection

### Sprint 2: Voice Foundation (45 min)
- WebSocket manager implementation
- Audio recording pipeline
- Streaming playback system
- Basic conversation loop

### Sprint 3: Vision Integration (45 min)
- Camera frame capture
- Image optimization
- Vision API integration
- Spatial response generation

### Sprint 4: Voice UX Enhancement (30 min)
- Command patterns
- Hardware button detection
- Interruption handling
- Error recovery

### Sprint 5: Demo Polish (30 min)
- Visual overlay
- Performance tuning
- Test scenarios
- Presentation prep

## 🔑 Critical Success Factors

1. **Start Simple**: Get voice working first, then add vision
2. **Test Early**: Verify API connection in first 15 minutes
3. **Focus on Demo**: Polish what judges will see
4. **Have Backups**: Record demo video as safety net

## 📝 Decision Log

### Why ChatGPT over Original Plan
1. **Time**: 2-3 hours vs 6 hours implementation
2. **Quality**: Professional voice vs robotic TTS
3. **Simplicity**: Single API vs distributed system
4. **Innovation**: Latest AI tech vs traditional approach
5. **Reliability**: Managed service vs custom infrastructure

### Trade-offs Accepted
- No offline mode (acceptable for demo)
- Less visual feedback (voice-first is the goal)
- API dependency (mitigated with fallbacks)
- Per-minute costs (minimal for hackathon)

## 🏁 Next Steps

1. Review this plan (5 min)
2. Create sprint documentation (15 min)
3. Start Sprint 1 implementation
4. Test early and often
5. Focus on demo impact

---

**Ready to start?** The first sprint document should focus on simplifying the existing backend and preparing for WebSocket integration.
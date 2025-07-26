# Sprint 3: Vision Integration

## 🎯 Sprint Goal
Add camera functionality to capture frames and send them to GPT-4V for intelligent visual analysis through the Realtime API.

## ⏱️ Duration: 45 minutes

## 📋 Prerequisites
- Sprint 2 completed (voice foundation working)
- Camera permissions understanding
- Device with camera for testing

## 🔧 Tasks Breakdown

### 1. Install Camera Dependencies (5 min)

```bash
cd frontend
# Camera and image processing
npm install expo-camera
npm install expo-image-manipulator
npm install expo-file-system
```

### 2. Create Camera Service (15 min)

#### Create `frontend/src/services/CameraService.js`
```javascript
import { Camera } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

class CameraService {
  constructor() {
    this.camera = null;
    this.isCapturing = false;
    this.captureInterval = null;
    this.frameCallback = null;
  }

  async initialize() {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Camera permission not granted');
    }
    console.log('Camera initialized');
    return true;
  }

  setCamera(cameraRef) {
    this.camera = cameraRef;
  }

  async captureFrame() {
    if (!this.camera || this.isCapturing) return null;

    try {
      this.isCapturing = true;
      
      // Capture photo
      const photo = await this.camera.takePictureAsync({
        quality: 0.5,
        base64: true,
        skipProcessing: true,
      });

      // Resize for faster processing
      const resized = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 640 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      // Clean up temp file
      await FileSystem.deleteAsync(photo.uri, { idempotent: true });

      this.isCapturing = false;
      return resized.base64;
    } catch (error) {
      console.error('Frame capture error:', error);
      this.isCapturing = false;
      return null;
    }
  }

  startContinuousCapture(callback, intervalMs = 2000) {
    if (this.captureInterval) {
      this.stopContinuousCapture();
    }

    this.frameCallback = callback;
    this.captureInterval = setInterval(async () => {
      const frame = await this.captureFrame();
      if (frame && this.frameCallback) {
        this.frameCallback(frame);
      }
    }, intervalMs);

    console.log(`Started continuous capture every ${intervalMs}ms`);
  }

  stopContinuousCapture() {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
      this.frameCallback = null;
      console.log('Stopped continuous capture');
    }
  }

  async captureOnDemand() {
    const frame = await this.captureFrame();
    return frame;
  }
}

export default new CameraService();
```

### 3. Update RealtimeAPI for Vision (10 min)

#### Update `frontend/src/services/RealtimeAPI.js`
```javascript
// Add to existing RealtimeAPI.js

class RealtimeAPI {
  // ... existing code ...

  sendImage(base64Image, prompt = "Describe what you see in detail, focusing on objects and their spatial positions.") {
    this.sendMessage({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: prompt
          },
          {
            type: 'input_image',
            image: base64Image
          }
        ]
      }
    });

    // Trigger response
    this.sendMessage({
      type: 'response.create'
    });
  }

  // Update session configuration for vision
  configureSession() {
    this.sendMessage({
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: `You are a helpful visual aid assistant for blind users. 
          When describing images:
          - Focus on object identification and spatial relationships
          - Use clock positions (12 o'clock = straight ahead)
          - Mention distances: close (within reach), medium (few steps), far
          - Describe the most important objects first
          - Be concise but informative
          - Always consider safety hazards`,
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        },
        tools: [
          {
            type: 'function',
            name: 'describe_scene',
            description: 'Analyze and describe the visual scene',
            parameters: {
              type: 'object',
              properties: {
                objects: {
                  type: 'array',
                  description: 'List of detected objects with positions'
                },
                safety_concerns: {
                  type: 'string',
                  description: 'Any safety hazards to warn about'
                }
              }
            }
          }
        ]
      }
    });
  }
}
```

### 4. Create Vision-Enabled UI Component (10 min)

#### Create `frontend/src/components/CameraView.js`
```javascript
import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import CameraService from '../services/CameraService';
import RealtimeAPI from '../services/RealtimeAPI';

export default function CameraView({ isActive, onFrameAnalyzed }) {
  const cameraRef = useRef(null);
  const [hasPermission, setHasPermission] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    initializeCamera();
    return () => {
      CameraService.stopContinuousCapture();
    };
  }, []);

  useEffect(() => {
    if (isActive && hasPermission) {
      startVisionAnalysis();
    } else {
      CameraService.stopContinuousCapture();
    }
  }, [isActive, hasPermission]);

  const initializeCamera = async () => {
    try {
      const permitted = await CameraService.initialize();
      setHasPermission(permitted);
    } catch (error) {
      console.error('Camera init error:', error);
      setHasPermission(false);
    }
  };

  const startVisionAnalysis = () => {
    CameraService.startContinuousCapture(async (frameBase64) => {
      if (!isAnalyzing) {
        setIsAnalyzing(true);
        
        // Send to API
        RealtimeAPI.sendImage(frameBase64);
        
        if (onFrameAnalyzed) {
          onFrameAnalyzed();
        }

        // Prevent overlapping analyses
        setTimeout(() => setIsAnalyzing(false), 1500);
      }
    }, 3000); // Analyze every 3 seconds
  };

  if (hasPermission === null) {
    return <View style={styles.container}><Text>Requesting camera permission...</Text></View>;
  }
  if (hasPermission === false) {
    return <View style={styles.container}><Text>No camera permission</Text></View>;
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={(ref) => {
          cameraRef.current = ref;
          CameraService.setCamera(ref);
        }}
        style={styles.camera}
        type={CameraType.back}
        ratio="16:9"
      >
        {/* Overlay for demo */}
        <View style={styles.overlay}>
          <View style={styles.scanLine} />
          <Text style={styles.statusText}>
            {isActive ? (isAnalyzing ? 'Analyzing...' : 'Scanning...') : 'Camera Ready'}
          </Text>
        </View>
      </Camera>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanLine: {
    width: '80%',
    height: 2,
    backgroundColor: '#00ff00',
    opacity: 0.8,
  },
  statusText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
});
```

### 5. Update Main App with Vision (5 min)

#### Update `frontend/App.js`
```javascript
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView } from 'react-native';
import VoiceService from './src/services/VoiceService';
import CameraView from './src/components/CameraView';

const OPENAI_API_KEY = 'your-api-key-here';

export default function App() {
  const [isListening, setIsListening] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    initializeServices();
    return () => {
      VoiceService.disconnect();
    };
  }, []);

  const initializeServices = async () => {
    try {
      await VoiceService.initialize(OPENAI_API_KEY);
      setStatus('Ready');
      // Auto-start camera for vision
      setIsCameraActive(true);
    } catch (error) {
      setStatus('Failed: ' + error.message);
    }
  };

  const toggleListening = async () => {
    try {
      if (isListening) {
        await VoiceService.stopListening();
        setStatus('Processing...');
      } else {
        await VoiceService.startListening();
        setStatus('Listening...');
      }
      setIsListening(!isListening);
    } catch (error) {
      setStatus('Error: ' + error.message);
    }
  };

  const handleQuickCommand = (command) => {
    VoiceService.sendTextMessage(command);
    setStatus(`Sent: ${command}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Camera runs in background */}
      <CameraView 
        isActive={isCameraActive}
        onFrameAnalyzed={() => console.log('Frame analyzed')}
      />
      
      {/* UI Overlay */}
      <View style={styles.overlay}>
        <View style={styles.header}>
          <Text style={styles.title}>Visual Aid Assistant</Text>
          <Text style={styles.status}>{status}</Text>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity 
            style={[styles.mainButton, isListening && styles.buttonActive]}
            onPress={toggleListening}
          >
            <Text style={styles.buttonText}>
              {isListening ? '🔴 Stop' : '🎤 Speak'}
            </Text>
          </TouchableOpacity>

          <View style={styles.quickCommands}>
            <TouchableOpacity 
              style={styles.commandButton}
              onPress={() => handleQuickCommand("What do you see?")}
            >
              <Text style={styles.commandText}>What's here?</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.commandButton}
              onPress={() => handleQuickCommand("Describe the scene in detail")}
            >
              <Text style={styles.commandText}>Describe</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.commandButton}
              onPress={() => handleQuickCommand("Are there any people?")}
            >
              <Text style={styles.commandText}>People?</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  status: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 10,
  },
  controls: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  mainButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 25,
    borderRadius: 35,
    marginBottom: 20,
    alignItems: 'center',
  },
  buttonActive: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  quickCommands: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  commandButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  commandText: {
    color: '#fff',
    fontSize: 14,
  },
});
```

## 🧪 Testing

### 1. Test Camera Permission
```bash
npm start
# Grant camera permission when prompted
```

### 2. Test Vision Analysis
1. Point camera at objects
2. Wait for "Analyzing..." status
3. Listen for voice description
4. Try quick command buttons

### 3. Test Voice + Vision
1. Press "Speak" button
2. Say "What do you see?"
3. Should get voice response describing the scene

## ✅ Sprint Completion Checklist
- [ ] Camera service implemented
- [ ] Frame capture working
- [ ] Vision API integration complete
- [ ] UI shows camera feed
- [ ] Quick commands functional
- [ ] Voice describes scenes
- [ ] Continuous analysis working

## 🚨 Common Issues

### Issue: Camera black screen
```javascript
// Ensure permissions in app.json
"expo": {
  "plugins": [
    [
      "expo-camera",
      {
        "cameraPermission": "Allow Visual Aid to access camera."
      }
    ]
  ]
}
```

### Issue: Images too large
```javascript
// Reduce quality and size
const resized = await ImageManipulator.manipulateAsync(
  photo.uri,
  [{ resize: { width: 480 } }], // Smaller size
  { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
);
```

### Issue: Analysis too frequent
```javascript
// Increase interval
startContinuousCapture(callback, 5000); // 5 seconds instead of 3
```

## 💡 What We Achieved
1. **Camera integration complete**
2. **Automatic frame capture**
3. **Vision analysis via GPT-4V**
4. **Voice + Vision working together**
5. **Quick command interface**

## 📝 Next Sprint
Sprint 4 will enhance voice commands and create a seamless UX for blind users.
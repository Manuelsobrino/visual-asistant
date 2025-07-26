# Sprint 2: Voice-First Mobile App

## 🎯 Sprint Goal
Build a voice-activated mobile app with TensorFlow.js object detection, hardware button activation, and continuous camera capture - all without any visual UI for the end user.

## ⏱️ Duration: 1 hour

## 📋 Prerequisites
- Sprint 1 completed (backend running)
- Expo CLI installed (`npm install -g expo-cli`)
- Android device or emulator
- Expo Go app installed on device

## 🔧 Tasks Breakdown

### 1. Initialize Expo Project (10 min)

```bash
cd frontend
expo init . --template blank
# Choose: blank (TypeScript) or blank (JavaScript)

# Install core dependencies
npm install expo-camera expo-av expo-speech expo-device
npm install @tensorflow/tfjs @tensorflow/tfjs-react-native
npm install @tensorflow-models/coco-ssd
npm install expo-gl expo-gl-cpp
npm install @react-native-async-storage/async-storage
```

### 2. Configure App Permissions (5 min)

#### Update `frontend/app.json`
```json
{
  "expo": {
    "name": "Visual Aid Assistant",
    "slug": "visual-aid-assistant",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#000000"
    },
    "plugins": [
      [
        "expo-camera",
        {
          "cameraPermission": "Visual Aid Assistant needs camera access to help you identify objects."
        }
      ],
      [
        "expo-av",
        {
          "microphonePermission": "Visual Aid Assistant needs microphone access for voice commands."
        }
      ]
    ],
    "android": {
      "permissions": [
        "CAMERA",
        "RECORD_AUDIO"
      ]
    }
  }
}
```

### 3. Create TensorFlow Service (10 min)

#### Create `frontend/src/services/tensorflow.js`
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
    try {
      // Wait for TensorFlow to initialize
      await tf.ready();
      console.log('TensorFlow.js initialized');
      
      // Load COCO-SSD model
      this.model = await cocoSsd.load({
        base: 'lite_mobilenet_v2'
      });
      console.log('COCO-SSD model loaded');
      
      this.isReady = true;
      return true;
    } catch (error) {
      console.error('TensorFlow initialization error:', error);
      return false;
    }
  }

  async detectObjects(imageData) {
    if (!this.isReady || !this.model) {
      throw new Error('TensorFlow not ready');
    }

    try {
      const predictions = await this.model.detect(imageData);
      return predictions;
    } catch (error) {
      console.error('Detection error:', error);
      return [];
    }
  }

  dispose() {
    if (this.model) {
      this.model.dispose();
    }
  }
}
```

### 4. Create Voice Service (10 min)

#### Create `frontend/src/services/voice.js`
```javascript
import * as Speech from 'expo-speech';

export class VoiceService {
  constructor() {
    this.isSpeaking = false;
  }

  async speak(text, options = {}) {
    try {
      // Stop any ongoing speech
      if (this.isSpeaking) {
        await Speech.stop();
      }

      this.isSpeaking = true;
      
      const speechOptions = {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
        onDone: () => { this.isSpeaking = false; },
        onError: () => { this.isSpeaking = false; },
        ...options
      };
      
      await Speech.speak(text, speechOptions);
    } catch (error) {
      console.error('Speech error:', error);
      this.isSpeaking = false;
    }
  }

  async stop() {
    if (this.isSpeaking) {
      await Speech.stop();
      this.isSpeaking = false;
    }
  }

  async announceReady() {
    await this.speak('Visual Assistant ready. Press volume button to activate.');
  }

  async announceListening() {
    await this.speak('Listening...');
  }

  async announceError(message = 'Sorry, something went wrong') {
    await this.speak(message);
  }
}
```

### 5. Create Hardware Button Listener (10 min)

#### Create `frontend/src/services/hardwareButtons.js`
```javascript
import { DeviceEventEmitter, NativeEventEmitter, Platform } from 'react-native';

export class HardwareButtonService {
  constructor(onVolumePress) {
    this.onVolumePress = onVolumePress;
    this.subscription = null;
  }

  start() {
    // For Android, we'll use a workaround with volume changes
    // In production, you'd want a native module for proper button handling
    
    if (Platform.OS === 'android') {
      // This is a simplified approach - in real implementation,
      // you'd create a native module to capture volume button events
      console.log('Hardware button listener started');
      
      // Simulate button press for development
      // In production, implement native module
      this.simulateButtonPress();
    }
  }

  simulateButtonPress() {
    // For development/demo: simulate button press every 10 seconds
    this.interval = setInterval(() => {
      console.log('Simulating volume button press');
      if (this.onVolumePress) {
        this.onVolumePress();
      }
    }, 10000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
    if (this.subscription) {
      this.subscription.remove();
    }
  }
}
```

### 6. Create Main App Component (15 min)

#### Update `frontend/App.js`
```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Camera } from 'expo-camera';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { TensorFlowService } from './src/services/tensorflow';
import { VoiceService } from './src/services/voice';
import { HardwareButtonService } from './src/services/hardwareButtons';

export default function App() {
  const [hasPermission, setHasPermission] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [tfService] = useState(new TensorFlowService());
  const [voiceService] = useState(new VoiceService());
  const [buttonService, setButtonService] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [camera, setCamera] = useState(null);

  useEffect(() => {
    initializeApp();
    return () => {
      if (buttonService) buttonService.stop();
      if (tfService) tfService.dispose();
    };
  }, []);

  const initializeApp = async () => {
    try {
      // Request permissions
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');

      if (status !== 'granted') {
        await voiceService.speak('Camera permission is required for visual assistance.');
        return;
      }

      // Initialize TensorFlow
      await voiceService.speak('Initializing visual assistant, please wait.');
      const tfReady = await tfService.initialize();
      
      if (!tfReady) {
        await voiceService.announceError('Failed to initialize visual recognition.');
        return;
      }

      // Setup hardware button listener
      const buttonHandler = new HardwareButtonService(handleButtonPress);
      buttonHandler.start();
      setButtonService(buttonHandler);

      setIsReady(true);
      await voiceService.announceReady();
    } catch (error) {
      console.error('Initialization error:', error);
      await voiceService.announceError();
    }
  };

  const handleButtonPress = async () => {
    if (isProcessing || !camera) return;

    setIsProcessing(true);
    await voiceService.announceListening();

    try {
      // Take a photo
      const photo = await camera.takePictureAsync({
        quality: 0.5,
        base64: false,
        skipProcessing: true
      });

      // For now, announce that we're processing
      // In Sprint 3, we'll add actual detection
      await voiceService.speak('Processing image...');
      
      // Simulate processing time
      setTimeout(async () => {
        await voiceService.speak('I can see the room. Press volume button again to scan.');
        setIsProcessing(false);
      }, 2000);

    } catch (error) {
      console.error('Processing error:', error);
      await voiceService.announceError();
      setIsProcessing(false);
    }
  };

  if (hasPermission === null) {
    return <View style={styles.container} />;
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No access to camera</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera 
        style={styles.camera} 
        type={Camera.Constants.Type.back}
        ref={ref => setCamera(ref)}
      >
        {/* No UI elements - camera runs invisibly */}
        {/* In Sprint 3, we'll add visual overlay for demo */}
      </Camera>
      
      {/* Development status - remove in production */}
      <View style={styles.debugInfo}>
        <Text style={styles.debugText}>
          Status: {isReady ? 'Ready' : 'Initializing...'}
        </Text>
        <Text style={styles.debugText}>
          Processing: {isProcessing ? 'Yes' : 'No'}
        </Text>
      </View>
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
  text: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    margin: 20,
  },
  debugInfo: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 5,
  },
  debugText: {
    color: 'white',
    fontSize: 12,
  },
});
```

### 7. Create Folder Structure (5 min)

```bash
cd frontend
mkdir -p src/{services,components,utils,hooks}
mkdir -p assets/sounds

# Move the service files we created
# Copy the code above into the respective files
```

## 🧪 Testing

### 1. Start the App
```bash
cd frontend
npm install
expo start
```

### 2. Run on Device/Emulator
- Scan QR code with Expo Go app
- Or press 'a' for Android emulator

### 3. Test Flow
1. App should announce "Initializing visual assistant"
2. Grant camera and microphone permissions
3. App should announce "Visual Assistant ready"
4. Wait 10 seconds for simulated button press
5. App should say "Listening..." then "Processing image..."

## ✅ Sprint Completion Checklist
- [ ] Expo app created and running
- [ ] TensorFlow.js initialized successfully
- [ ] Camera permissions granted
- [ ] Voice announcements working
- [ ] Hardware button simulation working
- [ ] App running on device/emulator
- [ ] No visual UI (except debug info)
- [ ] Continuous camera capture

## 🚧 Common Issues & Solutions

### Issue: TensorFlow initialization fails
```javascript
// Solution: Ensure all dependencies are installed
npm install @tensorflow/tfjs@4.15.0
npm install @tensorflow/tfjs-react-native@0.8.0
npm install expo-gl expo-gl-cpp
```

### Issue: Camera permission denied
```bash
# Solution: Reset permissions on device
# Android: Settings > Apps > Expo Go > Permissions > Camera
```

### Issue: Voice not working
```javascript
// Solution: Test voice separately
await Speech.speak('Test message');
```

## 📝 Notes for Production
- Implement proper native module for hardware button detection
- Remove debug UI elements
- Add error recovery mechanisms
- Implement voice command recognition (Sprint 4)

## 📝 Next Sprint
Sprint 3 will add the visual detection overlay and bounding boxes for the demo presentation.
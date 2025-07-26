# Sprint 3: Computer Vision + Demo Visuals

## 🎯 Sprint Goal
Implement real-time object detection with COCO-SSD and create an impressive visual overlay system with colored bounding boxes, confidence percentages, and smooth animations for the hackathon demo.

## ⏱️ Duration: 1 hour

## 📋 Prerequisites
- Sprint 1 & 2 completed
- App running with TensorFlow initialized
- Camera feed working

## 🔧 Tasks Breakdown

### 1. Update TensorFlow Service for Real Detection (10 min)

#### Update `frontend/src/services/tensorflow.js`
```javascript
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

export class TensorFlowService {
  constructor() {
    this.model = null;
    this.isReady = false;
    this.minConfidence = 0.5; // 50% confidence threshold
  }

  async initialize() {
    try {
      await tf.ready();
      console.log('TensorFlow.js initialized');
      
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

  async detectObjects(imageTensor) {
    if (!this.isReady || !this.model) {
      throw new Error('TensorFlow not ready');
    }

    try {
      const predictions = await this.model.detect(imageTensor);
      
      // Filter by confidence and format results
      return predictions
        .filter(pred => pred.score >= this.minConfidence)
        .map(pred => ({
          label: pred.class,
          confidence: pred.score,
          bbox: {
            x: pred.bbox[0],
            y: pred.bbox[1],
            width: pred.bbox[2],
            height: pred.bbox[3]
          }
        }));
    } catch (error) {
      console.error('Detection error:', error);
      return [];
    }
  }

  getConfidenceColor(confidence) {
    if (confidence >= 0.8) return '#00FF00'; // Green for high confidence
    if (confidence >= 0.6) return '#FFFF00'; // Yellow for medium
    return '#FF6B6B'; // Red for low confidence
  }

  // Common objects we can detect
  getObjectEmoji(label) {
    const emojiMap = {
      'person': '👤',
      'cell phone': '📱',
      'laptop': '💻',
      'keyboard': '⌨️',
      'mouse': '🖱️',
      'book': '📚',
      'cup': '☕',
      'bottle': '🍶',
      'chair': '🪑',
      'couch': '🛋️',
      'backpack': '🎒',
      'handbag': '👜',
      'suitcase': '🧳',
      'clock': '🕐',
      'tv': '📺',
      'refrigerator': '🧊'
    };
    return emojiMap[label] || '📦';
  }

  dispose() {
    if (this.model) {
      this.model.dispose();
    }
  }
}
```

### 2. Create Detection Overlay Component (15 min)

#### Create `frontend/src/components/DetectionOverlay.js`
```javascript
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withSpring,
  interpolate,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const DetectionOverlay = ({ predictions, imageSize }) => {
  if (!predictions || predictions.length === 0) {
    return null;
  }

  // Calculate scale factors
  const scaleX = screenWidth / (imageSize?.width || screenWidth);
  const scaleY = screenHeight / (imageSize?.height || screenHeight);

  return (
    <View style={StyleSheet.absoluteFillObject}>
      {predictions.map((prediction, index) => (
        <BoundingBox
          key={`${prediction.label}-${index}`}
          prediction={prediction}
          scaleX={scaleX}
          scaleY={scaleY}
        />
      ))}
      <StatsOverlay predictions={predictions} />
    </View>
  );
};

const BoundingBox = ({ prediction, scaleX, scaleY }) => {
  const { bbox, label, confidence } = prediction;
  const tfService = new (require('../services/tensorflow').TensorFlowService)();
  
  const color = tfService.getConfidenceColor(confidence);
  const emoji = tfService.getObjectEmoji(label);
  
  // Scale bbox to screen coordinates
  const scaledBox = {
    left: bbox.x * scaleX,
    top: bbox.y * scaleY,
    width: bbox.width * scaleX,
    height: bbox.height * scaleY,
  };

  return (
    <View
      style={[
        styles.boundingBox,
        {
          left: scaledBox.left,
          top: scaledBox.top,
          width: scaledBox.width,
          height: scaledBox.height,
          borderColor: color,
        }
      ]}
    >
      <View style={[styles.labelContainer, { backgroundColor: color }]}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.confidence}>{(confidence * 100).toFixed(0)}%</Text>
      </View>
    </View>
  );
};

const StatsOverlay = ({ predictions }) => {
  const objectCounts = predictions.reduce((acc, pred) => {
    acc[pred.label] = (acc[pred.label] || 0) + 1;
    return acc;
  }, {});

  return (
    <View style={styles.statsContainer}>
      <Text style={styles.statsTitle}>Detected Objects</Text>
      {Object.entries(objectCounts).map(([label, count]) => (
        <Text key={label} style={styles.statsItem}>
          {label}: {count}
        </Text>
      ))}
      <Text style={styles.statsTotal}>Total: {predictions.length}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  boundingBox: {
    position: 'absolute',
    borderWidth: 3,
    borderRadius: 8,
  },
  labelContainer: {
    position: 'absolute',
    top: -28,
    left: -1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'black',
  },
  emoji: {
    fontSize: 16,
    marginRight: 4,
  },
  label: {
    color: 'black',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 6,
  },
  confidence: {
    color: 'black',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statsContainer: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 15,
    borderRadius: 10,
    minWidth: 150,
  },
  statsTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statsItem: {
    color: 'white',
    fontSize: 14,
    marginVertical: 2,
  },
  statsTotal: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
  },
});
```

### 3. Create Camera with TensorFlow Integration (15 min)

#### Create `frontend/src/components/TensorCamera.js`
```javascript
import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Camera } from 'expo-camera';
import * as tf from '@tensorflow/tfjs';
import { cameraWithTensors } from '@tensorflow/tfjs-react-native';
import { DetectionOverlay } from './DetectionOverlay';

const TensorCamera = cameraWithTensors(Camera);

export const VisionCamera = ({ tfService, onDetection, showVisuals = true }) => {
  const [predictions, setPredictions] = useState([]);
  const [fps, setFps] = useState(0);
  const frameCount = useRef(0);
  const lastFrameTime = useRef(Date.now());

  const processImageTensor = async (images, updatePreview, gl) => {
    const loop = async () => {
      if (!tfService.isReady) {
        requestAnimationFrame(loop);
        return;
      }

      // FPS calculation
      frameCount.current++;
      const now = Date.now();
      const delta = now - lastFrameTime.current;
      if (delta >= 1000) {
        setFps(Math.round((frameCount.current * 1000) / delta));
        frameCount.current = 0;
        lastFrameTime.current = now;
      }

      // Get next image tensor
      const imageTensor = images.next().value;
      
      if (imageTensor) {
        try {
          // Run detection
          const detections = await tfService.detectObjects(imageTensor);
          setPredictions(detections);
          
          // Notify parent component
          if (onDetection) {
            onDetection(detections);
          }
        } catch (error) {
          console.error('Detection error:', error);
        } finally {
          imageTensor.dispose();
        }
      }

      requestAnimationFrame(loop);
    };
    loop();
  };

  const textureDims = Platform.OS === 'ios' ? 
    { width: 1920, height: 1080 } : 
    { width: 1080, height: 1920 };

  return (
    <View style={styles.container}>
      <TensorCamera
        style={styles.camera}
        type={Camera.Constants.Type.back}
        onReady={processImageTensor}
        resizeHeight={224}
        resizeWidth={224}
        resizeDepth={3}
        autorender={true}
        cameraTextureHeight={textureDims.height}
        cameraTextureWidth={textureDims.width}
      />
      
      {showVisuals && (
        <>
          <DetectionOverlay 
            predictions={predictions}
            imageSize={textureDims}
          />
          
          <View style={styles.fpsContainer}>
            <Text style={styles.fpsText}>FPS: {fps}</Text>
          </View>
          
          <View style={styles.brandingContainer}>
            <Text style={styles.brandingText}>Visual Aid Assistant</Text>
            <Text style={styles.brandingSubtext}>Powered by TensorFlow.js</Text>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  fpsContainer: {
    position: 'absolute',
    top: 40,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  fpsText: {
    color: '#00FF00',
    fontSize: 16,
    fontWeight: 'bold',
  },
  brandingContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  brandingText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  brandingSubtext: {
    color: 'white',
    fontSize: 16,
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
```

### 4. Update Main App with Visual Mode (10 min)

#### Update `frontend/App.js`
```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { Camera } from 'expo-camera';
import { TensorFlowService } from './src/services/tensorflow';
import { VoiceService } from './src/services/voice';
import { HardwareButtonService } from './src/services/hardwareButtons';
import { VisionCamera } from './src/components/TensorCamera';

export default function App() {
  const [hasPermission, setHasPermission] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [tfService] = useState(new TensorFlowService());
  const [voiceService] = useState(new VoiceService());
  const [buttonService, setButtonService] = useState(null);
  const [demoMode, setDemoMode] = useState(true); // Toggle for demo
  const [lastDetections, setLastDetections] = useState([]);

  useEffect(() => {
    initializeApp();
    return () => {
      if (buttonService) buttonService.stop();
      if (tfService) tfService.dispose();
    };
  }, []);

  const initializeApp = async () => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');

      if (status !== 'granted') {
        await voiceService.speak('Camera permission is required.');
        return;
      }

      await voiceService.speak('Initializing visual assistant.');
      const tfReady = await tfService.initialize();
      
      if (!tfReady) {
        await voiceService.announceError();
        return;
      }

      const buttonHandler = new HardwareButtonService(handleButtonPress);
      buttonHandler.start();
      setButtonService(buttonHandler);

      setIsReady(true);
      await voiceService.announceReady();
    } catch (error) {
      console.error('Init error:', error);
      await voiceService.announceError();
    }
  };

  const handleButtonPress = async () => {
    if (lastDetections.length === 0) {
      await voiceService.speak('No objects detected. Try pointing at something.');
      return;
    }

    // Announce detected objects
    const objectList = lastDetections
      .slice(0, 3) // Top 3 objects
      .map(d => `${d.label} at ${Math.round(d.confidence * 100)}% confidence`)
      .join(', ');
    
    await voiceService.speak(`I can see: ${objectList}`);
  };

  const handleDetection = (detections) => {
    setLastDetections(detections);
  };

  if (!hasPermission || !isReady) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>
          {!hasPermission ? 'No camera access' : 'Initializing...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <VisionCamera
        tfService={tfService}
        onDetection={handleDetection}
        showVisuals={demoMode}
      />
      
      {/* Demo Mode Toggle - Remove in production */}
      <View style={styles.demoToggle}>
        <Text style={styles.demoText}>Demo Mode</Text>
        <Switch
          value={demoMode}
          onValueChange={setDemoMode}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={demoMode ? '#f5dd4b' : '#f4f3f4'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    marginTop: '50%',
  },
  demoToggle: {
    position: 'absolute',
    top: 100,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 10,
    borderRadius: 20,
  },
  demoText: {
    color: 'white',
    marginRight: 10,
    fontSize: 14,
  },
});
```

### 5. Add Demo Scenarios (10 min)

#### Create `frontend/src/utils/demoScenarios.js`
```javascript
export const demoScenarios = {
  office: {
    name: "Office Desk",
    description: "Typical work setup",
    expectedObjects: ['laptop', 'keyboard', 'mouse', 'cell phone', 'cup'],
    voicePrompt: "Show me what's on my desk"
  },
  
  livingRoom: {
    name: "Living Room",
    description: "Home environment",
    expectedObjects: ['couch', 'tv', 'person', 'book', 'remote'],
    voicePrompt: "What's in the living room?"
  },
  
  kitchen: {
    name: "Kitchen Counter",
    description: "Kitchen items",
    expectedObjects: ['bottle', 'cup', 'bowl', 'fork', 'knife'],
    voicePrompt: "Find items in the kitchen"
  },
  
  personal: {
    name: "Personal Items",
    description: "Things people carry",
    expectedObjects: ['cell phone', 'backpack', 'handbag', 'book', 'bottle'],
    voicePrompt: "Where are my belongings?"
  }
};

export const getDemoScript = (detectedObjects) => {
  const objectNames = detectedObjects.map(d => d.label);
  
  // Match to scenario
  for (const [key, scenario] of Object.entries(demoScenarios)) {
    const matches = scenario.expectedObjects.filter(obj => 
      objectNames.includes(obj)
    );
    
    if (matches.length >= 2) {
      return `This looks like ${scenario.description}. ` +
             `I can see ${matches.join(', ')}.`;
    }
  }
  
  // Default response
  return `I can see ${objectNames.slice(0, 3).join(', ')}`;
};
```

## 🧪 Testing

### 1. Visual Detection Test
- Point camera at various objects
- Verify bounding boxes appear with correct colors
- Check confidence percentages
- Ensure smooth tracking

### 2. Performance Test
- Monitor FPS counter (should be 15-30 FPS)
- Check for smooth animations
- Verify no memory leaks

### 3. Demo Scenarios
Test with these objects:
- **Tech items**: Phone, laptop, keyboard
- **Personal**: Backpack, book, cup
- **Furniture**: Chair, couch, table

## ✅ Sprint Completion Checklist
- [ ] Real-time object detection working
- [ ] Colored bounding boxes (green/yellow/red)
- [ ] Confidence percentages displayed
- [ ] Object labels with emojis
- [ ] Stats overlay showing counts
- [ ] FPS counter visible
- [ ] Smooth animations
- [ ] Demo/production mode toggle

## 🚧 Common Issues & Solutions

### Issue: Low FPS
```javascript
// Solution: Reduce detection frequency
// In processImageTensor, add frame skipping:
if (frameCount.current % 3 === 0) { // Process every 3rd frame
  const detections = await tfService.detectObjects(imageTensor);
}
```

### Issue: Bounding boxes misaligned
```javascript
// Solution: Check texture dimensions match device
const textureDims = Platform.select({
  ios: { width: 1920, height: 1080 },
  android: { width: 1080, height: 1920 }
});
```

## 📝 Next Sprint
Sprint 4 will add intelligent voice responses and natural language processing with Gemini AI.
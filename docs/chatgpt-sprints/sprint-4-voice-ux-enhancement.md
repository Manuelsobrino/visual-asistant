# Sprint 4: Voice UX Enhancement

## 🎯 Sprint Goal
Create a seamless voice-first experience with hardware button activation, natural command patterns, and intelligent responses optimized for blind users.

## ⏱️ Duration: 30 minutes

## 📋 Prerequisites
- Sprint 3 completed (vision working)
- Understanding of accessibility patterns
- Physical device for button testing

## 🔧 Tasks Breakdown

### 1. Implement Hardware Button Detection (10 min)

#### Create `frontend/src/services/HardwareButtons.js`
```javascript
import { useEffect } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

class HardwareButtonService {
  constructor() {
    this.listeners = [];
    this.volumeButtonCallback = null;
    this.lastVolumePress = 0;
    this.doublePressThreshold = 500; // ms
  }

  initialize(onActivate) {
    this.volumeButtonCallback = onActivate;
    
    // Simulate volume button detection
    // In production, you'd use react-native-volume-button-listener
    this.simulateVolumeButtons();
    
    console.log('Hardware buttons initialized');
  }

  simulateVolumeButtons() {
    // For testing - in real app, use actual volume button events
    if (Platform.OS === 'ios') {
      // iOS: Listen for volume changes
      console.log('Volume button simulation ready (iOS)');
    } else {
      // Android: Can detect volume keys more directly
      console.log('Volume button simulation ready (Android)');
    }
  }

  triggerActivation() {
    const now = Date.now();
    
    // Detect double-press
    if (now - this.lastVolumePress < this.doublePressThreshold) {
      this.handleActivation();
      this.lastVolumePress = 0;
    } else {
      this.lastVolumePress = now;
    }
  }

  async handleActivation() {
    // Haptic feedback
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (this.volumeButtonCallback) {
      this.volumeButtonCallback();
    }
  }

  cleanup() {
    this.listeners.forEach(listener => listener.remove());
    this.listeners = [];
  }
}

export default new HardwareButtonService();
```

### 2. Create Voice Command Parser (10 min)

#### Create `frontend/src/services/CommandParser.js`
```javascript
class CommandParser {
  constructor() {
    this.commands = {
      // Navigation commands
      navigation: [
        { pattern: /where is (?:the |my )?(.+)/i, action: 'find_object' },
        { pattern: /guide me to (?:the |my )?(.+)/i, action: 'navigate_to' },
        { pattern: /what\'s in front of me/i, action: 'describe_front' },
        { pattern: /what\'s around me/i, action: 'describe_surroundings' },
      ],
      
      // Object queries
      objects: [
        { pattern: /how many (.+)/i, action: 'count_objects' },
        { pattern: /is there (?:a |any )?(.+)/i, action: 'check_presence' },
        { pattern: /describe (?:the )?(.+)/i, action: 'describe_object' },
      ],
      
      // General queries
      general: [
        { pattern: /what do you see/i, action: 'describe_scene' },
        { pattern: /help me/i, action: 'provide_help' },
        { pattern: /read (?:the |this )?(.+)?/i, action: 'read_text' },
        { pattern: /what time is it/i, action: 'tell_time' },
      ],
      
      // Safety
      safety: [
        { pattern: /is it safe/i, action: 'check_safety' },
        { pattern: /any (?:danger|hazard)/i, action: 'check_hazards' },
      ]
    };
  }

  parse(input) {
    const normalizedInput = input.toLowerCase().trim();
    
    // Check all command categories
    for (const [category, patterns] of Object.entries(this.commands)) {
      for (const { pattern, action } of patterns) {
        const match = normalizedInput.match(pattern);
        if (match) {
          return {
            action,
            category,
            target: match[1] || null,
            original: input
          };
        }
      }
    }
    
    // Default to general query
    return {
      action: 'general_query',
      category: 'general',
      target: null,
      original: input
    };
  }

  generatePrompt(parsedCommand, hasVisualContext = true) {
    const { action, target, original } = parsedCommand;
    
    const prompts = {
      find_object: `Help me find ${target}. Tell me its exact position relative to me.`,
      navigate_to: `Guide me step by step to reach ${target}.`,
      describe_front: 'What objects are directly in front of me? Focus on obstacles and important items.',
      describe_surroundings: 'Give me a 360-degree description of my surroundings.',
      count_objects: `How many ${target} can you see? Where are they?`,
      check_presence: `Is there ${target} visible? If yes, where?`,
      describe_scene: 'Describe what you see, focusing on the most important objects and their positions.',
      check_safety: 'Are there any safety hazards or obstacles I should be aware of?',
      general_query: original
    };
    
    return prompts[action] || original;
  }
}

export default new CommandParser();
```

### 3. Enhance Voice Service with Commands (5 min)

#### Update `frontend/src/services/VoiceService.js`
```javascript
import RealtimeAPI from './RealtimeAPI';
import AudioManager from './AudioManager';
import CommandParser from './CommandParser';
import * as Speech from 'expo-speech';

class VoiceService {
  constructor() {
    this.isListening = false;
    this.apiKey = null;
    this.lastImageContext = null;
  }

  async initialize(apiKey) {
    this.apiKey = apiKey;
    await AudioManager.initialize();
    await RealtimeAPI.connect(apiKey);
    
    // Enhanced audio queue processing
    RealtimeAPI.processAudioQueue = async () => {
      while (RealtimeAPI.audioQueue.length > 0) {
        const audioChunk = RealtimeAPI.audioQueue.shift();
        await AudioManager.playAudioFromBase64(audioChunk);
      }
    };

    // Set up response handler
    RealtimeAPI.handleMessage = this.handleRealtimeMessage.bind(this);
  }

  handleRealtimeMessage(message) {
    switch(message.type) {
      case 'response.audio_transcript.done':
        // Announce completion
        this.announceCompletion();
        break;
        
      case 'error':
        this.handleError(message.error);
        break;
    }
  }

  async processVoiceCommand(text) {
    // Parse the command
    const parsed = CommandParser.parse(text);
    const prompt = CommandParser.generatePrompt(parsed, !!this.lastImageContext);
    
    // Send with context
    if (this.lastImageContext && parsed.category !== 'general') {
      RealtimeAPI.sendImage(this.lastImageContext, prompt);
    } else {
      this.sendTextMessage(prompt);
    }
  }

  updateImageContext(base64Image) {
    this.lastImageContext = base64Image;
  }

  async announceState(state) {
    // Use expo-speech for immediate feedback
    await Speech.speak(state, {
      language: 'en-US',
      pitch: 1.0,
      rate: 1.0
    });
  }

  async announceCompletion() {
    // Subtle audio cue that response is complete
    // Could be a sound effect in production
    console.log('Response complete');
  }

  handleError(error) {
    this.announceState('Sorry, I encountered an error. Please try again.');
    console.error('Voice service error:', error);
  }

  // ... rest of existing code ...
}

export default new VoiceService();
```

### 4. Create Accessibility-First App Shell (5 min)

#### Update `frontend/App.js`
```javascript
import React, { useEffect, useState, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  SafeAreaView,
  AccessibilityInfo,
  Vibration
} from 'react-native';
import VoiceService from './src/services/VoiceService';
import CameraView from './src/components/CameraView';
import HardwareButtons from './src/services/HardwareButtons';
import * as Haptics from 'expo-haptics';

const OPENAI_API_KEY = 'your-api-key-here';

export default function App() {
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('waiting'); // waiting, listening, processing
  const [lastCommand, setLastCommand] = useState('');
  
  useEffect(() => {
    initializeApp();
    return cleanup;
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize services
      await VoiceService.initialize(OPENAI_API_KEY);
      
      // Set up hardware buttons
      HardwareButtons.initialize(() => {
        toggleVoiceAssistant();
      });
      
      // Announce ready
      await VoiceService.announceState('Visual assistant ready. Double press volume button to activate.');
      
      // Check screen reader
      const screenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
      if (screenReaderEnabled) {
        console.log('Screen reader detected - optimizing for accessibility');
      }
    } catch (error) {
      console.error('Initialization error:', error);
      await VoiceService.announceState('Failed to initialize. Please restart the app.');
    }
  };

  const toggleVoiceAssistant = async () => {
    if (mode === 'listening') {
      // Stop listening
      await VoiceService.stopListening();
      setMode('processing');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (mode === 'waiting') {
      // Start listening
      setMode('listening');
      await VoiceService.announceState('Listening');
      await VoiceService.startListening();
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  };

  const handleFrameAnalyzed = (base64Image) => {
    // Update context for voice commands
    VoiceService.updateImageContext(base64Image);
  };

  const cleanup = () => {
    VoiceService.disconnect();
    HardwareButtons.cleanup();
  };

  // Minimal UI for demo purposes
  const getStatusText = () => {
    switch(mode) {
      case 'listening': return '🔴 Listening...';
      case 'processing': return '⏳ Processing...';
      default: return '⭕ Ready';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Camera always active in background */}
      <CameraView 
        isActive={true}
        onFrameAnalyzed={handleFrameAnalyzed}
      />
      
      {/* Minimal overlay for demo */}
      <View style={styles.overlay}>
        <View style={styles.topBar}>
          <Text style={styles.title}>Visual Aid Assistant</Text>
        </View>
        
        {/* Large touch target for accessibility */}
        <TouchableOpacity
          style={styles.fullScreenButton}
          onPress={toggleVoiceAssistant}
          accessible={true}
          accessibilityLabel="Voice Assistant"
          accessibilityHint="Double tap to activate voice commands"
          accessibilityRole="button"
        >
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>{getStatusText()}</Text>
            {lastCommand ? (
              <Text style={styles.lastCommand}>"{lastCommand}"</Text>
            ) : null}
          </View>
        </TouchableOpacity>
        
        {/* Demo hints */}
        <View style={styles.hints}>
          <Text style={styles.hintText}>Try: "What do you see?"</Text>
          <Text style={styles.hintText}>Or: "Where is my phone?"</Text>
          <Text style={styles.hintText}>Double-press volume button to activate</Text>
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
  },
  topBar: {
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  fullScreenButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusContainer: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 40,
    paddingVertical: 30,
    borderRadius: 30,
  },
  statusText: {
    fontSize: 32,
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
  lastCommand: {
    fontSize: 18,
    color: '#888',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  hints: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginBottom: 5,
  },
});
```

## 🧪 Testing

### 1. Test Voice Commands
Try these commands:
- "What do you see?"
- "Where is my phone?"
- "How many people are there?"
- "Guide me to the door"
- "Is it safe to walk?"

### 2. Test Hardware Activation
- Simulate double volume press
- Verify haptic feedback
- Check voice announcement

### 3. Test Accessibility
```bash
# Enable TalkBack (Android) or VoiceOver (iOS)
# Verify all elements are accessible
```

## ✅ Sprint Completion Checklist
- [ ] Hardware button detection ready
- [ ] Command parser working
- [ ] Voice feedback implemented
- [ ] Haptic feedback added
- [ ] Accessibility optimized
- [ ] Natural language commands
- [ ] Context-aware responses

## 💡 What We Achieved
1. **Hardware button activation**
2. **Natural command understanding**
3. **Context-aware responses**
4. **Accessibility-first design**
5. **Haptic feedback system**

## 📝 Next Sprint
Sprint 5 will polish the demo with animations and performance optimizations.
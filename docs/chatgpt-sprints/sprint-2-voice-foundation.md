# Sprint 2: Voice Foundation

## 🎯 Sprint Goal
Implement WebSocket connection to OpenAI Realtime API with audio recording and playback capabilities for natural voice conversations.

## ⏱️ Duration: 45 minutes

## 📋 Prerequisites
- Sprint 1 completed (backend simplified)
- Expo project initialized
- OpenAI API key ready
- Microphone permissions understanding

## 🔧 Tasks Breakdown

### 1. Install Voice Dependencies (5 min)

```bash
cd frontend
# Core dependencies
npm install expo-av
npm install base64-arraybuffer
npm install react-native-url-polyfill

# Development helpers
npm install @react-native-async-storage/async-storage
```

### 2. Create WebSocket Manager (15 min)

#### Create `frontend/src/services/RealtimeAPI.js`
```javascript
import { Audio } from 'expo-av';
import { encode as base64Encode } from 'base64-arraybuffer';

class RealtimeAPI {
  constructor() {
    this.ws = null;
    this.audioQueue = [];
    this.isConnected = false;
    this.recording = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.sessionId = null;
  }

  async connect(apiKey) {
    if (this.ws && this.isConnected) {
      console.log('Already connected');
      return;
    }

    const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';
    
    this.ws = new WebSocket(url, [], {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    this.ws.onopen = () => {
      console.log('Connected to OpenAI Realtime API');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.configureSession();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(JSON.parse(event.data));
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('Disconnected from OpenAI');
      this.isConnected = false;
      this.handleReconnect(apiKey);
    };
  }

  configureSession() {
    this.sendMessage({
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: `You are a helpful visual aid assistant for blind users. 
          Be concise and clear. Focus on spatial descriptions and navigation help.
          Always describe positions as left, right, center, near, or far.`,
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
        }
      }
    });
  }

  sendMessage(message) {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message));
    }
  }

  handleMessage(message) {
    switch(message.type) {
      case 'session.created':
        this.sessionId = message.session.id;
        console.log('Session created:', this.sessionId);
        break;
        
      case 'response.audio.delta':
        this.handleAudioDelta(message);
        break;
        
      case 'response.audio_transcript.delta':
        console.log('Assistant:', message.delta);
        break;
        
      case 'response.done':
        console.log('Response completed');
        break;
        
      case 'error':
        console.error('API Error:', message.error);
        break;
    }
  }

  handleAudioDelta(message) {
    // Queue audio chunks for playback
    if (message.delta) {
      this.audioQueue.push(message.delta);
      this.processAudioQueue();
    }
  }

  async processAudioQueue() {
    // Audio playback will be implemented in next task
    console.log('Audio chunk received, queue size:', this.audioQueue.length);
  }

  handleReconnect(apiKey) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
      setTimeout(() => this.connect(apiKey), 1000 * this.reconnectAttempts);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }
}

export default new RealtimeAPI();
```

### 3. Implement Audio Recording (15 min)

#### Create `frontend/src/services/AudioManager.js`
```javascript
import { Audio } from 'expo-av';
import { encode as base64Encode } from 'base64-arraybuffer';
import RealtimeAPI from './RealtimeAPI';

class AudioManager {
  constructor() {
    this.recording = null;
    this.sound = null;
    this.recordingOptions = {
      android: {
        extension: '.wav',
        outputFormat: Audio.AndroidOutputFormat.DEFAULT,
        audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 128000,
      },
      ios: {
        extension: '.wav',
        audioQuality: Audio.IOSAudioQuality.HIGH,
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
    };
  }

  async initialize() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
      console.log('Audio initialized');
    } catch (error) {
      console.error('Audio initialization error:', error);
    }
  }

  async startRecording() {
    try {
      if (this.recording) {
        console.log('Already recording');
        return;
      }

      await this.initialize();
      
      const { recording } = await Audio.Recording.createAsync(
        this.recordingOptions
      );
      
      this.recording = recording;
      
      // Set up real-time audio streaming
      this.recording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording && status.durationMillis > 0) {
          // In production, you'd stream chunks here
          // For now, we'll send complete audio after recording stops
        }
      });

      console.log('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }

  async stopRecording() {
    try {
      if (!this.recording) {
        console.log('No recording to stop');
        return null;
      }

      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;

      // Convert audio to base64 and send to API
      const audioData = await this.getAudioBase64(uri);
      this.sendAudioToAPI(audioData);

      return uri;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      return null;
    }
  }

  async getAudioBase64(uri) {
    // In a real implementation, you'd read the file and convert to base64
    // For now, we'll simulate this
    console.log('Converting audio from:', uri);
    return 'base64_audio_data_here';
  }

  sendAudioToAPI(audioBase64) {
    RealtimeAPI.sendMessage({
      type: 'input_audio_buffer.append',
      audio: audioBase64
    });

    RealtimeAPI.sendMessage({
      type: 'input_audio_buffer.commit'
    });
  }

  async playAudioFromBase64(base64Audio) {
    try {
      // Convert base64 to audio and play
      // This is a simplified version - in production you'd handle PCM16 properly
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/wav;base64,${base64Audio}` }
      );
      
      this.sound = sound;
      await sound.playAsync();
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.error('Playback error:', error);
    }
  }

  async cleanup() {
    if (this.recording) {
      await this.recording.stopAndUnloadAsync();
      this.recording = null;
    }
    if (this.sound) {
      await this.sound.unloadAsync();
      this.sound = null;
    }
  }
}

export default new AudioManager();
```

### 4. Create Voice Service Integration (5 min)

#### Create `frontend/src/services/VoiceService.js`
```javascript
import RealtimeAPI from './RealtimeAPI';
import AudioManager from './AudioManager';

class VoiceService {
  constructor() {
    this.isListening = false;
    this.apiKey = null;
  }

  async initialize(apiKey) {
    this.apiKey = apiKey;
    await AudioManager.initialize();
    await RealtimeAPI.connect(apiKey);
    
    // Set up audio playback handler
    RealtimeAPI.processAudioQueue = async () => {
      while (RealtimeAPI.audioQueue.length > 0) {
        const audioChunk = RealtimeAPI.audioQueue.shift();
        await AudioManager.playAudioFromBase64(audioChunk);
      }
    };
  }

  async startListening() {
    if (this.isListening) return;
    
    this.isListening = true;
    await AudioManager.startRecording();
  }

  async stopListening() {
    if (!this.isListening) return;
    
    this.isListening = false;
    await AudioManager.stopRecording();
  }

  sendTextMessage(text) {
    RealtimeAPI.sendMessage({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: text
        }]
      }
    });

    // Trigger response
    RealtimeAPI.sendMessage({
      type: 'response.create'
    });
  }

  disconnect() {
    AudioManager.cleanup();
    RealtimeAPI.disconnect();
  }
}

export default new VoiceService();
```

### 5. Update App Entry Point (5 min)

#### Update `frontend/App.js`
```javascript
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView } from 'react-native';
import VoiceService from './src/services/VoiceService';

// Get API key from environment or hardcode for testing
const OPENAI_API_KEY = 'your-api-key-here';

export default function App() {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    initializeVoice();
    return () => {
      VoiceService.disconnect();
    };
  }, []);

  const initializeVoice = async () => {
    try {
      await VoiceService.initialize(OPENAI_API_KEY);
      setStatus('Ready to listen');
    } catch (error) {
      setStatus('Failed to initialize: ' + error.message);
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Visual Aid Assistant</Text>
        <Text style={styles.status}>{status}</Text>
        
        <TouchableOpacity 
          style={[styles.button, isListening && styles.buttonActive]}
          onPress={toggleListening}
        >
          <Text style={styles.buttonText}>
            {isListening ? 'Stop Listening' : 'Start Listening'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.testButton}
          onPress={() => VoiceService.sendTextMessage('Hello, can you hear me?')}
        >
          <Text style={styles.buttonText}>Test Text Message</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  status: {
    fontSize: 18,
    color: '#888',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 30,
    marginBottom: 20,
  },
  buttonActive: {
    backgroundColor: '#FF3B30',
  },
  testButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
```

## 🧪 Testing

### 1. Start the App
```bash
cd frontend
npm start
# Press 'a' for Android or 'i' for iOS
```

### 2. Test Connection
1. App should show "Ready to listen"
2. Check console for "Connected to OpenAI Realtime API"
3. Tap "Test Text Message" - should see response in console

### 3. Test Recording
1. Tap "Start Listening"
2. Speak for 2-3 seconds
3. Tap "Stop Listening"
4. Check console for audio processing logs

## ✅ Sprint Completion Checklist
- [ ] WebSocket manager created
- [ ] Audio recording implemented
- [ ] Voice service integrated
- [ ] Basic UI for testing
- [ ] API connection verified
- [ ] Audio permissions working
- [ ] Can send text messages

## 🚨 Common Issues

### Issue: WebSocket connection fails
```javascript
// Check API key format
console.log('API Key:', OPENAI_API_KEY.substring(0, 10) + '...');
// Should start with sk-
```

### Issue: Audio permissions denied
```javascript
// Add to app.json
"expo": {
  "plugins": [
    [
      "expo-av",
      {
        "microphonePermission": "Allow Visual Aid to access microphone."
      }
    ]
  ]
}
```

### Issue: No audio playback
```javascript
// Ensure audio mode is set correctly
await Audio.setAudioModeAsync({
  playsInSilentModeIOS: true,
  staysActiveInBackground: true,
});
```

## 💡 What We Achieved
1. **WebSocket connection to OpenAI**
2. **Audio recording capability**
3. **Basic voice service structure**
4. **Testing interface**
5. **Foundation for real-time voice**

## 📝 Next Sprint
Sprint 3 will add camera integration and vision capabilities to the voice assistant.
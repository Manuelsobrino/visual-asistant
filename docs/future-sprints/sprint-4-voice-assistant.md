# Sprint 4: Intelligent Voice Assistant

## 🎯 Sprint Goal
Transform detected objects into natural, helpful voice responses using spatial calculations and Gemini AI, creating an intelligent assistant that understands context and provides meaningful guidance for blind users.

## ⏱️ Duration: 1 hour

## 📋 Prerequisites
- Sprints 1-3 completed
- Object detection working
- Backend with Gemini API ready
- Voice services functional

## 🔧 Tasks Breakdown

### 1. Create Spatial Processing Service (10 min)

#### Create `frontend/src/services/spatial.js`
```javascript
export class SpatialService {
  constructor(screenWidth = 360, screenHeight = 640) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
  }

  getObjectPosition(bbox, imageSize) {
    // Calculate object center
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;
    
    // Normalize to 0-1 range
    const normalizedX = centerX / (imageSize?.width || this.screenWidth);
    const normalizedY = centerY / (imageSize?.height || this.screenHeight);
    
    return {
      horizontal: this.getHorizontalPosition(normalizedX),
      vertical: this.getVerticalPosition(normalizedY),
      distance: this.estimateDistance(bbox, imageSize),
      size: this.getRelativeSize(bbox, imageSize)
    };
  }

  getHorizontalPosition(normalizedX) {
    if (normalizedX < 0.2) return "far left";
    if (normalizedX < 0.4) return "left";
    if (normalizedX < 0.6) return "center";
    if (normalizedX < 0.8) return "right";
    return "far right";
  }

  getVerticalPosition(normalizedY) {
    if (normalizedY < 0.33) return "top";
    if (normalizedY < 0.66) return "middle";
    return "bottom";
  }

  estimateDistance(bbox, imageSize) {
    // Estimate based on object size relative to screen
    const screenArea = (imageSize?.width || this.screenWidth) * 
                      (imageSize?.height || this.screenHeight);
    const objectArea = bbox.width * bbox.height;
    const areaRatio = objectArea / screenArea;
    
    if (areaRatio > 0.5) return "very close";
    if (areaRatio > 0.25) return "close";
    if (areaRatio > 0.1) return "medium distance";
    if (areaRatio > 0.05) return "far";
    return "very far";
  }

  getRelativeSize(bbox, imageSize) {
    const screenArea = (imageSize?.width || this.screenWidth) * 
                      (imageSize?.height || this.screenHeight);
    const objectArea = bbox.width * bbox.height;
    const areaRatio = objectArea / screenArea;
    
    if (areaRatio > 0.3) return "large";
    if (areaRatio > 0.1) return "medium";
    return "small";
  }

  describeSpatialRelationship(object1, object2) {
    const pos1 = this.getObjectPosition(object1.bbox);
    const pos2 = this.getObjectPosition(object2.bbox);
    
    let description = `${object2.label} is `;
    
    // Horizontal relationship
    if (pos1.horizontal !== pos2.horizontal) {
      description += `to the ${pos2.horizontal} of the ${object1.label}`;
    }
    
    // Vertical relationship
    if (pos1.vertical !== pos2.vertical) {
      if (pos1.horizontal === pos2.horizontal) {
        description += `${pos2.vertical === 'top' ? 'above' : 'below'} the ${object1.label}`;
      } else {
        description += ` and ${pos2.vertical === 'top' ? 'above' : 'below'} it`;
      }
    }
    
    return description;
  }

  prioritizeObjects(detections) {
    // Sort by relevance: confidence * size * centered-ness
    return detections.map(detection => {
      const pos = this.getObjectPosition(detection.bbox);
      const centerScore = pos.horizontal === 'center' ? 1.5 : 1.0;
      const sizeScore = pos.size === 'large' ? 1.5 : 
                       pos.size === 'medium' ? 1.2 : 1.0;
      
      return {
        ...detection,
        spatialInfo: pos,
        relevanceScore: detection.confidence * centerScore * sizeScore
      };
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}
```

### 2. Create Voice Command Parser (10 min)

#### Create `frontend/src/services/voiceCommands.js`
```javascript
export class VoiceCommandService {
  constructor() {
    this.commands = {
      find: {
        patterns: [
          /find (?:my |the )?(\w+)/i,
          /where (?:is|are) (?:my |the )?(\w+)/i,
          /look for (?:my |the )?(\w+)/i,
          /locate (?:my |the )?(\w+)/i
        ],
        handler: 'findObject'
      },
      
      describe: {
        patterns: [
          /what (?:do you |can you )?see/i,
          /describe (?:the |what\'s )?(?:in front|around)/i,
          /what\'s (?:in front of|around) me/i,
          /scan (?:the )?(room|area|environment)/i
        ],
        handler: 'describeScene'
      },
      
      count: {
        patterns: [
          /how many (\w+)/i,
          /count (?:the )?(\w+)/i
        ],
        handler: 'countObjects'
      },
      
      navigate: {
        patterns: [
          /guide me to (?:the )?(\w+)/i,
          /help me (?:find|reach) (?:the )?(\w+)/i,
          /take me to (?:the )?(\w+)/i
        ],
        handler: 'navigateToObject'
      },
      
      identify: {
        patterns: [
          /what is (?:this|that)/i,
          /identify (?:this|that|the object)/i,
          /what\'s in (?:the )?(\w+)/i
        ],
        handler: 'identifyObject'
      }
    };
  }

  parseCommand(text) {
    const normalizedText = text.toLowerCase().trim();
    
    for (const [type, config] of Object.entries(this.commands)) {
      for (const pattern of config.patterns) {
        const match = normalizedText.match(pattern);
        if (match) {
          return {
            type,
            handler: config.handler,
            target: match[1] || null,
            originalText: text
          };
        }
      }
    }
    
    return {
      type: 'unknown',
      handler: 'handleUnknown',
      target: null,
      originalText: text
    };
  }

  // Map common spoken variations to COCO labels
  normalizeObjectName(spokenName) {
    const mappings = {
      'phone': 'cell phone',
      'mobile': 'cell phone',
      'computer': 'laptop',
      'notebook': 'laptop',
      'bag': 'backpack',
      'purse': 'handbag',
      'mug': 'cup',
      'glass': 'cup',
      'display': 'tv',
      'monitor': 'tv',
      'screen': 'tv'
    };
    
    return mappings[spokenName.toLowerCase()] || spokenName.toLowerCase();
  }
}
```

### 3. Create Response Generator Service (15 min)

#### Create `frontend/src/services/responseGenerator.js`
```javascript
export class ResponseGenerator {
  constructor(spatialService) {
    this.spatial = spatialService;
  }

  async generateResponse(command, detections, context = {}) {
    const prioritizedObjects = this.spatial.prioritizeObjects(detections);
    
    switch (command.handler) {
      case 'findObject':
        return this.findObjectResponse(command.target, prioritizedObjects);
      
      case 'describeScene':
        return this.describeSceneResponse(prioritizedObjects);
      
      case 'countObjects':
        return this.countObjectsResponse(command.target, prioritizedObjects);
      
      case 'navigateToObject':
        return this.navigateResponse(command.target, prioritizedObjects);
      
      case 'identifyObject':
        return this.identifyResponse(prioritizedObjects);
      
      default:
        return this.defaultResponse(prioritizedObjects);
    }
  }

  findObjectResponse(target, objects) {
    if (!target) {
      return "What would you like me to find?";
    }

    const normalizedTarget = new VoiceCommandService().normalizeObjectName(target);
    const found = objects.find(obj => obj.label === normalizedTarget);
    
    if (!found) {
      // Look for similar objects
      const similar = this.findSimilarObjects(normalizedTarget, objects);
      if (similar.length > 0) {
        return `I don't see a ${target}, but I found ${similar[0].label} ` +
               `${similar[0].spatialInfo.horizontal} at ${similar[0].spatialInfo.distance}.`;
      }
      return `I don't see any ${target} in view. Try moving the camera around.`;
    }

    const spatial = found.spatialInfo;
    let response = `Found ${found.label} `;
    
    // Add position
    response += `${spatial.horizontal} `;
    
    // Add distance
    response += `at ${spatial.distance}. `;
    
    // Add confidence if low
    if (found.confidence < 0.7) {
      response += `I'm ${Math.round(found.confidence * 100)}% sure. `;
    }
    
    // Add nearby objects for context
    const nearby = this.findNearbyObjects(found, objects);
    if (nearby.length > 0) {
      response += `It's near ${nearby[0].label}.`;
    }
    
    return response;
  }

  describeSceneResponse(objects) {
    if (objects.length === 0) {
      return "I don't detect any objects in view. Try adjusting the camera.";
    }

    let response = `I can see ${objects.length} object${objects.length > 1 ? 's' : ''}. `;
    
    // Group by type
    const groups = this.groupObjectsByType(objects);
    
    // Describe main objects (up to 3)
    const mainObjects = objects.slice(0, 3);
    const descriptions = mainObjects.map(obj => 
      `${obj.label} ${obj.spatialInfo.horizontal} at ${obj.spatialInfo.distance}`
    );
    
    response += descriptions.join(', ') + '. ';
    
    // Add summary if many objects
    if (objects.length > 3) {
      response += `Also ${objects.length - 3} more items. `;
    }
    
    return response;
  }

  countObjectsResponse(target, objects) {
    if (!target) {
      return `I see ${objects.length} objects total.`;
    }

    const normalizedTarget = new VoiceCommandService().normalizeObjectName(target);
    const matches = objects.filter(obj => obj.label === normalizedTarget);
    
    if (matches.length === 0) {
      return `I don't see any ${target}.`;
    }
    
    return `I can see ${matches.length} ${target}${matches.length > 1 ? 's' : ''}.`;
  }

  navigateResponse(target, objects) {
    const normalizedTarget = new VoiceCommandService().normalizeObjectName(target);
    const found = objects.find(obj => obj.label === normalizedTarget);
    
    if (!found) {
      return `I can't find ${target} to guide you to.`;
    }

    const spatial = found.spatialInfo;
    let response = `To reach the ${found.label}, `;
    
    // Give direction
    if (spatial.horizontal === 'center') {
      response += `move straight ahead `;
    } else if (spatial.horizontal.includes('left')) {
      response += `turn left `;
    } else {
      response += `turn right `;
    }
    
    // Give distance
    response += `about ${spatial.distance}. `;
    
    // Add warnings if needed
    const obstacles = this.findObstacles(found, objects);
    if (obstacles.length > 0) {
      response += `Watch out for ${obstacles[0].label} in the way.`;
    }
    
    return response;
  }

  identifyResponse(objects) {
    if (objects.length === 0) {
      return "I don't see any clear objects to identify.";
    }

    const center = objects.find(obj => obj.spatialInfo.horizontal === 'center');
    const target = center || objects[0];
    
    return `That appears to be a ${target.label} at ${target.spatialInfo.distance}.`;
  }

  defaultResponse(objects) {
    if (objects.length === 0) {
      return "I don't see any objects. Can you repeat your question?";
    }
    
    return `I see ${objects[0].label} and ${objects.length - 1} other objects. What would you like to know?`;
  }

  // Helper methods
  findSimilarObjects(target, objects) {
    // Simple similarity based on category
    const categories = {
      'electronics': ['cell phone', 'laptop', 'keyboard', 'mouse', 'tv'],
      'furniture': ['chair', 'couch', 'dining table', 'bed'],
      'personal': ['backpack', 'handbag', 'suitcase'],
      'kitchenware': ['cup', 'bowl', 'bottle', 'fork', 'knife', 'spoon']
    };
    
    for (const [category, items] of Object.entries(categories)) {
      if (items.includes(target)) {
        return objects.filter(obj => items.includes(obj.label) && obj.label !== target);
      }
    }
    
    return [];
  }

  findNearbyObjects(target, objects) {
    return objects
      .filter(obj => obj.label !== target.label)
      .filter(obj => {
        const dx = Math.abs(obj.bbox.x - target.bbox.x);
        const dy = Math.abs(obj.bbox.y - target.bbox.y);
        return dx < 100 && dy < 100; // Within 100 pixels
      })
      .slice(0, 2);
  }

  findObstacles(target, objects) {
    return objects
      .filter(obj => obj.label !== target.label)
      .filter(obj => {
        // Object is between user and target
        const targetDist = this.spatial.estimateDistance(target.bbox);
        const objDist = this.spatial.estimateDistance(obj.bbox);
        return objDist === 'closer' && 
               obj.spatialInfo.horizontal === target.spatialInfo.horizontal;
      });
  }

  groupObjectsByType(objects) {
    return objects.reduce((groups, obj) => {
      groups[obj.label] = (groups[obj.label] || 0) + 1;
      return groups;
    }, {});
  }
}
```

### 4. Integrate Voice Recognition (10 min)

#### Update `frontend/src/services/voice.js`
```javascript
import * as Speech from 'expo-speech';
import Voice from '@react-native-voice/voice';

export class VoiceService {
  constructor() {
    this.isSpeaking = false;
    this.isListening = false;
    this.onResult = null;
    
    // Initialize voice recognition
    Voice.onSpeechStart = this.onSpeechStart;
    Voice.onSpeechEnd = this.onSpeechEnd;
    Voice.onSpeechResults = this.onSpeechResults;
    Voice.onSpeechError = this.onSpeechError;
  }

  // Text-to-Speech methods (existing)
  async speak(text, options = {}) {
    try {
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

  // Speech-to-Text methods
  async startListening(onResult) {
    if (this.isListening) return;
    
    try {
      this.onResult = onResult;
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
    if (results && results.length > 0 && this.onResult) {
      this.onResult(results[0]);
    }
  };

  onSpeechError = (error) => {
    console.error('Speech recognition error:', error);
    this.isListening = false;
  };

  // Combined interaction flow
  async listenAndRespond() {
    // Play listening sound
    await this.speak('Yes?', { rate: 1.2 });
    
    // Start listening
    return new Promise((resolve) => {
      this.startListening((text) => {
        this.stopListening();
        resolve(text);
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.isListening) {
          this.stopListening();
          resolve(null);
        }
      }, 5000);
    });
  }
}
```

### 5. Update Main App with Voice Integration (15 min)

#### Update `frontend/App.js` to add voice command handling
```javascript
import { Dimensions } from 'react-native';
import { VoiceCommandService } from './src/services/voiceCommands';
import { ResponseGenerator } from './src/services/responseGenerator';
import { SpatialService } from './src/services/spatial';

// Add to App component
const { width, height } = Dimensions.get('window');
const [spatialService] = useState(new SpatialService(width, height));
const [voiceCommandService] = useState(new VoiceCommandService());
const [responseGenerator] = useState(new ResponseGenerator(spatialService));

// Update handleButtonPress
const handleButtonPress = async () => {
  if (isProcessing) return;
  setIsProcessing(true);

  try {
    // Listen for voice command
    const voiceText = await voiceService.listenAndRespond();
    
    if (!voiceText) {
      await voiceService.speak("I didn't hear anything. Please try again.");
      setIsProcessing(false);
      return;
    }

    // Parse command
    const command = voiceCommandService.parseCommand(voiceText);
    console.log('Command:', command);

    // Generate response based on current detections
    const response = await responseGenerator.generateResponse(
      command,
      lastDetections,
      { imageSize: { width, height } }
    );

    // Speak response
    await voiceService.speak(response);

  } catch (error) {
    console.error('Voice command error:', error);
    await voiceService.speak("Sorry, I had trouble understanding that.");
  }

  setIsProcessing(false);
};
```

## 🧪 Testing Voice Commands

### Test Scenarios

1. **Find Object**
   - "Find my phone" → Should locate and describe position
   - "Where is my laptop?" → Should give spatial guidance
   - "Look for my backpack" → Should search and report

2. **Describe Scene**
   - "What do you see?" → List main objects with positions
   - "Describe the room" → Overview of detected items
   - "What's in front of me?" → Focus on centered objects

3. **Count Objects**
   - "How many cups?" → Count specific object type
   - "Count the chairs" → Numerical response

4. **Navigation**
   - "Guide me to the laptop" → Turn and distance instructions
   - "Help me reach the phone" → Spatial directions

5. **Identification**
   - "What is this?" → Identify centered object
   - "What's that?" → Describe prominent object

## ✅ Sprint Completion Checklist
- [ ] Spatial calculations working
- [ ] Voice command parsing functional
- [ ] Natural language responses
- [ ] Speech recognition integrated
- [ ] Context-aware descriptions
- [ ] Position guidance (left/right/distance)
- [ ] Multiple command types supported
- [ ] Error handling for unclear commands

## 🚧 Common Issues & Solutions

### Issue: Voice recognition not working
```bash
# For iOS: Add to Info.plist
<key>NSSpeechRecognitionUsageDescription</key>
<string>Voice commands for object detection</string>

# For Android: Add permission
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

### Issue: Commands not matching
```javascript
// Add more pattern variations
patterns: [
  /find (?:my |the |a )?(\w+)/i,
  /where (?:is|are) (?:my |the |a )?(\w+)/i,
  // Add more variations
]
```

## 📝 Next Sprint
Sprint 5 will connect everything to the backend with Gemini AI for even more intelligent responses.
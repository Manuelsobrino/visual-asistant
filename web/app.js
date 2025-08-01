class BlindVisionApp {
    constructor() {
        this.hasStarted = false;
        // Initialize properties
        this.stream = null;
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.speechQueue = [];
        this.isSpeaking = false;
        
        // Audio management
        this.currentAudio = null;
        this.isPlaying = false;
        
        // Analysis management
        this.isAnalyzing = false;
        
        // Voice interaction
        this.recognition = null;
        this.isListening = false;
        this.conversationMode = false;
        this.lastCapturedImage = null;
        this.continuousListening = true;
        
        // Initialize speech recognition
        this.initializeSpeechRecognition();
        
        // API Keys - Load from ENV, localStorage, or fallback
        this.apiKey = (window.ENV && window.ENV.OPENAI_API_KEY && window.ENV.OPENAI_API_KEY !== '__OPENAI_API_KEY__') ? 
                      window.ENV.OPENAI_API_KEY : 
                      localStorage.getItem('openaiKey') || 
                      'your_openai_api_key_here';
        
        
        // ElevenLabs settings - Load from ENV, localStorage, or fallback
        this.elevenLabsKey = (window.ENV && window.ENV.ELEVENLABS_API_KEY && window.ENV.ELEVENLABS_API_KEY !== '__ELEVENLABS_API_KEY__') ? 
                             window.ENV.ELEVENLABS_API_KEY : 
                             localStorage.getItem('elevenLabsKey') || 
                             'your_elevenlabs_api_key_here';
        this.elevenLabsVoiceId = '21m00Tcm4TlvDq8ikWAM';
        
        // Enable ElevenLabs for natural voice synthesis
        this.useElevenLabs = true;
        
        this.initializeElements();
        this.bindEvents();
        this.autoStart();
    }

    initializeElements() {
        this.video = document.getElementById('video');
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set up touch/click controls for the entire screen
        document.addEventListener('touchstart', this.handleTouchControl.bind(this));
        document.addEventListener('click', this.handleTouchControl.bind(this));
        
        
        console.log('Elements initialized');
        
        // Set up start button for mobile
        const startButton = document.getElementById('startButton');
        const startScreen = document.getElementById('startScreen');
        
        if (startButton && startScreen) {
            startButton.addEventListener('click', () => {
                this.handleStartButtonClick();
            });
            
            startScreen.addEventListener('click', () => {
                this.handleStartButtonClick();
            });
        } else {
            // Desktop - start immediately
            this.startApp();
        }
    }

    bindEvents() {
        // Events are handled in initializeElements
    }
    
    initializeSpeechRecognition() {
        // Check for speech recognition support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.error('Speech recognition not supported in this browser');
            this.speak('Sorry, speech recognition is not supported in your browser. Please use Chrome or Safari.');
            return;
        }
        
        try {
            this.recognition = new SpeechRecognition();
        } catch (error) {
            console.error('Failed to initialize speech recognition:', error);
            this.speak('Failed to initialize speech recognition.');
            return;
        }
        
        // Configure recognition
        const isMobile = false
        
        // Mobile browsers have stricter requirements for continuous recognition
        this.recognition.continuous = !isMobile; // Disable continuous mode on mobile
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 1;
        
        this.recognition.onstart = () => {
            console.log('Speech recognition started');
            this.isListening = true;
            this.updateStatus('Ready', 'ready');
        };
        
        this.recognition.onresult = (event) => {
            const lastResult = event.results[event.results.length - 1];
            
            if (lastResult.isFinal) {
                const transcript = lastResult[0].transcript.trim();
                console.log('User said:', transcript);
                
                // Only process if it's meaningful speech (more than 3 words or contains question words)
                const questionWords = ['where', 'what', 'how', 'can', 'do', 'is', 'find', 'see', 'help', 'color', 'glasses', 'backpack', 'bag'];
                const words = transcript.toLowerCase().split(' ');
                const hasQuestionWord = questionWords.some(q => words.includes(q));
                
                // Filter out fragments and echoes
                const isEcho = transcript.toLowerCase().includes('the person on the left') || 
                               transcript.toLowerCase().includes('wearing glasses and') ||
                               transcript.toLowerCase().includes('room with');
                
                if (!isEcho && (words.length > 3 || (hasQuestionWord && words.length > 1))) {
                    // Stop listening while processing
                    this.recognition.stop();
                    this.handleVoiceCommand(transcript);
                }
            }
        };
        
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;
            
            if (event.error === 'no-speech') {
                // Don't announce if already playing audio
                if (!this.isPlaying) {
                    this.speak('I didn\'t hear anything. Please try again.');
                }
            } else if (event.error === 'network') {
                this.speak('Network error. Please check your connection.');
            }
            
            this.updateStatus('Ready', 'ready');
        };
        
        this.recognition.onend = () => {
            console.log('Speech recognition ended');
            this.isListening = false;
            this.updateStatus('Ready', 'ready');
            
            // Restart listening automatically
            if (this.continuousListening && !this.isPlaying) {
                // Mobile browsers need a shorter delay to maintain responsiveness
                const restartDelay = isMobile ? 100 : 1000;
                setTimeout(() => {
                    if (this.continuousListening && !this.isPlaying) {
                        console.log('Auto-restarting recognition...');
                        this.startContinuousListening();
                    }
                }, restartDelay);
            }
        };
    }

    async startCamera() {
        try {
            console.log('Starting camera...');
            
            // Check if we have camera permissions first (mobile browsers)
            if (navigator.permissions && navigator.permissions.query) {
                try {
                    const cameraPermission = await navigator.permissions.query({ name: 'camera' });
                    console.log('Camera permission status:', cameraPermission.state);
                } catch (e) {
                    console.log('Cannot query camera permissions:', e);
                }
            }
            
            // Configure camera constraints for mobile devices
            // Mobile-friendly camera constraints
            const constraints = {
                video: {
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                    facingMode: { ideal: 'environment' }, // Prefer rear camera
                    aspectRatio: { ideal: 16/9 }
                },
                audio: false
            };
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            
            console.log('Camera started successfully');
            this.updateStatus('Ready', 'ready');
            
        } catch (error) {
            console.error('Camera error:', error);
            this.updateStatus('Camera error', 'error');
            
            if (error.name === 'NotAllowedError') {
                this.speak('Camera access denied. Please allow camera permissions and refresh the page.');
            } else if (error.name === 'NotFoundError') {
                this.speak('No camera found. Please check your device has a camera.');
            } else {
                this.speak('Camera error. Please refresh the page and try again.');
            }
        }
    }

    updateStatus(message, type = 'ready') {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            // Remove all classes first
            statusElement.classList.remove('active', 'inactive', 'listening');
            
            // Add appropriate class based on type
            if (type === 'listening') {
                statusElement.classList.add('listening');
            } else if (type === 'ready' || type === 'analyzing') {
                statusElement.classList.add('active');
            } else {
                statusElement.classList.add('inactive');
            }
        }
        
        console.log('Status:', message);
    }

    displayDescription(description) {
        // Don't display text on screen - only speak it
        console.log('Description:', description);
    }

    handleTouchControl() {
        console.log('Touch/click detected');
        
        // Touch only stops audio - speech recognition keeps running!
        if (this.isPlaying) {
            console.log('Stopping current speech');
            this.stopAllAudio();
        }
    }



    handleStartButtonClick() {
        if (this.hasStarted) return;
        this.hasStarted = true;
        
        // Hide start screen
        const startScreen = document.getElementById('startScreen');
        const videoContainer = document.getElementById('videoContainer');
        
        if (startScreen) {
            startScreen.style.display = 'none';
        }
        
        if (videoContainer) {
            videoContainer.style.display = 'flex';
        }
        
        // Now start the app with user interaction
        this.startApp();
    }
    
    startApp() {
        console.log('Starting app...');
        
        // Start with welcome message
        this.speak('BlindVision Assistant ready. Just speak to ask me questions.');
        
        // Start camera
        setTimeout(() => {
            this.startCamera();
        }, 2000);
        
        // Start continuous listening after a delay (only if speech recognition is available)
        if (this.recognition) {
            setTimeout(() => {
                this.startContinuousListening();
            }, 3500);
        }
    }
    
    autoStart() {
        console.log('Auto-start called...');
        
        // Detect if on mobile
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        if (isMobile) {
            // On mobile, wait for user interaction
            console.log('Mobile detected - waiting for user interaction');
            // The start screen is already showing
        } else {
            // On desktop, hide start screen and start immediately
            const startScreen = document.getElementById('startScreen');
            const videoContainer = document.getElementById('videoContainer');
            
            if (startScreen) {
                startScreen.style.display = 'none';
            }
            
            if (videoContainer) {
                videoContainer.style.display = 'flex';
            }
            
            this.startApp();
        }
    }

    async speak(text) {
        console.log('Speak function called with text:', text.substring(0, 50) + '...');
        
        // Don't start new speech if already playing
        if (this.isPlaying) {
            console.log('Already playing audio, skipping new speech');
            // Add to queue instead of skipping
            this.speechQueue.push(text);
            return;
        }
        
        // Stop speech recognition to prevent echo
        if (this.recognition && this.isListening) {
            console.log('Stopping speech recognition while speaking');
            this.recognition.stop();
        }
        
        // Set isPlaying immediately to prevent race conditions
        this.isPlaying = true;
        
        // Stop any ongoing audio before starting new speech
        this.stopAllAudio();
        
        // Keep isPlaying true after stopAllAudio
        this.isPlaying = true;
        
        // Wait a moment to ensure all audio is stopped
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Use ElevenLabs if available, otherwise use browser speech
        if (this.elevenLabsKey && this.elevenLabsKey !== '' && this.elevenLabsKey !== 'your_elevenlabs_api_key_here') {
            console.log('Using ElevenLabs API key:', this.elevenLabsKey.substring(0, 20) + '...');
            try {
                await this.speakWithElevenLabs(text);
                console.log('ElevenLabs speech completed successfully');
            } catch (error) {
                console.log('ElevenLabs failed, using browser fallback');
                this.speakWithBrowser(text);
            }
        } else {
            console.log('No ElevenLabs API key found. Using browser speech synthesis.');
            this.speakWithBrowser(text);
        }
        
        // Process any queued speech
        if (this.speechQueue.length > 0) {
            const nextText = this.speechQueue.shift();
            setTimeout(() => {
                this.speak(nextText);
            }, 100);
        }
    }

    stopAllAudio() {
        console.log('Stopping all audio sources...');
        
        // Stop current audio if playing
        if (this.currentAudio) {
            try {
                this.currentAudio.pause();
                this.currentAudio.currentTime = 0;
                // Remove all event listeners to prevent errors
                this.currentAudio.onended = null;
                this.currentAudio.onerror = null;
                this.currentAudio.onplay = null;
                this.currentAudio.oncanplay = null;
                this.currentAudio.src = '';
                this.currentAudio = null;
            } catch (e) {
                console.log('Error stopping audio:', e);
            }
        }
        
        // Stop all audio elements
        const allAudios = document.querySelectorAll('audio');
        allAudios.forEach(audio => {
            try {
                audio.pause();
                audio.currentTime = 0;
                audio.onended = null;
                audio.onerror = null;
                audio.src = '';
            } catch (e) {
                console.log('Error stopping audio element:', e);
            }
        });
        
        // Cancel speech synthesis
        if ('speechSynthesis' in window) {
            speechSynthesis.cancel();
            speechSynthesis.pause();
        }
        
        // Clear any ongoing audio context
        // @ts-ignore - audioContext might be set by other scripts
        if (window.audioContext) {
            // @ts-ignore
            window.audioContext.close();
        }
        
        this.isPlaying = false;
        console.log('All audio sources stopped');
    }
    
    stopRecognition() {
        // Stop recognition
        if (this.recognition && this.isListening) {
            try {
                this.recognition.stop();
                this.isListening = false;
            } catch (e) {
                console.log('Error stopping recognition:', e);
            }
        }
        
        // Clear mobile restart interval
        if (this.mobileRestartInterval) {
            clearInterval(this.mobileRestartInterval);
            this.mobileRestartInterval = null;
        }
        
        this.continuousListening = false;
    }

    async speakWithElevenLabs(text) {
        console.log('ElevenLabs speech function called');
        
        // isPlaying is already set by speak() function
        // Don't need to check again
        
        try {
            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.elevenLabsVoiceId}`, {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': this.elevenLabsKey
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_monolingual_v1',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.5
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`ElevenLabs API error: ${response.status} - ${response.statusText}`);
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            
            const audio = new Audio(audioUrl);
            audio.volume = 1.0;
            
            // Set as current audio
            this.currentAudio = audio;
            this.isPlaying = true;
            
            audio.onloadstart = () => {
                console.log('ElevenLabs audio loading started');
            };
            
            audio.oncanplay = () => {
                console.log('ElevenLabs audio ready to play');
            };
            
            audio.onplay = () => {
                console.log('ElevenLabs audio playing');
            };
            
            audio.onended = () => {
                console.log('ElevenLabs audio finished');
                this.isPlaying = false;
                this.currentAudio = null;
                URL.revokeObjectURL(audioUrl);
                
                // Restart speech recognition after speaking
                if (this.continuousListening && !this.isListening) {
                    console.log('Restarting speech recognition after speaking');
                    setTimeout(() => {
                        this.startContinuousListening();
                    }, 1500); // Increased delay to ensure audio is truly done
                }
                
                // Process queued speech
                if (this.speechQueue.length > 0) {
                    const nextText = this.speechQueue.shift();
                    // Clear remaining queue if too many
                    if (this.speechQueue.length > 2) {
                        console.log('Clearing speech queue, too many items:', this.speechQueue.length);
                        this.speechQueue = [];
                    }
                    setTimeout(() => {
                        this.speak(nextText);
                    }, 500);
                }
            };
            
            audio.onerror = (error) => {
                console.error('ElevenLabs audio error:', error);
                this.isPlaying = false;
                this.currentAudio = null;
                // Don't throw error - just log it
                URL.revokeObjectURL(audioUrl);
            };
            
            await audio.play();
            console.log('ElevenLabs audio playback started successfully');
            
        } catch (error) {
            console.error('ElevenLabs speech error:', error);
            this.isPlaying = false;
            this.currentAudio = null;
            throw error;
        }
    }

    speakWithBrowser(text) {
        if ('speechSynthesis' in window) {
            console.log('Using browser speech synthesis');
            
            // Cancel any ongoing speech
            speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.9;  // Slightly faster for better flow
            utterance.pitch = 1.1;  // Slightly higher for warmth
            utterance.volume = 1.0;
            
            // Try to use the best available English voice
            const voices = speechSynthesis.getVoices();
            let bestVoice = null;
            
            // Priority order for better voices
            const voicePreferences = [
                voice => voice.name.includes('Samantha') && voice.lang.includes('en'),
                voice => voice.name.includes('Alex') && voice.lang.includes('en'),
                voice => voice.name.includes('Victoria') && voice.lang.includes('en'),
                voice => voice.name.includes('Google') && voice.lang.includes('en'),
                voice => voice.name.includes('Natural') && voice.lang.includes('en'),
                voice => voice.lang.includes('en') && !voice.name.includes('Microsoft')
            ];
            
            for (const preference of voicePreferences) {
                bestVoice = voices.find(preference);
                if (bestVoice) {
                    console.log('Using browser voice:', bestVoice.name);
                    break;
                }
            }
            
            if (bestVoice) {
                utterance.voice = bestVoice;
            }
            
            utterance.onstart = () => {
                console.log('Browser speech started');
            };
            
            utterance.onend = () => {
                console.log('Browser speech ended');
                this.isPlaying = false;
                
                // Restart speech recognition after speaking
                if (this.continuousListening && !this.isListening) {
                    console.log('Restarting speech recognition after browser speech');
                    setTimeout(() => {
                        this.startContinuousListening();
                    }, 1500); // Increased delay to ensure audio is truly done
                }
                
                // Process queued speech
                if (this.speechQueue.length > 0) {
                    const nextText = this.speechQueue.shift();
                    // Clear remaining queue if too many
                    if (this.speechQueue.length > 2) {
                        console.log('Clearing speech queue, too many items:', this.speechQueue.length);
                        this.speechQueue = [];
                    }
                    setTimeout(() => {
                        this.speak(nextText);
                    }, 500);
                }
            };
            
            utterance.onerror = (event) => {
                console.error('Browser speech error:', event.error);
                this.isPlaying = false;
            };
            
            speechSynthesis.speak(utterance);
        }
    }

    captureFrame() {
        if (!this.video || !this.video.videoWidth) {
            console.log('Video not ready for capture');
            return null;
        }
        
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        this.ctx.drawImage(this.video, 0, 0);
        
        return this.canvas.toDataURL('image/jpeg', 0.8);
    }

    async callOpenAIVision(imageData) {
        try {
            console.log('Calling OpenAI Vision API...');
            
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a visual assistant specifically designed for blind users. Your descriptions should help with navigation, safety, and spatial awareness. Focus on practical information that a blind person would need to move around safely and efficiently. Use clear, direct language and prioritize information about obstacles, pathways, and spatial relationships.'
                        },
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: `You are a visual assistant for a blind person. Describe what you see in a way that helps them navigate and understand their environment. Focus on:

1. **Obstacles and safety**: Stairs, steps, walls, furniture edges, objects in the path
2. **Spatial information**: Distance to objects, room layout, open spaces vs. confined areas
3. **Navigation cues**: Doorways, hallways, pathways, exits
4. **Practical details**: What's within reach, what's on surfaces, object locations
5. **Environmental context**: Lighting conditions, room type, general atmosphere

Keep descriptions concise (2-3 sentences) and immediately actionable. Use spatial language like "to your left", "ahead of you", "within arm's reach".

Describe in English with clear, direct language suitable for someone who cannot see.`
                                },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: imageData
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens: 150
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('OpenAI API error:', response.status, errorText);
                throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            const description = data.choices[0].message.content;
            
            console.log('OpenAI response:', description);
            return description;
            
        } catch (error) {
            console.error('OpenAI Vision API error:', error);
            throw error;
        }
    }

    
    startContinuousListening() {
        if (!this.recognition) {
            console.log('Speech recognition not available');
            return;
        }
        
        if (this.isListening) {
            console.log('Already listening');
            return;
        }
        
        console.log('Starting continuous listening...');
        
        // Set continuous listening flag
        this.continuousListening = true;
        
        // Detect mobile browser
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        try {
            this.recognition.start();
            this.isListening = true;
            console.log('Continuous listening started');
            
            // Mobile browsers often stop recognition after a period of silence
            // Restart it periodically to maintain continuous listening
            if (isMobile && !this.mobileRestartInterval) {
                // Clear any existing interval first
                if (this.mobileRestartInterval) {
                    clearInterval(this.mobileRestartInterval);
                }
                
                this.mobileRestartInterval = setInterval(() => {
                    if (this.continuousListening && !this.isPlaying) {
                        console.log('Restarting recognition for mobile...');
                        try {
                            // First stop the recognition
                            if (this.isListening) {
                                this.recognition.stop();
                                this.isListening = false;
                            }
                            
                            // Then restart it after a short delay
                            setTimeout(() => {
                                if (this.continuousListening && !this.isPlaying && !this.isListening) {
                                    try {
                                        this.recognition.start();
                                        this.isListening = true;
                                        console.log('Mobile recognition restarted successfully');
                                    } catch (e) {
                                        console.log('Error starting recognition:', e);
                                        // Try again after a delay
                                        setTimeout(() => {
                                            if (this.continuousListening && !this.isPlaying && !this.isListening) {
                                                this.startContinuousListening();
                                            }
                                        }, 2000);
                                    }
                                }
                            }, 200);
                        } catch (e) {
                            console.log('Error stopping recognition for restart:', e);
                        }
                    }
                }, 20000); // Restart every 20 seconds (more frequent for better mobile response)
            }
        } catch (error) {
            console.error('Failed to start recognition:', error);
            
            // Check if it's because recognition is already started
            if (error.message && error.message.includes('already started')) {
                console.log('Recognition already running');
                this.isListening = true;
            } else {
                // Retry after a delay
                setTimeout(() => {
                    this.startContinuousListening();
                }, 2000);
            }
        }
    }
    
    startListening() {
        if (!this.recognition) {
            this.speak('Speech recognition not available in your browser.');
            return;
        }
        
        if (this.isListening) {
            console.log('Already listening');
            return;
        }
        
        
        // Stop any playing audio first
        this.stopAllAudio();
        
        // Clear speech queue to prevent overlapping
        this.speechQueue = [];
        
        // Don't capture image here - will capture when user asks question
        
        // Start recognition immediately without announcing
        try {
            this.recognition.start();
        } catch (error) {
            console.error('Failed to start recognition:', error);
            
            // On mobile, speech recognition might need user interaction
            if (error.name === 'NotAllowedError') {
                console.log('Microphone permission denied');
                this.speak('Please allow microphone access to use voice commands.');
            }
        }
    }
    
    async handleVoiceCommand(command) {
        console.log('Processing voice command:', command);
        
        // Common navigation commands
        const lowerCommand = command.toLowerCase();
        
        if (lowerCommand.includes('help')) {
            this.speak('I can help you find things. Just ask: Where is my backpack? Do you see a bag? What\'s in front of me?');
            return;
        }
        
        if (lowerCommand.includes('stop') || lowerCommand.includes('quiet')) {
            this.stopAllAudio();
            return;
        }
        
        // Quick answers for common questions
        if (lowerCommand.includes('where') && (lowerCommand.includes('glasses') || lowerCommand.includes('sunglasses'))) {
            // Focus on finding glasses, not describing the scene
            command = 'Where are my glasses or sunglasses? Look for them specifically.';
        }
        
        // Always capture a fresh image before answering
        this.lastCapturedImage = this.captureFrame();
        if (this.lastCapturedImage) {
            console.log('Image captured successfully, length:', this.lastCapturedImage.length);
            await this.askAboutScene(command);
        } else {
            console.error('Failed to capture image');
            this.speak('Unable to capture image. Please make sure the camera is active.');
        }
    }
    
    async askAboutScene(question) {
        try {
            console.log('Asking about scene:', question);
            this.updateStatus('Analyzing your question...', 'analyzing');
            
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a visual assistant helping a blind person. You CAN and SHOULD describe everything you see, including people, their appearance, hair color, clothing, glasses, and any objects. When asked about visual features like hair color or if someone is wearing glasses, you MUST provide a direct answer based on what you see in the image. Do not refuse to describe people or their features - the user needs this information for daily life. Be helpful and descriptive.'
                        },
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: `The user asks: "${question}"

IMPORTANT: You MUST answer their question directly based on what you see. Do NOT refuse to describe people or their features.

Examples:
- "What color is my hair?" → "Your hair is [color]"
- "Am I wearing glasses?" → "Yes, you are wearing glasses" or "No, I don\'t see glasses"
- "Where is my backpack?" → "I see a backpack on the floor to your left"
- "What do you see?" → Describe the scene including people and objects

Always provide helpful, direct answers about what you observe in the image.`
                                },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: this.lastCapturedImage
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens: 200
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status}`);
            }

            const data = await response.json();
            const answer = data.choices[0].message.content;
            
            console.log('OpenAI answer:', answer);
            this.speak(answer);
            this.updateStatus('Ready', 'ready');
            
        } catch (error) {
            console.error('Error asking about scene:', error);
            this.speak('Sorry, I had trouble analyzing that. Please try again.');
            this.updateStatus('Ready', 'ready');
        }
    }
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', async () => {
    // Check if we're on HTTPS (required for camera/mic on mobile)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        console.error('HTTPS required for camera/microphone access');
        document.body.innerHTML = '<div style="padding: 20px; text-align: center; font-family: Arial;"><h2>HTTPS Required</h2><p>This app requires HTTPS to access camera and microphone. Please use: <br><strong>' + location.href.replace('http:', 'https:') + '</strong></p></div>';
        return;
    }
    // Wait for environment variables to load
    if (window.envLoaded) {
        await window.envLoaded;
    }
    
    // Small delay to ensure ENV is fully set
    await new Promise(resolve => setTimeout(resolve, 100));
    
    new BlindVisionApp();
}); 
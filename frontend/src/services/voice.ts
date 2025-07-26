import * as Speech from 'expo-speech';

export class VoiceService {
  private isSpeaking: boolean = false;

  async speak(text: string, options: Speech.SpeechOptions = {}): Promise<void> {
    try {
      // Stop any ongoing speech
      if (this.isSpeaking) {
        await Speech.stop();
      }

      this.isSpeaking = true;
      
      const speechOptions: Speech.SpeechOptions = {
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

  async stop(): Promise<void> {
    if (this.isSpeaking) {
      await Speech.stop();
      this.isSpeaking = false;
    }
  }

  async announceReady(): Promise<void> {
    await this.speak('Visual Assistant ready. Press volume button to activate.');
  }

  async announceListening(): Promise<void> {
    await this.speak('Listening...');
  }

  async announceError(message: string = 'Sorry, something went wrong'): Promise<void> {
    await this.speak(message);
  }
}
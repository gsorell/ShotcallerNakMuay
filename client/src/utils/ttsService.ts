// Import Capacitor TTS plugin for native apps
import { TextToSpeech } from '@capacitor-community/text-to-speech';

// This service uses browser TTS for web builds and Capacitor TTS for native apps

// Voice interface for unified TTS
export interface UnifiedVoice {
  id: string;
  name: string;
  language: string;
  isDefault?: boolean;
  quality?: string;
  // Browser-specific properties
  browserVoice?: SpeechSynthesisVoice;
}

export interface TTSOptions {
  voice?: UnifiedVoice | null;
  rate?: number;
  pitch?: number;
  volume?: number;
  onStart?: () => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

class TTSService {
  private availableVoices: UnifiedVoice[] = [];
  private currentVoice: UnifiedVoice | null = null;
  private isNativeApp: boolean;

  constructor() {
    // Detect if we're in a Capacitor (native) environment
    this.isNativeApp = !!(window as any).Capacitor;
    this.initializeVoices();
  }

  private async initializeVoices() {
    try {
      console.log('Initializing TTS voices. IsNativeApp:', this.isNativeApp);
      console.log('Capacitor available:', !!(window as any).Capacitor);
      
      if (this.isNativeApp) {
        // Use Capacitor TTS for native apps
        try {
          console.log('Attempting to load Capacitor TTS voices...');
          
          // First check if TextToSpeech is available
          if (!TextToSpeech) {
            throw new Error('TextToSpeech plugin not available');
          }
          
          // Try to get supported voices
          const result = await TextToSpeech.getSupportedVoices();
          console.log('Capacitor TTS getSupportedVoices result:', result);
          console.log('Result structure:', typeof result, Object.keys(result || {}));
          
          if (!result) {
            throw new Error('No result from Capacitor TTS getSupportedVoices');
          }
          
          // Handle different possible response structures
          let voicesArray = result.voices || result || [];
          if (!Array.isArray(voicesArray)) {
            console.log('Voices not in expected array format, trying to extract...');
            voicesArray = [];
          }
          
          // Deduplicate voices by name, keeping the best quality one
          const voiceMap = new Map<string, any>();
          
          voicesArray.forEach(voice => {
            const baseName = voice.name || 'Unknown Voice';
            const voiceId = voice.voiceURI || voice.name || 'unknown';
            
            if (!voiceMap.has(baseName)) {
              // First occurrence - add it
              voiceMap.set(baseName, voice);
            } else {
              // Duplicate found - keep the better one based on quality indicators
              const existing = voiceMap.get(baseName);
              const existingId = existing.voiceURI || existing.name || '';
              
              // Prefer voices that seem to be from better engines
              // Google TTS usually has better quality than eSpeak or Pico
              const isCurrentBetter = 
                voiceId.toLowerCase().includes('google') ||
                voiceId.toLowerCase().includes('enhanced') ||
                voiceId.toLowerCase().includes('premium') ||
                voice.default;
                
              const isExistingBetter = 
                existingId.toLowerCase().includes('google') ||
                existingId.toLowerCase().includes('enhanced') ||
                existingId.toLowerCase().includes('premium') ||
                existing.default;
              
              if (isCurrentBetter && !isExistingBetter) {
                voiceMap.set(baseName, voice);
              }
              // Otherwise keep the existing one
            }
          });
          
          // Convert map back to array
          this.availableVoices = Array.from(voiceMap.values()).map(voice => ({
            id: voice.voiceURI || voice.name || 'unknown',
            name: voice.name || 'Unknown Voice',
            language: voice.lang || (voice as any).language || 'en-US',
            isDefault: voice.default || false,
            quality: 'native'
          }));
          console.log('Capacitor TTS voices loaded:', this.availableVoices.length, this.availableVoices);
          // If the plugin reports no voices, add a safe fallback so the UI can show a selection
          if (this.availableVoices.length === 0) {
            console.warn('Capacitor TTS returned no voices, adding a System Default fallback');
            this.availableVoices = [{
              id: 'system_default',
              name: 'System default',
              language: 'en-US',
              isDefault: true,
              quality: 'native'
            }];
          }
        } catch (error) {
          console.error('Capacitor TTS error:', error);
          console.error('Error details:', JSON.stringify(error));
          // Fallback to browser TTS if available
          console.log('Falling back to browser TTS...');
          this.initializeBrowserTTS();
        }
      } else {
        // Use browser TTS for web
        console.log('Using browser TTS for web environment');
        this.initializeBrowserTTS();
      }
    } catch (error) {
      console.error('Failed to initialize TTS voices:', error);
    }
  }

  private initializeBrowserTTS() {
    console.log('Initializing browser TTS...');
    console.log('speechSynthesis available:', 'speechSynthesis' in window);
    
    if ('speechSynthesis' in window) {
      const browserVoices = window.speechSynthesis.getVoices();
      console.log('Browser voices found:', browserVoices.length, browserVoices);
      
      this.availableVoices = browserVoices.map(voice => ({
        id: `${voice.name}_${voice.lang}`,
        name: voice.name,
        language: voice.lang,
        isDefault: voice.default,
        browserVoice: voice
      }));

      // If voices aren't loaded yet, wait for them
      if (this.availableVoices.length === 0) {
        console.log('No voices loaded yet, setting up listener...');
        window.speechSynthesis.onvoiceschanged = () => {
          const voices = window.speechSynthesis.getVoices();
          console.log('Voices changed event:', voices.length, voices);
          this.availableVoices = voices.map(voice => ({
            id: `${voice.name}_${voice.lang}`,
            name: voice.name,
            language: voice.lang,
            isDefault: voice.default,
            browserVoice: voice
          }));
        };
      }
    } else {
      console.error('speechSynthesis not available in window');
    }
  }

  // Get all available voices
  async getVoices(): Promise<UnifiedVoice[]> {
    if (this.availableVoices.length === 0) {
      await this.initializeVoices();
    }
    return this.availableVoices;
  }

  // Get English voices only (for your app's requirements)
  async getEnglishVoices(): Promise<UnifiedVoice[]> {
    const voices = await this.getVoices();
    return voices.filter(voice => 
      voice.language.toLowerCase().startsWith('en')
    );
  }

  // Set the current voice
  setVoice(voice: UnifiedVoice | null) {
    this.currentVoice = voice;
  }

  // Get the current voice
  getCurrentVoice(): UnifiedVoice | null {
    return this.currentVoice;
  }

  // Main speak function
  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    const voiceToUse = options.voice || this.currentVoice;
    const rate = options.rate || 1.0;
    const pitch = options.pitch || 1.0;
    const volume = options.volume || 1.0;

    try {
      if (this.isNativeApp) {
        // Use Capacitor TTS for native apps
        if (options.onStart) options.onStart();
        
        // Choose a voice param that works with the Capacitor plugin.
        // Some platforms return numeric ids, others return string identifiers.
        let voiceParam: any = undefined;
        if (voiceToUse?.id) {
          const asNum = Number(voiceToUse.id);
          voiceParam = Number.isFinite(asNum) ? asNum : voiceToUse.id;
        }

        await TextToSpeech.speak({
          text: text + '.',  // Add period to prevent abrupt cutoff
          lang: voiceToUse?.language || 'en-US',
          rate: rate,
          pitch: pitch,
          volume: volume,
          voice: voiceParam
        });
        
        if (options.onDone) options.onDone();
      } else {
        // Use browser TTS for web
        if ('speechSynthesis' in window) {
          // Cancel any current speech
          window.speechSynthesis.cancel();

          const utterance = new SpeechSynthesisUtterance(text);
          
          if (voiceToUse?.browserVoice) {
            utterance.voice = voiceToUse.browserVoice;
          }
          
          utterance.rate = rate;
          utterance.pitch = pitch;
          utterance.volume = volume;

          if (options.onStart) {
            utterance.onstart = options.onStart;
          }
          
          if (options.onDone) {
            utterance.onend = options.onDone;
          }
          
          if (options.onError) {
            utterance.onerror = (event) => {
              options.onError!(new Error(`Speech synthesis error: ${event.error}`));
            };
          }

          window.speechSynthesis.speak(utterance);
        } else {
          throw new Error('Speech synthesis not supported');
        }
      }
    } catch (error) {
      console.error('TTS Error:', error);
      if (options.onError) {
        options.onError(error as Error);
      }
    }
  }

  // Stop/cancel current speech
  async stop(): Promise<void> {
    try {
      if (this.isNativeApp) {
        await TextToSpeech.stop();
      } else if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch (error) {
      console.error('Error stopping TTS:', error);
    }
  }

  // Check if currently speaking
  async isSpeaking(): Promise<boolean> {
    try {
      if (this.isNativeApp) {
        // Capacitor TTS doesn't have a direct isSpeaking method
        // Return false for now (can be enhanced with state tracking)
        return false;
      } else if ('speechSynthesis' in window) {
        return window.speechSynthesis.speaking;
      }
      return false;
    } catch (error) {
      console.error('Error checking TTS status:', error);
      return false;
    }
  }

  // Pause speech
  async pause(): Promise<void> {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.pause();
      }
    } catch (error) {
      console.error('Error pausing TTS:', error);
    }
  }

  // Resume speech
  async resume(): Promise<void> {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.resume();
      }
    } catch (error) {
      console.error('Error resuming TTS:', error);
    }
  }

  // Wrapper for system announcements (unguarded)
  async speakSystem(text: string, options: TTSOptions = {}): Promise<void> {
    return this.speak(text, options);
  }

  // Wrapper for technique callouts (with guards)
  async speakTechnique(text: string, options: TTSOptions = {}, isGuarded: boolean = true): Promise<void> {
    // Add your existing guard logic here if needed
    return this.speak(text, options);
  }

  // Check if TTS is available
  isAvailable(): boolean {
    if (this.isNativeApp) {
      return true; // Capacitor TTS should always be available
    } else {
      return 'speechSynthesis' in window;
    }
  }

  // Get current platform
  getPlatform(): 'native' | 'web' {
    return this.isNativeApp ? 'native' : 'web';
  }
}

// Create and export a singleton instance
export const ttsService = new TTSService();

// Also export the class for testing or multiple instances if needed
export default TTSService;
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
  private isPageVisible = true;

  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private reusableUtterance: SpeechSynthesisUtterance | null = null; // Reuse to prevent WebMediaPlayer accumulation
  private utteranceStartTime = 0;
  private lastVisibilityChange = Date.now();
  private consecutiveFailures = 0; // Track consecutive TTS failures
  private isBusy = false; // Prevent concurrent TTS operations
  private pendingQueue: Array<() => Promise<void>> = []; // Queue for pending TTS calls

  constructor() {
    // Detect if we're in a Capacitor (native) environment
    this.isNativeApp = !!(window as any).Capacitor;
    
    this.initializeVoices();
    this.setupVisibilityHandling();
    this.setupPeriodicCleanup();
  }





  private setupPeriodicCleanup() {
    // Basic cleanup to clear any completed utterances
    if (!this.isNativeApp && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setInterval(() => {
        try {
          // Only cleanup if we're not currently speaking
          if (!this.isBusy && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
            window.speechSynthesis.cancel();
          }
        } catch (error) {
          // Ignore cleanup errors
        }
      }, 60000); // Every 60 seconds
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isBusy || this.pendingQueue.length === 0) {
      return;
    }

    const nextOperation = this.pendingQueue.shift();
    if (nextOperation) {
      try {
        this.isBusy = true;
        await nextOperation();
      } catch (error) {
        // Error processing TTS queue
      } finally {
        this.isBusy = false;
        // Process next item in queue
        setTimeout(() => this.processQueue(), 50);
      }
    }
  }

  private setupVisibilityHandling() {
    // Simplified: Just track initial visibility state
    // No need for complex visibility management since callouts should continue during tab switching
    this.isPageVisible = document.visibilityState === 'visible';
  }

  private async initializeVoices() {
    try {
      if (this.isNativeApp) {
        // Use Capacitor TTS for native apps
        try {
          // First check if TextToSpeech is available
          if (!TextToSpeech) {
            throw new Error('TextToSpeech plugin not available');
          }
          
          // Try to get supported voices
          const result = await TextToSpeech.getSupportedVoices();
          
          if (!result) {
            throw new Error('No result from Capacitor TTS getSupportedVoices');
          }
          
          // Handle different possible response structures
          let voicesArray = result.voices || result || [];
          if (!Array.isArray(voicesArray)) {
            // Sometimes voices come back as an object with numeric keys
            if (typeof voicesArray === 'object' && voicesArray !== null) {
              const keys = Object.keys(voicesArray);
              if (keys.length > 0 && keys.every(k => !isNaN(Number(k)))) {
                // Convert object with numeric keys to array
                voicesArray = keys.map(k => (voicesArray as any)[k]);
              } else {
                voicesArray = [];
              }
            } else {
              voicesArray = [];
            }
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
          
          // If the plugin reports no voices, add a safe fallback so the UI can show a selection
          if (this.availableVoices.length === 0) {
            this.addFallbackVoice();
          }
        } catch (error) {
          // Fallback to browser TTS if available
          this.initializeBrowserTTS();
          
          // If browser TTS also fails, ensure we have a fallback
          setTimeout(() => {
            if (this.availableVoices.length === 0) {
              this.addFallbackVoice();
            }
          }, 1000);
        }
      } else {
        // Use browser TTS for web
        this.initializeBrowserTTS();
      }
    } catch (error) {
      // Ensure we always have at least a fallback voice
      this.addFallbackVoice();
    }
  }

  private initializeBrowserTTS() {
    if ('speechSynthesis' in window) {
      const loadBrowserVoices = () => {
        const browserVoices = window.speechSynthesis.getVoices();
        
        if (browserVoices.length > 0) {
          this.availableVoices = browserVoices.map(voice => ({
            id: `${voice.name}_${voice.lang}`,
            name: voice.name,
            language: voice.lang,
            isDefault: voice.default,
            browserVoice: voice
          }));
          
          // Remove the event listener once we have voices
          window.speechSynthesis.onvoiceschanged = null;
        } else {
          // Add a fallback voice so the UI doesn't show "No voices available"
          this.addFallbackVoice();
        }
      };

      // Try to get voices immediately
      loadBrowserVoices();

      // If no voices yet, set up listener for when they become available
      if (this.availableVoices.length === 0) {
        window.speechSynthesis.onvoiceschanged = loadBrowserVoices;
        
        // Also add a timeout fallback in case the event never fires
        setTimeout(() => {
          if (this.availableVoices.length === 0) {
            this.addFallbackVoice();
          }
        }, 3000);
      }
    } else {
      this.addFallbackVoice();
    }
  }

  private addFallbackVoice() {
    // Add a fallback voice entry so the UI can function
    if (this.availableVoices.length === 0) {
      this.availableVoices = [{
        id: 'system_fallback',
        name: 'System Voice',
        language: 'en-US',
        isDefault: true,
        quality: this.isNativeApp ? 'native' : 'web'
      }];
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

  private lastSpeakTime = 0;
  private readonly MIN_SPEAK_INTERVAL = 100; // Minimum 100ms between TTS calls

  // Main speak function with concurrency control
  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      const operation = async () => {
        try {
          await this.speakInternal(text, options);
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      // If we're busy, queue the operation
      if (this.isBusy) {
        this.pendingQueue.push(operation);
        this.processQueue();
        return;
      }

      // Otherwise execute immediately
      this.isBusy = true;
      operation().finally(() => {
        this.isBusy = false;
        this.processQueue();
      });
    });
  }

  // Internal speak implementation (the actual TTS logic)
  private async speakInternal(text: string, options: TTSOptions = {}): Promise<void> {

    
    // User preference: Allow callouts to continue during tab switching
    // WebMediaPlayer errors confirmed to be from external sources, not our app
    const isPageHidden = !this.isPageVisible || 
                        document.visibilityState === 'hidden' || 
                        document.hidden;
    
    if (isPageHidden) {
      // Continue with TTS as user prefers to hear callouts during tab switching
      // Any WebMediaPlayer errors are from external sources (other tabs, extensions, etc.)
    }

    // Prevent rapid successive TTS calls that can overflow WebMediaPlayer
    const now = Date.now();
    const timeSinceLastSpeak = now - this.lastSpeakTime;
    if (timeSinceLastSpeak < this.MIN_SPEAK_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, this.MIN_SPEAK_INTERVAL - timeSinceLastSpeak));
    }
    this.lastSpeakTime = Date.now();

    const voiceToUse = options.voice || this.currentVoice;
    const rate = options.rate || 1.0;
    const pitch = options.pitch || 1.0;
    const volume = options.volume || 1.0;

    try {
      if (this.isNativeApp) {
        // Use Capacitor TTS for native apps
        if (options.onStart) options.onStart();
        
        const startTime = Date.now();
        
        // Choose a voice param that works with the Capacitor plugin.
        // Some platforms return numeric ids, others return string identifiers.
        let voiceParam: any = undefined;
        if (voiceToUse?.id) {
          const asNum = Number(voiceToUse.id);
          voiceParam = Number.isFinite(asNum) ? asNum : voiceToUse.id;
        }

        await TextToSpeech.speak({
          text: text,  // Use text as-is - TTS engines handle sentence endings properly
          lang: voiceToUse?.language || 'en-US',
          rate: rate,
          pitch: pitch,
          volume: volume,
          voice: voiceParam
        });
        
        const endTime = Date.now();
        const actualDuration = endTime - startTime;
        
        if (options.onDone) {
          // Pass actual duration to onDone callback if it accepts it
          if (options.onDone.length > 0) {
            (options.onDone as any)(actualDuration);
          } else {
            options.onDone();
          }
        }
      } else {
        // Use browser TTS for web
        if ('speechSynthesis' in window) {

          
          // Cancel any pending speech before starting new utterance
          if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
            window.speechSynthesis.cancel();
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          // Reuse single SpeechSynthesisUtterance to prevent WebMediaPlayer accumulation
          if (!this.reusableUtterance) {
            this.reusableUtterance = new SpeechSynthesisUtterance();
          }
          
          const utterance = this.reusableUtterance;
          utterance.text = text; // Update text instead of creating new instance
          this.currentUtterance = utterance;
          this.utteranceStartTime = Date.now();
          
          // Clear any existing event handlers
          utterance.onstart = null;
          utterance.onend = null;
          utterance.onerror = null;
          
          // Ensure we always have a voice set to prevent "interrupted" errors
          if (voiceToUse?.browserVoice) {
            utterance.voice = voiceToUse.browserVoice;
          } else {
            // Fallback to system default voice if no specific voice is set
            const voices = window.speechSynthesis.getVoices();
            const defaultVoice = voices.find(v => v.default) || voices[0];
            if (defaultVoice) {
              utterance.voice = defaultVoice;
            }
          }
          
          utterance.rate = rate;
          utterance.pitch = pitch;
          utterance.volume = volume;

          if (options.onStart) {
            utterance.onstart = options.onStart;
          }
          
          if (options.onDone) {
            utterance.onend = () => {
              const endTime = Date.now();
              const actualDuration = endTime - this.utteranceStartTime;
              this.currentUtterance = null; // Clear reference
              
              // Reset failure count on successful completion
              this.consecutiveFailures = 0;
              

              
              // Pass actual duration to onDone callback if it accepts it
              if (options.onDone!.length > 0) {
                (options.onDone as any)(actualDuration);
              } else {
                options.onDone!();
              }
            };
          }
          
          utterance.onerror = (event) => {
            this.currentUtterance = null; // Clear reference on error
            
            // Handle different types of errors differently
            if (event.error === 'interrupted') {
              // Interrupted errors are usually from cleanup
              this.consecutiveFailures = 0; // Reset failure count on interruptions
            } else {
              this.consecutiveFailures++;
              
              // Only propagate non-interrupted errors
              if (options.onError) {
                options.onError!(new Error(`Speech synthesis error: ${event.error}`));
              }
            }
          };

          window.speechSynthesis.speak(utterance);
        } else {
          throw new Error('Speech synthesis not supported');
        }
      }
    } catch (error) {
      if (options.onError) {
        options.onError(error as Error);
      }
    }
  }

  // Stop/cancel current speech and clear queue
  async stop(): Promise<void> {
    try {
      // Clear the pending queue to prevent queued operations from running
      this.pendingQueue = [];
      
      if (this.isNativeApp) {
        await TextToSpeech.stop();
      } else if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        this.currentUtterance = null; // Clear reference
      }
      
      // Reset busy flag
      this.isBusy = false;
    } catch (error) {
      this.isBusy = false; // Ensure we reset the flag even on error
    }
  }

  // Check if currently speaking or has pending operations
  async isSpeaking(): Promise<boolean> {
    try {
      if (this.isBusy || this.pendingQueue.length > 0) {
        return true;
      }
      
      if (this.isNativeApp) {
        // Capacitor TTS doesn't have a direct isSpeaking method
        // Return false for now (can be enhanced with state tracking)
        return false;
      } else if ('speechSynthesis' in window) {
        return window.speechSynthesis.speaking;
      }
      return false;
    } catch (error) {
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
      // Error pausing TTS
    }
  }

  // Resume speech
  async resume(): Promise<void> {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.resume();
      }
    } catch (error) {
      // Error resuming TTS
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

  // Cleanup method to prevent WebMediaPlayer accumulation
  cleanup(): void {
    try {
      if (this.currentUtterance) {
        window.speechSynthesis.cancel();
        this.currentUtterance = null;
      }
      
      // Don't destroy reusableUtterance - just clear its handlers
      if (this.reusableUtterance) {
        this.reusableUtterance.onstart = null;
        this.reusableUtterance.onend = null;
        this.reusableUtterance.onerror = null;
      }
      
      this.pendingQueue = [];
      this.isBusy = false;
    } catch (error) {
      // Error during TTS cleanup
    }
  }
}

// Create and export a singleton instance
export const ttsService = new TTSService();

// Also export the class for testing or multiple instances if needed
export default TTSService;
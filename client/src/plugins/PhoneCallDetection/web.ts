import { WebPlugin } from '@capacitor/core';
import type { PhoneCallDetectionPlugin, CallStateChangedEvent } from './definitions';

/**
 * Web implementation of phone call detection
 * 
 * This provides basic phone call detection for web/PWA environments
 * using available Web APIs like visibility change, focus/blur events,
 * and audio context interruptions.
 */
export class PhoneCallDetectionWeb extends WebPlugin implements PhoneCallDetectionPlugin {
  private isMonitoring = false;
  private isCallCurrentlyActive = false;
  private visibilityHandler?: () => void;
  private focusHandler?: (event: FocusEvent) => void;
  private blurHandler?: (event: FocusEvent) => void;
  private audioContext?: AudioContext;
  private audioContextHandler?: () => void;

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.setupEventListeners();
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    this.removeEventListeners();
  }

  async isCallActive(): Promise<{ isActive: boolean }> {
    return { isActive: this.isCallCurrentlyActive };
  }

  private setupEventListeners(): void {
    // Visibility change detection
    this.visibilityHandler = () => {
      const isHidden = document.hidden || document.visibilityState === 'hidden';
      
      if (isHidden && !this.isCallCurrentlyActive) {
        // Only trigger for very long periods (likely actual phone calls)
        setTimeout(() => {
          if (document.hidden) {
            this.handleCallStateChange(true, 'visibility-change');
          }
        }, 30000); // 30 seconds - very conservative, only genuine phone calls
      } else if (!isHidden && this.isCallCurrentlyActive) {
        this.handleCallStateChange(false, 'visibility-restored');
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    // Focus/blur detection - disabled as it's too aggressive for web
    this.blurHandler = () => {
      // Disabled to prevent false positives from normal web usage
      // if (!this.isCallCurrentlyActive) {
      //   setTimeout(() => {
      //     if (document.hasFocus() === false) {
      //       this.handleCallStateChange(true, 'focus-lost');
      //     }
      //   }, 5000);
      // }
    };
    
    this.focusHandler = () => {
      if (this.isCallCurrentlyActive) {
        this.handleCallStateChange(false, 'focus-restored');
      }
    };

    window.addEventListener('blur', this.blurHandler);
    window.addEventListener('focus', this.focusHandler);

    // Audio context monitoring
    this.setupAudioContextMonitoring();
  }

  private setupAudioContextMonitoring(): void {
    try {
      // Create minimal audio context for monitoring
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      this.audioContextHandler = () => {
        if (!this.audioContext) return;
        
        const state = this.audioContext.state;
        if (state === 'suspended') {
          if (!this.isCallCurrentlyActive) {
            this.handleCallStateChange(true, 'audio-interrupted');
          }
        } else if (state === 'running' && this.isCallCurrentlyActive) {
          this.handleCallStateChange(false, 'audio-restored');
        }
      };
      
      this.audioContext.addEventListener('statechange', this.audioContextHandler);
    } catch (error) {
      // Audio context not available or blocked
      console.warn('AudioContext monitoring not available:', error);
    }
  }

  private removeEventListeners(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = undefined;
    }

    if (this.blurHandler) {
      window.removeEventListener('blur', this.blurHandler);
      this.blurHandler = undefined;
    }

    if (this.focusHandler) {
      window.removeEventListener('focus', this.focusHandler);
      this.focusHandler = undefined;
    }

    if (this.audioContext && this.audioContextHandler) {
      this.audioContext.removeEventListener('statechange', this.audioContextHandler);
      try {
        this.audioContext.close();
      } catch (error) {
        // Audio context cleanup failed
      }
      this.audioContext = undefined;
      this.audioContextHandler = undefined;
    }
  }

  private handleCallStateChange(isActive: boolean, reason: string): void {
    if (this.isCallCurrentlyActive === isActive) {
      return; // No change
    }

    this.isCallCurrentlyActive = isActive;
    
    const event: CallStateChangedEvent = {
      isActive,
      reason,
      timestamp: Date.now()
    };

    this.notifyListeners('callStateChanged', event);
  }
}
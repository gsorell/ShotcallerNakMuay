import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

/**
 * Interface for native phone call detection plugin
 */
export interface PhoneCallDetectionPlugin {
  /**
   * Start monitoring for phone call interruptions
   */
  startMonitoring(): Promise<void>;
  
  /**
   * Stop monitoring for phone call interruptions
   */
  stopMonitoring(): Promise<void>;
  
  /**
   * Check if a phone call is currently active
   */
  isCallActive(): Promise<{ isActive: boolean }>;
  
  /**
   * Add listener for phone call state changes
   */
  addListener(
    eventName: 'callStateChanged',
    listenerFunc: (event: { isActive: boolean; reason: string }) => void,
  ): Promise<PluginListenerHandle>;
  
  /**
   * Remove all listeners for this plugin
   */
  removeAllListeners(): Promise<void>;
}

/**
 * Native phone call detection plugin for iOS and Android
 * 
 * This plugin provides native-level phone call detection that works
 * even when the app is backgrounded or the device is locked.
 * 
 * Features:
 * - Detects incoming/outgoing phone calls
 * - Audio session interruption detection
 * - App state change monitoring
 * - Background task support for iOS
 */
const PhoneCallDetection = registerPlugin<PhoneCallDetectionPlugin>('PhoneCallDetection', {
  web: () => import('./web').then(m => new m.PhoneCallDetectionWeb()),
});

export * from './definitions';
export { PhoneCallDetection };
export interface PhoneCallState {
  isActive: boolean;
  reason: string;
}

export interface CallStateChangedEvent {
  isActive: boolean;
  reason: string;
  timestamp: number;
}

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
    listenerFunc: (event: CallStateChangedEvent) => void,
  ): Promise<import('@capacitor/core').PluginListenerHandle>;
  
  /**
   * Remove all listeners for this plugin
   */
  removeAllListeners(): Promise<void>;
}
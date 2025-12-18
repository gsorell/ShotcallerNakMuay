package com.shotcallernakmuay.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * AudioSessionPlugin: Manages Android audio focus to enable music ducking during workouts
 * 
 * On Android devices, background music from Spotify, YouTube Music, etc. can be automatically
 * lowered (ducked) during workout callouts if we request audio focus with the AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK flag.
 * 
 * This plugin:
 * 1. Requests TRANSIENT audio focus with ducking enabled when workout starts
 * 2. Releases audio focus when workout ends, allowing music to resume at full volume
 * 3. Handles both pre-Android 8.0 and modern versions via AudioFocusRequest API
 */
@CapacitorPlugin(name = "AudioSession")
public class AudioSessionPlugin extends Plugin {
  
  private AudioManager audioManager;
  private AudioFocusRequest audioFocusRequest;
  private static final String TAG = "AudioSessionPlugin";
  
  @Override
  public void load() {
    // Initialize audio manager when plugin loads
    audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
  }
  
  /**
   * Request transient audio focus with ducking enabled
   * This tells Android to lower background music volume during the workout
   */
  @PluginMethod
  public void requestAudioFocus(PluginCall call) {
    try {
      if (audioManager == null) {
        audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
      }
      
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        // Modern API (Android 8.0+): Use AudioFocusRequest
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_GAME)
          .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
          .build();
        
        audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
          .setAudioAttributes(audioAttributes)
          .setAcceptsDelayedFocusGain(false)
          .setOnAudioFocusChangeListener(this::handleAudioFocusChange)
          .build();
        
        int result = audioManager.requestAudioFocus(audioFocusRequest);
        
        if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
          // Audio focus granted - background music will duck
          android.util.Log.d(TAG, "Audio focus granted with ducking enabled");
          call.resolve(new JSObject().put("success", true).put("message", "Audio focus granted with ducking"));
        } else {
          // Audio focus denied - background music won't be controlled
          android.util.Log.w(TAG, "Audio focus request denied");
          call.resolve(new JSObject().put("success", false).put("message", "Audio focus request denied"));
        }
      } else {
        // Legacy API (Android 7.1 and earlier): Use requestAudioFocus with legacy flags
        int result = audioManager.requestAudioFocus(
          this::handleAudioFocusChange,
          AudioManager.STREAM_MUSIC,
          AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
        );
        
        if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
          android.util.Log.d(TAG, "Audio focus granted (legacy API) with ducking enabled");
          call.resolve(new JSObject().put("success", true).put("message", "Audio focus granted with ducking (legacy)"));
        } else {
          android.util.Log.w(TAG, "Audio focus request denied (legacy API)");
          call.resolve(new JSObject().put("success", false).put("message", "Audio focus request denied (legacy)"));
        }
      }
    } catch (Exception error) {
      android.util.Log.e(TAG, "Error requesting audio focus: " + error.getMessage());
      call.reject("Error requesting audio focus: " + error.getMessage());
    }
  }
  
  /**
   * Release audio focus so background music can resume at full volume
   */
  @PluginMethod
  public void releaseAudioFocus(PluginCall call) {
    try {
      if (audioManager == null) {
        audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
      }
      
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        // Modern API: Release via AudioFocusRequest
        if (audioFocusRequest != null) {
          int result = audioManager.abandonAudioFocusRequest(audioFocusRequest);
          audioFocusRequest = null;
          
          if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
            android.util.Log.d(TAG, "Audio focus released");
            call.resolve(new JSObject().put("success", true).put("message", "Audio focus released"));
          } else {
            android.util.Log.w(TAG, "Failed to release audio focus");
            call.resolve(new JSObject().put("success", false).put("message", "Failed to release audio focus"));
          }
        } else {
          call.resolve(new JSObject().put("success", true).put("message", "No audio focus to release"));
        }
      } else {
        // Legacy API: Abandon focus via stream
        int result = audioManager.abandonAudioFocus(this::handleAudioFocusChange);
        
        if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
          android.util.Log.d(TAG, "Audio focus released (legacy API)");
          call.resolve(new JSObject().put("success", true).put("message", "Audio focus released (legacy)"));
        } else {
          android.util.Log.w(TAG, "Failed to release audio focus (legacy API)");
          call.resolve(new JSObject().put("success", false).put("message", "Failed to release audio focus (legacy)"));
        }
      }
    } catch (Exception error) {
      android.util.Log.e(TAG, "Error releasing audio focus: " + error.getMessage());
      call.reject("Error releasing audio focus: " + error.getMessage());
    }
  }
  
  /**
   * Handle audio focus changes (e.g., phone call incoming, alarm, etc.)
   * This is called when another app requests focus or focus is lost
   */
  private void handleAudioFocusChange(int focusChange) {
    switch (focusChange) {
      case AudioManager.AUDIOFOCUS_GAIN:
        // We gained focus - can use audio at full volume
        android.util.Log.d(TAG, "Audio focus gained");
        break;
      case AudioManager.AUDIOFOCUS_LOSS:
        // We lost focus - should stop playing
        android.util.Log.d(TAG, "Audio focus lost");
        // Notify web layer if needed
        break;
      case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
        // We lost focus temporarily (e.g., phone call) - should pause/reduce volume
        android.util.Log.d(TAG, "Audio focus lost transiently");
        // Notify web layer if needed
        break;
      case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
        // Another app wants focus but we can duck - reduce volume
        android.util.Log.d(TAG, "Audio focus lost transiently - can duck");
        break;
    }
  }
}

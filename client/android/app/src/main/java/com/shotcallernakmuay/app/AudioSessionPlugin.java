package com.shotcallernakmuay.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Custom Capacitor plugin to manage Android audio focus
 * This enables audio ducking - lowering background music volume during workout sessions
 */
@CapacitorPlugin(name = "AudioSession")
public class AudioSessionPlugin extends Plugin {

    private static final String TAG = "AudioSessionPlugin";
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private boolean hasAudioFocus = false;
    private boolean sessionActive = false;
    private AudioManager.OnAudioFocusChangeListener audioFocusChangeListener;

    @Override
    public void load() {
        super.load();
        audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        
        // Initialize audio focus change listener
        audioFocusChangeListener = new AudioManager.OnAudioFocusChangeListener() {
            @Override
            public void onAudioFocusChange(int focusChange) {
                switch (focusChange) {
                    case AudioManager.AUDIOFOCUS_GAIN:
                        Log.d(TAG, "Audio focus gained");
                        hasAudioFocus = true;
                        break;
                        
                    case AudioManager.AUDIOFOCUS_LOSS:
                        Log.w(TAG, "Audio focus lost permanently");
                        hasAudioFocus = false;
                        // If we have an active session and lost focus, try to re-request it
                        if (sessionActive) {
                            Log.d(TAG, "Session active - attempting to re-request audio focus");
                            requestAudioFocusInternal();
                        }
                        break;
                        
                    case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                        Log.d(TAG, "Audio focus lost transiently (temporary interruption)");
                        hasAudioFocus = false;
                        // For transient loss, we'll wait for it to return naturally
                        // but mark that we should still be holding focus
                        break;
                        
                    case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                        Log.d(TAG, "Audio focus loss (can duck) - another app wants to duck us");
                        // Another app wants us to duck - we can continue but at lower volume
                        // For our use case, we want to maintain our ducking of background music
                        // so we'll try to re-assert our focus request
                        if (sessionActive) {
                            Log.d(TAG, "Re-asserting audio focus to maintain ducking");
                            requestAudioFocusInternal();
                        }
                        break;
                        
                    case AudioManager.AUDIOFOCUS_GAIN_TRANSIENT:
                    case AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK:
                        Log.d(TAG, "Audio focus gained transiently");
                        hasAudioFocus = true;
                        break;
                        
                    default:
                        Log.d(TAG, "Unknown audio focus change: " + focusChange);
                        break;
                }
            }
        };
    }
    
    /**
     * Internal method to request audio focus
     * Used both for initial request and for re-requesting when focus is lost
     */
    private boolean requestAudioFocusInternal() {
        try {
            int result;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // Modern Android API (8.0+)
                AudioAttributes playbackAttributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build();

                audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(playbackAttributes)
                    .setAcceptsDelayedFocusGain(false)
                    .setWillPauseWhenDucked(false)
                    .setOnAudioFocusChangeListener(audioFocusChangeListener)
                    .build();

                result = audioManager.requestAudioFocus(audioFocusRequest);
            } else {
                // Legacy API (older Android versions)
                result = audioManager.requestAudioFocus(
                    audioFocusChangeListener,
                    AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
                );
            }

            if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                hasAudioFocus = true;
                Log.d(TAG, "Audio focus granted");
                return true;
            } else {
                hasAudioFocus = false;
                Log.w(TAG, "Audio focus not granted");
                return false;
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to request audio focus: " + e.getMessage());
            return false;
        }
    }

    /**
     * Start an audio session - requests audio focus with ducking
     * This will lower background music (Spotify, etc.) to ~60-70% volume
     */
    @PluginMethod
    public void startSession(PluginCall call) {
        try {
            sessionActive = true;
            boolean success = requestAudioFocusInternal();

            JSObject ret = new JSObject();
            ret.put("success", success);
            ret.put("message", success ? 
                "Audio focus granted - background music will duck" : 
                "Audio focus not granted");
            call.resolve(ret);

        } catch (Exception e) {
            call.reject("Failed to request audio focus: " + e.getMessage());
        }
    }

    /**
     * End an audio session - releases audio focus
     * This will restore background music to full volume
     */
    @PluginMethod
    public void endSession(PluginCall call) {
        try {
            sessionActive = false;
            
            if (hasAudioFocus) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    if (audioFocusRequest != null) {
                        audioManager.abandonAudioFocusRequest(audioFocusRequest);
                        audioFocusRequest = null;
                    }
                } else {
                    audioManager.abandonAudioFocus(audioFocusChangeListener);
                }
                hasAudioFocus = false;
                Log.d(TAG, "Audio focus released");
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Audio focus released - background music restored");
            call.resolve(ret);

        } catch (Exception e) {
            call.reject("Failed to release audio focus: " + e.getMessage());
        }
    }

    /**
     * Check if currently holding audio focus
     */
    @PluginMethod
    public void hasAudioFocus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("hasAudioFocus", hasAudioFocus);
        call.resolve(ret);
    }
}

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
 * Custom Capacitor plugin to manage Android audio focus
 * This enables audio ducking - lowering background music volume during workout sessions
 */
@CapacitorPlugin(name = "AudioSession")
public class AudioSessionPlugin extends Plugin {

    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private boolean hasAudioFocus = false;

    @Override
    public void load() {
        super.load();
        audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    }

    /**
     * Start an audio session - requests audio focus with ducking
     * This will lower background music (Spotify, etc.) to ~60-70% volume
     */
    @PluginMethod
    public void startSession(PluginCall call) {
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
                    .build();

                result = audioManager.requestAudioFocus(audioFocusRequest);
            } else {
                // Legacy API (older Android versions)
                result = audioManager.requestAudioFocus(
                    null,
                    AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
                );
            }

            if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                hasAudioFocus = true;
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("message", "Audio focus granted - background music will duck");
                call.resolve(ret);
            } else {
                hasAudioFocus = false;
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("message", "Audio focus not granted");
                call.resolve(ret);
            }

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
            if (hasAudioFocus) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    if (audioFocusRequest != null) {
                        audioManager.abandonAudioFocusRequest(audioFocusRequest);
                        audioFocusRequest = null;
                    }
                } else {
                    audioManager.abandonAudioFocus(null);
                }
                hasAudioFocus = false;
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

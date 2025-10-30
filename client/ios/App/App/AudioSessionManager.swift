import Foundation
import AVFoundation
import Capacitor

/**
 * iOS Audio Session Manager for Shotcaller Nak Muay
 * 
 * This native iOS code configures the audio session to allow background music
 * (like Spotify) to continue playing while the app uses Text-to-Speech.
 */
@objc(AudioSessionManager)
public class AudioSessionManager: CAPPlugin {
    
    override public func load() {
        super.load()
        configureAudioSessionForBackgroundCompatibility()
    }
    
    private func configureAudioSessionForBackgroundCompatibility() {
        do {
            let audioSession = AVAudioSession.sharedInstance()
            
            // Configure audio session to mix WITHOUT ducking background music
            try audioSession.setCategory(.playback, 
                                       mode: .default, 
                                       options: [.mixWithOthers])  // Removed .duckOthers
            
            // Set audio session active without affecting other apps
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
            
            print("AudioSessionManager: Configured iOS audio session for non-ducking background compatibility")
            
        } catch {
            print("AudioSessionManager: Failed to configure audio session: \(error)")
        }
    }
    
    @objc func configureMixingMode(_ call: CAPPluginCall) {
        do {
            let audioSession = AVAudioSession.sharedInstance()
            
            // Allow true mixing with background audio WITHOUT ducking
            try audioSession.setCategory(.playback, 
                                       mode: .default, 
                                       options: [.mixWithOthers])  // No ducking
            
            try audioSession.setActive(true)
            
            call.resolve()
        } catch {
            call.reject("Failed to configure mixing mode: \(error.localizedDescription)")
        }
    }
    
    @objc func restoreExclusiveMode(_ call: CAPPluginCall) {
        do {
            let audioSession = AVAudioSession.sharedInstance()
            
            // Restore default behavior if needed
            try audioSession.setCategory(.playback, mode: .default)
            try audioSession.setActive(true)
            
            call.resolve()
        } catch {
            call.reject("Failed to restore exclusive mode: \(error.localizedDescription)")
        }
    }
}
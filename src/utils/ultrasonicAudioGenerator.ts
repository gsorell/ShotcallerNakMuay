/**
 * Generates a continuous ultrasonic (20kHz) sine wave for maintaining Android audio focus
 * Includes smooth fade-in/fade-out to prevent popping/clicking artifacts
 * Inaudible to humans but recognized by Android as active audio playback
 */

export class UltrasonicAudioGenerator {
  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying = false;
  private readonly FREQUENCY = 20000; // 20kHz - above human hearing (typically 20Hz-20kHz)
  private readonly FADE_DURATION = 0.2; // 200ms fade in/out to prevent popping
  private readonly TARGET_VOLUME = 0.01; // 1% volume - inaudible but detectable

  constructor() {
    try {
      const AudioContextClass =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
      }
    } catch (error) {
      console.warn("[UltrasonicAudio] AudioContext not available:", error);
    }
  }

  /**
   * Start playing the ultrasonic sine wave with fade-in
   */
  async start(): Promise<void> {
    if (this.isPlaying) {
      console.log("[UltrasonicAudio] Already playing");
      return;
    }

    if (!this.audioContext) {
      console.warn("[UltrasonicAudio] AudioContext not initialized");
      return;
    }

    try {
      // Resume audio context if suspended (required by browser autoplay policies)
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
        console.log("[UltrasonicAudio] AudioContext resumed");
      }

      // Create oscillator (sine wave generator)
      this.oscillator = this.audioContext.createOscillator();
      this.oscillator.type = "sine";
      this.oscillator.frequency.setValueAtTime(
        this.FREQUENCY,
        this.audioContext.currentTime
      );

      // Create gain node for volume control
      this.gainNode = this.audioContext.createGain();

      // Start with zero volume
      this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);

      // Smooth fade-in (ramp up) to prevent popping
      this.gainNode.gain.linearRampToValueAtTime(
        this.TARGET_VOLUME,
        this.audioContext.currentTime + this.FADE_DURATION
      );

      // Connect oscillator -> gain -> destination (speakers)
      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);

      // Start oscillator
      this.oscillator.start();
      this.isPlaying = true;

      console.log(
        `[UltrasonicAudio] Started ${this.FREQUENCY}Hz sine wave with ${this.FADE_DURATION}s fade-in`
      );
    } catch (error) {
      console.error("[UltrasonicAudio] Failed to start:", error);
      this.isPlaying = false;
    }
  }

  /**
   * Stop playing with fade-out to prevent popping
   */
  async stop(): Promise<void> {
    if (!this.isPlaying) {
      console.log("[UltrasonicAudio] Not currently playing");
      return;
    }

    if (!this.audioContext || !this.oscillator || !this.gainNode) {
      console.warn("[UltrasonicAudio] Components not initialized");
      this.isPlaying = false;
      return;
    }

    try {
      // Smooth fade-out (ramp down) to prevent popping
      this.gainNode.gain.linearRampToValueAtTime(
        0,
        this.audioContext.currentTime + this.FADE_DURATION
      );

      // Stop oscillator after fade completes
      setTimeout(() => {
        try {
          if (this.oscillator) {
            this.oscillator.stop();
            this.oscillator.disconnect();
            this.oscillator = null;
          }
          if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
          }
          console.log("[UltrasonicAudio] Stopped with fade-out");
        } catch (error) {
          console.error("[UltrasonicAudio] Error during stop cleanup:", error);
        }
      }, this.FADE_DURATION * 1000);

      this.isPlaying = false;
    } catch (error) {
      console.error("[UltrasonicAudio] Failed to stop:", error);
      this.isPlaying = false;
    }
  }

  /**
   * Check if currently playing
   */
  isActive(): boolean {
    return this.isPlaying;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.isPlaying) {
      this.stop();
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      // Don't close the context as it may be reused
      // this.audioContext.close();
    }
  }
}

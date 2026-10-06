import React, { useCallback } from "react";
import type { UnifiedVoice } from "@/utils/ttsService";
import { ttsService } from "@/utils/ttsService";
import { useWorkoutContext } from "../contexts/WorkoutProvider";
import { useTTSContext } from "../../shared";

/**
 * Which voice calls the round, and how fast it talks. Free, unlike the
 * training options it sits beside.
 */
export const VoiceSettings = () => {
  const { settings } = useWorkoutContext();
  const {
    currentVoice,
    voices,
    setCurrentVoice,
    saveVoicePreference,
    isAvailable: ttsAvailable,
    testVoice,
    voiceCompatibilityWarning,
  } = useTTSContext();
  const { voiceSpeed, setVoiceSpeed } = settings;

  // Detect iOS Safari - TTS rate is scaled by 0.8x for Pro difficulty to match Android's perceived speed
  // Only apply display adjustment for elevated rates (Pro difficulty) - amateur (1.0x) stays as 1.0x
  const isIOSSafari =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream;
  const displaySpeed = isIOSSafari && voiceSpeed > 1.0 ? voiceSpeed * 0.8 : voiceSpeed;
  // Voice selection logic
  const handleVoiceSelection = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedId = e.target.value;
      const selectedVoice = voices.find((v) => v.id === selectedId) || null;

      if (selectedVoice) {
        setCurrentVoice(selectedVoice);
        saveVoicePreference(selectedVoice);

        // Announce change
        setTimeout(async () => {
          try {
            await ttsService.speakImmediate(
              `Voice switched to ${selectedVoice.name}`,
              { voice: selectedVoice, rate: voiceSpeed }
            );
          } catch (error) {
            console.warn("Voice switch announcement failed", error);
          }
        }, 50);
      }
    },
    [voices, setCurrentVoice, saveVoicePreference, voiceSpeed]
  );

  return (
    <div>
      <div style={styles.voiceControlsContainer}>
        {/* Dropdown */}
        <div style={{ flex: 2, minWidth: "180px" }}>
          <label htmlFor="voice-select" style={styles.inputLabel}>
            Voice
          </label>
          <select
            id="voice-select"
            value={currentVoice?.id || ""}
            onChange={handleVoiceSelection}
            style={styles.selectInput}
          >
            <option value="" disabled>
              {voices.length === 0 && ttsAvailable
                ? "Using system default voice"
                : "Select a voice"}
            </option>
            {voices
              .filter((v) => v.language.toLowerCase().startsWith("en"))
              .map((v) => (
                <VoiceOption key={v.id} voice={v} />
              ))}
          </select>
        </div>

        {/* Test Button */}
        <div style={styles.testButtonContainer}>
          <button type="button" onClick={() => testVoice(voiceSpeed)} style={styles.testButton}>
            Test Voice
          </button>
        </div>
      </div>

      {/* Warning */}
      {voiceCompatibilityWarning && (
        <div style={styles.warningBox}>
          <strong>⚠️ Voice Notice:</strong> {voiceCompatibilityWarning}
        </div>
      )}

      {/* Speed Slider */}
      <div style={{ margin: "0.9rem 0 0.5rem" }}>
        <label htmlFor="voice-speed" style={styles.inputLabel}>
          Voice Speed
        </label>
        <input
          id="voice-speed"
          type="range"
          min={0.5}
          max={2}
          step={0.05}
          value={voiceSpeed}
          onChange={(e) => setVoiceSpeed(Number(e.target.value))}
          style={{ width: "100%" }}
        />
        <div style={styles.speedLabel}>{displaySpeed.toFixed(2)}x</div>
      </div>

      {/* Footer Info */}
      <div style={styles.footerInfo}>
        <span>
          <strong>Tip:</strong>{" "}
          {voiceCompatibilityWarning
            ? "Voice issues detected. Try selecting an English voice or adjust the speed."
            : "All English voices work great for Muay Thai techniques."}
        </span>
        {!voices.length && !ttsAvailable && (
          <div style={{ ...styles.statusMessage, color: "#fcd34d" }}>
            <strong>No text-to-speech available:</strong> Check device settings.
          </div>
        )}
        {!voices.length && ttsAvailable && (
          <div style={{ ...styles.statusMessage, color: "#60a5fa" }}>
            <strong>Voice loading:</strong> System voice used automatically.
          </div>
        )}
      </div>
    </div>
  );
};

// Helper for rendering <option> logic
const VoiceOption = ({ voice }: { voice: UnifiedVoice }) => {
  const lang = voice.language.toLowerCase();
  const isAmerican =
    lang.includes("en-us") ||
    lang.includes("united states") ||
    lang.includes("us english");
  const flag = isAmerican ? "🇺🇸 " : "🌐 ";

  return (
    <option value={voice.id} style={{ padding: "0.5rem 0.75rem" }}>
      {flag}
      {voice.name} ({voice.language})
    </option>
  );
};

const styles = {
  voiceControlsContainer: {
    display: "flex",
    gap: "0.75rem",
    alignItems: "flex-end",
    flexWrap: "wrap" as const,
  },
  inputLabel: {
    color: "#f9a8d4",
    fontWeight: 600,
    fontSize: "0.9rem",
    display: "block",
    marginBottom: 4,
  },
  selectInput: {
    appearance: "none" as const,
    background: "#eeeeeeff",
    color: "#181825",
    padding: "0.65rem 0.9rem",
    borderRadius: "0.5rem",
    border: "1px solid #000000ff",
    fontSize: "1rem",
    cursor: "pointer",
    width: "100%",
    minWidth: "160px",
    boxSizing: "border-box" as const,
  },
  testButtonContainer: {
    flex: 1,
    display: "flex",
    alignItems: "flex-end",
    minWidth: "120px",
  },
  testButton: {
    padding: "0.5rem 1.2rem",
    borderRadius: "0.5rem",
    border: "1px solid #60a5fa",
    background: "linear-gradient(90deg, #60a5fa 0%, #818cf8 100%)",
    color: "white",
    fontWeight: 700,
    fontSize: "1rem",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(59,130,246,0.10)",
    width: "100%",
  },
  warningBox: {
    background: "rgba(251, 191, 36, 0.1)",
    border: "1px solid rgba(251, 191, 36, 0.3)",
    borderRadius: "0.5rem",
    padding: "0.75rem",
    marginTop: "1rem",
    color: "#fbbf24",
    fontSize: "0.9rem",
    lineHeight: "1.5",
  },
  speedLabel: {
    fontSize: "0.9rem",
    color: "#f9a8d4",
    marginTop: 2,
  },
  footerInfo: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: "0.8rem",
    marginTop: "0.5rem",
    textAlign: "left" as const,
  },
  statusMessage: {
    marginTop: "0.5rem",
    fontSize: "0.85rem",
  },
};

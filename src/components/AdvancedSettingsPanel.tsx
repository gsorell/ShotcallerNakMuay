import React, { useCallback } from "react";
import { AnalyticsEvents } from "../utils/analytics";
import type { UnifiedVoice } from "../utils/ttsService";

// Define Props Interfaces
export type AdvancedSettingsPanelProps = {
  southpawMode: boolean;
  setSouthpawMode: (value: boolean) => void;
  addCalisthenics: boolean;
  setAddCalisthenics: (value: boolean) => void;
  readInOrder: boolean;
  setReadInOrder: (value: boolean) => void;
  currentVoice: UnifiedVoice | null;
  voices: UnifiedVoice[];
  setCurrentVoice: (voice: UnifiedVoice | null) => void;
  saveVoicePreference: (voice: UnifiedVoice | null) => void;
  ttsService: any;
  voiceSpeed: number;
  ttsAvailable: boolean;
  testVoice: () => void;
  voiceCompatibilityWarning: string;
  setVoiceSpeed: (speed: number) => void;
  trackEvent: (eventName: string, properties?: object) => void;
};

// ---------------------------------------------------------------------------
// Sub-Component: Training Options
// ---------------------------------------------------------------------------
const TrainingOptions = ({
  southpawMode,
  setSouthpawMode,
  trackEvent,
  addCalisthenics,
  setAddCalisthenics,
  readInOrder,
  setReadInOrder,
}: Pick<
  AdvancedSettingsPanelProps,
  | "southpawMode"
  | "setSouthpawMode"
  | "trackEvent"
  | "addCalisthenics"
  | "setAddCalisthenics"
  | "readInOrder"
  | "setReadInOrder"
>) => {
  // Logic extracted to a named handler
  const handleSouthpawChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    setSouthpawMode(newValue);
    try {
      trackEvent(AnalyticsEvents.SettingToggle, {
        setting_name: "southpaw_mode",
        setting_value: newValue,
      });
    } catch (error) {
      console.warn("Analytics tracking failed", error);
    }
  };

  return (
    <div style={{ marginBottom: "2rem" }}>
      <h4 style={styles.sectionHeader}>Training Options</h4>
      <div style={styles.optionsContainer}>
        <ToggleOption
          label="Southpaw Mode"
          description="Mirrors 'Left' and 'Right' in technique callouts for left-handed fighters"
          checked={southpawMode}
          onChange={handleSouthpawChange}
        />
        <ToggleOption
          label="Include Calisthenics"
          description="Adds bodyweight exercises like jumping jacks and high knees to your workout"
          checked={addCalisthenics}
          onChange={(e: any) => setAddCalisthenics(e.target.checked)}
        />
        <ToggleOption
          label="Read Techniques in Order"
          description="Calls techniques sequentially instead of randomly for structured practice"
          checked={readInOrder}
          onChange={(e: any) => setReadInOrder(e.target.checked)}
        />
      </div>
    </div>
  );
};

// Helper for repetitive checkboxes
const ToggleOption = ({ label, description, checked, onChange }: any) => (
  <div>
    <label style={styles.checkboxLabel}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={styles.checkboxInput}
      />
      {label}
    </label>
    <p style={styles.checkboxDescription}>{description}</p>
  </div>
);

// ---------------------------------------------------------------------------
// Sub-Component: Voice Settings
// ---------------------------------------------------------------------------
const VoiceSettings = ({
  currentVoice,
  voices,
  setCurrentVoice,
  saveVoicePreference,
  ttsService,
  voiceSpeed,
  setVoiceSpeed,
  ttsAvailable,
  testVoice,
  voiceCompatibilityWarning,
}: Omit<
  AdvancedSettingsPanelProps,
  | "southpawMode"
  | "setSouthpawMode"
  | "addCalisthenics"
  | "setAddCalisthenics"
  | "readInOrder"
  | "setReadInOrder"
  | "trackEvent"
>) => {
  // Voice selection logic
  const handleVoiceSelection = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedName = e.target.value;
      const selectedVoice = voices.find((v) => v.name === selectedName) || null;

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
    [voices, setCurrentVoice, saveVoicePreference, ttsService, voiceSpeed]
  );

  return (
    <div>
      <h4 style={styles.sectionHeader}>Voice Settings</h4>

      <div style={styles.voiceControlsContainer}>
        {/* Dropdown */}
        <div style={{ flex: 2, minWidth: "180px" }}>
          <label htmlFor="voice-select" style={styles.inputLabel}>
            Voice
          </label>
          <select
            id="voice-select"
            value={currentVoice?.name || ""}
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
                <VoiceOption key={v.name} voice={v} />
              ))}
          </select>
        </div>

        {/* Test Button */}
        <div style={styles.testButtonContainer}>
          <button type="button" onClick={testVoice} style={styles.testButton}>
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
      <div style={{ marginBottom: "0.5rem" }}>
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
        <div style={styles.speedLabel}>{voiceSpeed.toFixed(2)}x</div>
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
    <option value={voice.name} style={{ padding: "0.5rem 0.75rem" }}>
      {flag}
      {voice.name} ({voice.language})
    </option>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export const AdvancedSettingsPanel = (props: AdvancedSettingsPanelProps) => {
  return (
    <div className="advanced-settings-panel" style={styles.panelContainer}>
      <TrainingOptions
        southpawMode={props.southpawMode}
        setSouthpawMode={props.setSouthpawMode}
        trackEvent={props.trackEvent}
        addCalisthenics={props.addCalisthenics}
        setAddCalisthenics={props.setAddCalisthenics}
        readInOrder={props.readInOrder}
        setReadInOrder={props.setReadInOrder}
      />

      <VoiceSettings
        currentVoice={props.currentVoice}
        voices={props.voices}
        setCurrentVoice={props.setCurrentVoice}
        saveVoicePreference={props.saveVoicePreference}
        ttsService={props.ttsService}
        voiceSpeed={props.voiceSpeed}
        setVoiceSpeed={props.setVoiceSpeed}
        ttsAvailable={props.ttsAvailable}
        testVoice={props.testVoice}
        voiceCompatibilityWarning={props.voiceCompatibilityWarning}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Styles (Extracted to bottom for readability)
// ---------------------------------------------------------------------------
const styles = {
  panelContainer: {
    marginTop: "1rem",
    maxWidth: "32rem",
    marginLeft: "auto",
    marginRight: "auto",
    background: "rgba(0, 0, 0, 0.3)",
    borderRadius: "12px",
    padding: "1.5rem",
    border: "1px solid rgba(96, 165, 250, 0.2)",
  },
  sectionHeader: {
    color: "#60a5fa",
    fontSize: "0.875rem",
    fontWeight: 600,
    margin: "0 0 1rem 0",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  optionsContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1.25rem",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    fontWeight: 500,
    color: "#f9a8d4",
    fontSize: "0.95rem",
    cursor: "pointer",
  },
  checkboxInput: {
    accentColor: "#60a5fa",
    width: 18,
    height: 18,
    borderRadius: "4px",
    border: "2px solid rgba(96, 165, 250, 0.3)",
    cursor: "pointer",
  },
  checkboxDescription: {
    color: "#cbd5e1",
    fontSize: "0.8rem",
    margin: "0.25rem 0 0 2.5rem",
    lineHeight: "1.4",
    textAlign: "left" as const,
  },
  voiceControlsContainer: {
    display: "flex",
    gap: "1.5rem",
    alignItems: "flex-end",
    flexWrap: "wrap" as const,
  },
  inputLabel: {
    color: "#f9a8d4",
    fontWeight: 600,
    fontSize: "1rem",
    display: "block",
    marginBottom: 4,
  },
  selectInput: {
    appearance: "none" as const,
    background: "#eeeeeeff",
    color: "#181825",
    padding: "0.75rem 1.25rem",
    borderRadius: "0.5rem",
    border: "1px solid #000000ff",
    fontSize: "1rem",
    cursor: "pointer",
    width: "100%",
    minWidth: "160px",
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
    fontSize: "0.95rem",
    color: "#f9a8d4",
    marginTop: 2,
  },
  footerInfo: {
    color: "#f9a8d4",
    fontSize: "0.92rem",
    marginTop: "0.5rem",
    textAlign: "left" as const,
  },
  statusMessage: {
    marginTop: "0.5rem",
    fontSize: "0.85rem",
  },
};

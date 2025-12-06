import { AnalyticsEvents } from "../utils/analytics";
import type { UnifiedVoice } from "../utils/ttsService";

export type AdvancedSettingsPanelProps = {
  southpawMode: boolean;
  setSouthpawMode: any;
  addCalisthenics: boolean;
  setAddCalisthenics: any;
  readInOrder: boolean;
  setReadInOrder: any;
  voice: SpeechSynthesisVoice | null;
  voices: SpeechSynthesisVoice[];
  unifiedVoices: UnifiedVoice[];
  setCurrentVoice: any;
  saveVoicePreference: any;
  checkVoiceCompatibility: any;
  ttsService: any;
  voiceSpeed: any;
  ttsAvailable: any;
  testVoice: any;
  voiceCompatibilityWarning: any;
  setVoiceSpeed: any;
  trackEvent: any;
};

export const AdvancedSettingsPanel = ({
  southpawMode,
  setSouthpawMode,
  addCalisthenics,
  setAddCalisthenics,
  readInOrder,
  setReadInOrder,
  voice,
  voices,
  unifiedVoices,
  setCurrentVoice,
  saveVoicePreference,
  checkVoiceCompatibility,
  ttsService,
  voiceSpeed,
  ttsAvailable,
  testVoice,
  voiceCompatibilityWarning,
  setVoiceSpeed,
  trackEvent,
}: AdvancedSettingsPanelProps) => (
  <div
    className="advanced-settings-panel"
    style={{
      marginTop: "1rem",
      maxWidth: "32rem",
      marginLeft: "auto",
      marginRight: "auto",
      background: "rgba(0, 0, 0, 0.3)",
      borderRadius: "12px",
      padding: "1.5rem",
      border: "1px solid rgba(96, 165, 250, 0.2)",
    }}
  >
    {/* Training Options Section */}
    <div style={{ marginBottom: "2rem" }}>
      <h4
        style={{
          color: "#60a5fa",
          fontSize: "0.875rem",
          fontWeight: 600,
          margin: "0 0 1rem 0",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        Training Options
      </h4>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        {/* Southpaw Mode toggle */}
        <div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              fontWeight: 500,
              color: "#f9a8d4",
              fontSize: "0.95rem",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={southpawMode}
              onChange={(e) => {
                const newValue = e.target.checked;
                setSouthpawMode(newValue);
                // Track southpaw mode toggle
                try {
                  trackEvent(AnalyticsEvents.SettingToggle, {
                    setting_name: "southpaw_mode",
                    setting_value: newValue,
                  });
                } catch (error) {
                  // Analytics tracking failed
                }
              }}
              style={{
                accentColor: "#60a5fa",
                width: 18,
                height: 18,
                borderRadius: "4px",
                border: "2px solid rgba(96, 165, 250, 0.3)",
                cursor: "pointer",
              }}
            />
            Southpaw Mode
          </label>
          <p
            style={{
              color: "#cbd5e1",
              fontSize: "0.8rem",
              margin: "0.25rem 0 0 2.5rem",
              lineHeight: "1.4",
              textAlign: "left",
            }}
          >
            Mirrors "Left" and "Right" in technique callouts for left-handed
            fighters
          </p>
        </div>

        {/* Calisthenics toggle */}
        <div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              fontWeight: 500,
              color: "#f9a8d4",
              fontSize: "0.95rem",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={addCalisthenics}
              onChange={(e) => setAddCalisthenics(e.target.checked)}
              style={{
                accentColor: "#60a5fa",
                width: 18,
                height: 18,
                borderRadius: "4px",
                border: "2px solid rgba(96, 165, 250, 0.3)",
                cursor: "pointer",
              }}
            />
            Include Calisthenics
          </label>
          <p
            style={{
              color: "#cbd5e1",
              fontSize: "0.8rem",
              margin: "0.25rem 0 0 2.5rem",
              lineHeight: "1.4",
              textAlign: "left",
            }}
          >
            Adds bodyweight exercises like jumping jacks and high knees to your
            workout
          </p>
        </div>

        {/* Read in order toggle */}
        <div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              fontWeight: 500,
              color: "#f9a8d4",
              fontSize: "0.95rem",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={readInOrder}
              onChange={(e) => setReadInOrder(e.target.checked)}
              style={{
                accentColor: "#60a5fa",
                width: 18,
                height: 18,
                borderRadius: "4px",
                border: "2px solid rgba(96, 165, 250, 0.3)",
                cursor: "pointer",
              }}
            />
            Read Techniques in Order
          </label>
          <p
            style={{
              color: "#cbd5e1",
              fontSize: "0.8rem",
              margin: "0.25rem 0 0 2.5rem",
              lineHeight: "1.4",
              textAlign: "left",
            }}
          >
            Calls techniques sequentially instead of randomly for structured
            practice
          </p>
        </div>
      </div>
    </div>

    {/* Voice Settings Section */}
    <div>
      <h4
        style={{
          color: "#60a5fa",
          fontSize: "0.875rem",
          fontWeight: 600,
          margin: "0 0 1rem 0",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        Voice Settings
      </h4>
      <div
        style={{
          display: "flex",
          gap: "1.5rem",
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        {/* Voice Dropdown */}
        <div style={{ flex: 2, minWidth: "180px" }}>
          <label
            htmlFor="voice-select"
            style={{
              color: "#f9a8d4",
              fontWeight: 600,
              fontSize: "1rem",
              display: "block",
              marginBottom: 4,
            }}
          >
            Voice
          </label>
          <select
            id="voice-select"
            value={voice?.name || ""}
            onChange={(e) => {
              const selectedName = e.target.value;
              const selected =
                voices.find((v) => v.name === selectedName) || null;

              if (selected) {
                // Find the corresponding unified voice - try multiple matching strategies
                let unifiedVoice = unifiedVoices.find(
                  (v) =>
                    v.name === selected.name && v.language === selected.lang
                );

                // If exact match fails, try name-only match
                if (!unifiedVoice) {
                  unifiedVoice = unifiedVoices.find(
                    (v) => v.name === selected.name
                  );
                }

                // If that fails, try the first English voice as fallback
                if (!unifiedVoice) {
                  unifiedVoice = unifiedVoices.find((v) =>
                    v.language.toLowerCase().startsWith("en")
                  );
                }

                if (unifiedVoice) {
                  setCurrentVoice(unifiedVoice);
                  saveVoicePreference(selected); // Use the synthetic voice for legacy preference saving

                  // Check compatibility of the newly selected voice
                  checkVoiceCompatibility(selected, voices);

                  // Use immediate speak to announce voice change with the new voice
                  setTimeout(async () => {
                    try {
                      await ttsService.speakImmediate(
                        `Voice switched to ${selected.name}`,
                        {
                          voice: unifiedVoice,
                          rate: voiceSpeed,
                        }
                      );
                    } catch (error) {
                      // Voice switch announcement failed - this is non-critical
                    }
                  }, 50);
                }
              }
            }}
            style={{
              appearance: "none",
              background: "#eeeeeeff",
              color: "#181825",
              padding: "0.75rem 1.25rem",
              borderRadius: "0.5rem",
              border: "1px solid #000000ff",
              fontSize: "1rem",
              cursor: "pointer",
              width: "100%",
              minWidth: "160px",
            }}
          >
            <option value="" disabled>
              {voices.length === 0 && ttsAvailable
                ? "Using system default voice"
                : "Select a voice"}
            </option>
            {voices
              .filter((v) => v.lang.toLowerCase().startsWith("en")) // Only show English voices
              .map((v) => {
                const isAmericanEnglish =
                  v.lang.toLowerCase() === "en-us" ||
                  v.lang.toLowerCase() === "en_us" ||
                  v.lang.toLowerCase().startsWith("en-us") ||
                  v.lang.toLowerCase().startsWith("en_us");
                const isOtherEnglish =
                  v.lang.toLowerCase().startsWith("en") && !isAmericanEnglish;

                // More specific check for American English names (avoid false positives like "Australia")
                const isAmericanEnglishName =
                  v.name.toLowerCase().includes("united states") ||
                  v.name.toLowerCase().includes("us english") ||
                  (v.name.toLowerCase().includes("english") &&
                    v.name.toLowerCase().includes(" us ")) ||
                  (v.name.toLowerCase().includes("english") &&
                    v.name.toLowerCase().endsWith(" us"));

                let flag = "";
                if (isAmericanEnglish || isAmericanEnglishName) {
                  flag = "🇺🇸 ";
                } else if (
                  isOtherEnglish ||
                  v.name.toLowerCase().includes("english")
                ) {
                  flag = "🌐 ";
                }

                return (
                  <option
                    key={v.name}
                    value={v.name}
                    style={{ padding: "0.5rem 0.75rem" }}
                  >
                    {flag}
                    {v.name} ({v.lang})
                  </option>
                );
              })}
          </select>
        </div>
        {/* Test Voice Button */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "flex-end",
            minWidth: "120px",
          }}
        >
          <button
            type="button"
            onClick={testVoice}
            style={{
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
            }}
          >
            Test Voice
          </button>
        </div>
      </div>

      {/* Voice Compatibility Warning */}
      {voiceCompatibilityWarning && (
        <div
          style={{
            background: "rgba(251, 191, 36, 0.1)",
            border: "1px solid rgba(251, 191, 36, 0.3)",
            borderRadius: "0.5rem",
            padding: "0.75rem",
            marginTop: "1rem",
            color: "#fbbf24",
            fontSize: "0.9rem",
            lineHeight: "1.5",
          }}
        >
          <strong>⚠️ Voice Notice:</strong> {voiceCompatibilityWarning}
        </div>
      )}

      {/* Voice Speed Slider */}
      <div style={{ marginBottom: "0.5rem" }}>
        <label
          htmlFor="voice-speed"
          style={{
            color: "#f9a8d4",
            fontWeight: 600,
            fontSize: "1rem",
            display: "block",
            marginBottom: 4,
          }}
        >
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
        <div
          style={{
            fontSize: "0.95rem",
            color: "#f9a8d4",
            marginTop: 2,
          }}
        >
          {voiceSpeed.toFixed(2)}x
        </div>
      </div>
      <div
        style={{
          color: "#f9a8d4",
          fontSize: "0.92rem",
          marginTop: "0.5rem",
          textAlign: "left",
        }}
      >
        <span>
          <strong>Tip:</strong>{" "}
          {voiceCompatibilityWarning
            ? "Voice issues detected. Try selecting an English voice or adjust the speed."
            : "All English voices work great for Muay Thai techniques. American English (🇺🇸) is preferred, but any English variant will provide clear pronunciation."}
        </span>
        {!voices.length && !ttsAvailable && (
          <div
            style={{
              marginTop: "0.5rem",
              fontSize: "0.85rem",
              color: "#fcd34d",
            }}
          >
            <strong>No text-to-speech available:</strong> Your device may not
            support text-to-speech.
          </div>
        )}
        {!voices.length && ttsAvailable && (
          <div
            style={{
              marginTop: "0.5rem",
              fontSize: "0.85rem",
              color: "#60a5fa",
            }}
          >
            <strong>Voice loading:</strong> System voice will be used
            automatically.
          </div>
        )}
      </div>
    </div>
  </div>
);

import {
  DEFAULT_USER_SETTINGS,
  USER_SETTINGS_STORAGE_KEY,
  type UserSettings,
} from "@/constants/storage";

export function loadUserSettings(): UserSettings {
  try {
    const stored = localStorage.getItem(USER_SETTINGS_STORAGE_KEY);
    if (!stored) return DEFAULT_USER_SETTINGS;

    const parsed = JSON.parse(stored);

    // Validate and sanitize settings
    return {
      roundMin: Math.min(
        30,
        Math.max(0.25, parsed.roundMin || DEFAULT_USER_SETTINGS.roundMin)
      ),
      restMinutes: Math.min(
        10,
        Math.max(0.25, parsed.restMinutes || DEFAULT_USER_SETTINGS.restMinutes)
      ),
      voiceSpeed: Math.min(
        2,
        Math.max(0.5, parsed.voiceSpeed || DEFAULT_USER_SETTINGS.voiceSpeed)
      ),
      roundsCount: Math.min(
        20,
        Math.max(1, parsed.roundsCount || DEFAULT_USER_SETTINGS.roundsCount)
      ),
    };
  } catch (error) {
    return DEFAULT_USER_SETTINGS;
  }
}

export function saveUserSettings(settings: Partial<UserSettings>): void {
  try {
    const current = loadUserSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(USER_SETTINGS_STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    // Failed to save user settings to localStorage
  }
}

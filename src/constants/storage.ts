export const TECHNIQUES_STORAGE_KEY = "shotcaller_techniques";
export const TECHNIQUES_VERSION_KEY = "shotcaller_techniques_version";
// Snapshot of the shipped defaults the user's saved techniques were last
// reconciled against. Diffing stored-vs-baseline is what distinguishes "the
// user edited this group" from "we shipped new content for this group", so an
// update can add/refresh groups without discarding customizations.
export const TECHNIQUES_BASELINE_KEY = "shotcaller_techniques_baseline";
export const WORKOUTS_STORAGE_KEY = "shotcaller_workouts";
export const VOICE_STORAGE_KEY = "shotcaller_voice_preference";
export const MILESTONES_STORAGE_KEY = "shotcaller_streak_milestones";
export const CHARMS_STORAGE_KEY = "shotcaller_charms";
// One-time flag: set after existing users' already-earned charms are seeded
// as "awarded" so they don't get a backlog of celebrations on next workout.
export const CHARMS_SEEDED_FLAG = "shotcaller_charms_seeded";
// Guided-path progress: which "Start Here" levels have been cleared.
export const ROADMAP_STORAGE_KEY = "shotcaller_roadmap_progress";
// Set once the user dismisses the "Start Here" banner on the setup screen, so
// a returning fighter who doesn't want the path isn't nagged by it forever.
export const ROADMAP_BANNER_DISMISSED_KEY = "shotcaller_roadmap_banner_hidden";

// User settings persistence
export const USER_SETTINGS_STORAGE_KEY = "shotcaller_user_settings";

// User settings persistence utilities
export interface UserSettings {
  roundMin: number;
  restMinutes: number;
  voiceSpeed: number;
  roundsCount: number;
}

export const DEFAULT_REST_MINUTES = 1;

export const DEFAULT_USER_SETTINGS: UserSettings = {
  roundMin: 3,
  restMinutes: DEFAULT_REST_MINUTES,
  voiceSpeed: 1,
  roundsCount: 5,
};

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

// The name attached to styles this user shares. There are no accounts, so this
// is self-declared and unverified — it is a "from Jake" on a text message, not
// an identity. Asked for once, on the first share.
export const SHARE_SENDER_NAME_KEY = "shotcaller_share_sender_name";
// Set once the user has actually *chosen* their sharing name rather than
// having one assigned. An assigned name earns one confirmation prompt at the
// first share; after that sharing is a single tap.
export const SHARE_NAME_CONFIRMED_KEY = "shotcaller_share_name_confirmed";
// How many shared styles a free user has imported, against FREE_IMPORT_LIMIT.
export const SHARE_IMPORT_COUNT_KEY = "shotcaller_share_import_count";

/**
 * Free users can import this many shared styles before the paywall.
 *
 * Receiving is deliberately not gated the way the rest of the editor is: a
 * shared style is how a paying user hands a friend something that works
 * immediately, and charging at that moment kills the loop at exactly the point
 * it would pay off. The cap keeps the upgrade pressure without closing the door.
 */
export const FREE_IMPORT_LIMIT = 2;

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

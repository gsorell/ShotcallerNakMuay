/**
 * The stance preference, for the one caller that cannot reach it through the
 * session: onboarding is mounted above WorkoutProvider, so it has no setter to
 * call. Writing storage alone would not do — the session read it once at mount
 * and would carry on orthodox until the next launch.
 */
const STORAGE_KEY = "southpaw_mode";
const CHANGE_EVENT = "shotcaller:southpaw-change";

export const loadSouthpaw = (): boolean => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;
    return Boolean(JSON.parse(stored));
  } catch {
    return false;
  }
};

export const saveSouthpaw = (southpaw: boolean): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(southpaw));
  } catch {
    /* private mode or a full quota: the choice still holds for this session */
  }
};

/** Save the stance and tell the running session about it. */
export const setSouthpawPreference = (southpaw: boolean): void => {
  saveSouthpaw(southpaw);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: southpaw }));
};

/** Hear about a stance set from outside the session. Returns the unsubscribe. */
export const onSouthpawPreferenceChange = (
  listener: (southpaw: boolean) => void
): (() => void) => {
  const handler = (event: Event) =>
    listener(Boolean((event as CustomEvent<boolean>).detail));
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
};

// One-time flag: set once the first-launch onboarding has been shown, so it
// never auto-appears again. Bump the suffix if onboarding is redesigned and
// you want existing users to see it again.
const ONBOARDED_KEY = "shotcaller_onboarded_v1";

export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, "1");
  } catch {
    // Best-effort; if storage fails we'll just show onboarding again next time.
  }
}

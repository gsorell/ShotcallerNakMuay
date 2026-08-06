import { Capacitor, registerPlugin } from "@capacitor/core";

interface InstallInfoPlugin {
  /** Epoch millis this app was first installed on the device; 0 if unknown. */
  getFirstInstallTime(): Promise<{ firstInstallTime: number }>;
}

const InstallInfo = registerPlugin<InstallInfoPlugin>("InstallInfo");

/**
 * When this app was first installed on this device, in epoch millis.
 *
 * `null` means "unknown" — web, iOS, a plugin error, or the native side
 * reporting 0. Callers MUST treat null as "no information" and never as an
 * old install, or a lookup failure would grandfather every user.
 *
 * Android only. See ANDROID_FREE_TRANSITION_DATE in ./releaseConfig for why
 * this exists.
 */
/**
 * Whether an install predates the free flip, and therefore was paid for.
 *
 * Extracted as a pure function because the failure modes here are the
 * dangerous kind: treating an unknown install time as "very old" would
 * grandfather every user on the planet, and a null transition date must mean
 * "not flipped yet, grant nothing" rather than "grant everything".
 */
export function isGrandfatheredByInstallTime(
  firstInstallTime: number | null,
  transitionDate: number | null
): boolean {
  // Not flipped yet — nobody is grandfathered by install time.
  if (transitionDate == null) return false;
  // Unknown install time — never assume it was early.
  if (firstInstallTime == null) return false;
  if (!Number.isFinite(firstInstallTime) || firstInstallTime <= 0) return false;
  return firstInstallTime < transitionDate;
}

export async function getFirstInstallTime(): Promise<number | null> {
  if (Capacitor.getPlatform() !== "android") return null;

  try {
    const { firstInstallTime } = await InstallInfo.getFirstInstallTime();
    if (typeof firstInstallTime !== "number" || firstInstallTime <= 0) {
      return null;
    }
    return firstInstallTime;
  } catch {
    return null;
  }
}

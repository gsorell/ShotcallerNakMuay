import {
  FREE_IMPORT_LIMIT,
  SHARE_IMPORT_COUNT_KEY,
  SHARE_NAME_CONFIRMED_KEY,
  SHARE_SENDER_NAME_KEY,
} from "@/constants/storage";
import { SHARE_LIMITS } from "@/utils/styleShare";

/**
 * Local bookkeeping for style sharing: who this phone says it is, and how many
 * shared styles a free user has taken.
 *
 * Every read is defensive. localStorage throws outright in a locked-down
 * WebView and returns nonsense after a partial write, and neither is a reason
 * to break the editor.
 */

export const getSenderName = (): string => {
  try {
    return (localStorage.getItem(SHARE_SENDER_NAME_KEY) ?? "").slice(
      0,
      SHARE_LIMITS.senderName
    );
  } catch {
    return "";
  }
};

export const setSenderName = (name: string): void => {
  try {
    const trimmed = name.trim().slice(0, SHARE_LIMITS.senderName);
    if (trimmed) localStorage.setItem(SHARE_SENDER_NAME_KEY, trimmed);
    else localStorage.removeItem(SHARE_SENDER_NAME_KEY);
  } catch {
    /* a phone that cannot remember the name can still share */
  }
};

/**
 * A name for someone who never picked one.
 *
 * Deliberately generic — it is a "from" line on a message, not a persona, and
 * it must never read as a real fighter's name. The number keeps two people in
 * the same gym from looking like the same sender.
 */
export const generateSenderName = (): string =>
  `Nak Muay ${Math.floor(1000 + Math.random() * 9000)}`;

/**
 * The name to share under, assigning one on first use if needed.
 *
 * Assignment has to be lazy rather than onboarding-only: Pro users never see
 * onboarding (`if (isPro) return` in OnboardingProvider) and neither does
 * anyone who onboarded before this shipped — which is every existing user.
 * They would otherwise reach the share sheet with no name at all.
 */
export const ensureSenderName = (): string => {
  const existing = getSenderName();
  if (existing) return existing;
  const assigned = generateSenderName();
  setSenderName(assigned);
  return assigned;
};

/**
 * Whether the user has actually chosen their name, as opposed to having one
 * assigned. An assigned name gets one confirmation prompt at the first share;
 * a chosen one never does.
 */
export const hasConfirmedSenderName = (): boolean => {
  try {
    return localStorage.getItem(SHARE_NAME_CONFIRMED_KEY) === "1";
  } catch {
    // Unreadable storage would otherwise prompt on every single share.
    return true;
  }
};

export const markSenderNameConfirmed = (): void => {
  try {
    localStorage.setItem(SHARE_NAME_CONFIRMED_KEY, "1");
  } catch {
    /* the prompt reappearing is a smaller cost than failing the share */
  }
};

export const getImportCount = (): number => {
  try {
    const raw = Number(localStorage.getItem(SHARE_IMPORT_COUNT_KEY));
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  } catch {
    return 0;
  }
};

export const recordImport = (): void => {
  try {
    localStorage.setItem(SHARE_IMPORT_COUNT_KEY, String(getImportCount() + 1));
  } catch {
    /* worst case the cap is more generous than intended — not worth failing on */
  }
};

/**
 * Whether this user may import right now.
 *
 * Pro is unlimited. A free user gets {@link FREE_IMPORT_LIMIT} before the
 * paywall, and `remaining` is what the confirmation sheet shows so the cost of
 * saying yes is visible *before* they spend one.
 */
export const importAllowance = (isPro: boolean) => {
  if (isPro) return { allowed: true, remaining: Infinity, isCapped: false };
  const used = getImportCount();
  const remaining = Math.max(0, FREE_IMPORT_LIMIT - used);
  return { allowed: remaining > 0, remaining, isCapped: true };
};

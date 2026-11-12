/**
 * Fetch the paywall's plans, and say why when there are none.
 *
 * This replaced a `getPackages` that returned `[]` for three different
 * failures and reported none of them:
 *
 *   - the paywall opened before RevenueCat finished configuring, so it got an
 *     empty list and never asked again;
 *   - configuring failed outright, so every paywall that session was empty;
 *   - `getOfferings` threw, and the error went to `console.warn` only.
 *
 * GA4 showed the cost: from 2026-09-08 to 2026-11-11 about half of all Android
 * paywall dismissals carried `plans_loaded = false` (61 of 125), against 1 of
 * 283 on iOS. Those users were looking at "Plans aren't available" with
 * nothing to tap, and the funnel could not say which of the three it was.
 *
 * Kept free of React and of the RevenueCat import so the rules are testable.
 */

/** Which step produced no plans. */
export type PlansFailureStage =
  /** RevenueCat never finished configuring (no key, init threw, or timed out). */
  | "not_configured"
  /** `getOfferings` threw on every attempt. */
  | "offerings_error"
  /** The store answered, but the current offering had no packages. */
  | "empty_offering";

export interface PlansFailure {
  stage: PlansFailureStage;
  /** The store/RevenueCat error code, when there was one. */
  code: string | null;
  /** The error message, trimmed to fit a GA4 parameter (100 chars). */
  message: string | null;
  /** How many times `getOfferings` was called. */
  attempts: number;
}

export interface PlansResult<P> {
  packages: P[];
  /** Null when plans loaded. */
  failure: PlansFailure | null;
}

export interface LoadPlansDeps<P> {
  /** Resolves true once RevenueCat is configured, false if it never will be. */
  whenConfigured: () => Promise<boolean>;
  /** One `getOfferings` call, reduced to the current offering's packages. */
  fetchPackages: () => Promise<P[]>;
  /** How long to wait for configuring before giving up. */
  configureTimeoutMs?: number;
  /** Extra attempts after the first failed or empty fetch. */
  retries?: number;
  retryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const GA_PARAM_MAX = 100;

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** `{ code, message }` is what arrives across the Capacitor bridge. */
export function describePlansError(error: unknown): {
  code: string | null;
  message: string | null;
} {
  const err = error as { code?: unknown; message?: unknown } | null | undefined;
  const code =
    err && err.code !== undefined && err.code !== null ? String(err.code) : null;
  const raw =
    err && typeof err.message === "string"
      ? err.message
      : error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : null;
  const message = raw ? raw.slice(0, GA_PARAM_MAX) : null;
  return { code, message };
}

export async function loadPlans<P>(deps: LoadPlansDeps<P>): Promise<PlansResult<P>> {
  const {
    whenConfigured,
    fetchPackages,
    configureTimeoutMs = 10_000,
    retries = 1,
    retryDelayMs = 1_500,
    sleep = defaultSleep,
  } = deps;

  // Wait for configuring rather than answering "no plans" while it runs. A
  // timeout keeps a hung init from leaving the sheet on "Loading plans…".
  let timer: ReturnType<typeof setTimeout> | undefined;
  const configured = await Promise.race([
    whenConfigured(),
    new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), configureTimeoutMs);
    }),
  ]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });

  if (!configured) {
    return {
      packages: [],
      failure: { stage: "not_configured", code: null, message: null, attempts: 0 },
    };
  }

  let lastError: unknown = null;
  let sawEmpty = false;
  let attempts = 0;

  for (let i = 0; i <= retries; i++) {
    if (i > 0) await sleep(retryDelayMs);
    attempts++;
    try {
      const packages = await fetchPackages();
      if (packages.length > 0) return { packages, failure: null };
      sawEmpty = true;
      lastError = null;
    } catch (error) {
      lastError = error;
      sawEmpty = false;
    }
  }

  // Reports the last attempt's outcome: that is the state the user is left in.
  if (sawEmpty) {
    return {
      packages: [],
      failure: { stage: "empty_offering", code: null, message: null, attempts },
    };
  }
  return {
    packages: [],
    failure: { stage: "offerings_error", ...describePlansError(lastError), attempts },
  };
}

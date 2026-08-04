import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Capacitor } from "@capacitor/core";
import {
  LOG_LEVEL,
  Purchases,
  type CustomerInfo,
} from "@revenuecat/purchases-capacitor";

import type { EmphasisKey } from "@/types";

import {
  IOS_FREE_TRANSITION_BUILD,
  LEGACY_STAMP_ENABLED,
  PRO_ENTITLEMENT_ID,
  isFreeEmphasis,
} from "./constants";
import { getRevenueCatApiKey } from "./config";
import { isLegacyOwner, markLegacyOwner } from "./legacy";

// The full set of entitlement states the app can be in. `unknown` is the
// pre-resolution / offline state — callers should treat it as not-yet-Pro but
// avoid showing a hard paywall until `ready` is true.
export type EntitlementStatus =
  | "legacy_lifetime"
  | "subscribed"
  | "in_trial"
  | "free"
  | "unknown";

interface EntitlementContextValue {
  status: EntitlementStatus;
  /** True when the user has Pro access by any route (legacy, sub, or trial). */
  isPro: boolean;
  /** False until the first entitlement resolution completes. */
  ready: boolean;
  /** Whether a given fighting style is unlocked for this user. */
  isEmphasisUnlocked: (key: EmphasisKey) => boolean;
  /** Re-query the store for the latest entitlement state. */
  refresh: () => Promise<void>;
  /** Store-native "Restore Purchases" (same-account reinstalls). */
  restore: () => Promise<void>;
  /** Honor-system "I bought this before it went free" grant (Phase 0). */
  claimLegacyOwnership: () => Promise<void>;
}

const EntitlementContext = createContext<EntitlementContextValue | null>(null);

const PRO_STATUSES: ReadonlySet<EntitlementStatus> = new Set<EntitlementStatus>(
  ["legacy_lifetime", "subscribed", "in_trial"]
);

export function EntitlementProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<EntitlementStatus>("unknown");
  const [ready, setReady] = useState(false);
  const configuredRef = useRef(false);

  // Resolve the entitlement state from (optionally) a RevenueCat CustomerInfo,
  // applying the precedence: legacy flag → active entitlement → iOS original
  // version grandfathering → free.
  const evaluate = useCallback(async (customerInfo: CustomerInfo | null) => {
    if (await isLegacyOwner()) {
      setStatus("legacy_lifetime");
      return;
    }

    const entitlement = customerInfo?.entitlements.active[PRO_ENTITLEMENT_ID];
    if (entitlement) {
      setStatus(entitlement.periodType === "TRIAL" ? "in_trial" : "subscribed");
      return;
    }

    if (
      Capacitor.getPlatform() === "ios" &&
      IOS_FREE_TRANSITION_BUILD != null &&
      customerInfo?.originalApplicationVersion
    ) {
      const original = parseInt(customerInfo.originalApplicationVersion, 10);
      if (!Number.isNaN(original) && original < IOS_FREE_TRANSITION_BUILD) {
        await markLegacyOwner();
        setStatus("legacy_lifetime");
        return;
      }
    }

    setStatus("free");
  }, []);

  const refresh = useCallback(async () => {
    if (!configuredRef.current) {
      await evaluate(null);
      return;
    }
    try {
      const { customerInfo } = await Purchases.getCustomerInfo();
      await evaluate(customerInfo);
    } catch (error) {
      console.warn("[entitlement] getCustomerInfo failed", error);
    }
  }, [evaluate]);

  const restore = useCallback(async () => {
    if (!configuredRef.current) return;
    try {
      const { customerInfo } = await Purchases.restorePurchases();
      await evaluate(customerInfo);
    } catch (error) {
      console.warn("[entitlement] restorePurchases failed", error);
    }
  }, [evaluate]);

  const claimLegacyOwnership = useCallback(async () => {
    await markLegacyOwner();
    setStatus("legacy_lifetime");
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const native = Capacitor.isNativePlatform();

      // Phase 0: while the app is still paid, stamp every install as a legacy
      // owner (all current users are paying owners). Guarded so a persisted
      // flag isn't rewritten, and disabled in the later free release.
      if (LEGACY_STAMP_ENABLED && native && !(await isLegacyOwner())) {
        await markLegacyOwner();
      }

      const apiKey = native ? getRevenueCatApiKey() : null;

      // Web (PWA) or no key yet (pre-Task-6): skip RevenueCat, evaluate from
      // the legacy flag alone. Everyone else resolves to free-tier gating.
      if (!apiKey) {
        if (!cancelled) {
          await evaluate(null);
          setReady(true);
        }
        return;
      }

      try {
        await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
        await Purchases.configure({ apiKey });
        configuredRef.current = true;
        await Purchases.addCustomerInfoUpdateListener((customerInfo) => {
          if (!cancelled) void evaluate(customerInfo);
        });
        const { customerInfo } = await Purchases.getCustomerInfo();
        if (!cancelled) await evaluate(customerInfo);
      } catch (error) {
        console.warn("[entitlement] RevenueCat init failed", error);
        if (!cancelled) await evaluate(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, [evaluate]);

  const isPro = PRO_STATUSES.has(status);

  const isEmphasisUnlocked = useCallback(
    (key: EmphasisKey) => isFreeEmphasis(key) || isPro,
    [isPro]
  );

  const value: EntitlementContextValue = {
    status,
    isPro,
    ready,
    isEmphasisUnlocked,
    refresh,
    restore,
    claimLegacyOwnership,
  };

  return (
    <EntitlementContext.Provider value={value}>
      {children}
    </EntitlementContext.Provider>
  );
}

export function useEntitlement(): EntitlementContextValue {
  const ctx = useContext(EntitlementContext);
  if (!ctx) {
    throw new Error("useEntitlement must be used within an EntitlementProvider");
  }
  return ctx;
}

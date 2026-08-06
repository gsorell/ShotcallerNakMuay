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
  type PurchasesPackage,
} from "@revenuecat/purchases-capacitor";

import type { EmphasisKey } from "@/types";

import { PRO_ENTITLEMENT_ID, isFreeEmphasis } from "./constants";
import {
  ANDROID_FREE_TRANSITION_DATE,
  IOS_FREE_TRANSITION_BUILD,
  LEGACY_STAMP_ENABLED,
} from "./releaseConfig";
import { getRevenueCatApiKey } from "./config";
import { isDevProOverrideActive } from "./devOverride";
import {
  getFirstInstallTime,
  isGrandfatheredByInstallTime,
} from "./installInfo";
import { isLegacyOwner, markLegacyOwner } from "./legacy";
import { readCachedStatus, writeCachedStatus } from "./statusCache";

// The full set of entitlement states the app can be in. `unknown` is the
// pre-resolution / offline state — callers should treat it as not-yet-Pro but
// avoid showing a hard paywall until `ready` is true.
export type EntitlementStatus =
  | "legacy_lifetime"
  | "subscribed"
  | "in_trial"
  | "free"
  | "unknown";

export interface PurchaseResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
}

interface EntitlementContextValue {
  status: EntitlementStatus;
  /** True when the user has Pro access by any route (legacy, sub, or trial). */
  isPro: boolean;
  /** False until the first entitlement resolution completes. */
  ready: boolean;
  /**
   * True as soon as there is a trustworthy answer to render — either a real
   * resolution, or the cached result of the last one. Gate entitlement-
   * dependent UI on this rather than `ready`: `ready` waits on the network,
   * and rendering "locked" in the meantime makes lock badges flash on every
   * launch for users who actually have Pro.
   */
  hydrated: boolean;
  /** Whether a given fighting style is unlocked for this user. */
  isEmphasisUnlocked: (key: EmphasisKey) => boolean;
  /** Re-query the store for the latest entitlement state. */
  refresh: () => Promise<void>;
  /** Store-native "Restore Purchases" (same-account reinstalls). */
  restore: () => Promise<void>;
  /** Honor-system "I bought this before it went free" grant (Phase 0). */
  claimLegacyOwnership: () => Promise<void>;
  /** Packages from the current RevenueCat offering (empty if unavailable). */
  getPackages: () => Promise<PurchasesPackage[]>;
  /** Purchase a package; resolves entitlement state on success. */
  purchase: (pkg: PurchasesPackage) => Promise<PurchaseResult>;
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
  // Seed from the last resolved status so the first paint is already right for
  // returning users — see ./statusCache.
  const cachedStatus = useRef(readCachedStatus()).current;
  const [status, setStatusRaw] = useState<EntitlementStatus>(
    cachedStatus ?? "unknown"
  );
  const [ready, setReady] = useState(false);
  const configuredRef = useRef(false);

  // Every status change also refreshes the cache.
  const setStatus = useCallback((next: EntitlementStatus) => {
    setStatusRaw(next);
    writeCachedStatus(next);
  }, []);

  // Resolve the entitlement state from (optionally) a RevenueCat CustomerInfo,
  // applying the precedence: legacy flag → active entitlement → iOS original
  // version grandfathering → free.
  const evaluate = useCallback(async (customerInfo: CustomerInfo | null) => {
    // Dev-only browser preview override (?pro=1). Compiled out of production.
    if (isDevProOverrideActive()) {
      setStatus("subscribed");
      return;
    }

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

    // Android equivalent: a device that installed the app before the price
    // flip installed it while it still cost money, so that user paid. This
    // catches owners whose phone auto-updated to the free build before they
    // next opened the app, who therefore never got stamped.
    if (
      Capacitor.getPlatform() === "android" &&
      ANDROID_FREE_TRANSITION_DATE != null
    ) {
      const firstInstall = await getFirstInstallTime();
      // null means "unknown" — never treat a failed lookup as an old install.
      if (isGrandfatheredByInstallTime(firstInstall, ANDROID_FREE_TRANSITION_DATE)) {
        await markLegacyOwner();
        setStatus("legacy_lifetime");
        return;
      }
    }

    setStatus("free");
  }, [setStatus]);

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
  }, [setStatus]);

  const getPackages = useCallback(async (): Promise<PurchasesPackage[]> => {
    if (!configuredRef.current) return [];
    try {
      const offerings = await Purchases.getOfferings();
      return offerings.current?.availablePackages ?? [];
    } catch (error) {
      console.warn("[entitlement] getOfferings failed", error);
      return [];
    }
  }, []);

  const purchase = useCallback(
    async (pkg: PurchasesPackage): Promise<PurchaseResult> => {
      if (!configuredRef.current) {
        return { success: false, error: "Purchases are not available." };
      }
      try {
        const { customerInfo } = await Purchases.purchasePackage({
          aPackage: pkg,
        });
        await evaluate(customerInfo);
        return {
          success: !!customerInfo.entitlements.active[PRO_ENTITLEMENT_ID],
        };
      } catch (error) {
        const err = error as { userCancelled?: boolean; message?: string };
        if (err?.userCancelled) return { success: false, cancelled: true };
        console.warn("[entitlement] purchase failed", error);
        return { success: false, error: err?.message ?? "Purchase failed." };
      }
    },
    [evaluate]
  );

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const native = Capacitor.isNativePlatform();

      // Phase 0 (ANDROID ONLY): while the app is still paid, stamp every
      // install as a legacy owner — all current Android users are paying
      // owners, and Android has no retroactive ownership signal.
      //
      // iOS deliberately does NOT stamp: it grandfathers via
      // originalApplicationVersion (in `evaluate`), which recognizes existing
      // owners WITHOUT hiding the paywall from new installs — critical so the
      // App Review team (a fresh install) can actually reach and test the IAPs.
      if (
        LEGACY_STAMP_ENABLED &&
        Capacitor.getPlatform() === "android" &&
        !(await isLegacyOwner())
      ) {
        await markLegacyOwner();
      }

      // FAST PATH: legacy ownership is answerable from local storage alone —
      // no network needed. Resolve it before configuring RevenueCat so a
      // grandfathered owner is never rendered as locked while a network round
      // trip completes. RevenueCat still initializes below (purchases and
      // restores need it); it just no longer gates what these users see.
      if (!cancelled && (await isLegacyOwner())) {
        setStatus("legacy_lifetime");
        setReady(true);
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
  }, [evaluate, setStatus]);

  const isPro = PRO_STATUSES.has(status);
  // Safe to render entitlement-dependent UI: either resolved for real, or
  // seeded from the last resolution. Only a genuine first launch has neither.
  const hydrated = cachedStatus !== null || ready;

  const isEmphasisUnlocked = useCallback(
    (key: EmphasisKey) => isFreeEmphasis(key) || isPro,
    [isPro]
  );

  const value: EntitlementContextValue = {
    status,
    isPro,
    ready,
    hydrated,
    isEmphasisUnlocked,
    refresh,
    restore,
    claimLegacyOwnership,
    getPackages,
    purchase,
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

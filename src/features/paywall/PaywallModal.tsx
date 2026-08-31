import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import type { PurchasesPackage } from "@revenuecat/purchases-capacitor";

import { APP_STORE_URL, PLAY_STORE_URL } from "@/constants/storeLinks";
import { isLegacyClaimAvailable, useEntitlement } from "@/features/entitlement";
import { AnalyticsEvents, trackEvent } from "@/utils/analytics";
import { LegacyClaimSheet } from "./LegacyClaimSheet";
import {
  annualSavingsPercent,
  describeIntroOffer,
  monthlyEquivalent,
} from "./pricing";

const TERMS_URL = "https://shotcallernakmuay.netlify.app/terms.html";
const PRIVACY_URL = "https://shotcallernakmuay.netlify.app/privacy-policy.html";

interface PaywallModalProps {
  source?: string;
  onClose: () => void;
}

interface PackageMeta {
  period: string;
  badge?: string;
  order: number;
}

/** How the sheet was left. Everything except `purchase` is a lost sale. */
type DismissReason = "close_button" | "overlay";

// Human-readable labelling derived from the RevenueCat package type.
function metaFor(pkg: PurchasesPackage): PackageMeta {
  switch (pkg.packageType) {
    case "ANNUAL":
      return { period: "per year", badge: "Best value", order: 0 };
    case "MONTHLY":
      return { period: "per month", order: 1 };
    case "LIFETIME":
      return { period: "one-time", badge: "Own it forever", order: 2 };
    default:
      return { period: "", order: 3 };
  }
}

export const PaywallModal: React.FC<PaywallModalProps> = ({
  source,
  onClose,
}) => {
  const { getPackages, purchase, restore, claimLegacyOwnership } =
    useEntitlement();
  const [packages, setPackages] = useState<PurchasesPackage[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showLegacyClaim, setShowLegacyClaim] = useState(false);
  // The manual claim closes some time after the free flip — see legacyClaim.
  const legacyClaimOffered = useMemo(() => isLegacyClaimAvailable(), []);
  // In the browser there is no store to buy from, and there never will be —
  // RevenueCat is never configured, so plans cannot load, `purchase` refuses,
  // and `restore` is a no-op. Rather than surface that as a transient error,
  // the web build sends people to the app that can actually sell them Pro.
  const isWeb = !Capacitor.isNativePlatform();

  // When the sheet appeared, so a dismissal can report how long it was read.
  // A paywall closed in under a second is a misfire; one closed after twenty
  // is a price objection, and the two want opposite fixes.
  const openedAt = useRef(Date.now());
  // A purchase also unmounts the sheet, but it is not a dismissal.
  const purchasedRef = useRef(false);

  useEffect(() => {
    try {
      trackEvent(AnalyticsEvents.PaywallOpen, { source: source ?? "unknown" });
    } catch {}
  }, [source]);

  const dismiss = useCallback(
    (reason: DismissReason) => {
      if (!purchasedRef.current) {
        try {
          trackEvent(AnalyticsEvents.PaywallDismiss, {
            source: source ?? "unknown",
            reason,
            seconds_open: Math.round((Date.now() - openedAt.current) / 1000),
            // Whether they got as far as the store sheet before backing out.
            plans_loaded: packages !== null && packages.length > 0,
          });
        } catch {}
      }
      onClose();
    },
    [onClose, packages, source]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pkgs = await getPackages();
      if (!cancelled) setPackages(pkgs);
    })();
    return () => {
      cancelled = true;
    };
  }, [getPackages]);

  const sorted = useMemo(
    () =>
      (packages ?? [])
        .slice()
        .sort((a, b) => metaFor(a).order - metaFor(b).order),
    [packages]
  );

  // The saving is a property of the pair of plans, not of either one, so it is
  // computed once here rather than per row.
  const savings = useMemo(() => annualSavingsPercent(sorted), [sorted]);

  // The strongest thing we can say, if the store is offering it: a free trial
  // on any plan changes the ask from "pay now" to "try it". Surfaced in the
  // subtitle as well as on the row, because most people never read the rows.
  const trialOffer = useMemo(
    () => sorted.map(describeIntroOffer).find((o) => o?.isFreeTrial) ?? null,
    [sorted]
  );

  // Which row gets the visual weight. Annual is the one worth recommending —
  // it is the best value and the best retention — and a paywall where every
  // option looks identical asks the user to do the comparison themselves.
  const recommended = useMemo(
    () =>
      sorted.find((p) => p.packageType === "ANNUAL")?.identifier ??
      sorted[0]?.identifier ??
      null,
    [sorted]
  );

  const handlePurchase = async (pkg: PurchasesPackage) => {
    const intro = describeIntroOffer(pkg);
    try {
      // The tap itself, so the drop between "chose a plan" and "completed the
      // store sheet" is visible. That gap is a store problem, not a copy one.
      trackEvent(AnalyticsEvents.PaywallPlanTap, {
        source: source ?? "unknown",
        product: pkg.product.identifier,
        package_type: pkg.packageType,
        has_trial: !!intro?.isFreeTrial,
      });
    } catch {}

    setBusy(pkg.identifier);
    setMessage(null);
    const result = await purchase(pkg);
    setBusy(null);
    if (result.success) {
      purchasedRef.current = true;
      try {
        trackEvent(AnalyticsEvents.PaywallPurchaseSuccess, {
          source: source ?? "unknown",
          product: pkg.product.identifier,
          package_type: pkg.packageType,
          has_trial: !!intro?.isFreeTrial,
          // GA4 revenue reporting needs these two names specifically.
          value: pkg.product.price,
          currency: pkg.product.currencyCode,
        });
      } catch {}
      onClose();
    } else if (result.cancelled) {
      // User backed out at the store sheet; no message needed, but this is a
      // different loss from never tapping at all and is counted separately.
      try {
        trackEvent(AnalyticsEvents.PaywallPurchaseCancelled, {
          source: source ?? "unknown",
          product: pkg.product.identifier,
        });
      } catch {}
    } else {
      try {
        trackEvent(AnalyticsEvents.PaywallPurchaseError, {
          source: source ?? "unknown",
          product: pkg.product.identifier,
          error: result.error ?? "unknown",
        });
      } catch {}
      setMessage(result.error ?? "Something went wrong. Please try again.");
    }
  };

  const handleRestore = async () => {
    setBusy("restore");
    setMessage(null);
    await restore();
    setBusy(null);
    try {
      trackEvent(AnalyticsEvents.PaywallRestore, { source: source ?? "unknown" });
    } catch {}
    setMessage("If you had a purchase, it's been restored.");
  };

  const handleLegacyClaim = async (orderId: string) => {
    setBusy("legacy");
    await claimLegacyOwnership();
    setBusy(null);
    try {
      // Recorded so the real volume of manual claims is visible — both to spot
      // abuse and to know whether the automatic grandfathering is working.
      trackEvent(AnalyticsEvents.PaywallLegacyClaim, {
        order_id: orderId,
        source,
      });
    } catch {}
    setShowLegacyClaim(false);
    // A claim is an unlock, not an abandonment.
    purchasedRef.current = true;
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Unlock Shotcaller Pro"
      onClick={() => dismiss("overlay")}
      style={styles.overlay}
    >
      <div onClick={(e) => e.stopPropagation()} style={styles.sheet}>
        <button
          type="button"
          onClick={() => dismiss("close_button")}
          aria-label="Close"
          style={styles.close}
        >
          ✕
        </button>

        <h2 style={styles.title}>
          {trialOffer ? "Try Shotcaller Pro free" : "Unlock Shotcaller Pro"}
        </h2>
        <p style={styles.subtitle}>
          Every fighting style, the technique editor, advanced training options,
          and the full charm progression.
        </p>

        {/* Only ever rendered from a store-provided intro price, so it cannot
            claim a trial the store will not actually honour. */}
        {trialOffer && !isWeb && (
          <p style={styles.trialBanner}>
            Start with <strong>{trialOffer.label}</strong> — cancel anytime.
          </p>
        )}

        {isWeb && (
          <>
            <p style={styles.webNote}>
              Pro is unlocked in the mobile app. Grab it below, and your styles,
              lessons, and charms come with you.
            </p>
            <div style={styles.list}>
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noreferrer"
                style={styles.storeButton}
              >
                Download for iPhone &amp; iPad
              </a>
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noreferrer"
                style={styles.storeButton}
              >
                Download for Android
              </a>
            </div>
            <p style={styles.finePrint}>
              You can keep training free in this browser — the round timer,
              Freestyle, and Nak Muay Newb all work here.
            </p>
          </>
        )}

        {!isWeb && (
        <div style={styles.list}>
          {packages === null && <p style={styles.muted}>Loading plans…</p>}

          {packages !== null && sorted.length === 0 && (
            <p style={styles.muted}>
              Plans aren't available right now. Please check your connection and
              try again later.
            </p>
          )}

          {sorted.map((pkg) => {
            const meta = metaFor(pkg);
            const loading = busy === pkg.identifier;
            const intro = describeIntroOffer(pkg);
            const perMonth = monthlyEquivalent(pkg);
            const isRecommended = pkg.identifier === recommended;
            // The annual saving belongs on the annual row, and replaces the
            // generic "Best value" chip with the number behind it.
            const badge =
              pkg.packageType === "ANNUAL" && savings
                ? `Save ${savings}%`
                : meta.badge;
            return (
              <button
                key={pkg.identifier}
                type="button"
                disabled={!!busy}
                onClick={() => handlePurchase(pkg)}
                style={{
                  ...styles.plan,
                  ...(isRecommended ? styles.planRecommended : null),
                  opacity: busy && !loading ? 0.5 : 1,
                }}
              >
                <div style={{ textAlign: "left", minWidth: 0 }}>
                  <div style={styles.planTitle}>{pkg.product.title}</div>
                  <div style={styles.planPeriod}>
                    {pkg.product.priceString} {meta.period}
                    {perMonth && (
                      <span style={styles.planPerMonth}>
                        {" "}
                        · {perMonth}/mo
                      </span>
                    )}
                  </div>
                  {intro && (
                    <div style={styles.planIntro}>
                      {intro.isFreeTrial
                        ? `${intro.label}, then ${pkg.product.priceString}`
                        : intro.label}
                    </div>
                  )}
                </div>
                <div style={styles.planRight}>
                  {badge && (
                    <span
                      style={{
                        ...styles.badge,
                        ...(isRecommended ? styles.badgeRecommended : null),
                      }}
                    >
                      {badge}
                    </span>
                  )}
                  <span>
                    {loading ? "…" : intro?.isFreeTrial ? "Try free" : "Get"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        )}

        {message && <p style={styles.message}>{message}</p>}

        {/* Auto-renew terms only apply to a store subscription, which cannot
            be started from the browser. */}
        {!isWeb && (
          <p style={styles.finePrint}>
            {trialOffer
              ? "Your trial converts to a paid subscription unless cancelled at least 24 hours before it ends. "
              : ""}
            Subscriptions auto-renew unless cancelled at least 24 hours before
            the period ends. Manage or cancel anytime in your App Store or
            Google Play account settings.
          </p>
        )}

        <div style={styles.actions}>
          {/* `restore` returns early when RevenueCat was never configured, so
              on the web this button would claim success having done nothing. */}
          {!isWeb && (
            <button
              type="button"
              disabled={!!busy}
              onClick={handleRestore}
              style={styles.textButton}
            >
              Restore Purchases
            </button>
          )}
          <button
            type="button"
            disabled={!!busy}
            onClick={() => setShowLegacyClaim(true)}
            style={{
              ...styles.textButton,
              display: legacyClaimOffered ? undefined : "none",
            }}
          >
            I bought this before it went free
          </button>
        </div>

        <div style={styles.legal}>
          <a href={TERMS_URL} target="_blank" rel="noreferrer" style={styles.link}>
            Terms of Use
          </a>
          <span aria-hidden="true">·</span>
          <a
            href={PRIVACY_URL}
            target="_blank"
            rel="noreferrer"
            style={styles.link}
          >
            Privacy Policy
          </a>
        </div>
      </div>

      {showLegacyClaim && (
        <LegacyClaimSheet
          busy={busy === "legacy"}
          onConfirm={handleLegacyClaim}
          onCancel={() => setShowLegacyClaim(false)}
        />
      )}
    </div>
  );
};

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1rem",
    zIndex: 9999,
    backdropFilter: "blur(4px)",
  },
  sheet: {
    position: "relative",
    width: "100%",
    maxWidth: "26rem",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#1f2937",
    borderRadius: "1.25rem",
    padding: "1.75rem 1.5rem 1.5rem",
    color: "white",
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  },
  close: {
    position: "absolute",
    top: "0.75rem",
    right: "0.875rem",
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.6)",
    fontSize: "1.1rem",
    cursor: "pointer",
    lineHeight: 1,
  },
  title: {
    fontSize: "1.4rem",
    fontWeight: 800,
    margin: "0 0 0.5rem",
    textAlign: "center",
  },
  subtitle: {
    color: "#f9a8d4",
    fontSize: "0.9rem",
    textAlign: "center",
    margin: "0 0 1.25rem",
    lineHeight: 1.4,
  },
  trialBanner: {
    background: "rgba(37,99,235,0.18)",
    border: "1px solid rgba(96,165,250,0.45)",
    borderRadius: "0.75rem",
    color: "#dbeafe",
    fontSize: "0.9rem",
    lineHeight: 1.4,
    margin: "0 0 1rem",
    padding: "0.7rem 0.9rem",
    textAlign: "center",
  },
  list: { display: "flex", flexDirection: "column", gap: "0.75rem" },
  webNote: {
    color: "rgba(255,255,255,0.85)",
    fontSize: "0.9rem",
    lineHeight: 1.5,
    textAlign: "center",
    margin: "0 0 1.1rem",
  },
  storeButton: {
    display: "block",
    padding: "0.875rem 1rem",
    borderRadius: "0.875rem",
    border: "2px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 700,
    fontSize: "0.95rem",
    textAlign: "center",
    textDecoration: "none",
    width: "100%",
    // <a> defaults to content-box, unlike the <button> the plan rows use, so
    // without this the padding and border push it past the sheet.
    boxSizing: "border-box",
  },
  muted: {
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    fontSize: "0.9rem",
    padding: "1rem 0",
  },
  plan: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.5rem",
    padding: "0.875rem 1rem",
    borderRadius: "0.875rem",
    border: "2px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    cursor: "pointer",
    transition: "border 0.2s, background 0.2s",
    width: "100%",
  },
  // The recommended row carries the accent the rest of the app uses for the
  // primary action, so the eye lands on one option instead of three.
  planRecommended: {
    border: "2px solid #ec4899",
    background: "rgba(236,72,153,0.12)",
  },
  planTitle: { fontWeight: 700, fontSize: "1rem" },
  planPeriod: { color: "#f9a8d4", fontSize: "0.85rem", marginTop: "0.15rem" },
  planPerMonth: { color: "rgba(255,255,255,0.55)" },
  planIntro: {
    color: "#93c5fd",
    fontSize: "0.8rem",
    fontWeight: 600,
    marginTop: "0.2rem",
  },
  planRight: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontWeight: 700,
    flexShrink: 0,
  },
  badge: {
    background: "#2563eb",
    color: "white",
    fontSize: "0.65rem",
    fontWeight: 700,
    padding: "0.2rem 0.45rem",
    borderRadius: "0.5rem",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  badgeRecommended: { background: "#ec4899" },
  message: {
    color: "#fca5a5",
    fontSize: "0.85rem",
    textAlign: "center",
    margin: "0.75rem 0 0",
  },
  finePrint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: "0.7rem",
    lineHeight: 1.4,
    margin: "1rem 0 0",
    textAlign: "center",
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    marginTop: "0.75rem",
    alignItems: "center",
  },
  textButton: {
    background: "transparent",
    border: "none",
    color: "#93c5fd",
    fontSize: "0.85rem",
    cursor: "pointer",
    padding: "0.35rem",
  },
  legal: {
    display: "flex",
    gap: "0.5rem",
    justifyContent: "center",
    alignItems: "center",
    marginTop: "0.75rem",
    color: "rgba(255,255,255,0.4)",
    fontSize: "0.75rem",
  },
  link: { color: "rgba(255,255,255,0.6)", textDecoration: "underline" },
} satisfies Record<string, React.CSSProperties>;

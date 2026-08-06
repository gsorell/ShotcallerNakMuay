import React, { useMemo, useState } from "react";

import {
  orderIdHint,
  orderIdPlaceholder,
  validateOrderId,
} from "@/features/entitlement";

interface LegacyClaimSheetProps {
  /** Called with the validated order number once the user confirms. */
  onConfirm: (orderId: string) => void;
  onCancel: () => void;
  busy?: boolean;
}

/**
 * Confirmation step for the manual prior-purchase claim.
 *
 * Asking for the store order number is friction, not verification — with no
 * backend the app cannot check it. That is stated plainly below rather than
 * implied otherwise, because pretending to verify would be a lie to the user
 * and would not stop anyone determined anyway. What it does do is turn a
 * one-tap "unlock everything" button into a deliberate act, which is enough
 * to stop casual abuse, and it records the claim so real volume is visible.
 */
export const LegacyClaimSheet: React.FC<LegacyClaimSheetProps> = ({
  onConfirm,
  onCancel,
  busy = false,
}) => {
  const [orderId, setOrderId] = useState("");
  const [touched, setTouched] = useState(false);

  const check = useMemo(() => validateOrderId(orderId), [orderId]);
  const showError = touched && !check.valid;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!check.valid || busy) return;
    onConfirm(orderId.trim());
  };

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <form
        style={styles.sheet}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h2 style={styles.title}>Bought this before it went free?</h2>

        <p style={styles.body}>
          Almost everyone who paid for the app is unlocked automatically. If
          you're seeing this, that check didn't find your purchase — enter the
          order number from your receipt and we'll restore your access.
        </p>

        <label style={styles.label} htmlFor="legacy-order-id">
          Order number
        </label>
        <input
          id="legacy-order-id"
          style={{
            ...styles.input,
            borderColor: showError
              ? "rgba(220,38,38,0.6)"
              : "rgba(255,255,255,0.2)",
          }}
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={orderIdPlaceholder()}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          disabled={busy}
        />

        {showError ? (
          <p style={styles.error}>{check.error}</p>
        ) : (
          <p style={styles.hint}>{orderIdHint()}</p>
        )}

        <p style={styles.finePrint}>
          Claims are recorded. Please only do this if you actually bought the
          app — it's the honour system, and it's how we keep it available for
          the people who paid.
        </p>

        <div style={styles.actions}>
          <button
            type="submit"
            style={{
              ...styles.primary,
              opacity: busy || !check.valid ? 0.55 : 1,
            }}
            disabled={busy || !check.valid}
          >
            {busy ? "Restoring…" : "Restore my access"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={styles.secondary}
            disabled={busy}
          >
            Cancel
          </button>
        </div>
      </form>
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
    zIndex: 60,
    padding: "1rem",
    overflowY: "auto",
  },
  sheet: {
    width: "100%",
    maxWidth: "26rem",
    background: "rgb(15,23,42)",
    borderRadius: "1rem",
    border: "1px solid rgba(255,255,255,0.12)",
    padding: "1.25rem",
    boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
    display: "flex",
    flexDirection: "column",
  },
  title: {
    margin: "0 0 0.5rem",
    fontSize: "1.15rem",
    fontWeight: 800,
    color: "#fff",
  },
  body: {
    margin: "0 0 1rem",
    fontSize: "0.9rem",
    lineHeight: 1.5,
    color: "rgba(255,255,255,0.75)",
  },
  label: {
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#f9a8d4",
    marginBottom: "0.35rem",
  },
  input: {
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "0.5rem",
    padding: "0.65rem 0.75rem",
    color: "#fff",
    fontSize: "0.95rem",
    width: "100%",
    boxSizing: "border-box",
  },
  hint: {
    margin: "0.4rem 0 0",
    fontSize: "0.78rem",
    lineHeight: 1.45,
    color: "rgba(255,255,255,0.5)",
  },
  error: {
    margin: "0.4rem 0 0",
    fontSize: "0.78rem",
    lineHeight: 1.45,
    color: "#fca5a5",
  },
  finePrint: {
    margin: "0.9rem 0 0",
    fontSize: "0.75rem",
    lineHeight: 1.45,
    color: "rgba(255,255,255,0.45)",
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    marginTop: "1rem",
  },
  primary: {
    background:
      "linear-gradient(135deg, rgba(236,72,153,0.9) 0%, rgba(168,85,247,0.9) 100%)",
    border: "none",
    borderRadius: "0.75rem",
    padding: "0.8rem 1rem",
    color: "#fff",
    fontWeight: 700,
    fontSize: "0.95rem",
    cursor: "pointer",
  },
  secondary: {
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: "0.75rem",
    padding: "0.6rem 1rem",
    color: "rgba(255,255,255,0.6)",
    fontWeight: 600,
    fontSize: "0.9rem",
    cursor: "pointer",
  },
} satisfies Record<string, React.CSSProperties>;

export default LegacyClaimSheet;

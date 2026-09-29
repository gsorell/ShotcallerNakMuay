import { beforeEach, describe, expect, it } from "vitest";

import { FREE_IMPORT_LIMIT } from "@/constants/storage";
import {
  ensureSenderName,
  generateSenderName,
  getSenderName,
  hasConfirmedSenderName,
  importAllowance,
  markSenderNameConfirmed,
  recordImport,
  setSenderName,
} from "@/features/style-share";

// The app runs in a browser; the test runner does not.
const globalWithStorage = globalThis as { localStorage?: unknown };

function installLocalStorage() {
  const store = new Map<string, string>();
  globalWithStorage.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

/** Storage that throws on every access, as a locked-down WebView does. */
function installHostileStorage() {
  const boom = () => {
    throw new Error("storage disabled");
  };
  globalWithStorage.localStorage = {
    getItem: boom,
    setItem: boom,
    removeItem: boom,
    clear: boom,
  };
}

beforeEach(() => {
  installLocalStorage();
});

describe("sharing identity", () => {
  it("assigns a name to someone who never picked one", () => {
    // This is the majority path, not an edge case: Pro users never see
    // onboarding, and neither does anyone who onboarded before sharing
    // existed — so most users reach their first share with no name set.
    expect(getSenderName()).toBe("");

    const assigned = ensureSenderName();

    expect(assigned).not.toBe("");
    expect(getSenderName()).toBe(assigned);
  });

  it("keeps the same assigned name on later calls", () => {
    const first = ensureSenderName();
    expect(ensureSenderName()).toBe(first);
  });

  it("does not treat an assigned name as confirmed", () => {
    // An assigned name earns exactly one look before it goes out attached to
    // someone's style.
    ensureSenderName();
    expect(hasConfirmedSenderName()).toBe(false);
  });

  it("treats a chosen name as confirmed, so sharing stays one tap", () => {
    setSenderName("Jake");
    markSenderNameConfirmed();

    expect(getSenderName()).toBe("Jake");
    expect(hasConfirmedSenderName()).toBe(true);
  });

  it("generates names that are plainly not a real person", () => {
    const name = generateSenderName();
    expect(name).toMatch(/^Nak Muay \d{4}$/);
  });

  it("trims and caps an over-long name", () => {
    setSenderName(`   ${"x".repeat(200)}   `);
    expect(getSenderName().length).toBeLessThanOrEqual(32);
    expect(getSenderName().startsWith("x")).toBe(true);
  });

  it("clears the name when set to blank", () => {
    setSenderName("Jake");
    setSenderName("   ");
    expect(getSenderName()).toBe("");
  });

  it("does not prompt forever when storage throws", () => {
    installHostileStorage();
    // Unreadable storage must read as "already confirmed", or every single
    // share would stop to ask for a name it can never remember.
    expect(hasConfirmedSenderName()).toBe(true);
    expect(() => ensureSenderName()).not.toThrow();
  });
});

describe("free import allowance", () => {
  it("gives Pro unlimited imports", () => {
    const allowance = importAllowance(true);
    expect(allowance.allowed).toBe(true);
    expect(allowance.isCapped).toBe(false);
  });

  it("counts a free user down to the cap and then blocks", () => {
    for (let i = 0; i < FREE_IMPORT_LIMIT; i++) {
      expect(importAllowance(false).allowed).toBe(true);
      recordImport();
    }
    const spent = importAllowance(false);
    expect(spent.allowed).toBe(false);
    expect(spent.remaining).toBe(0);
  });

  it("does not let a corrupted counter grant extra imports", () => {
    localStorage.setItem("shotcaller_share_import_count", "not-a-number");
    expect(importAllowance(false).remaining).toBe(FREE_IMPORT_LIMIT);
  });
});

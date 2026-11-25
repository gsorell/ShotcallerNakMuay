import { describe, expect, it, vi } from "vitest";

import { describePlansError, loadPlans } from "@/features/entitlement/loadPlans";

const noSleep = () => Promise.resolve();

describe("loadPlans", () => {
  it("waits for configuring instead of answering empty", async () => {
    let configure!: (ok: boolean) => void;
    const configured = new Promise<boolean>((r) => (configure = r));
    const fetchPackages = vi.fn().mockResolvedValue(["annual"]);

    const pending = loadPlans({ whenConfigured: () => configured, fetchPackages, sleep: noSleep });
    await Promise.resolve();
    expect(fetchPackages).not.toHaveBeenCalled();

    configure(true);
    await expect(pending).resolves.toEqual({ packages: ["annual"], failure: null });
  });

  it("reports not_configured when RevenueCat never comes up", async () => {
    const fetchPackages = vi.fn();
    const result = await loadPlans({
      whenConfigured: () => Promise.resolve(false),
      fetchPackages,
    });
    expect(fetchPackages).not.toHaveBeenCalled();
    expect(result.failure).toEqual({ stage: "not_configured", code: null, message: null, attempts: 0 });
  });

  it("gives up waiting after the timeout", async () => {
    vi.useFakeTimers();
    try {
      const pending = loadPlans({
        whenConfigured: () => new Promise<boolean>(() => {}),
        fetchPackages: vi.fn(),
        configureTimeoutMs: 5000,
      });
      await vi.advanceTimersByTimeAsync(5000);
      expect((await pending).failure?.stage).toBe("not_configured");
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries a failed fetch and succeeds", async () => {
    const fetchPackages = vi
      .fn()
      .mockRejectedValueOnce({ code: "2", message: "Store problem" })
      .mockResolvedValueOnce(["monthly"]);
    const result = await loadPlans({
      whenConfigured: () => Promise.resolve(true),
      fetchPackages,
      sleep: noSleep,
    });
    expect(fetchPackages).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ packages: ["monthly"], failure: null });
  });

  it("reports the store error code after the retries run out", async () => {
    const fetchPackages = vi.fn().mockRejectedValue({ code: 2, message: "Store problem" });
    const result = await loadPlans({
      whenConfigured: () => Promise.resolve(true),
      fetchPackages,
      sleep: noSleep,
    });
    expect(result.packages).toEqual([]);
    expect(result.failure).toEqual({
      stage: "offerings_error",
      code: "2",
      message: "Store problem",
      attempts: 2,
    });
  });

  it("reports purchases_not_allowed without retrying", async () => {
    const message = "The device or user is not allowed to make the purchase.";
    const fetchPackages = vi.fn().mockRejectedValue({ code: "3", message });
    const result = await loadPlans({
      whenConfigured: () => Promise.resolve(true),
      fetchPackages,
      sleep: noSleep,
    });
    expect(fetchPackages).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      packages: [],
      failure: { stage: "purchases_not_allowed", code: "3", message, attempts: 1 },
    });
  });

  it("accepts the not-allowed code as a number too", async () => {
    const result = await loadPlans({
      whenConfigured: () => Promise.resolve(true),
      fetchPackages: vi.fn().mockRejectedValue({ code: 3, message: "Billing unavailable" }),
      sleep: noSleep,
    });
    expect(result.failure?.stage).toBe("purchases_not_allowed");
  });

  it("tells an empty offering apart from an error", async () => {
    const result = await loadPlans({
      whenConfigured: () => Promise.resolve(true),
      fetchPackages: vi.fn().mockResolvedValue([]),
      sleep: noSleep,
    });
    expect(result.failure?.stage).toBe("empty_offering");
  });
});

describe("describePlansError", () => {
  it("trims long messages to a GA4 parameter", () => {
    const { message } = describePlansError({ message: "x".repeat(300) });
    expect(message).toHaveLength(100);
  });

  it("handles Error objects, strings and nothing", () => {
    expect(describePlansError(new Error("boom"))).toEqual({ code: null, message: "boom" });
    expect(describePlansError("plain")).toEqual({ code: null, message: "plain" });
    expect(describePlansError(undefined)).toEqual({ code: null, message: null });
  });
});

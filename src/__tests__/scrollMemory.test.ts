import { beforeEach, describe, expect, it } from "vitest";

import {
  consumePageRestore,
  pageScrollKey,
  restoreOnNextPage,
} from "@/utils/scroll";

// Only the page handoff is covered here. Everything else in the module reaches
// for `.app-scroll`, and these tests run in node with no DOM — but the handoff
// is where the subtle behaviour is, so it is the part worth pinning.

describe("the back-navigation handoff", () => {
  beforeEach(() => {
    // Drain anything a previous test left pending.
    consumePageRestore();
  });

  it("has nothing pending by default, so navigation goes to the top", () => {
    expect(consumePageRestore()).toBeNull();
  });

  it("hands the key to the next page change", () => {
    restoreOnNextPage(pageScrollKey("timer"));
    expect(consumePageRestore()).toBe("page:timer");
  });

  it("is a one-shot", () => {
    // The whole reason this is a token rather than a flag: an unconsumed
    // request must not leak into a later, unrelated navigation. Tap back to the
    // timer, then tap Learn from the footer, and Learn must open at the top
    // rather than inheriting the back button's intent.
    restoreOnNextPage(pageScrollKey("timer"));
    expect(consumePageRestore()).toBe("page:timer");
    expect(consumePageRestore()).toBeNull();
  });

  it("keeps only the most recent request", () => {
    restoreOnNextPage(pageScrollKey("logs"));
    restoreOnNextPage(pageScrollKey("timer"));
    expect(consumePageRestore()).toBe("page:timer");
    expect(consumePageRestore()).toBeNull();
  });

  it("namespaces page keys so they cannot collide with a view key", () => {
    // Learn keeps "learn:shelf" for its own in-page position, which is a
    // different thing from where the Learn PAGE was scrolled to.
    expect(pageScrollKey("learn")).toBe("page:learn");
    expect(pageScrollKey("learn")).not.toBe("learn:shelf");
  });
});

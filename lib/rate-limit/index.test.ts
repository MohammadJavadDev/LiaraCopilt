import { describe, expect, it } from "vitest";

import { checkRateLimit } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  it("allows up to the configured limit and rejects the next request in the same window", () => {
    const key = `test-key-${Math.random()}`;

    for (let i = 0; i < 20; i += 1) {
      expect(checkRateLimit(key).allowed).toBe(true);
    }

    const blocked = checkRateLimit(key);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("tracks distinct keys independently", () => {
    const keyA = `test-key-a-${Math.random()}`;
    const keyB = `test-key-b-${Math.random()}`;

    for (let i = 0; i < 20; i += 1) {
      checkRateLimit(keyA);
    }

    expect(checkRateLimit(keyA).allowed).toBe(false);
    expect(checkRateLimit(keyB).allowed).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { retrieveDocs } from "@/lib/docs/retrieve";

describe("retrieveDocs", () => {
  it("returns real, grounded chunks for a known documentation topic", () => {
    const results = retrieveDocs("چطور یک دیتابیس PostgreSQL روی لیارا بسازم؟");

    expect(results.length).toBeGreaterThan(0);
    for (const { chunk, score } of results) {
      // Citation grounding contract (spec §6): every returned chunk is a real
      // doc chunk with a real docs.liara.ir URL — never a made-up source.
      expect(chunk.url.startsWith("https://docs.liara.ir")).toBe(true);
      expect(score).toBeGreaterThan(0);
    }
  });

  it("ranks the most topically relevant chunk first", () => {
    const results = retrieveDocs("چطور یک دیتابیس PostgreSQL روی لیارا بسازم؟");
    const topChunk = results[0].chunk;

    const mentionsDatabase = `${topChunk.title} ${topChunk.section}`.toLowerCase();
    expect(mentionsDatabase).toMatch(/postgres|دیتابیس|database/i);
  });

  it("returns nothing for queries with no real signal (spec §6: no fabricated sources)", () => {
    const results = retrieveDocs("۱۲۳ ؟؟؟ ...");
    expect(results).toEqual([]);
  });

  it("respects the topK option", () => {
    const results = retrieveDocs("چطور اپلیکیشن Next.js را روی لیارا دیپلوی کنم؟", { topK: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });
});

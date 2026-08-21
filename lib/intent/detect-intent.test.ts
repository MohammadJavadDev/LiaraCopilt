import { describe, expect, it } from "vitest";

import { detectIntent } from "@/lib/intent/detect-intent";

describe("detectIntent", () => {
  it("classifies deployment questions (demo scenario A)", () => {
    expect(detectIntent("چطور می‌توانم اپلیکیشن Next.js خودم را روی لیارا دیپلوی کنم؟")).toBe("deploy");
  });

  it("classifies error/troubleshooting questions (demo scenario B)", () => {
    expect(detectIntent("بعد از دیپلوی، اپلیکیشنم خطای 502 می‌دهد")).toBe("troubleshoot");
  });

  it("classifies plain documentation questions as qa (demo scenario C)", () => {
    expect(detectIntent("PostgreSQL چطور به پروژه وصل میشه؟")).toBe("qa");
  });

  it("prioritizes troubleshoot over deploy when both signals are present", () => {
    expect(detectIntent("دیپلوی می‌کنم ولی ارور می‌گیرم")).toBe("troubleshoot");
  });

  it("falls back to qa for empty input", () => {
    expect(detectIntent("")).toBe("qa");
  });
});

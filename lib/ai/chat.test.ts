import { describe, expect, it } from "vitest";

import { chatRequestSchema, getLastUserText, trimConversationHistory } from "@/lib/ai/chat";

const userMessage = (id: string, text: string) => ({
  id,
  role: "user" as const,
  parts: [{ type: "text", text }],
});

describe("chatRequestSchema", () => {
  it("accepts a minimal valid chat request", () => {
    const result = chatRequestSchema.safeParse({
      messages: [userMessage("m1", "سلام")],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a request with no messages", () => {
    const result = chatRequestSchema.safeParse({ messages: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a message part with no type field", () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ id: "m1", role: "user", parts: [{ text: "سلام" }] }],
    });
    expect(result.success).toBe(false);
  });
});

describe("trimConversationHistory", () => {
  it("keeps only the most recent N messages", () => {
    const messages = Array.from({ length: 12 }, (_, i) => userMessage(`m${i}`, `msg ${i}`));
    const trimmed = trimConversationHistory(messages, 8);
    expect(trimmed).toHaveLength(8);
    expect(trimmed[0].id).toBe("m4");
    expect(trimmed[7].id).toBe("m11");
  });
});

describe("getLastUserText", () => {
  it("extracts and concatenates the last user message's text parts", () => {
    const messages = [userMessage("m1", "سؤال اول"), userMessage("m2", "سؤال دوم")];
    expect(getLastUserText(messages)).toBe("سؤال دوم");
  });
});

import { z } from "zod";
import type { UIMessage } from "ai";

/**
 * Loose but real Zod validation for the `useChat` request body (spec §2:
 * "Zod for input/output validation"). We deliberately don't model every
 * possible UIMessage part variant (tool calls, files, reasoning, ...) since
 * this endpoint only ever needs to read text parts — anything else just
 * needs to survive round-tripping into `convertToModelMessages`.
 */
const uiMessagePartSchema = z.record(z.string(), z.unknown()).refine((part) => typeof part.type === "string", {
  message: "هر بخش پیام باید فیلد type داشته باشد.",
});

const uiMessageSchema = z
  .object({
    id: z.string(),
    role: z.enum(["system", "user", "assistant"]),
    metadata: z.unknown().optional(),
    parts: z.array(uiMessagePartSchema).min(1),
  })
  .passthrough();

export const chatRequestSchema = z.object({
  id: z.string().optional(),
  messages: z.array(uiMessageSchema).min(1, "حداقل یک پیام لازم است.").max(200),
});

export type ChatRequestBody = z.infer<typeof chatRequestSchema>;

/** Max number of most-recent messages sent to the model (spec §3/§8: last 6–8 turns, drop older). */
export const MAX_HISTORY_MESSAGES = 8;

/** Keeps only the most recent N messages, preserving order (simple truncation per spec §8). */
export function trimConversationHistory<T>(messages: T[], max: number = MAX_HISTORY_MESSAGES): T[] {
  if (messages.length <= max) return messages;
  return messages.slice(messages.length - max);
}

/** Extracts the plain-text content of the last user message, concatenating its text parts. */
export function getLastUserText(messages: ChatRequestBody["messages"]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "user") continue;

    return message.parts
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => (part.text as string))
      .join("\n")
      .trim();
  }
  return "";
}

/** Runtime cast after schema validation — safe because {@link chatRequestSchema} enforces the shape `convertToModelMessages` needs. */
export function toUIMessages(messages: ChatRequestBody["messages"]): UIMessage[] {
  return messages as unknown as UIMessage[];
}

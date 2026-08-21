import { generateText } from "ai";
import { z } from "zod";

import { HELPER_MAX_OUTPUT_TOKENS, getFastModel } from "@/lib/ai/model-config";
import { DEFAULT_CONVERSATION_TITLE } from "@/lib/conversations/types";

/**
 * Short conversation-title generation (PROJECT_SPEC §3/§9-b): uses the cheap
 * "fast" model — never the strong one — since this is a low-value helper
 * task, not the answer the user actually reads. Always degrades gracefully
 * (heuristic truncation) instead of failing the whole request.
 */
export const runtime = "nodejs";

const requestSchema = z.object({
  text: z.string().min(1).max(4000),
});

const TITLE_SYSTEM_PROMPT =
  "برای پیام کاربر یک عنوان بسیار کوتاه (حداکثر ۵ تا ۶ کلمه) و خنثی به زبان فارسی بنویس که موضوع را خلاصه کند. فقط خودِ عنوان را برگردان؛ بدون گیومه، بدون نقطه پایانی، بدون هیچ توضیح اضافه.";

function fallbackTitle(text: string): string {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return DEFAULT_CONVERSATION_TITLE;
  return normalized.length > 48 ? `${normalized.slice(0, 48)}…` : normalized;
}

function sanitizeTitle(raw: string): string {
  return raw
    .trim()
    .replace(/^["'«»]+|["'«»]+$/g, "")
    .replace(/[.\u06D4]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 60);
}

export async function POST(req: Request): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return Response.json({ title: DEFAULT_CONVERSATION_TITLE }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json({ title: DEFAULT_CONVERSATION_TITLE }, { status: 400 });
  }

  try {
    const { text } = await generateText({
      model: getFastModel(),
      system: TITLE_SYSTEM_PROMPT,
      prompt: parsed.data.text.slice(0, 2000),
      maxOutputTokens: HELPER_MAX_OUTPUT_TOKENS,
      temperature: 0.4,
    });

    const title = sanitizeTitle(text) || fallbackTitle(parsed.data.text);
    return Response.json({ title });
  } catch (error) {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "warn",
        scope: "title.generate",
        message: error instanceof Error ? error.message : String(error),
      })
    );
    return Response.json({ title: fallbackTitle(parsed.data.text) });
  }
}

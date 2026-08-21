import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
} from "ai";
import type { NextRequest } from "next/server";

import {
  chatRequestSchema,
  getLastUserText,
  toUIMessages,
  trimConversationHistory,
} from "@/lib/ai/chat";
import { CHAT_MAX_OUTPUT_TOKENS, CHAT_TEMPERATURE, getStrongModel } from "@/lib/ai/model-config";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { retrieveDocs } from "@/lib/docs/retrieve";

// Uses the Node.js filesystem (via lib/docs/load-docs) to read the ingested
// docs corpus, so this route cannot run on the Edge runtime.
export const runtime = "nodejs";

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function logEvent(event: Record<string, unknown>): void {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), ...event }));
}

export async function POST(req: NextRequest): Promise<Response> {
  const startedAt = Date.now();

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return errorResponse("بدنه‌ی درخواست JSON معتبر نیست.", 400);
  }

  const parsedBody = chatRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    logEvent({ level: "warn", scope: "chat.validation", issues: parsedBody.error.issues });
    return errorResponse("ساختار پیام‌های ارسالی نامعتبر است.", 400);
  }

  const trimmedMessages = trimConversationHistory(parsedBody.data.messages);
  const lastUserText = getLastUserText(trimmedMessages);

  if (!lastUserText) {
    return errorResponse("پیام کاربر خالی است.", 400);
  }

  const retrieved = retrieveDocs(lastUserText);
  const systemPrompt = buildSystemPrompt(retrieved.map(({ chunk }) => chunk));

  let result: ReturnType<typeof streamText>;
  try {
    result = streamText({
      model: getStrongModel(),
      system: systemPrompt,
      messages: await convertToModelMessages(toUIMessages(trimmedMessages)),
      maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
      temperature: CHAT_TEMPERATURE,
    });
  } catch (error) {
    logEvent({
      level: "error",
      scope: "chat.model_setup",
      message: error instanceof Error ? error.message : String(error),
    });
    return errorResponse("در دریافت پاسخ مشکلی پیش آمد.", 500);
  }

  const uniqueSources = new Map<string, { title: string; section: string; url: string }>();
  for (const { chunk } of retrieved) {
    if (!uniqueSources.has(chunk.url)) {
      uniqueSources.set(chunk.url, { title: chunk.title, section: chunk.section, url: chunk.url });
    }
  }

  logEvent({
    level: "info",
    scope: "chat.request",
    queryLength: lastUserText.length,
    retrievedChunks: retrieved.length,
    uniqueSources: uniqueSources.size,
    setupLatencyMs: Date.now() - startedAt,
  });

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      for (const source of uniqueSources.values()) {
        writer.write({
          type: "source-url",
          sourceId: source.url,
          url: source.url,
          title: `${source.title} — ${source.section}`,
        });
      }

      writer.merge(
        toUIMessageStream({
          stream: result.stream,
          onError: (error) => {
            logEvent({
              level: "error",
              scope: "chat.stream",
              message: error instanceof Error ? error.message : String(error),
            });
            return "در دریافت پاسخ مشکلی پیش آمد.";
          },
        })
      );
    },
    onError: (error) => {
      logEvent({
        level: "error",
        scope: "chat.stream_fatal",
        message: error instanceof Error ? error.message : String(error),
      });
      return "در دریافت پاسخ مشکلی پیش آمد.";
    },
  });

  return createUIMessageStreamResponse({ stream });
}

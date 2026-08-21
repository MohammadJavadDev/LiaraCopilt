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
  getSessionState,
  toUIMessages,
  trimConversationHistory,
} from "@/lib/ai/chat";
import { CHAT_MAX_OUTPUT_TOKENS, CHAT_TEMPERATURE, getStrongModel } from "@/lib/ai/model-config";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { retrieveDocs } from "@/lib/docs/retrieve";
import { detectIntent } from "@/lib/intent/detect-intent";
import { log, recordRequestMetric } from "@/lib/logging";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildAgenticInstructions, getFollowupSuggestions, updateSessionState } from "@/lib/session/memory";

// Uses the Node.js filesystem (via lib/docs/load-docs) to read the ingested
// docs corpus, so this route cannot run on the Edge runtime.
export const runtime = "nodejs";

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest): Promise<Response> {
  const startedAt = Date.now();
  const clientIp = getClientIp(req);

  const rateLimit = checkRateLimit(clientIp);
  if (!rateLimit.allowed) {
    log({ level: "warn", scope: "chat.rate_limit", clientIp, retryAfterMs: rateLimit.retryAfterMs });
    recordRequestMetric({ timestamp: startedAt, scope: "chat", success: false, latencyMs: Date.now() - startedAt });
    return errorResponse("تعداد درخواست‌ها زیاد شده. چند لحظه بعد دوباره امتحان کنید.", 429);
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    recordRequestMetric({ timestamp: startedAt, scope: "chat", success: false, latencyMs: Date.now() - startedAt });
    return errorResponse("بدنه‌ی درخواست JSON معتبر نیست.", 400);
  }

  const parsedBody = chatRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    log({ level: "warn", scope: "chat.validation", issues: parsedBody.error.issues });
    recordRequestMetric({ timestamp: startedAt, scope: "chat", success: false, latencyMs: Date.now() - startedAt });
    return errorResponse("ساختار پیام‌های ارسالی نامعتبر است.", 400);
  }

  const trimmedMessages = trimConversationHistory(parsedBody.data.messages);
  const lastUserText = getLastUserText(trimmedMessages);

  if (!lastUserText) {
    recordRequestMetric({ timestamp: startedAt, scope: "chat", success: false, latencyMs: Date.now() - startedAt });
    return errorResponse("پیام کاربر خالی است.", 400);
  }

  // Agentic layer (spec §7): local, zero-cost intent detection + session
  // memory refinement — never an extra LLM call.
  const intent = detectIntent(lastUserText);
  const sessionState = updateSessionState(getSessionState(parsedBody.data), lastUserText, intent);
  const agenticInstructions = buildAgenticInstructions(intent, sessionState);
  const followups = getFollowupSuggestions(intent, sessionState);

  const retrieved = retrieveDocs(lastUserText);
  const systemPrompt = buildSystemPrompt(retrieved.map(({ chunk }) => chunk), agenticInstructions);

  let result: ReturnType<typeof streamText>;
  try {
    result = streamText({
      model: getStrongModel(),
      system: systemPrompt,
      messages: await convertToModelMessages(toUIMessages(trimmedMessages)),
      maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
      temperature: CHAT_TEMPERATURE,
      onFinish: ({ finishReason, totalUsage }) => {
        const latencyMs = Date.now() - startedAt;
        log({
          level: "info",
          scope: "chat.finish",
          intent,
          finishReason,
          inputTokens: totalUsage.inputTokens,
          outputTokens: totalUsage.outputTokens,
          totalLatencyMs: latencyMs,
        });
        recordRequestMetric({
          timestamp: startedAt,
          scope: "chat",
          success: finishReason !== "error",
          latencyMs,
          intent,
          inputTokens: totalUsage.inputTokens,
          outputTokens: totalUsage.outputTokens,
        });
      },
    });
  } catch (error) {
    log({
      level: "error",
      scope: "chat.model_setup",
      message: error instanceof Error ? error.message : String(error),
    });
    recordRequestMetric({ timestamp: startedAt, scope: "chat", success: false, latencyMs: Date.now() - startedAt, intent });
    return errorResponse("در دریافت پاسخ مشکلی پیش آمد.", 500);
  }

  const uniqueSources = new Map<string, { title: string; section: string; url: string }>();
  for (const { chunk } of retrieved) {
    if (!uniqueSources.has(chunk.url)) {
      uniqueSources.set(chunk.url, { title: chunk.title, section: chunk.section, url: chunk.url });
    }
  }

  log({
    level: "info",
    scope: "chat.request",
    clientIp,
    intent,
    queryLength: lastUserText.length,
    retrievedChunks: retrieved.length,
    uniqueSources: uniqueSources.size,
    deploymentStep: sessionState.deploymentStep,
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

      if (followups.length > 0) {
        writer.write({ type: "data-followups", data: followups });
      }

      // Not part of the visible message — the client persists this into the
      // conversation record and echoes it back on the next turn (spec §7.4/§8).
      writer.write({ type: "data-session-state", data: sessionState, transient: true });

      writer.merge(
        toUIMessageStream({
          stream: result.stream,
          onError: (error) => {
            log({
              level: "error",
              scope: "chat.stream",
              message: error instanceof Error ? error.message : String(error),
            });
            recordRequestMetric({
              timestamp: startedAt,
              scope: "chat",
              success: false,
              latencyMs: Date.now() - startedAt,
              intent,
            });
            return "در دریافت پاسخ مشکلی پیش آمد.";
          },
        })
      );
    },
    onError: (error) => {
      log({
        level: "error",
        scope: "chat.stream_fatal",
        message: error instanceof Error ? error.message : String(error),
      });
      return "در دریافت پاسخ مشکلی پیش آمد.";
    },
  });

  return createUIMessageStreamResponse({ stream });
}

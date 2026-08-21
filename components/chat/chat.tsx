"use client";

import { useCallback, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { AlertTriangle } from "lucide-react";

import { ChatMessage, type MessagePhase } from "@/components/chat/message";
import { Composer } from "@/components/chat/composer";
import { WelcomeScreen } from "@/components/chat/welcome-screen";
import { Button } from "@/components/ui/button";
import { getConversation, upsertConversation } from "@/lib/conversations/storage";
import { DEFAULT_CONVERSATION_TITLE } from "@/lib/conversations/types";
import type { SessionState } from "@/lib/session/memory";

const PERSIST_DEBOUNCE_MS = 800;
const NEAR_BOTTOM_THRESHOLD_PX = 96;

function extractText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim();
}

/** The AI SDK client transport surfaces our route's JSON error body as raw response text on `error.message`. */
function getFriendlyErrorMessage(error: Error): string {
  try {
    const parsed = JSON.parse(error.message) as { error?: unknown };
    if (typeof parsed.error === "string" && parsed.error.trim()) return parsed.error;
  } catch {
    // Not JSON (network failure, etc.) — fall through to the generic message.
  }
  return "در دریافت پاسخ مشکلی پیش آمد.";
}

interface ChatProps {
  conversationId: string;
  initialMessages: UIMessage[];
  initialSessionState: SessionState;
}

/**
 * Owns one conversation's live chat state (spec §5/§9): streams answers via
 * `useChat`, persists to localStorage (debounced while streaming, immediate
 * once settled), triggers cheap-model title generation after the first user
 * message, and renders the welcome screen / message list / composer.
 * Persistence writes flow through `lib/conversations/storage`, which any
 * other component (e.g. the sidebar) can observe reactively via
 * `useConversations()` — no callback prop needed here.
 *
 * Also carries the personalization/deploy-step `sessionState` (spec
 * §7.4/§8): sent back to the server with every turn, refined there, and
 * streamed back as a transient `data-session-state` part so it can be
 * persisted alongside the messages for the next turn.
 */
export function Chat({ conversationId, initialMessages, initialSessionState }: ChatProps) {
  const sessionStateRef = useRef<SessionState>(initialSessionState);

  const { messages, sendMessage, status, stop, error, regenerate } = useChat({
    id: conversationId,
    messages: initialMessages,
    onData: (dataPart) => {
      if (dataPart.type === "data-session-state") {
        sessionStateRef.current = dataPart.data as SessionState;
      }
    },
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRequestedRef = useRef(false);

  const isBusy = status === "streaming" || status === "submitted";

  useEffect(() => {
    if (messages.length === 0) return;

    const persist = () => {
      const existing = getConversation(conversationId);
      upsertConversation({
        id: conversationId,
        title: existing?.title ?? DEFAULT_CONVERSATION_TITLE,
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        messages,
        sessionState: sessionStateRef.current,
      });
    };

    if (isBusy) {
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
      persistTimeoutRef.current = setTimeout(persist, PERSIST_DEBOUNCE_MS);
      return () => {
        if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
      };
    }

    persist();
  }, [messages, isBusy, conversationId]);

  // Cheap-model title generation after the very first user message (spec §3/§9-b) — never the strong model.
  useEffect(() => {
    if (titleRequestedRef.current || messages.length !== 1 || messages[0].role !== "user") {
      return;
    }
    const text = extractText(messages[0]);
    if (!text) return;
    titleRequestedRef.current = true;

    fetch("/api/title", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then((res) => res.json() as Promise<{ title?: string }>)
      .then((data) => {
        if (!data.title) return;
        const existing = getConversation(conversationId);
        upsertConversation({
          id: conversationId,
          title: data.title,
          createdAt: existing?.createdAt ?? Date.now(),
          updatedAt: Date.now(),
          messages: existing?.messages ?? messages,
        });
      })
      .catch(() => {
        // Non-critical — the conversation just keeps its default title.
      });
    // Deliberately excludes `messages` beyond the first run: this must fire exactly once per conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight });
  }, [messages]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < NEAR_BOTTOM_THRESHOLD_PX;
  }, []);

  const handleSend = useCallback(
    (text: string) => {
      shouldAutoScrollRef.current = true;
      sendMessage({ text }, { body: { sessionState: sessionStateRef.current } });
    },
    [sendMessage]
  );

  const handleRegenerate = useCallback(
    (messageId?: string) => {
      regenerate({ messageId, body: { sessionState: sessionStateRef.current } });
    },
    [regenerate]
  );

  const visibleMessages = messages.filter((message) => message.role !== "system");
  const lastMessageId = visibleMessages[visibleMessages.length - 1]?.id;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 sm:px-4">
        {visibleMessages.length === 0 ? (
          <WelcomeScreen onSelectPrompt={handleSend} />
        ) : (
          <div className="mx-auto w-full max-w-3xl divide-y divide-border/60 pb-4">
            {visibleMessages.map((message) => {
              const isLast = message.id === lastMessageId;
              const phase: MessagePhase =
                isLast && message.role === "assistant" && isBusy
                  ? status === "submitted"
                    ? "submitted"
                    : "streaming"
                  : undefined;

              return (
                <ChatMessage
                  key={message.id}
                  message={message}
                  phase={phase}
                  canRetry={message.role === "assistant" && !isBusy}
                  onRetry={() => handleRegenerate(message.id)}
                  onSelectFollowup={handleSend}
                />
              );
            })}

            {error && (
              <div className="my-3 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0" />
                  {getFriendlyErrorMessage(error)}
                </span>
                <Button variant="destructive" size="sm" onClick={() => handleRegenerate()}>
                  تلاش مجدد
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <Composer isStreaming={isBusy} onSend={handleSend} onStop={stop} />
    </div>
  );
}

import type { UIMessage } from "ai";

import type { SessionState } from "@/lib/session/memory";

/**
 * Client-side-only conversation record (PROJECT_SPEC §9-b): no backend/DB in
 * the MVP, persisted to localStorage. Matches the shape the spec calls for:
 * `{ id, title, createdAt, updatedAt, messages }`, plus `sessionState` —
 * the structured deploy-step/personalization memory from §7.4/§8, kept
 * alongside the message history rather than re-guessed from raw text.
 */
export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: UIMessage[];
  sessionState?: SessionState;
}

export const DEFAULT_CONVERSATION_TITLE = "گفتگوی جدید";

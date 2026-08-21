import type { UIMessage } from "ai";

/**
 * Client-side-only conversation record (PROJECT_SPEC §9-b): no backend/DB in
 * the MVP, persisted to localStorage. Matches the shape the spec calls for:
 * `{ id, title, createdAt, updatedAt, messages }`.
 */
export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: UIMessage[];
}

export const DEFAULT_CONVERSATION_TITLE = "گفتگوی جدید";

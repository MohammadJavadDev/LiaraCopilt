import type { Conversation } from "@/lib/conversations/types";

/**
 * localStorage-backed conversation persistence (PROJECT_SPEC §9-b). No
 * backend/DB dependency, so this stays deployable as-is on any platform.
 * All functions are safe to call during SSR (no-op) and never throw on
 * corrupt/blocked storage — conversation history is best-effort, not a
 * critical path for the chat itself.
 */

const STORAGE_KEY = "liara-copilot:conversations:v1";
const MAX_CONVERSATIONS = 100;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

type Listener = () => void;
const listeners = new Set<Listener>();

function notifyListeners(): void {
  for (const listener of listeners) listener();
}

/**
 * Subscribes to conversation-store changes (own-tab writes + cross-tab
 * `storage` events). Powers {@link useConversations} via
 * `useSyncExternalStore` so React components stay in sync with localStorage
 * without ad-hoc `setState`-in-effect calls.
 */
export function subscribeToConversations(listener: Listener): () => void {
  listeners.add(listener);

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) listener();
  };

  if (isBrowser()) {
    window.addEventListener("storage", handleStorageEvent);
  }

  return () => {
    listeners.delete(listener);
    if (isBrowser()) {
      window.removeEventListener("storage", handleStorageEvent);
    }
  };
}

function readAll(): Conversation[] {
  if (!isBrowser()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is Conversation =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.createdAt === "number" &&
        typeof item.updatedAt === "number" &&
        Array.isArray(item.messages)
    );
  } catch {
    return [];
  }
}

function writeAll(conversations: Conversation[]): void {
  if (!isBrowser()) return;

  try {
    const trimmed = conversations
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_CONVERSATIONS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage full/blocked (private browsing, quota, etc.) — non-fatal.
  }

  notifyListeners();
}

/** Returns all saved conversations, most recently updated first. */
export function listConversations(): Conversation[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getConversation(id: string): Conversation | undefined {
  return readAll().find((conversation) => conversation.id === id);
}

/** Creates or fully replaces a conversation record. */
export function upsertConversation(conversation: Conversation): void {
  const all = readAll();
  const index = all.findIndex((c) => c.id === conversation.id);
  if (index === -1) {
    all.push(conversation);
  } else {
    all[index] = conversation;
  }
  writeAll(all);
}

export function deleteConversation(id: string): void {
  writeAll(readAll().filter((conversation) => conversation.id !== id));
}

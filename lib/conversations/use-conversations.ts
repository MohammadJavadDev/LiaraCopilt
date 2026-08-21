"use client";

import { useSyncExternalStore } from "react";

import { listConversations, subscribeToConversations } from "@/lib/conversations/storage";
import type { Conversation } from "@/lib/conversations/types";

const EMPTY_CONVERSATIONS: Conversation[] = [];

function getServerSnapshot(): Conversation[] {
  return EMPTY_CONVERSATIONS;
}

/**
 * Reactive view of the localStorage conversation list. Uses
 * `useSyncExternalStore` (the React-sanctioned way to read an external
 * mutable source) instead of `useEffect` + `setState`, so the sidebar stays
 * in sync with every write — including ones made from a different
 * component (e.g. `<Chat>` persisting new messages) or browser tab.
 */
export function useConversations(): Conversation[] {
  return useSyncExternalStore(subscribeToConversations, listConversations, getServerSnapshot);
}

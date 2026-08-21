"use client";

import { useCallback, useMemo, useState } from "react";
import { nanoid } from "nanoid";
import { Menu } from "lucide-react";

import { Chat } from "@/components/chat/chat";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { deleteConversation, getConversation } from "@/lib/conversations/storage";
import { useConversations } from "@/lib/conversations/use-conversations";

/**
 * Top-level responsive shell (PROJECT_SPEC §9): permanent sidebar + main
 * chat on desktop, a header with a drawer on mobile. Owns which
 * conversation is active; the conversation list itself is read reactively
 * from localStorage via `useConversations`, and the actual chat
 * state/persistence lives in `<Chat>`, keyed by conversation id so
 * switching conversations resets it cleanly.
 */
export function CopilotApp() {
  const conversations = useConversations();
  const [activeConversationId, setActiveConversationId] = useState<string>(() => nanoid());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId),
    [conversations, activeConversationId]
  );

  const handleNewChat = useCallback(() => {
    setActiveConversationId(nanoid());
    setMobileMenuOpen(false);
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setMobileMenuOpen(false);
  }, []);

  const handleDeleteConversation = useCallback(
    (id: string) => {
      deleteConversation(id);
      if (id === activeConversationId) {
        setActiveConversationId(nanoid());
      }
    },
    [activeConversationId]
  );

  const sidebarProps = {
    conversations,
    activeConversationId,
    onNewChat: handleNewChat,
    onSelectConversation: handleSelectConversation,
    onDeleteConversation: handleDeleteConversation,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden w-72 shrink-0 border-l md:flex">
        <AppSidebar {...sidebarProps} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b p-2 md:hidden">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" />} aria-label="باز کردن منو">
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <SheetTitle className="sr-only">منوی مکالمه‌ها</SheetTitle>
              <AppSidebar {...sidebarProps} />
            </SheetContent>
          </Sheet>
          <span className="truncate text-sm font-semibold">
            {activeConversation?.title ?? "گفتگوی جدید"}
          </span>
          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-hidden">
          <Chat
            key={activeConversationId}
            conversationId={activeConversationId}
            initialMessages={getConversation(activeConversationId)?.messages ?? []}
          />
        </main>
      </div>
    </div>
  );
}

"use client";

import { Plus } from "lucide-react";

import { ConversationList } from "@/components/sidebar/conversation-list";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Conversation } from "@/lib/conversations/types";

interface AppSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
}

/** Desktop sidebar content (New Chat / Conversations / About — spec §9). Reused inside the mobile drawer too. */
export function AppSidebar({
  conversations,
  activeConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
}: AppSidebarProps) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="flex items-center gap-2 px-1">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
            L
          </div>
          <span className="text-sm font-semibold">لیارا کوپایلوت</span>
        </div>
        <ThemeToggle />
      </div>

      <div className="px-3">
        <Button variant="outline" className="w-full justify-start gap-2" onClick={onNewChat}>
          <Plus className="size-4" />
          گفتگوی جدید
        </Button>
      </div>

      <Separator className="my-3" />

      <div className="flex min-h-0 flex-1 flex-col px-2">
        <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">مکالمه‌ها</p>
        <ScrollArea className="min-h-0 flex-1">
          <ConversationList
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelect={onSelectConversation}
            onDelete={onDeleteConversation}
          />
        </ScrollArea>
      </div>

      <Separator className="my-3" />

      <div className="space-y-1 px-3 pb-3 text-xs text-muted-foreground">
        <p className="font-medium text-sidebar-foreground">درباره</p>
        <p>
          لیارا کوپایلوت بر اساس مستندات رسمی{" "}
          <a
            href="https://docs.liara.ir"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-primary"
          >
            docs.liara.ir
          </a>{" "}
          پاسخ می‌دهد؛ همیشه منابع پاسخ را بررسی کنید.
        </p>
      </div>
    </div>
  );
}

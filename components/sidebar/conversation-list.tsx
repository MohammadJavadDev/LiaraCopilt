"use client";

import { MessageSquare, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Conversation } from "@/lib/conversations/types";
import { cn } from "@/lib/utils";

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ConversationList({
  conversations,
  activeConversationId,
  onSelect,
  onDelete,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-xs text-muted-foreground">
        هنوز مکالمه‌ای ثبت نشده است.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {conversations.map((conversation) => {
        const isActive = conversation.id === activeConversationId;
        return (
          <li key={conversation.id} className="group relative">
            <button
              type="button"
              onClick={() => onSelect(conversation.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg py-2 pr-2.5 pl-9 text-right text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/90 hover:bg-sidebar-accent/60"
              )}
            >
              <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{conversation.title}</span>
            </button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="حذف مکالمه"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(conversation.id);
              }}
              className="absolute top-1/2 left-1.5 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

"use client";

import type { ComponentType, KeyboardEvent } from "react";
import { Database, Globe, Rocket, Wrench } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface SuggestedAction {
  icon: ComponentType<{ className?: string }>;
  title: string;
  prompt: string;
}

/** The 4 welcome-screen suggestion cards (PROJECT_SPEC §9: Deploy / Troubleshoot / Database / Domains). */
export const WELCOME_SUGGESTIONS: SuggestedAction[] = [
  {
    icon: Rocket,
    title: "دیپلوی یک اپلیکیشن",
    prompt: "چطور می‌توانم اپلیکیشن Next.js خودم را روی لیارا دیپلوی کنم؟",
  },
  {
    icon: Wrench,
    title: "رفع‌اشکال",
    prompt: "بعد از دیپلوی، اپلیکیشنم خطای 502 می‌دهد. چطور رفعش کنم؟",
  },
  {
    icon: Database,
    title: "دیتابیس",
    prompt: "چطور یک دیتابیس PostgreSQL بسازم و به اپلیکیشنم وصل کنم؟",
  },
  {
    icon: Globe,
    title: "دامنه",
    prompt: "چطور دامنه‌ی خودم را به اپلیکیشنم روی لیارا وصل کنم؟",
  },
];

interface SuggestedActionsProps {
  actions: SuggestedAction[];
  onSelect: (prompt: string) => void;
  className?: string;
}

/**
 * Clickable suggestion cards — used both on the welcome screen (fixed set
 * of 4) and, later, for personalized follow-up suggestions after an answer.
 * Clicking sends the exact prompt text as a real user message (spec §9:
 * "these buttons must actually send a real message, not just decorative UI").
 */
export function SuggestedActions({ actions, onSelect, className }: SuggestedActionsProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>, prompt: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(prompt);
    }
  }

  return (
    <div className={cn("grid grid-cols-1 gap-2.5 sm:grid-cols-2", className)}>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Card
            key={action.title}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(action.prompt)}
            onKeyDown={(event) => handleKeyDown(event, action.prompt)}
            className="cursor-pointer gap-1.5 p-3.5 text-right transition-colors hover:border-primary/40 hover:bg-accent"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <Icon className="size-4 text-primary" />
              {action.title}
            </div>
            <p className="line-clamp-2 text-xs text-muted-foreground">{action.prompt}</p>
          </Card>
        );
      })}
    </div>
  );
}

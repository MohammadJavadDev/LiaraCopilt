import type { UIMessage } from "ai";
import { ArrowLeft } from "lucide-react";

import type { FollowupSuggestion } from "@/lib/session/memory";

interface FollowupsProps {
  message: UIMessage;
  onSelect: (prompt: string) => void;
}

/**
 * Personalized "what's next" suggestions (spec §7.4) — clicking sends the
 * exact prompt as a real message. `data-followups` is a custom stream part
 * (server-defined, not part of the base `UIMessage` part union), so it's
 * read via a plain runtime check rather than a type-level `Extract`.
 */
export function Followups({ message, onSelect }: FollowupsProps) {
  const part = message.parts.find((p) => p.type === "data-followups") as
    | { type: "data-followups"; data?: unknown }
    | undefined;
  const suggestions = part?.data as FollowupSuggestion[] | undefined;

  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.prompt}
          type="button"
          onClick={() => onSelect(suggestion.prompt)}
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs transition-colors hover:border-primary/40 hover:bg-accent"
        >
          {suggestion.label}
          <ArrowLeft className="size-3 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

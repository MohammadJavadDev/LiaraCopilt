"use client";

import { useRef, type KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ComposerProps {
  isStreaming: boolean;
  disabled?: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  className?: string;
}

/** Message input: Enter to send, Shift+Enter for a newline, Stop button while streaming (spec §9/§13). */
export function Composer({ isStreaming, disabled, onSend, onStop, className }: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const value = textareaRef.current?.value.trim();
    if (!value || isStreaming || disabled) return;
    onSend(value);
    if (textareaRef.current) textareaRef.current.value = "";
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className={cn("mx-auto w-full max-w-3xl px-3 pb-3 sm:px-4 sm:pb-6", className)}>
      <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm focus-within:ring-3 focus-within:ring-ring/50">
        <Textarea
          ref={textareaRef}
          rows={1}
          maxLength={4000}
          placeholder="سؤال خودت را درباره‌ی دیپلوی، دیتابیس، دامنه یا رفع‌اشکال روی لیارا بپرس..."
          disabled={disabled}
          onKeyDown={handleKeyDown}
          className="max-h-48 resize-none border-none bg-transparent px-2 py-1.5 shadow-none focus-visible:ring-0"
        />
        {isStreaming ? (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label="توقف پاسخ"
            onClick={onStop}
            className="shrink-0"
          >
            <Square className="size-4" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            aria-label="ارسال پیام"
            disabled={disabled}
            onClick={submit}
            className="shrink-0"
          >
            <Send className="size-4 -scale-x-100" />
          </Button>
        )}
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        پاسخ‌ها بر اساس مستندات رسمی لیارا تولید می‌شوند و ممکن است شامل خطا باشند.
      </p>
    </div>
  );
}

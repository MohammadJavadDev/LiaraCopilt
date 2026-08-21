"use client";

import { isValidElement, useState, type ComponentProps, type ReactNode } from "react";
import type { UIMessage } from "ai";
import { Bot, Check, Copy, RotateCcw, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import { Sources } from "@/components/chat/sources";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

/** Recovers the plain-text content of a rendered node tree (works through rehype-highlight's `<span>` tokens). */
function getNodeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return getNodeText(node.props.children);
  return "";
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyButton({
  text,
  label,
  size = "icon-sm",
}: {
  text: string;
  label: string;
  size?: ComponentProps<typeof Button>["size"];
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size={size} />}
        aria-label={label}
        onClick={async () => {
          const ok = await copyToClipboard(text);
          if (ok) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }
        }}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </TooltipTrigger>
      <TooltipContent>{copied ? "کپی شد" : label}</TooltipContent>
    </Tooltip>
  );
}

/** Wraps every fenced code block with a "کپی کد" (copy code) button; always forced LTR (spec §9). */
function CodeBlockPre({ children, ...props }: ComponentProps<"pre">) {
  const code = getNodeText(children);

  return (
    <div className="group relative my-2" dir="ltr">
      <div className="absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <CopyButton text={code} label="کپی کد" size="icon-xs" />
      </div>
      <pre {...props}>{children}</pre>
    </div>
  );
}

const MARKDOWN_COMPONENTS = { pre: CodeBlockPre };
const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS = [rehypeHighlight];

function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="در حال نوشتن">
      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-current" />
    </span>
  );
}

/** `submitted` = request sent, no tokens yet (spec §9 loading copy). `streaming` = tokens arriving but no text part yet (rare/transient). */
export type MessagePhase = "submitted" | "streaming" | undefined;

interface ChatMessageProps {
  message: UIMessage;
  phase: MessagePhase;
  canRetry: boolean;
  onRetry: () => void;
}

export function ChatMessage({ message, phase, canRetry, onRetry }: ChatMessageProps) {
  const isUser = message.role === "user";
  const text = getMessageText(message);
  const showActions = !isUser && !phase && text.length > 0;

  return (
    <div className={cn("flex gap-3 py-3", isUser && "flex-row-reverse")}>
      <Avatar className="size-8 shrink-0 border">
        <AvatarFallback
          className={cn(isUser ? "bg-secondary" : "bg-primary text-primary-foreground")}
        >
          {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
        </AvatarFallback>
      </Avatar>

      <div className={cn("flex min-w-0 flex-1 flex-col gap-2", isUser && "items-end")}>
        <div
          className={cn(
            "max-w-full rounded-2xl px-4 py-2.5 text-sm leading-7 sm:max-w-[85%]",
            isUser ? "bg-primary text-primary-foreground" : "bg-muted"
          )}
        >
          {text ? (
            <div className="prose-chat">
              <ReactMarkdown
                remarkPlugins={REMARK_PLUGINS}
                rehypePlugins={REHYPE_PLUGINS}
                components={MARKDOWN_COMPONENTS}
              >
                {text}
              </ReactMarkdown>
            </div>
          ) : phase === "submitted" ? (
            <span className="text-muted-foreground">در حال بررسی مستندات لیارا...</span>
          ) : phase === "streaming" ? (
            <TypingIndicator />
          ) : null}
        </div>

        {!isUser && <Sources message={message} />}

        {showActions && (
          <div className="flex items-center gap-0.5">
            <CopyButton text={text} label="کپی پاسخ" />
            {canRetry && (
              <Tooltip>
                <TooltipTrigger
                  render={<Button variant="ghost" size="icon-sm" />}
                  aria-label="تلاش مجدد"
                  onClick={onRetry}
                >
                  <RotateCcw className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>تلاش مجدد</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

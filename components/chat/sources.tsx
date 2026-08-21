import type { UIMessage } from "ai";
import { BookOpen, ExternalLink } from "lucide-react";

/** Max Source Cards shown per answer (PROJECT_SPEC §6/§9: 3–5 max). */
const MAX_SOURCES_SHOWN = 5;

type SourceUrlPart = Extract<UIMessage["parts"][number], { type: "source-url" }>;

function isSourceUrlPart(part: UIMessage["parts"][number]): part is SourceUrlPart {
  return part.type === "source-url";
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "docs.liara.ir";
  }
}

interface SourcesProps {
  message: UIMessage;
}

/**
 * Renders the Source Cards for a message's `source-url` parts (written by
 * the server for every retrieved doc chunk — spec §6). Never fabricates a
 * URL: only ever links to whatever the server actually attached.
 */
export function Sources({ message }: SourcesProps) {
  const sources = message.parts.filter(isSourceUrlPart).slice(0, MAX_SOURCES_SHOWN);

  if (sources.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((source) => (
        <a
          key={source.sourceId}
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="group block w-56 shrink-0 rounded-xl border bg-card px-3 py-2 text-xs transition-colors hover:border-primary/40 hover:bg-accent"
        >
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <BookOpen className="size-3.5 shrink-0" />
            <span className="truncate">{extractHostname(source.url)}</span>
          </div>
          <p className="mt-1 line-clamp-2 font-medium text-foreground">
            {source.title ?? "مشاهده مستندات"}
          </p>
          <span className="mt-1 flex items-center gap-1 text-[11px] text-primary opacity-0 transition-opacity group-hover:opacity-100">
            مشاهده مستندات
            <ExternalLink className="size-3" />
          </span>
        </a>
      ))}
    </div>
  );
}

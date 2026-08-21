import { readFileSync } from "node:fs";
import path from "node:path";
import { DocChunkArraySchema, type DocChunk } from "@/lib/docs/types";

/**
 * Loads and validates `data/liara-docs.json` once per server process and
 * keeps it in memory (PROJECT_SPEC §3: "cache the parsed docs result, don't
 * re-parse per request"). Subsequent calls return the same cached array.
 */
let cachedChunks: DocChunk[] | null = null;

function readAndValidate(): DocChunk[] {
  const filePath = path.join(process.cwd(), "data", "liara-docs.json");

  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch (error) {
    throw new Error(
      `فایل مستندات (data/liara-docs.json) پیدا نشد یا خوانده نشد. دستور "npm run ingest" را اجرا کنید. جزئیات: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `فایل data/liara-docs.json حاوی JSON نامعتبر است: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  const result = DocChunkArraySchema.safeParse(parsedJson);
  if (!result.success) {
    throw new Error(
      `ساختار data/liara-docs.json با schema مورد انتظار (DocChunk[]) مطابقت ندارد: ${result.error.message}`
    );
  }

  if (result.data.length === 0) {
    throw new Error("data/liara-docs.json خالی است؛ ingestion را دوباره اجرا کنید.");
  }

  return result.data;
}

/** Returns all ingested documentation chunks (validated, cached across requests). */
export function getDocChunks(): DocChunk[] {
  if (!cachedChunks) {
    cachedChunks = readAndValidate();
  }
  return cachedChunks;
}

/** Test/dev-only helper to force a reload on the next {@link getDocChunks} call. */
export function invalidateDocChunksCache(): void {
  cachedChunks = null;
}

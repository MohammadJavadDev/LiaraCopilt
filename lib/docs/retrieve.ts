import { getDocChunks } from "@/lib/docs/load-docs";
import { normalizeFa, tokenizeFa } from "@/lib/docs/normalize-fa";
import type { DocChunk } from "@/lib/docs/types";

/**
 * Hybrid keyword retrieval over the ingested Liara docs corpus (PROJECT_SPEC
 * §4.2): weighted title/section/body matching + a boost for known technical
 * terms, all on top of Persian-normalized text. No vector DB — intentional
 * per spec, since the corpus is small enough that this scores well and is
 * far cheaper/faster to run per-request.
 */

export interface RetrievedChunk {
  chunk: DocChunk;
  score: number;
}

export interface RetrieveOptions {
  /** Max number of chunks to return. Spec §4.2/§6 recommend 4–6 fed to the model, ≤5 shown as sources. */
  topK?: number;
  /** Chunks scoring below this are treated as "not found" (spec §6 fallback message). */
  minScore?: number;
}

const WEIGHTS = {
  titleToken: 6,
  sectionToken: 3,
  bodyTokenFirst: 1.5,
  bodyTokenRepeat: 0.4,
  bodyTokenCap: 5,
  titlePhrase: 14,
  sectionPhrase: 8,
  keywordBoost: 5,
} as const;

const DEFAULT_TOP_K = 5;
const DEFAULT_MIN_SCORE = 4;

/**
 * High document-frequency Persian function words (pronouns, prepositions,
 * conjunctions, auxiliary verbs). Left in the query as-is for readability,
 * but excluded from scoring so they don't dilute matches with near-uniform
 * "noise score" across unrelated chunks that happen to repeat them often.
 */
const PERSIAN_STOPWORDS = new Set([
  "و", "یا", "را", "با", "از", "به", "در", "که", "این", "آن", "تا", "برای",
  "است", "هست", "هستم", "هستی", "هستیم", "هستند", "بود", "بودم", "بودی", "بودیم", "بودند",
  "شود", "شوم", "شوی", "شویم", "شوند", "می", "نمی", "باید", "نباید", "کنم", "کنی", "کنیم",
  "کنید", "کنند", "کرد", "کردم", "کردی", "کردیم", "کردند", "دارم", "داری", "دارد", "داریم",
  "دارند", "ندارم", "ندارد", "نیست", "من", "تو", "او", "ما", "شما", "آنها", "یک", "چه",
  "چطور", "چگونه", "چرا", "کجا", "کی", "هم", "نیز", "روی", "اش", "ام", "ات", "را",
]);


interface PreparedChunk {
  chunk: DocChunk;
  normalizedTitle: string;
  normalizedSection: string;
  titleTokens: Set<string>;
  sectionTokens: Set<string>;
  bodyTokenCounts: Map<string, number>;
  normalizedKeywords: string[];
}

let preparedCache: PreparedChunk[] | null = null;

function prepareChunk(chunk: DocChunk): PreparedChunk {
  const bodyTokenCounts = new Map<string, number>();
  for (const token of tokenizeFa(chunk.content)) {
    bodyTokenCounts.set(token, (bodyTokenCounts.get(token) ?? 0) + 1);
  }

  return {
    chunk,
    normalizedTitle: normalizeFa(chunk.title),
    normalizedSection: normalizeFa(chunk.section),
    titleTokens: new Set(tokenizeFa(chunk.title)),
    sectionTokens: new Set(tokenizeFa(chunk.section)),
    bodyTokenCounts,
    normalizedKeywords: (chunk.keywords ?? []).map((k) => normalizeFa(k)).filter(Boolean),
  };
}

function getPreparedChunks(): PreparedChunk[] {
  if (!preparedCache) {
    preparedCache = getDocChunks().map(prepareChunk);
  }
  return preparedCache;
}

function scoreBodyToken(count: number): number {
  if (count <= 0) return 0;
  const repeats = Math.min(count, WEIGHTS.bodyTokenCap) - 1;
  return WEIGHTS.bodyTokenFirst + repeats * WEIGHTS.bodyTokenRepeat;
}

function scoreChunk(
  queryTokens: string[],
  normalizedQuery: string,
  prepared: PreparedChunk
): number {
  let score = 0;

  const seenQueryTokens = new Set(queryTokens);
  for (const token of seenQueryTokens) {
    if (prepared.titleTokens.has(token)) score += WEIGHTS.titleToken;
    if (prepared.sectionTokens.has(token)) score += WEIGHTS.sectionToken;
    score += scoreBodyToken(prepared.bodyTokenCounts.get(token) ?? 0);
  }

  if (normalizedQuery.length >= 3) {
    if (prepared.normalizedTitle.includes(normalizedQuery)) score += WEIGHTS.titlePhrase;
    if (prepared.normalizedSection.includes(normalizedQuery)) score += WEIGHTS.sectionPhrase;
  }

  for (const keyword of prepared.normalizedKeywords) {
    if (keyword.length >= 2 && normalizedQuery.includes(keyword)) {
      score += WEIGHTS.keywordBoost;
    }
  }

  return score;
}

/**
 * Retrieves the top-scoring documentation chunks for a (Persian or English)
 * query. Returns an empty array when nothing scores above `minScore` — the
 * caller must then surface the "no reliable source found" fallback (spec §6).
 */
export function retrieveDocs(query: string, options: RetrieveOptions = {}): RetrievedChunk[] {
  const topK = options.topK ?? DEFAULT_TOP_K;
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;

  const normalizedQuery = normalizeFa(query);
  const queryTokens = tokenizeFa(query).filter((token) => !PERSIAN_STOPWORDS.has(token));
  if (queryTokens.length === 0) return [];

  const scored: RetrievedChunk[] = [];
  for (const prepared of getPreparedChunks()) {
    const score = scoreChunk(queryTokens, normalizedQuery, prepared);
    if (score >= minScore) {
      scored.push({ chunk: prepared.chunk, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

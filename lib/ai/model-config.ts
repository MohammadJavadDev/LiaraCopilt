import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

/**
 * Liara AI provider + two-tier model strategy (PROJECT_SPEC §3):
 *  - "fast" model: cheap/low-latency helper tasks (title generation, follow-up
 *    suggestions, local-intent-adjacent helpers). Never used for the final answer.
 *  - "strong" model: final technical answer generation only — the one axis
 *    the rubric weighs most heavily (80 points), so quality > cost here.
 *
 * All env access is lazy (inside functions, not at module load) so that
 * `next build` and route type-checking never fail just because
 * `.env.local` hasn't been populated yet.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `متغیر محیطی ${name} تنظیم نشده است. آن را در .env.local قرار دهید (نمونه در .env.example).`
    );
  }
  return value;
}

type LiaraAiProvider = ReturnType<typeof createOpenAICompatible>;

let cachedProvider: LiaraAiProvider | null = null;

function getLiaraProvider(): LiaraAiProvider {
  if (!cachedProvider) {
    cachedProvider = createOpenAICompatible({
      name: "liara-ai",
      baseURL: requireEnv("LIARA_AI_BASE_URL"),
      apiKey: requireEnv("LIARA_AI_API_KEY"),
    });
  }
  return cachedProvider;
}

/** Cheap/fast model — intent-adjacent helper tasks only (title gen, follow-ups). Never the final answer. */
export function getFastModel(): LanguageModel {
  return getLiaraProvider().languageModel(requireEnv("LIARA_AI_MODEL_FAST"));
}

/** Strong model — final technical answer generation only (highest-weight rubric axis). */
export function getStrongModel(): LanguageModel {
  return getLiaraProvider().languageModel(requireEnv("LIARA_AI_MODEL_STRONG"));
}

/** Output token ceiling for final answers (spec §3: keep responses to ~600–800 tokens). */
export const CHAT_MAX_OUTPUT_TOKENS = 700;

/** Low temperature — answers must stay grounded in retrieved docs, not creative. */
export const CHAT_TEMPERATURE = 0.3;

/** Small token budget for cheap helper tasks (title/follow-up generation, added in a later phase). */
export const HELPER_MAX_OUTPUT_TOKENS = 60;

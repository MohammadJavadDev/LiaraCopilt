import { normalizeFa } from "@/lib/docs/normalize-fa";

export type Intent = "deploy" | "troubleshoot" | "qa";

/**
 * Local, zero-cost intent classification (PROJECT_SPEC §5/§7): plain
 * keyword/regex matching on the normalized query, no extra LLM call. Order
 * matters — "troubleshoot" is checked first because a message can mention
 * both deploy and error words (e.g. "دیپلوی می‌کنم ولی ارور می‌گیرم"), and
 * the failure is the more urgent thing to address.
 */
const TROUBLESHOOT_PATTERNS: RegExp[] = [
  /خطا/,
  /ارور/,
  /error/i,
  /exception/i,
  /fail(ed|ure)?/i,
  /crash/i,
  /کار نمی\s?کند/,
  /کار نمیکنه/,
  /درست نمی\s?شود/,
  /درست نمیشه/,
  /(نمی|نمیشه|نمیشود)\s*(بالا|اجرا|باز)/,
  /not work(ing)?/i,
  /broken/i,
  /\b(4\d{2}|5\d{2})\b/, // HTTP status codes (404, 500, 502, ...)
  /econnrefused|econnreset|etimedout/i,
  /رفع\s?اشکال/,
  /دیباگ|debug/i,
  /مشکل/,
  /گیر کرد/,
  /لاگ.*(نشون|نشان|میده|می‌دهد)/,
];

const DEPLOY_PATTERNS: RegExp[] = [
  /دیپلوی/,
  /deploy/i,
  /استقرار/,
  /راه\s?اندازی/,
  /publish/i,
  /release/i,
  /روی\s?لیارا\s?ببرم/,
  /میزبانی/,
  /host(ing)?/i,
];

function matchesAny(patterns: RegExp[], text: string): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function detectIntent(text: string): Intent {
  const normalized = normalizeFa(text);
  if (!normalized) return "qa";

  if (matchesAny(TROUBLESHOOT_PATTERNS, normalized)) return "troubleshoot";
  if (matchesAny(DEPLOY_PATTERNS, normalized)) return "deploy";
  return "qa";
}

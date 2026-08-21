/**
 * Persian/Farsi text normalization for search matching (PROJECT_SPEC §4.2.3).
 *
 * Without this, queries written with Arabic-style letters, ZWNJ ("نیم‌فاصله"),
 * Arabic-Indic digits, or diacritics would fail to match documentation text
 * that happens to use a different (but equally valid) representation of the
 * same word. This is the single biggest risk to retrieval quality for a
 * Persian-language RAG system.
 */

const ARABIC_YEH_VARIANTS = /[\u064A\u0649\u06CC\u0620]/g; // ي, ى, ی, ؠ → ی
const ARABIC_KAF = /\u0643/g; // ك → ک
const ARABIC_HEH_VARIANTS = /[\u06C0\u06C1\u06C3]/g; // heh variants → ه
const ARABIC_ALEF_VARIANTS = /[\u0622\u0623\u0625\u0671]/g; // آ, أ, إ, ٱ → ا
const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D4-\u08E1\u08E3-\u08FF]/g;
const ZERO_WIDTH_CHARS = /[\u200C\u200D\u200E\u200F\u00AD]/g; // ZWNJ/ZWJ/LRM/RLM/soft-hyphen
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const TATWEEL = /\u0640/g; // ـ (kashida)

/**
 * Normalizes Persian/Arabic text so that equivalent writings of the same
 * word compare equal: unifies letter variants, strips diacritics/ZWNJ,
 * converts Persian/Arabic-Indic digits to ASCII, lowercases Latin runs
 * (for English technical terms typed inline), and collapses whitespace.
 */
export function normalizeFa(input: string): string {
  if (!input) return "";

  let out = input.normalize("NFKC");

  out = out
    .replace(ZERO_WIDTH_CHARS, " ") // half-space → regular space (word boundary)
    .replace(TATWEEL, "")
    .replace(ARABIC_DIACRITICS, "")
    .replace(ARABIC_YEH_VARIANTS, "ی")
    .replace(ARABIC_KAF, "ک")
    .replace(ARABIC_HEH_VARIANTS, "ه")
    .replace(ARABIC_ALEF_VARIANTS, "ا");

  out = out.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
  out = out.replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC_DIGITS.indexOf(d)));

  out = out.toLowerCase();
  out = out.replace(/\s+/g, " ").trim();

  return out;
}

const TOKEN_SPLIT_PATTERN = /[^\p{L}\p{N}._-]+/u;

/** Splits normalized text into search tokens, keeping dotted/hyphenated technical terms intact (e.g. "liara.json", "postgresql-14"). */
export function tokenizeFa(input: string): string[] {
  return normalizeFa(input)
    .split(TOKEN_SPLIT_PATTERN)
    .map((token) => token.replace(/^[._-]+|[._-]+$/g, ""))
    .filter(Boolean);
}

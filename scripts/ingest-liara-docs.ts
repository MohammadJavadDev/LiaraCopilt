/**
 * Ingests the real Liara documentation (github.com/liara-cloud/docs) into
 * data/liara-docs.json, chunked by heading (PROJECT_SPEC.md §4.1).
 *
 * The upstream docs are MDX files that mix plain markdown with custom JSX
 * components (<Highlight>, <Section>, <Tabs>, <Step>, <Table>, <Important>,
 * <Alert>, ...). There is no public "content API", so this script clones the
 * repo and converts each page's JSX into clean, retrieval-friendly text with
 * a purpose-built (regex-based) MDX-to-text pipeline — no invented content,
 * no invented URLs: every chunk's `url` is derived directly from the file's
 * real path in the source repo, matching the site's actual routing.
 *
 * Usage: npm run ingest
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractKeywords } from "../lib/docs/keywords";
import { DocChunkArraySchema, type DocChunk } from "../lib/docs/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const REPO_URL = "https://github.com/liara-cloud/docs.git";
const CACHE_DIR = path.join(PROJECT_ROOT, ".cache", "liara-docs-src");
const PAGES_ROOT = path.join(CACHE_DIR, "src", "pages");
const OUTPUT_PATH = path.join(PROJECT_ROOT, "data", "liara-docs.json");
const SITE_BASE_URL = "https://docs.liara.ir";

/** Path segments to skip entirely (not real platform docs, or off-topic). */
const EXCLUDED_SEGMENTS = new Set(["cookbook", "tv"]);

/**
 * The `ai/` subtree mostly mirrors generic Vercel AI SDK tutorial content
 * (ai-sdk-core, ai-sdk-ui, foundations, connect-to-service, per-provider
 * "getting started" pages, ...), which is not about the Liara platform and
 * is out of scope for a Liara deploy/database/domain/troubleshooting
 * assistant (PROJECT_SPEC.md's "do NOT build" / no-over-engineering rule).
 * Only the operational Liara-AI-service docs are kept.
 */
const AI_ALLOWED_TOP_LEVEL_FILES = new Set(["quick-start.mdx", "faq.mdx", "about.mdx"]);
const AI_ALLOWED_SUBDIRS = new Set(["details", "references"]);

function isIncludedPath(relPathPosix: string): boolean {
  const segments = relPathPosix.split("/");
  if (segments.some((seg) => EXCLUDED_SEGMENTS.has(seg))) return false;
  if (segments[0] === "ai") {
    if (segments.length === 2) return AI_ALLOWED_TOP_LEVEL_FILES.has(segments[1]);
    return AI_ALLOWED_SUBDIRS.has(segments[1]);
  }
  return true;
}

const MIN_CHUNK_CHARS = 20;

// ---------------------------------------------------------------------------
// 1. Fetch source
// ---------------------------------------------------------------------------

function ensureDocsRepo(): void {
  mkdirSync(path.dirname(CACHE_DIR), { recursive: true });
  if (existsSync(path.join(CACHE_DIR, ".git"))) {
    console.log(`[ingest] Using cached clone, pulling latest: ${CACHE_DIR}`);
    try {
      execFileSync("git", ["-C", CACHE_DIR, "fetch", "--depth", "1", "origin", "master"], {
        stdio: "inherit",
      });
      execFileSync("git", ["-C", CACHE_DIR, "reset", "--hard", "origin/master"], {
        stdio: "inherit",
      });
      return;
    } catch (err) {
      console.warn("[ingest] Cached clone update failed, re-cloning fresh.", err);
    }
  }
  console.log(`[ingest] Cloning ${REPO_URL} (depth=1) -> ${CACHE_DIR}`);
  execFileSync("git", ["clone", "--depth", "1", REPO_URL, CACHE_DIR], {
    stdio: "inherit",
  });
}

function walkMdxFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (EXCLUDED_SEGMENTS.has(entry)) continue;
      walkMdxFiles(fullPath, files);
    } else if (entry.endsWith(".mdx")) {
      const relPathPosix = path.relative(PAGES_ROOT, fullPath).split(path.sep).join("/");
      if (!isIncludedPath(relPathPosix)) continue;
      files.push(fullPath);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// 2. Category / platform labels (for the chunk `section` field)
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  paas: "استقرار برنامه (PaaS)",
  dbaas: "دیتابیس (DBaaS)",
  references: "مرجع",
  "object-storage": "فضای ذخیره‌سازی ابری (Object Storage)",
  "email-server": "سرور ایمیل",
  "dns-management-system": "مدیریت دامنه (DNS)",
  iaas: "سرورهای ابری (IaaS)",
  mirrors: "Mirror لیارا",
  "one-click-apps": "اپلیکیشن‌های یک‌کلیکی",
  overview: "معرفی لیارا",
  ai: "هوش مصنوعی لیارا",
};

const PLATFORM_LABELS: Record<string, string> = {
  nextjs: "Next.js",
  react: "React",
  vue: "Vue",
  angular: "Angular",
  static: "Static/HTML",
  laravel: "Laravel",
  django: "Django",
  flask: "Flask",
  go: "Go",
  dotnet: ".NET",
  node: "Node.js",
  nodejs: "Node.js",
  php: "PHP",
  python: "Python",
  wordpress: "WordPress",
  nuxt: "Nuxt",
  svelte: "Svelte",
  expo: "Expo",
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  mariadb: "MariaDB",
  redis: "Redis",
  rabbitmq: "RabbitMQ",
  mongodb: "MongoDB",
  mssql: "MSSQL",
  elasticsearch: "Elasticsearch",
  cli: "CLI",
  api: "API",
  console: "کنسول",
  team: "تیم‌ها",
};

function categoryLabel(relPathPosix: string): string {
  const segments = relPathPosix.split("/");
  const category = CATEGORY_LABELS[segments[0]] ?? segments[0];
  const platform = PLATFORM_LABELS[segments[1]];
  return platform ? `${category} / ${platform}` : category;
}

// ---------------------------------------------------------------------------
// 3. MDX -> plain text conversion pipeline
// ---------------------------------------------------------------------------

function replaceRepeated(
  text: string,
  regex: RegExp,
  replacer: (...args: string[]) => string
): string {
  let prev: string;
  let current = text;
  do {
    prev = current;
    current = current.replace(regex, replacer);
  } while (current !== prev);
  return current;
}

function protectCodeBlocks(text: string, blocks: string[]): string {
  return text.replace(
    /<Highlight[^>]*className=["']([\w+-]*)["'][^>]*>\s*\{`([\s\S]*?)`\}\s*<\/Highlight>/g,
    (_match, lang: string, code: string) => {
      const index = blocks.length;
      const cleanCode = code.replace(/\\`/g, "`").replace(/\\\$/g, "$").trimEnd();
      blocks.push("```" + (lang || "") + "\n" + cleanCode + "\n```");
      return `\n@@CODE${index}@@\n`;
    }
  );
}

function restoreCodeBlocks(text: string, blocks: string[]): string {
  return text.replace(/@@CODE(\d+)@@/g, (_m, i: string) => blocks[Number(i)] ?? "");
}

/** Finds the index of the closing (unescaped) backtick of a template literal, given the index right after the opening backtick. */
function findTemplateLiteralEnd(text: string, startIndex: number): number {
  for (let i = startIndex; i < text.length; i++) {
    if (text[i] === "\\") {
      i++;
      continue;
    }
    if (text[i] === "`") return i;
  }
  return -1;
}

/** Converts <HighlightTabs tabs={[{label, icon, language, code: `...`}, ...]}/> into fenced code per label. */
function convertHighlightTabs(text: string, blocks: string[]): string {
  const openRegex = /<HighlightTabs\s+tabs=\{\[/g;
  let result = "";
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = openRegex.exec(text))) {
    result += text.slice(cursor, match.index);
    const arrayStart = match.index + match[0].length - 1;
    const arrayEnd = findMatchingClose(text, arrayStart);
    if (arrayEnd === -1) {
      result += match[0];
      cursor = match.index + match[0].length;
      openRegex.lastIndex = cursor;
      continue;
    }
    const body = text.slice(arrayStart + 1, arrayEnd);
    const afterArray = text.slice(arrayEnd + 1);
    const closeMatch = afterArray.match(/^\}\s*\/>/);
    const consumedEnd = arrayEnd + 1 + (closeMatch ? closeMatch[0].length : 1);

    let out = "\n\n";
    const itemRegex = /label:\s*["']([^"']*)["'][\s\S]*?language:\s*["']([^"']*)["'],?\s*\n\s*code:\s*`/g;
    let im: RegExpExecArray | null;
    while ((im = itemRegex.exec(body))) {
      const label = im[1];
      const language = im[2];
      const codeStart = im.index + im[0].length;
      const codeEnd = findTemplateLiteralEnd(body, codeStart);
      if (codeEnd === -1) break;
      const code = body.slice(codeStart, codeEnd).replace(/\\`/g, "`").replace(/\\\$/g, "$").trimEnd();
      const blockIndex = blocks.length;
      blocks.push("```" + language + "\n" + code + "\n```");
      out += `\n\n**${label}:**\n@@CODE${blockIndex}@@\n`;
      itemRegex.lastIndex = codeEnd;
    }
    result += out + "\n\n";
    cursor = consumedEnd;
    openRegex.lastIndex = cursor;
  }
  result += text.slice(cursor);
  return result;
}

/** Converts <QuestionBox question="..." answer={<>...</>} /> FAQ-accordion items into markdown Q&A. */
function convertQuestionBox(text: string): string {
  const openRegex = /<QuestionBox\b/g;
  let result = "";
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = openRegex.exec(text))) {
    result += text.slice(cursor, match.index);
    const headMatch = text
      .slice(match.index)
      .match(/^<QuestionBox\b[\s\S]*?question=["']([^"']*)["'][\s\S]*?answer=\{/);
    if (!headMatch) {
      result += "<QuestionBox";
      cursor = match.index + "<QuestionBox".length;
      openRegex.lastIndex = cursor;
      continue;
    }
    const question = headMatch[1];
    const answerBraceIndex = match.index + headMatch[0].length - 1;
    const answerEnd = findMatchingClose(text, answerBraceIndex);
    if (answerEnd === -1) {
      result += headMatch[0];
      cursor = match.index + headMatch[0].length;
      openRegex.lastIndex = cursor;
      continue;
    }
    const answerBody = text
      .slice(answerBraceIndex + 1, answerEnd)
      .replace(/^\s*<>/, "")
      .replace(/<\/>\s*$/, "");
    const afterAnswer = text.slice(answerEnd + 1);
    const closeMatch = afterAnswer.match(/^\s*\/>/);
    const consumedEnd = answerEnd + 1 + (closeMatch ? closeMatch[0].length : 0);
    result += `\n\n#### ${question}\n\n${answerBody.trim()}\n\n`;
    cursor = consumedEnd;
    openRegex.lastIndex = cursor;
  }
  result += text.slice(cursor);
  return result;
}

function stripJsxComments(text: string): string {
  return text.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

function stripImports(text: string): string {
  // Handles both single-line (`import Foo from "bar";`) and multi-line
  // (`import {\n  Foo,\n  Bar,\n} from "baz";`) import statements.
  return text.replace(/^[ \t]*import\s[^;]*?;[ \t]*$/gm, "");
}

function extractTitleAndStripHead(text: string): { text: string; headTitle: string | null } {
  const headMatch = text.match(/<Head>([\s\S]*?)<\/Head>/);
  let headTitle: string | null = null;
  if (headMatch) {
    const titleMatch = headMatch[1].match(/<title>([\s\S]*?)<\/title>/);
    if (titleMatch) {
      headTitle = titleMatch[1].replace(/\s*-\s*لیارا\s*$/, "").trim();
    }
  }
  return { text: text.replace(/<Head>[\s\S]*?<\/Head>/, ""), headTitle };
}

function stripLayoutAndMedia(text: string): string {
  return text
    .replace(/<\/?Layout>/g, "")
    .replace(/<video\b[\s\S]*?<\/video>/g, "")
    .replace(/<img\b[^>]*\/?>/g, "")
    .replace(/<Asciinema\b[^>]*\/>/g, "")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<hr\b[^>]*\/?>/g, "\n\n");
}

function extractH1(text: string): { text: string; h1: string | null } {
  const match = text.match(/^[ \t]*#[ \t]+(.+)$/m);
  if (!match) return { text, h1: null };
  return { text: text.replace(match[0], ""), h1: match[1].trim() };
}

/** Replaces <Section id="x" title="y" /> with a plain, regex-safe marker. */
function markSections(text: string): string {
  return text.replace(/<Section\s+([^/]*?)\/>/g, (_m, attrs: string) => {
    const id = attrs.match(/id=["']([^"']*)["']/)?.[1] ?? "";
    const title = attrs.match(/title=["']([^"']*)["']/)?.[1] ?? "";
    return `\n\n@@SECTION#${id}#${title}@@\n\n`;
  });
}

/** Converts <Step steps={[{step, content: (<>...</>)}, ...]}/> to markdown. */
function convertSteps(text: string): string {
  return text.replace(/<Step\s+steps=\{\[([\s\S]*?)\]\}\s*\/>/g, (_m, arrayBody: string) => {
    const stepRegex = /\{\s*step:\s*["']([^"']*)["']\s*,\s*content:\s*\(([\s\S]*?)\)\s*\}\s*,?/g;
    let out = "";
    let sm: RegExpExecArray | null;
    while ((sm = stepRegex.exec(arrayBody))) {
      const stepContent = sm[2]
        .trim()
        .replace(/^<>/, "")
        .replace(/<\/>\s*$/, "")
        .trim();
      out += `\n\n**قدم ${sm[1]}:** ${stepContent}\n\n`;
    }
    return out || "\n";
  });
}

/** Finds the index of the bracket that closes the one at `openIndex`, tracking depth of that bracket type only. */
function findMatchingClose(text: string, openIndex: number): number {
  const openChar = text[openIndex];
  const closeChar = openChar === "[" ? "]" : openChar === "{" ? "}" : openChar === "(" ? ")" : null;
  if (!closeChar) return -1;
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === openChar) depth++;
    else if (text[i] === closeChar) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Converts <Tabs tabs={[...]} content={[<>...</>, ...]}/> to labelled
 * sections. Uses bracket-depth matching (not naive regex) because these
 * docs sometimes nest a <Tabs> inside another <Tabs>'s content (e.g. one
 * tab per SDK, each containing one tab per programming language).
 */
function convertTabs(text: string): string {
  const openRegex = /<Tabs\s+tabs=\{\[/g;
  let result = "";
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = openRegex.exec(text))) {
    if (match.index < cursor) continue;
    result += text.slice(cursor, match.index);

    const tabsArrayStart = match.index + match[0].length - 1;
    const tabsArrayEnd = findMatchingClose(text, tabsArrayStart);
    if (tabsArrayEnd === -1) {
      result += match[0];
      cursor = match.index + match[0].length;
      openRegex.lastIndex = cursor;
      continue;
    }
    const tabsBody = text.slice(tabsArrayStart + 1, tabsArrayEnd);

    const afterTabsArray = text.slice(tabsArrayEnd + 1);
    const contentOpenMatch = afterTabsArray.match(/^\}\s*content=\{\[/);
    if (!contentOpenMatch) {
      result += text.slice(match.index, tabsArrayEnd + 1);
      cursor = tabsArrayEnd + 1;
      openRegex.lastIndex = cursor;
      continue;
    }
    const contentArrayStart = tabsArrayEnd + 1 + contentOpenMatch[0].length - 1;
    const contentArrayEnd = findMatchingClose(text, contentArrayStart);
    if (contentArrayEnd === -1) {
      result += text.slice(match.index, contentArrayStart + 1);
      cursor = contentArrayStart + 1;
      openRegex.lastIndex = cursor;
      continue;
    }
    const contentBody = text.slice(contentArrayStart + 1, contentArrayEnd);

    const afterContentArray = text.slice(contentArrayEnd + 1);
    const closeMatch = afterContentArray.match(/^\}\s*\/>/);
    const consumedEnd = contentArrayEnd + 1 + (closeMatch ? closeMatch[0].length : 1);

    // Recurse first so nested Tabs/Step blocks are fully resolved before we
    // split this level's content into per-tab segments.
    const processedContentBody = convertTabs(convertSteps(contentBody));

    let labels = Array.from(tabsBody.matchAll(/label\s*:\s*["']([^"']*)["']/g)).map((mm) => mm[1]);
    if (labels.length === 0) {
      labels = Array.from(tabsBody.matchAll(/["']([^"']*)["']/g)).map((mm) => mm[1]);
    }
    const segments = processedContentBody
      .split(/<>|<\/>/)
      .map((seg) => seg.replace(/^[,\s]+|[,\s]+$/g, ""))
      .filter((seg) => seg.length > 0);

    let converted = "\n\n";
    segments.forEach((seg, i) => {
      const label = labels[i] ?? `روش ${i + 1}`;
      converted += `\n\n**روش «${label}»:**\n${seg}\n`;
    });
    result += `${converted}\n\n`;

    cursor = consumedEnd;
    openRegex.lastIndex = cursor;
  }
  result += text.slice(cursor);
  return result;
}

/** Converts `{[{title|platform, link}, ...].map(item => <Card>...)}` link-list widgets to bullet lists. */
function convertRelatedLinksMap(text: string): string {
  return text.replace(
    /\{\s*\[([\s\S]*?)\]\s*\.map\(\s*\(?\w+[^)]*\)?\s*=>[\s\S]*?\)\s*\}/g,
    (_m, arrayBody: string) => {
      const items = Array.from(
        arrayBody.matchAll(/(?:platform|title|name)\s*:\s*['"]([^'"]*)['"]/g)
      ).map((mm) => mm[1]);
      if (items.length === 0) return "";
      return "\n\n" + items.map((label) => `- ${label}`).join("\n") + "\n\n";
    }
  );
}

function flattenJsxToText(input: string): string {
  let text = input;
  text = text.replace(/<Important>([\s\S]*?)<\/Important>/g, (_m, inner: string) => `\`${inner.trim()}\``);
  text = replaceRepeated(text, /<a\b[^>]*>([\s\S]*?)<\/a>/gi, (_m, inner: string) => inner);
  text = replaceRepeated(text, /<Link\b[^>]*>([\s\S]*?)<\/Link>/g, (_m, inner: string) => inner);
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_m, inner: string) => `\n# ${inner.trim()}\n`);
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_m, inner: string) => `\n## ${inner.trim()}\n`);
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_m, inner: string) => `\n### ${inner.trim()}\n`);
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_m, inner: string) => `\n#### ${inner.trim()}\n`);
  text = text.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, (_m, inner: string) => `\n##### ${inner.trim()}\n`);
  text = text.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, (_m, inner: string) => `\n###### ${inner.trim()}\n`);
  text = replaceRepeated(text, /<(?:b|strong)\b[^>]*>([\s\S]*?)<\/(?:b|strong)>/gi, (_m, inner: string) => `**${inner}**`);
  text = text.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m, inner: string) => `\n- ${inner.trim()}`);
  text = replaceRepeated(text, /<Alert\b[^>]*>([\s\S]*?)<\/Alert>/g, (_m, inner: string) => `\n> ${inner.trim()}\n`);
  // Self-closing tags (spacer divs, icons, stray media) carry no text value.
  text = text.replace(/<[A-Za-z][^<>]*\/>/g, "");
  // Iteratively peel innermost paired tags (div, p, span, Card, Button, table, tr, td, ...).
  let prev: string;
  do {
    prev = text;
    text = text.replace(/<([A-Za-z][A-Za-z0-9]*)\b[^<>]*>([^<]*)<\/\1>/g, (_m, _tag: string, inner: string) => inner);
  } while (text !== prev);
  // Safety net for anything malformed/unmatched.
  text = text.replace(/<\/?[A-Za-z][^<>]*>/g, "");
  return text;
}

function convertTable(text: string): string {
  return text.replace(
    /<Table\s+headers=\{\[([\s\S]*?)\]\}\s*data=\{\[([\s\S]*?)\]\}\s*\/>/g,
    (_m, headersBody: string, dataBody: string) => {
      const headers = Array.from(headersBody.matchAll(/["']([^"']*)["']/g)).map((mm) => mm[1]);
      const trimmed = dataBody.trim().replace(/^\[/, "").replace(/\]$/, "");
      const rows = trimmed
        .split(/\]\s*,\s*\n\s*\[/)
        .map((row) => row.replace(/^\s*\[?/, "").replace(/\]?\s*$/, "").trim())
        .filter((row) => row.length > 0);

      const tableRows = rows.map((row) =>
        row
          .split(/,\s*\n(?=\s*[<"'`])/)
          .map((cell) => flattenJsxToText(cell.trim()).replace(/\s*\n\s*/g, " ").replace(/\|/g, "\\|").trim())
          .filter((cell) => cell.length > 0)
      );

      let md = "\n\n";
      if (headers.length > 0) {
        md += `| ${headers.join(" | ")} |\n`;
        md += `| ${headers.map(() => "---").join(" | ")} |\n`;
      }
      for (const cells of tableRows) {
        if (cells.length === 0) continue;
        md += `| ${cells.join(" | ")} |\n`;
      }
      return `${md}\n`;
    }
  );
}

function cleanupWhitespace(text: string): string {
  const noJunkLines = text
    .split("\n")
    .filter((line) => line.trim() === "" || !/^[{}[\]().,;:]+$/.test(line.trim()))
    .join("\n");
  return noJunkLines
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface RawSegment {
  sectionId: string;
  sectionTitle: string;
  content: string;
}

function splitBySectionMarkers(text: string): { intro: string; segments: RawSegment[] } {
  const markerRegex = /@@SECTION#([^#]*)#([^@]*)@@/g;
  const markers: { index: number; id: string; title: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = markerRegex.exec(text))) {
    markers.push({ index: m.index, id: m[1], title: m[2] });
  }
  if (markers.length === 0) {
    return { intro: text.replace(/@@SECTION#[^@]*@@/g, "").trim(), segments: [] };
  }
  const intro = text.slice(0, markers[0].index).trim();
  const segments: RawSegment[] = markers.map((marker, i) => {
    const start = marker.index + `@@SECTION#${marker.id}#${marker.title}@@`.length;
    const end = i + 1 < markers.length ? markers[i + 1].index : text.length;
    return {
      sectionId: marker.id,
      sectionTitle: marker.title,
      content: text.slice(start, end).trim(),
    };
  });
  return { intro, segments };
}

function mdxFileToChunks(rawSource: string, relPathPosix: string): DocChunk[] {
  const baseId = relPathPosix.replace(/\.mdx$/, "");
  const pageUrl = `${SITE_BASE_URL}/${baseId}`;

  const normalized = rawSource.replace(/\r\n/g, "\n");
  const withoutComments = stripJsxComments(normalized);
  const withoutImports = stripImports(withoutComments);
  const blocks: string[] = [];
  const afterHighlightTabs = convertHighlightTabs(withoutImports, blocks);
  const afterCode = protectCodeBlocks(afterHighlightTabs, blocks);
  const { text: afterHead, headTitle } = extractTitleAndStripHead(afterCode);
  const afterLayout = stripLayoutAndMedia(afterHead);
  const { text: afterH1, h1 } = extractH1(afterLayout);
  const afterSections = markSections(afterH1);
  const afterSteps = convertSteps(afterSections);
  const afterTabs = convertTabs(afterSteps);
  const afterQuestionBox = convertQuestionBox(afterTabs);
  const afterRelatedLinks = convertRelatedLinksMap(afterQuestionBox);
  const afterTables = convertTable(afterRelatedLinks);
  const afterFlatten = flattenJsxToText(afterTables);
  // Clean up stray JS/JSX punctuation while code is still behind @@CODE_n@@
  // placeholders, then restore the real code verbatim so brace-only lines
  // inside legitimate code samples are never touched by the cleanup pass.
  const cleanedShell = cleanupWhitespace(afterFlatten);
  const cleaned = restoreCodeBlocks(cleanedShell, blocks);

  const pageTitle = h1 || headTitle || baseId.split("/").pop() || baseId;
  const category = categoryLabel(relPathPosix);

  const { intro, segments } = splitBySectionMarkers(cleaned);

  const chunks: DocChunk[] = [];

  if (segments.length === 0) {
    if (intro.length >= MIN_CHUNK_CHARS) {
      chunks.push({
        id: baseId,
        title: pageTitle,
        section: category,
        content: intro,
        url: pageUrl,
        keywords: extractKeywords(`${pageTitle} ${category} ${intro}`),
      });
    }
    return chunks;
  }

  segments.forEach((seg, i) => {
    let content = seg.content;
    if (i === 0 && intro.length > 0) {
      content = `${intro}\n\n${content}`.trim();
    }
    if (content.length < MIN_CHUNK_CHARS) return;
    const id = seg.sectionId ? `${baseId}#${seg.sectionId}` : `${baseId}#s${i + 1}`;
    const url = seg.sectionId ? `${pageUrl}#${seg.sectionId}` : pageUrl;
    const section = seg.sectionTitle ? `${category} — ${seg.sectionTitle}` : category;
    chunks.push({
      id,
      title: pageTitle,
      section,
      content,
      url,
      keywords: extractKeywords(`${pageTitle} ${section} ${content}`),
    });
  });

  return chunks;
}

// ---------------------------------------------------------------------------
// 4. Main
// ---------------------------------------------------------------------------

function main(): void {
  ensureDocsRepo();

  const files = walkMdxFiles(PAGES_ROOT);
  console.log(`[ingest] Found ${files.length} candidate .mdx files.`);

  const allChunks: DocChunk[] = [];
  const failures: { file: string; error: string }[] = [];

  for (const filePath of files) {
    const relPathPosix = path.relative(PAGES_ROOT, filePath).split(path.sep).join("/");
    try {
      const raw = readFileSync(filePath, "utf-8");
      const chunks = mdxFileToChunks(raw, relPathPosix);
      allChunks.push(...chunks);
    } catch (err) {
      failures.push({ file: relPathPosix, error: (err as Error).message });
    }
  }

  console.log(`[ingest] Produced ${allChunks.length} chunks from ${files.length} files.`);
  if (failures.length > 0) {
    console.warn(`[ingest] ${failures.length} files failed to parse:`);
    for (const f of failures.slice(0, 20)) {
      console.warn(`  - ${f.file}: ${f.error}`);
    }
  }

  // Sanity check: warn (but don't fail the whole ingestion) about chunks that
  // still contain obvious unconverted JSX/JS leftovers, so they can be fixed.
  // Fenced code blocks are excluded first since arrow functions, `.map(`,
  // and `className=` are all completely normal inside real JS/TS/JSX samples.
  const suspiciousPattern = /<[A-Za-z][\w-]*[\s/>]|\{\s*item\.\w+\s*\}|\]\}\.map\(/;
  const suspicious = allChunks.filter((c) =>
    suspiciousPattern.test(c.content.replace(/```[\s\S]*?```/g, ""))
  );
  if (suspicious.length > 0) {
    console.warn(
      `[ingest] ${suspicious.length}/${allChunks.length} chunks contain possible leftover JSX/JS syntax. Examples:`
    );
    for (const c of suspicious.slice(0, 10)) {
      console.warn(`  - ${c.id}`);
    }
  }

  const deduped = allChunks.filter((c, i, arr) => arr.findIndex((o) => o.id === c.id) === i);

  const parsed = DocChunkArraySchema.parse(deduped);

  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(parsed, null, 2), "utf-8");
  console.log(`[ingest] Wrote ${parsed.length} chunks to ${path.relative(PROJECT_ROOT, OUTPUT_PATH)}`);
}

main();

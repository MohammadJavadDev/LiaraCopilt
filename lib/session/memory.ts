import { extractKeywords } from "@/lib/docs/keywords";
import type { Intent } from "@/lib/intent/detect-intent";

/**
 * Lightweight, client/session-scoped memory (PROJECT_SPEC §7.4 / §8) — no
 * auth, no database. Travels alongside the message history: the client
 * persists it on the `Conversation` record and re-sends it with every
 * request; the server refines it each turn from plain keyword heuristics
 * (never a separate LLM call) and streams the updated value back.
 */

export type TopicId = "database" | "domain" | "env" | "deploy" | "troubleshoot";

export const DEPLOYMENT_STEPS = [
  "ask_source",
  "detect_framework",
  "create_app",
  "env_vars",
  "deploy",
  "verify",
] as const;

export type DeploymentStepId = (typeof DEPLOYMENT_STEPS)[number];

export type TechLevel = "beginner" | "advanced";

export interface SessionState {
  /** The framework/platform the user said they're using (e.g. "Next.js"), remembered so we never ask twice. */
  framework: string | null;
  techLevel: TechLevel;
  mentionedTopics: TopicId[];
  deploymentStep: DeploymentStepId | null;
}

export const DEFAULT_SESSION_STATE: SessionState = {
  framework: null,
  techLevel: "beginner",
  mentionedTopics: [],
  deploymentStep: null,
};

const FRAMEWORK_KEYWORDS = [
  "Next.js",
  "NextJS",
  "React",
  "Vue",
  "Nuxt",
  "Svelte",
  "Angular",
  "Laravel",
  "Django",
  "Flask",
  "FastAPI",
  "Go",
  ".NET",
  "Node.js",
  "PHP",
  "Python",
  "WordPress",
  "TypeScript",
];

export const TOPIC_IDS: TopicId[] = ["database", "domain", "env", "deploy", "troubleshoot"];

const TOPIC_KEYWORDS: Record<TopicId, string[]> = {
  database: [
    "دیتابیس",
    "PostgreSQL",
    "MySQL",
    "MariaDB",
    "MongoDB",
    "Redis",
    "RabbitMQ",
    "MSSQL",
    "Elasticsearch",
    "SQLite",
    "connection string",
    "connection pooling",
    "backup",
    "restore",
  ],
  domain: [
    "domain",
    "دامنه",
    "DNS",
    "SSL",
    "CNAME",
    "A record",
    "TXT record",
    "MX",
    "SPF",
    "DKIM",
    "subdomain",
  ],
  env: ["environment variable", "env", "LIARA_API_TOKEN", "api-token"],
  deploy: ["liara deploy", "liara.json", "CLI", "CI/CD", "GitHub", "webhook", "build location"],
  troubleshoot: ["502", "503", "504", "ECONNRESET", "health check", "restart"],
};

/** Terms whose mere presence signals a technically fluent user (spec §7.4 heuristic). */
const ADVANCED_SIGNAL_KEYWORDS = new Set([
  "Dockerfile",
  "docker",
  "CI/CD",
  "webhook",
  "reverse proxy",
  "connection pooling",
  "CORS",
  "SSR",
  "ISR",
  "TypeScript",
  "IaaS",
  "private registry",
]);

const ADVANCED_TEXT_LENGTH_THRESHOLD = 140;

function detectFramework(matchedKeywords: string[]): string | null {
  return matchedKeywords.find((keyword) => FRAMEWORK_KEYWORDS.includes(keyword)) ?? null;
}

function detectTopics(matchedKeywords: string[]): TopicId[] {
  const found: TopicId[] = [];
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS) as [TopicId, string[]][]) {
    if (keywords.some((keyword) => matchedKeywords.includes(keyword))) {
      found.push(topic);
    }
  }
  return found;
}

function isAdvancedTurn(text: string, matchedKeywords: string[]): boolean {
  if (matchedKeywords.some((keyword) => ADVANCED_SIGNAL_KEYWORDS.has(keyword))) return true;
  if (matchedKeywords.length >= 2) return true;
  return matchedKeywords.length >= 1 && text.length > ADVANCED_TEXT_LENGTH_THRESHOLD;
}

/** Advances the deploy-guide state machine by exactly one step (spec §7.2); skips steps already answered. */
function nextDeploymentStep(current: DeploymentStepId | null, framework: string | null): DeploymentStepId {
  const startIndex = current ? DEPLOYMENT_STEPS.indexOf(current) + 1 : 0;
  for (let i = startIndex; i < DEPLOYMENT_STEPS.length; i += 1) {
    const step = DEPLOYMENT_STEPS[i];
    if (step === "detect_framework" && framework) continue;
    return step;
  }
  return DEPLOYMENT_STEPS[DEPLOYMENT_STEPS.length - 1];
}

/**
 * Folds the latest user turn into the running session state. Framework and
 * tech-level only ever strengthen (never reset once learned) — the whole
 * point is to stop re-asking things the user already told us.
 */
export function updateSessionState(prev: SessionState, latestUserText: string, intent: Intent): SessionState {
  const matchedKeywords = extractKeywords(latestUserText);

  const framework = prev.framework ?? detectFramework(matchedKeywords);
  const techLevel: TechLevel =
    prev.techLevel === "advanced" || isAdvancedTurn(latestUserText, matchedKeywords) ? "advanced" : "beginner";

  const mentionedTopics = Array.from(new Set([...prev.mentionedTopics, ...detectTopics(matchedKeywords)]));

  const deploymentStep =
    intent === "deploy" ? nextDeploymentStep(prev.deploymentStep, framework) : prev.deploymentStep;

  return { framework, techLevel, mentionedTopics, deploymentStep };
}

const STEP_INSTRUCTIONS: Record<DeploymentStepId, string> = {
  ask_source:
    "قدم فعلی راهنمای دیپلوی: پرسیدن منبع کد. از کاربر بپرس که آیا کدش را از GitHub دیپلوی می‌کند یا با آپلود مستقیم/Liara CLI از حالت لوکال — و فقط بعد از پاسخ او قدم بعدی را ادامه بده.",
  detect_framework:
    "قدم فعلی راهنمای دیپلوی: تشخیص فریم‌ورک/زبان پروژه. اگر کاربر هنوز نگفته پروژه‌اش با چه فریم‌ورک یا زبانی نوشته شده، همین را بپرس؛ در غیر این صورت مستقیم قدم بعدی (ساخت اپ) را توضیح بده.",
  create_app: "قدم فعلی راهنمای دیپلوی: راهنمایی برای ساخت اپ جدید در کنسول یا CLI لیارا متناسب با پلتفرم پروژه.",
  env_vars: "قدم فعلی راهنمای دیپلوی: پرسیدن/راهنمایی درباره‌ی environment variableهای لازم پروژه و نحوه‌ی ست کردن آن‌ها در لیارا.",
  deploy: "قدم فعلی راهنمای دیپلوی: توضیح دستور یا مراحل دقیق اجرای خود دیپلوی (liara deploy یا دکمه‌ی دیپلوی در کنسول).",
  verify: "قدم فعلی راهنمای دیپلوی: راهنمایی برای بررسی سالم بودن دیپلوی (باز شدن URL، health check، مشاهده‌ی لاگ‌ها).",
};

/** Extra system-prompt instructions derived from intent + session memory (spec §7.2/§7.3/§7.4). */
export function buildAgenticInstructions(intent: Intent, state: SessionState): string {
  const lines: string[] = [];

  if (state.framework) {
    lines.push(
      `کاربر قبلاً در همین مکالمه گفته که پروژه‌اش با «${state.framework}» است — این را دوباره نپرس، در پاسخ‌هایت همین را به‌عنوان فرض بگیر.`
    );
  }

  if (intent === "deploy" && state.deploymentStep) {
    lines.push(STEP_INSTRUCTIONS[state.deploymentStep]);
    lines.push("پاسخ را فقط محدود به همین یک قدم بده، کل راهنما را یک‌جا ننویس.");
  }

  if (intent === "troubleshoot") {
    lines.push(
      state.framework
        ? "فریم‌ورک پروژه از قبل مشخص است؛ اگر پیام کاربر برای تشخیص علت خطا کافی است، مستقیم یک checklist عملی و مستند بده."
        : "قبل از هر چیز، اگر فریم‌ورک/تکنولوژی پروژه و متن دقیق خطا یا وضعیت build مشخص نیست، همین را با ۱ یا ۲ سؤال کوتاه بپرس و checklist کامل را به بعد از پاسخ کاربر موکول کن."
    );
  }

  lines.push(
    state.techLevel === "advanced"
      ? "کاربر از اصطلاحات فنی پیشرفته استفاده کرده؛ پاسخ را فنی‌تر، مستقیم‌تر و کوتاه‌تر بده، توضیحات پایه‌ای اضافه نده."
      : "سؤال کاربر ساده/مبتدیانه به نظر می‌رسد؛ پاسخ را گام‌به‌گام و با توضیح واضح‌تر بده."
  );

  return lines.length > 0 ? `راهنمای رفتار (بر اساس حافظه‌ی این مکالمه):\n${lines.map((line) => `- ${line}`).join("\n")}` : "";
}

export interface FollowupSuggestion {
  label: string;
  prompt: string;
}

/** Deterministic, history-aware follow-up suggestions (spec §7.4 bullet 3) — never generic filler. */
export function getFollowupSuggestions(intent: Intent, state: SessionState): FollowupSuggestion[] {
  const suggestions: FollowupSuggestion[] = [];
  const has = (topic: TopicId) => state.mentionedTopics.includes(topic);

  if (has("database") && !has("env")) {
    suggestions.push({
      label: "اتصال دیتابیس با env variable",
      prompt: "چطور connection string دیتابیسم را به‌صورت environment variable به اپلیکیشنم در لیارا وصل کنم؟",
    });
  }

  if (intent === "deploy" && state.deploymentStep === "verify") {
    suggestions.push({
      label: "اتصال دامنه‌ی شخصی",
      prompt: "چطور دامنه‌ی شخصی خودم را به این اپلیکیشن روی لیارا وصل کنم؟",
    });
    suggestions.push({
      label: "مشاهده‌ی لاگ‌ها",
      prompt: "چطور می‌توانم لاگ‌های اپلیکیشنم را روی لیارا ببینم؟",
    });
  }

  if (intent === "troubleshoot") {
    suggestions.push({
      label: "جلوگیری از تکرار مشکل",
      prompt: "چطور می‌توانم از بروز دوباره‌ی این مشکل در دیپلوی‌های بعدی جلوگیری کنم؟",
    });
  }

  if (has("domain") && !has("database")) {
    suggestions.push({
      label: "افزودن دیتابیس",
      prompt: "چطور یک دیتابیس جدید به این اپلیکیشن روی لیارا اضافه کنم؟",
    });
  }

  return suggestions.slice(0, 3);
}

/**
 * Curated technical-term dictionary used to (a) tag extracted doc chunks with
 * real keywords found in their own text, and (b) boost retrieval scoring for
 * queries that mention these high-signal platform terms (PROJECT_SPEC §4.2).
 *
 * Matching is case-insensitive and word-boundary aware for Latin tokens; the
 * list intentionally mixes English technical tokens (which Persian speakers
 * type verbatim, e.g. "PostgreSQL", "502") with a few Persian phrases.
 */
export const TECH_KEYWORDS: string[] = [
  // Core deploy/runtime
  "liara deploy",
  "liara.json",
  "liaraignore",
  "liara-json",
  "Dockerfile",
  "docker",
  "buildpack",
  "npm install",
  "npm run build",
  "npm start",
  "package.json",
  "node_modules",
  "environment variable",
  "env",
  "LIARA_API_TOKEN",
  "api-token",
  "CLI",
  "CI/CD",
  "GitHub",
  "webhook",
  "health check",
  "restart",
  "build location",
  "mirror",
  "disk",
  "private registry",

  // Frameworks / platforms
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
  "static",
  "SPA",
  "SSR",
  "ISR",
  "TypeScript",

  // Databases
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

  // Networking / domains
  "502",
  "503",
  "504",
  "ECONNRESET",
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
  "Nginx",
  "CORS",
  "reverse proxy",
  "port",
  "CDN",

  // Storage / infra
  "Object Storage",
  "bucket",
  "S3",
  "IaaS",
  "cron",
  "cron job",

  // Account / team
  "team-id",
  "team",
  "role",
  "invoice",
  "two-factor",
];

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const KEYWORD_MATCHERS = TECH_KEYWORDS.map((keyword) => ({
  keyword,
  regex: new RegExp(
    /^[a-zA-Z0-9.\-_/]+$/.test(keyword)
      ? `(?<![a-zA-Z0-9])${escapeRegExp(keyword)}(?![a-zA-Z0-9])`
      : escapeRegExp(keyword),
    "i"
  ),
}));

/** Extracts the subset of TECH_KEYWORDS that literally occur in `text`. */
export function extractKeywords(text: string): string[] {
  const found = new Set<string>();
  for (const { keyword, regex } of KEYWORD_MATCHERS) {
    if (regex.test(text)) {
      found.add(keyword);
    }
  }
  return Array.from(found);
}

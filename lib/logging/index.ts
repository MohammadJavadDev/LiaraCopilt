/**
 * Structured JSON logging + in-memory runtime metrics (PROJECT_SPEC §11/§12).
 * `console.log(JSON.stringify(...))` is deliberately all this needs — no
 * external logging infra for a hackathon MVP. The metrics ring buffer also
 * powers `/status` (and its "successful/failed" counts double as the
 * request-level monitoring data the rubric asks for).
 */

export type LogLevel = "info" | "warn" | "error";

export interface LogEvent {
  level: LogLevel;
  scope: string;
  [key: string]: unknown;
}

/** Emits one structured, greppable JSON line per event — never a raw thrown error. */
export function log(event: LogEvent): void {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), ...event }));
}

export type RequestScope = "chat" | "title";

export interface RequestMetric {
  timestamp: number;
  scope: RequestScope;
  success: boolean;
  latencyMs: number;
  intent?: string;
  inputTokens?: number;
  outputTokens?: number;
}

const MAX_METRICS = 500;
const metrics: RequestMetric[] = [];

export function recordRequestMetric(metric: RequestMetric): void {
  metrics.push(metric);
  if (metrics.length > MAX_METRICS) metrics.shift();
}

export interface MetricsSnapshot {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatencyMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byScope: Record<RequestScope, { total: number; successful: number; failed: number }>;
  recent: RequestMetric[];
  processStartedAt: number;
}

const processStartedAt = Date.now();

/** Aggregates the in-memory ring buffer for the `/status` page and any future health checks. */
export function getMetricsSnapshot(): MetricsSnapshot {
  const totalRequests = metrics.length;
  const successfulRequests = metrics.filter((m) => m.success).length;
  const failedRequests = totalRequests - successfulRequests;
  const averageLatencyMs =
    totalRequests > 0 ? Math.round(metrics.reduce((sum, m) => sum + m.latencyMs, 0) / totalRequests) : 0;
  const totalInputTokens = metrics.reduce((sum, m) => sum + (m.inputTokens ?? 0), 0);
  const totalOutputTokens = metrics.reduce((sum, m) => sum + (m.outputTokens ?? 0), 0);

  const byScope: MetricsSnapshot["byScope"] = {
    chat: { total: 0, successful: 0, failed: 0 },
    title: { total: 0, successful: 0, failed: 0 },
  };
  for (const metric of metrics) {
    const bucket = byScope[metric.scope];
    bucket.total += 1;
    if (metric.success) bucket.successful += 1;
    else bucket.failed += 1;
  }

  return {
    totalRequests,
    successfulRequests,
    failedRequests,
    averageLatencyMs,
    totalInputTokens,
    totalOutputTokens,
    byScope,
    recent: metrics.slice(-20).reverse(),
    processStartedAt,
  };
}

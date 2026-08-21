import Link from "next/link";
import { ArrowRight, Gauge } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMetricsSnapshot } from "@/lib/logging";

// In-memory metrics change on every request; never statically cache this page (spec §12).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(value);
}

function formatDuration(ms: number): string {
  return `${formatNumber(ms)} ms`;
}

function formatUptime(startedAt: number): string {
  const totalSeconds = Math.floor((Date.now() - startedAt) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${formatNumber(hours)} ساعت و ${formatNumber(minutes)} دقیقه و ${formatNumber(seconds)} ثانیه`;
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(
    new Date(timestamp)
  );
}

const SCOPE_LABELS: Record<string, string> = { chat: "چت", title: "عنوان مکالمه" };

export default function StatusPage() {
  const metrics = getMetricsSnapshot();
  const successRate =
    metrics.totalRequests > 0 ? Math.round((metrics.successfulRequests / metrics.totalRequests) * 100) : 100;

  return (
    <div dir="rtl" className="mx-auto min-h-screen max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Gauge className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">وضعیت سرویس لیارا کوپایلوت</h1>
            <p className="text-xs text-muted-foreground">
              متریک‌های این پردازه از زمان آخرین اجرا — {formatUptime(metrics.processStartedAt)} پیش
            </p>
          </div>
        </div>
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          بازگشت به چت
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardDescription>کل درخواست‌ها</CardDescription>
            <CardTitle className="text-2xl">{formatNumber(metrics.totalRequests)}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>موفق</CardDescription>
            <CardTitle className="text-2xl text-emerald-600 dark:text-emerald-400">
              {formatNumber(metrics.successfulRequests)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>خطا</CardDescription>
            <CardTitle className="text-2xl text-destructive">{formatNumber(metrics.failedRequests)}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>نرخ موفقیت</CardDescription>
            <CardTitle className="text-2xl">٪{formatNumber(successRate)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>میانگین تأخیر پاسخ</CardDescription>
            <CardTitle className="text-2xl">{formatDuration(metrics.averageLatencyMs)}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>توکن ورودی (تخمینی)</CardDescription>
            <CardTitle className="text-2xl">{formatNumber(metrics.totalInputTokens)}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>توکن خروجی (تخمینی)</CardDescription>
            <CardTitle className="text-2xl">{formatNumber(metrics.totalOutputTokens)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="mt-3">
        <CardHeader>
          <CardTitle>درخواست‌های اخیر</CardTitle>
          <CardDescription>۲۰ درخواست آخر (جدیدترین بالا)</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">هنوز درخواستی ثبت نشده است.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 font-medium">زمان</th>
                    <th className="py-2 font-medium">نوع</th>
                    <th className="py-2 font-medium">Intent</th>
                    <th className="py-2 font-medium">وضعیت</th>
                    <th className="py-2 font-medium">تأخیر</th>
                    <th className="py-2 font-medium">توکن (ورودی/خروجی)</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.recent.map((entry, index) => (
                    <tr key={`${entry.timestamp}-${index}`} className="border-b border-border/60 last:border-0">
                      <td className="py-2 text-muted-foreground">{formatTime(entry.timestamp)}</td>
                      <td className="py-2">{SCOPE_LABELS[entry.scope] ?? entry.scope}</td>
                      <td className="py-2 text-muted-foreground">{entry.intent ?? "—"}</td>
                      <td className="py-2">
                        <Badge variant={entry.success ? "secondary" : "destructive"}>
                          {entry.success ? "موفق" : "خطا"}
                        </Badge>
                      </td>
                      <td className="py-2">{formatDuration(entry.latencyMs)}</td>
                      <td className="py-2 text-muted-foreground" dir="ltr">
                        {entry.inputTokens ?? "—"} / {entry.outputTokens ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

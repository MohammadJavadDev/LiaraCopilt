/** Liveness probe (PROJECT_SPEC §12) — intentionally has zero dependencies (no docs load, no AI provider). */
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return Response.json({ status: "ok" });
}

import { NextResponse } from "next/server";

import { buildDashboardPayload } from "@/lib/services/dashboard";

// yahoo-finance2 は tough-cookie 等 Node API に依存するため edge 不可
export const runtime = "nodejs";
// キャッシュは unstable_cache(データ層)に一本化する。
// ここに revalidate を付けると二重管理になり servedAt が固まって鮮度表示が嘘になる。
export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await buildDashboardPayload();
  return NextResponse.json(payload, {
    status: payload.status === "error" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ASSET_BY_ID } from "@/lib/config";
import { buildHistoryPayload } from "@/lib/services/history";
import type { CandleInterval, Currency } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INTERVALS: readonly CandleInterval[] = ["daily", "weekly", "monthly", "yearly"];
const CURRENCIES: readonly Currency[] = ["USD", "JPY"];

function parseInterval(raw: string | null): CandleInterval | null {
  return INTERVALS.includes(raw as CandleInterval) ? (raw as CandleInterval) : null;
}

/** ?currency=usd|jpy(大文字小文字は問わない)。未知の通貨は 400 にする */
function parseCurrency(raw: string | null): Currency | null {
  const upper = raw?.toUpperCase() ?? null;
  return CURRENCIES.includes(upper as Currency) ? (upper as Currency) : null;
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/history/[symbol]">) {
  // Next 16 では params は Promise
  const { symbol } = await ctx.params;

  // URL はティッカーではなく id(slug)で受け、allowlist で照合する。
  // 任意のティッカーをそのまま Yahoo に流すと、この URL が第三者の Yahoo プロキシとして
  // 使われ(レート制限の枯渇や SSRF 的な悪用)てしまう。
  const asset = ASSET_BY_ID.get(symbol);
  if (!asset) {
    return NextResponse.json({ error: "unknown symbol" }, { status: 404 });
  }

  const interval = parseInterval(req.nextUrl.searchParams.get("interval"));
  if (interval === null && req.nextUrl.searchParams.has("interval")) {
    return NextResponse.json({ error: "invalid interval" }, { status: 400 });
  }

  const currency = parseCurrency(req.nextUrl.searchParams.get("currency"));
  if (currency === null && req.nextUrl.searchParams.has("currency")) {
    return NextResponse.json({ error: "invalid currency" }, { status: 400 });
  }

  // 未指定なら銘柄本来の建て通貨。投信は円、米国 ETF はドルで返る。
  const payload = await buildHistoryPayload(asset, interval ?? "daily", currency ?? asset.baseCurrency);
  return NextResponse.json(payload, {
    status: payload.status === "error" ? 503 : 200,
    // 履歴は1日1回しか変わらないので CDN に載せてラムダ起動自体を減らす
    headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400" },
  });
}

import { NextResponse } from "next/server";

import { ASSETS, FX_SYMBOL } from "@/lib/config";
import { countBars } from "@/lib/db/navRepo";
import { getSeries } from "@/lib/series";
import { fetchQuotes } from "@/lib/yahoo";

/**
 * 開発時の疎通確認用。
 * Yahoo(crumb 取得・レイテンシ)と投資信託協会 + SQLite の両系統をまとめて見る。
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    const [quotes, ...series] = await Promise.all([
      fetchQuotes([FX_SYMBOL, ...ASSETS.filter((a) => a.source === "yahoo").map((a) => a.symbol)]),
      ...ASSETS.map((a) => getSeries(a)),
    ]);

    return NextResponse.json({
      ok: true,
      elapsedMs: Date.now() - started,
      usdjpy: quotes.bySymbol[FX_SYMBOL]?.price ?? null,
      marketState: quotes.bySymbol[FX_SYMBOL]?.marketState ?? null,
      assets: ASSETS.map((a, i) => {
        const s = series[i];
        const last = s.bars[s.bars.length - 1];
        return {
          id: a.id,
          symbol: a.symbol,
          source: a.source,
          baseCurrency: a.baseCurrency,
          quotePrice: a.source === "yahoo" ? (quotes.bySymbol[a.symbol]?.price ?? null) : null,
          bars: s.bars.length,
          // 投信は SQLite に何行入っているかも見る(0 なら永続化できていない)
          rowsInDb: a.source === "toushin" ? countBars(a.symbol) : null,
          timezone: s.timezone,
          first: s.bars[0]?.date ?? null,
          last: last?.date ?? null,
          lastClose: last?.close ?? null,
          fetchedAt: s.fetchedAt,
        };
      }),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, elapsedMs: Date.now() - started, error: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}

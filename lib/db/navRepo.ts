import "server-only";

import { asc, count, eq, sql } from "drizzle-orm";

import { synthesizeOhlc } from "../candles";
import type { HistorySeries, NavRow } from "../types";
import { getDb } from "./client";
import { navBars, seriesMeta } from "./schema";

/**
 * 投信の基準価額を SQLite に読み書きする層。
 * ここだけが drizzle を知っている。上位(lib/series.ts)は HistorySeries しか見ない。
 */

/** 前回この銘柄を投資信託協会から取得した時刻。未取得なら null */
export function getFetchedAt(symbol: string): string | null {
  const rows = getDb().select().from(seriesMeta).where(eq(seriesMeta.symbol, symbol)).limit(1).all();
  return rows[0]?.fetchedAt ?? null;
}

/**
 * DB の基準価額を Yahoo 系列と同じ `HistorySeries` に組み立てて返す。
 * 1 行も無ければ null(= まだ一度も取得していない)。
 */
export function readSeries(symbol: string): HistorySeries | null {
  const db = getDb();

  const meta = db.select().from(seriesMeta).where(eq(seriesMeta.symbol, symbol)).limit(1).all()[0];
  if (!meta) return null;

  const rows = db
    .select()
    .from(navBars)
    .where(eq(navBars.symbol, symbol))
    .orderBy(asc(navBars.date))
    .all();
  if (rows.length === 0) return null;

  const navRows: NavRow[] = rows.map((r) => ({
    date: r.date,
    nav: r.close,
    netAssets: r.netAssets,
    distribution: r.distribution,
  }));

  return {
    symbol,
    bars: synthesizeOhlc(navRows),
    firstTradeDate: meta.firstTradeDate ?? navRows[0].date,
    // 基準価額は日本時間の営業日で公表される
    timezone: "Asia/Tokyo",
    splitCount: 0,
    // 基準価額に株式分割は無く、協会 CSV にスケール異常も出ないので常に空
    corrections: [],
    fetchedAt: meta.fetchedAt,
  };
}

/**
 * 取得した全履歴を upsert する。
 *
 * CSV は毎回設定来の全件を返すので全行を投げるが、1銘柄 2,000 行程度なので
 * トランザクションに包めば一瞬で終わる。遡って改訂された基準価額も
 * onConflictDoUpdate で自然に直る。
 */
export function upsertSeries(
  symbol: string,
  rows: readonly NavRow[],
  fetchedAt: string,
  firstTradeDate: string | null,
): void {
  const db = getDb();

  db.transaction((tx) => {
    // SQLite の変数上限(既定 999)に当たらないよう分割して投げる
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK).map((r) => ({
        symbol,
        date: r.date,
        close: r.nav,
        netAssets: r.netAssets,
        distribution: r.distribution,
      }));
      tx.insert(navBars)
        .values(chunk)
        .onConflictDoUpdate({
          target: [navBars.symbol, navBars.date],
          // excluded.* = 今 INSERT しようとした行の値
          set: {
            close: sql`excluded.close`,
            netAssets: sql`excluded.net_assets`,
            distribution: sql`excluded.distribution`,
          },
        })
        .run();
    }

    tx.insert(seriesMeta)
      .values({ symbol, fetchedAt, firstTradeDate })
      .onConflictDoUpdate({
        target: seriesMeta.symbol,
        set: { fetchedAt, firstTradeDate },
      })
      .run();
  });
}

/** 動作確認用。銘柄ごとの行数 */
export function countBars(symbol: string): number {
  const rows = getDb()
    .select({ n: count() })
    .from(navBars)
    .where(eq(navBars.symbol, symbol))
    .all();
  return rows[0]?.n ?? 0;
}

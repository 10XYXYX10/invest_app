import "server-only";

import { getCachedHistory } from "./cache";
import { CACHE } from "./config";
import { getFetchedAt, readSeries, upsertSeries } from "./db/navRepo";
import { rememberGood } from "./lastGood";
import { synthesizeOhlc } from "./candles";
import { fetchToushinHistory } from "./toushin";
import type { AssetConfig, HistorySeries } from "./types";

/**
 * 取得元に依らず日足系列を返す唯一の入口。
 * lib/services/* が "yahoo" / "toushin" の違いを意識しなくて済むようにここへ寄せる。
 *
 * キャッシュ戦略が源で違う:
 * - yahoo   : `unstable_cache`(24h)。揮発層だが Yahoo が高速なので十分。
 * - toushin : **SQLite**。CSV が設定来の全件一括で重く、差分取得もできないため、
 *             揮発層ではなく永続層で受ける。DB の fetched_at が revalidate の役割を果たすので
 *             `unstable_cache` は重ねない(二重キャッシュは無意味かつデバッグを難しくする)。
 */
export async function getSeries(asset: AssetConfig): Promise<HistorySeries> {
  if (asset.source === "yahoo") return getCachedHistory(asset.symbol);
  return getToushinSeries(asset);
}

async function getToushinSeries(asset: AssetConfig): Promise<HistorySeries> {
  const fetchedAt = getFetchedAt(asset.symbol);
  const ageMs = fetchedAt === null ? Infinity : Date.now() - Date.parse(fetchedAt);

  if (Number.isFinite(ageMs) && ageMs < CACHE.NAV_REVALIDATE_SEC * 1000) {
    const cached = readSeries(asset.symbol);
    if (cached) return cached;
  }

  try {
    const fresh = await fetchToushinHistory(asset);
    upsertSeries(asset.symbol, fresh.rows, fresh.fetchedAt, fresh.firstTradeDate);

    const series: HistorySeries = {
      symbol: asset.symbol,
      bars: synthesizeOhlc(fresh.rows),
      firstTradeDate: fresh.firstTradeDate,
      timezone: "Asia/Tokyo",
      splitCount: 0,
      corrections: [],
      fetchedAt: fresh.fetchedAt,
    };
    rememberGood(`history:${asset.symbol}`, series);
    return series;
  } catch (e) {
    // 協会側が落ちていても DB に履歴があるなら古い値で描く。
    // 呼び出し元(services)の 3 段フォールバックが status を "stale" に落とす。
    const cached = readSeries(asset.symbol);
    if (cached) return cached;
    throw e;
  }
}

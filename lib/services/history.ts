import "server-only";

import { getCachedHistory, getCachedQuotes } from "../cache";
import { aggregate, trimToRecentYears } from "../candles";
import { DAILY_CHART_LOOKBACK_YEARS, FX_SYMBOL, QUOTE_SYMBOLS } from "../config";
import { buildFxLookup, convertBars } from "../fx";
import { recallGood } from "../lastGood";
import { describeCorrection } from "../normalize";
import { getSeries } from "../series";
import { computeAllTimeHigh } from "../yahoo";
import type {
  AssetConfig,
  CandleInterval,
  Currency,
  DailyBar,
  DataStatus,
  HistoryPayload,
  HistorySeries,
  QuoteBundle,
} from "../types";

interface Loaded<T> {
  value: T | null;
  status: DataStatus;
  error?: string;
}

async function load<T>(key: string, fetcher: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { value: await fetcher(), status: "live" };
  } catch (e) {
    const fallback = recallGood<T>(key);
    if (fallback) return { value: fallback.value, status: "stale" };
    return { value: null, status: "error", error: e instanceof Error ? e.message : String(e) };
  }
}

function worstStatus(statuses: readonly DataStatus[]): DataStatus {
  if (statuses.includes("error")) return "error";
  if (statuses.includes("stale")) return "stale";
  return "live";
}

export async function buildHistoryPayload(
  asset: AssetConfig,
  interval: CandleInterval,
  currency: Currency,
): Promise<HistoryPayload> {
  const warnings: string[] = [];

  // 表示通貨が銘柄の建て通貨と同じなら為替は要らない。
  // 「Y 軸をドルで見る」ケースでは FX を一切通さないので換算誤差も欠損も出ない。
  const needsFx = currency !== asset.baseCurrency;

  const [assetRes, fxRes, quotesRes] = await Promise.all([
    load<HistorySeries>(`history:${asset.symbol}`, () => getSeries(asset)),
    needsFx
      ? load<HistorySeries>(`history:${FX_SYMBOL}`, () => getCachedHistory(FX_SYMBOL))
      : Promise.resolve<Loaded<HistorySeries>>({ value: null, status: "live" }),
    load<QuoteBundle>("quotes", () => getCachedQuotes([...QUOTE_SYMBOLS])),
  ]);

  const base: Omit<HistoryPayload, "status"> = {
    id: asset.id,
    symbol: asset.symbol,
    name: asset.name,
    interval,
    baseCurrency: asset.baseCurrency,
    currency,
    candles: [],
    fx: { from: null, to: null, droppedBars: 0, forwardFilled: 0, sourceBars: 0, fetchedAt: fxRes.value?.fetchedAt ?? null },
    allTimeHighNative: null,
    allTimeHighUsd: null,
    allTimeHighJpy: null,
    allTimeHighDate: null,
    historyStartDate: null,
    historyFetchedAt: assetRes.value?.fetchedAt ?? null,
    servedAt: new Date().toISOString(),
    warnings,
  };

  if (!assetRes.value) {
    warnings.push(`履歴の取得に失敗しました: ${assetRes.error ?? "unknown"}`);
    return { ...base, status: "error" };
  }
  if (needsFx && !fxRes.value) {
    warnings.push(`ドル円履歴の取得に失敗しました: ${fxRes.error ?? "unknown"}`);
    return { ...base, status: "error" };
  }

  const series = assetRes.value;

  // 取得元のスケール異常を補正した場合は、チャート上でも必ず知らせる。
  // ★"?? []" は必須。Data Cache には corrections を持たない旧い形の系列が
  //   revalidate 期限(24h)まで残るため、型どおりに読むと実行時に落ちる。
  for (const c of series.corrections ?? []) warnings.push(describeCorrection(c));

  // ATH は必ず「銘柄本来の建て通貨」で求める。換算後の系列から取ると
  // 為替の山谷が混ざって「価格の最高値」ではなくなる。
  const ath = computeAllTimeHigh(series, asset.symbol);
  const fxRate = quotesRes.value?.bySymbol[FX_SYMBOL]?.price ?? null;

  // 日足のみ転送量を抑えるために遡及年数を制限する。週/月/年足は全期間。
  const nativeBars = interval === "daily" ? trimToRecentYears(series.bars, DAILY_CHART_LOOKBACK_YEARS) : series.bars;

  let bars: DailyBar[] = [...nativeBars];
  let droppedBars = 0;
  let forwardFilled = 0;
  let lookupFrom: string | null = null;
  let lookupTo: string | null = null;

  if (needsFx && fxRes.value) {
    // 仕様書 §3.2 の近似。集計より先に日足レベルで換算するのが重要(lib/fx.ts のコメント参照)。
    const lookup = buildFxLookup(fxRes.value.bars);
    const converted = convertBars(nativeBars, lookup, currency === "JPY" ? "usdToJpy" : "jpyToUsd");
    bars = converted.bars;
    droppedBars = converted.droppedBars;
    forwardFilled = converted.forwardFilled;
    lookupFrom = lookup.from;
    lookupTo = lookup.to;

    if (droppedBars > 0) {
      warnings.push(`ドル円の履歴が及ばない ${droppedBars} 本のバーをチャートから除外しました`);
    }
  }

  const candles = aggregate(bars, interval);

  // ATH の両通貨表示。※当時のレートではなく現在レートでの換算
  const athUsd =
    ath.value === null ? null : asset.baseCurrency === "USD" ? ath.value : fxRate === null ? null : ath.value / fxRate;
  const athJpy =
    ath.value === null ? null : asset.baseCurrency === "JPY" ? ath.value : fxRate === null ? null : ath.value * fxRate;

  return {
    ...base,
    candles,
    fx: {
      from: lookupFrom,
      to: lookupTo,
      droppedBars,
      forwardFilled,
      sourceBars: needsFx ? nativeBars.length : 0,
      fetchedAt: fxRes.value?.fetchedAt ?? null,
    },
    allTimeHighNative: ath.value,
    allTimeHighUsd: athUsd,
    allTimeHighJpy: athJpy,
    allTimeHighDate: ath.date,
    historyStartDate: series.bars[0]?.date ?? series.firstTradeDate ?? null,
    historyFetchedAt: series.fetchedAt,
    status: worstStatus([assetRes.status, needsFx ? fxRes.status : "live"]),
  };
}

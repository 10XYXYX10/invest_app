import "server-only";

import { getCachedQuotes } from "../cache";
import { ASSETS, DEFAULT_FX_PAIR_ID, FX_PAIRS, FX_PAIR_IDS, QUOTE_SYMBOLS, STALE_AFTER_MS } from "../config";
import { drawdownPct, fxDeviationPct, fxRevertImpactPct, indexValue, isBuySignal } from "../indicators";
import { describeCorrection } from "../normalize";
import { recallGood } from "../lastGood";
import { getSeries } from "../series";
import { computeAllTimeHigh } from "../yahoo";
import type {
  AssetQuote,
  DashboardPayload,
  DataStatus,
  FxPairId,
  FxSnapshot,
  HistorySeries,
  QuoteBundle,
} from "../types";

/**
 * 「全期間最高値」と言えるだけの履歴があるかの目安。
 * 上場直後の銘柄は最高値が上場来の狭い範囲に留まり、X が実態より浅く出る。
 */
const SHORT_HISTORY_YEARS = 3;

function historyYears(startDate: string | null): number | null {
  if (!startDate) return null;
  const t = Date.parse(startDate);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (365.25 * 24 * 60 * 60 * 1000);
}

function worstStatus(statuses: readonly DataStatus[]): DataStatus {
  if (statuses.includes("error")) return "error";
  if (statuses.includes("stale")) return "stale";
  return "live";
}

/** 取得時刻が古すぎるなら live ではなく stale として扱う */
function ageAdjusted(status: DataStatus, fetchedAt: string | null): DataStatus {
  if (status !== "live" || !fetchedAt) return status;
  const age = Date.now() - new Date(fetchedAt).getTime();
  return Number.isFinite(age) && age > STALE_AFTER_MS ? "stale" : "live";
}

interface Loaded<T> {
  value: T | null;
  status: DataStatus;
  error?: string;
}

/**
 * キャッシュ層 → 直近成功値 の順に取りに行く。
 * Data Cache がヒットしたときも `lastGood` を温めておき、暖まったインスタンスに保険を持たせる。
 */
async function load<T>(key: string, fetcher: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { value: await fetcher(), status: "live" };
  } catch (e) {
    const fallback = recallGood<T>(key);
    if (fallback) return { value: fallback.value, status: "stale" };
    return { value: null, status: "error", error: e instanceof Error ? e.message : String(e) };
  }
}

export async function buildDashboardPayload(): Promise<DashboardPayload> {
  const warnings: string[] = [];

  // 現在値(ドル建て銘柄+FX を1本)と全銘柄の履歴を並列で取りに行く。
  // 投信は quote の対象外(Yahoo に存在しない)で、現在値は履歴の最終バーから取る。
  // allSettled ではなく個別に try/catch する `load` を使うことで、
  // 1銘柄の失敗が他の銘柄やページ全体を落とさない。
  const [quotes, ...histories] = await Promise.all([
    load<QuoteBundle>("quotes", () => getCachedQuotes([...QUOTE_SYMBOLS])),
    ...ASSETS.map((a) => load<HistorySeries>(`history:${a.symbol}`, () => getSeries(a))),
  ]);

  const quoteFetchedAt = quotes.value?.fetchedAt ?? null;
  const quoteStatus = ageAdjusted(quotes.status, quoteFetchedAt);
  if (quotes.status === "error") warnings.push(`現在値の取得に失敗しました: ${quotes.error ?? "unknown"}`);

  // ---- 為替 ----
  // ★ペアごとに独立して組み立てる。1 ペアが欠けても他のペアと全銘柄は生かす。
  const fxByPair = {} as Record<FxPairId, FxSnapshot>;
  for (const id of FX_PAIR_IDS) {
    const cfg = FX_PAIRS[id];
    // `?? null` は Yahoo 障害だけでなく、ペア追加前の古い lastGood バンドル
    // (INRJPY=X のキーを持たない)を読んだ場合にも効く。
    const q = quotes.value?.bySymbol[cfg.symbol] ?? null;
    const rate = q?.price ?? null;
    fxByPair[id] = {
      id: cfg.id,
      symbol: cfg.symbol,
      label: cfg.label,
      rate,
      base: cfg.base,
      fractionDigits: cfg.fractionDigits,
      baseNote: cfg.baseNote,
      exposureNote: cfg.exposureNote,
      deviationPct: rate === null ? null : fxDeviationPct(rate, cfg.base),
      marketState: q?.marketState ?? null,
      fetchedAt: quoteFetchedAt,
      status: rate === null ? "error" : quoteStatus,
    };
  }
  const fxPairs = FX_PAIR_IDS.map((id) => fxByPair[id]);

  /** ドル円。価格の USD⇔JPY 換算と後方互換フィールド専用 */
  const fx = fxByPair[DEFAULT_FX_PAIR_ID];
  const usdJpyRate = fx.rate;

  // 特定のペアだけ欠けた場合は警告に留める。全体を error に落とすと /api/quotes が
  // 503 を返し、そのペアと無関係な銘柄まで巻き添えで表示できなくなる。
  for (const snap of fxPairs) {
    if (snap.rate === null && quotes.status !== "error") {
      warnings.push(
        `${snap.label}(${snap.symbol})のレートを取得できませんでした。このペアを使う銘柄の為替乖離 Y は表示されません`,
      );
    }
  }

  // ---- 各投資対象 ----
  const assets: AssetQuote[] = ASSETS.map((config, i) => {
    const history = histories[i];
    const assetWarnings: string[] = [];

    const series = history.value;
    const quote = quotes.value?.bySymbol[config.symbol] ?? null;

    // この銘柄の為替乖離 Y を測るペア。★価格の円換算(下の toUsd/toJpy)とは別物。
    const pair = fxByPair[config.fxPairId ?? DEFAULT_FX_PAIR_ID];
    if (pair.rate === null && quotes.status !== "error") {
      assetWarnings.push(`${pair.label}のレートを取得できず、為替乖離 Y は表示していません`);
    }

    // 現在値の取り方が取得元で分かれる。
    // - yahoo   : quote の regularMarketPrice(ザラ場中も動く)
    // - toushin : 基準価額に別 API は無いので**系列の最終バー**がそのまま現在値
    const priceNative =
      config.source === "yahoo" ? (quote?.price ?? null) : (series?.bars[series.bars.length - 1]?.close ?? null);

    // ATH も X も「銘柄本来の建て通貨」で計算する。換算後の系列で取ると
    // 為替の山谷が混ざって「価格の最高値」ではなくなる。
    const ath = series ? computeAllTimeHigh(series, config.symbol) : { value: null, date: null };

    if (history.status === "error") {
      assetWarnings.push(`履歴の取得に失敗しました: ${history.error ?? "unknown"}`);
    }
    // 取得元のスケール異常を lib/normalize.ts が直した場合は黙って直さず必ず知らせる
    for (const c of series?.corrections ?? []) {
      assetWarnings.push(describeCorrection(c));
    }

    const startDate = series?.bars[0]?.date ?? series?.firstTradeDate ?? null;
    const years = historyYears(startDate);
    if (years !== null && years < SHORT_HISTORY_YEARS) {
      assetWarnings.push(
        `履歴が ${years.toFixed(1)} 年ぶんしかありません。全期間最高値は上場来の範囲に限られるため、下落率 X は参考値です`,
      );
    }

    if (series && series.splitCount > 0 && priceNative !== null && ath.value !== null) {
      // 分割の調整漏れは実在する。ATH が現在値と桁違いなら疑う。
      const ratio = ath.value / priceNative;
      if (ratio > 1.9 || ratio < 0.55) {
        assetWarnings.push("株式分割の調整が正しくない可能性があります(最高値と現在値の乖離が異常)");
      }
    }

    const x = priceNative !== null && ath.value !== null && ath.value > 0 ? drawdownPct(priceNative, ath.value) : null;

    /**
     * ★為替乖離 Y を足すのはドル建て銘柄だけ。
     * 投資信託の基準価額は円建てで、既に為替が織り込まれている。そこに Y を足すと
     * 為替を二重計上することになり、仕様書 §1 が「X はドル建てで計算せよ」と
     * 定めているのと同じ理由で誤りになる。
     */
    const usesFxDeviation = config.baseCurrency === "USD";
    const y = usesFxDeviation ? pair.deviationPct : null;
    const index = usesFxDeviation ? (x !== null && y !== null ? indexValue(x, y) : null) : x;

    /**
     * 円建て銘柄の参考値。★しきい値判定には使わない(index は上のまま)。
     * 「円建て = 為替リスクなし」ではないので、円高でどれだけ目減りするかを別枠で見せる。
     * - fxAdjustedIndex     : X + Y。ドル円が基準値へ戻った場合の割安度の目安
     * - fxRevertImpact      : 実際に何%減るか。Y と分母が違うので値も違う
     */
    const fxAdjustedIndex =
      !usesFxDeviation && x !== null && pair.deviationPct !== null ? indexValue(x, pair.deviationPct) : null;
    const fxRevertImpact =
      !usesFxDeviation && pair.rate !== null ? fxRevertImpactPct(pair.rate, pair.base) : null;

    // 投信は quote を引かないので、鮮度は履歴の取得時刻だけで決まる
    const priceFetchedAt = config.source === "yahoo" ? quoteFetchedAt : (series?.fetchedAt ?? null);
    const priceStatus =
      config.source === "yahoo" ? quoteStatus : ageAdjusted(history.status, series?.fetchedAt ?? null);

    const status = worstStatus([
      ageAdjusted(history.status, series?.fetchedAt ?? null),
      priceNative === null ? "error" : priceStatus,
    ]);

    // ★価格の換算は常にドル円(usdJpyRate)。銘柄ごとの Y のペア(pair.rate)と混ぜてはいけない。
    //   priceUsd / priceJpy は「ドル建て/円建て」の表示値であって、ルピーは無関係。
    //   どちらも number | null なので取り違えても型エラーにならない。ここは目視で守る。
    const toUsd = (v: number | null): number | null =>
      v === null
        ? null
        : config.baseCurrency === "USD"
          ? v
          : usdJpyRate === null || usdJpyRate <= 0
            ? null
            : v / usdJpyRate;
    const toJpy = (v: number | null): number | null =>
      v === null ? null : config.baseCurrency === "JPY" ? v : usdJpyRate === null ? null : v * usdJpyRate;

    return {
      id: config.id,
      symbol: config.symbol,
      displaySymbol: config.displaySymbol ?? config.symbol,
      name: config.name,
      shortName: config.shortName,
      source: config.source,
      themeId: config.themeId,
      risk: config.risk,
      riskLabel: config.riskLabel,
      threshold: config.threshold,
      baseCurrency: config.baseCurrency,
      usesFxDeviation,
      priceNative,
      priceUsd: toUsd(priceNative),
      priceJpy: toJpy(priceNative),
      allTimeHighNative: ath.value,
      allTimeHighUsd: toUsd(ath.value),
      allTimeHighJpy: toJpy(ath.value),
      allTimeHighDate: ath.date,
      historyStartDate: startDate,
      drawdownPct: x,
      indexValue: index,
      isBuySignal: index !== null && isBuySignal(index, config.threshold),
      fxDeviationPct: pair.deviationPct,
      fxPair: pair,
      fxAdjustedIndex,
      fxRevertImpactPct: fxRevertImpact,
      fxNote: config.fxNote ?? null,
      currency: quote?.currency ?? config.baseCurrency,
      marketState: quote?.marketState ?? null,
      quoteFetchedAt: priceFetchedAt,
      historyFetchedAt: series?.fetchedAt ?? null,
      status,
      warnings: assetWarnings,
    };
  });

  return {
    fx,
    fxPairs,
    assets,
    servedAt: new Date().toISOString(),
    // ★fxPairs 全体ではなくドル円だけを見る。ルピー円が欠けただけで payload 全体を
    //   error にすると /api/quotes が 503 を返し、ダッシュボードごと落ちる。
    status: worstStatus([fx.status, ...assets.map((a) => a.status)]),
    warnings,
  };
}

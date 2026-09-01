import "server-only";
import YahooFinance from "yahoo-finance2";

import {
  ATH_BASIS_OVERRIDES,
  ATH_PRICE_BASIS,
  CACHE,
  HISTORY_PERIOD1,
  HISTORY_PERIOD1_FALLBACK,
} from "./config";
import { isFiniteNumber } from "./indicators";
import { normalizeDailyBars } from "./normalize";
import type { AllTimeHigh, DailyBar, DateKey, HistorySeries, QuoteBundle, QuoteSnapshot } from "./types";

/**
 * yahoo-finance2 は v3 以降クラス化されている。static 呼び出し
 * (`YahooFinance.quote(...)`)は `never` 型で定義されており実行時に必ず throw するため、
 * 必ず `new` する。cookie jar と crumb をインスタンスが保持するので、
 * モジュールスコープに1つだけ置いてラムダ内で使い回す(cold start あたり +300〜800ms の節約)。
 */
const yf = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
  validation: { logErrors: false },
});

/**
 * 全モジュール呼び出しに渡す第3引数。
 *
 * ★`validateResult: false` は必須。デフォルトでは Yahoo のレスポンスがライブラリ内蔵の
 * JSON schema 検証に落ちると `FailedYahooValidationError` を無条件に throw する
 * (`validation.logErrors` はログ出力の可否を変えるだけで throw は止まらない)。
 * Yahoo がフィールドを1つ増やしただけで本番が落ちるため無効化し、
 * 代わりに下の `num()` / `?? null` による防御的な取り出しと自前の型で品質を担保する。
 */
function moduleOpts() {
  return {
    validateResult: false as const,
    // AbortSignal は使い回せないので呼び出しごとに作る
    fetchOptions: { signal: AbortSignal.timeout(CACHE.YAHOO_TIMEOUT_MS) },
  };
}

// ---------- 防御的な値の取り出し ----------

function num(v: unknown): number | null {
  return isFiniteNumber(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function toIso(v: unknown): string | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

/**
 * 取引所ローカル日付での 'YYYY-MM-DD' を作る。
 *
 * ★UTC 日付を使ってはいけない。Yahoo の USDJPY=X は取引所タイムゾーンが Europe/London で、
 * 夏時間中の日足バーが前日 23:00Z に打たれる。UTC で日付キーを作ると米国株の日付と
 * 12% 以上ずれ、円換算が systematically 1日古いレートになる。
 * 取引所タイムゾーンで切ると不一致は 0.5% まで下がる(= FX が本当に休んでいる日だけ)。
 */
function makeDateKeyFormatter(timeZone: string): (d: unknown) => DateKey | null {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" });
  }
  return (v: unknown) => {
    const d = v instanceof Date ? v : typeof v === "string" || typeof v === "number" ? new Date(v) : null;
    if (!d || Number.isNaN(d.getTime())) return null;
    return fmt.format(d);
  };
}

// ---------- 現在値 ----------

/**
 * 全対象 + ドル円の現在値を1リクエストでまとめて取得する。
 * まとめることで、閲覧者が何人いても Yahoo へは1回で済む。
 */
export async function fetchQuotes(symbols: readonly string[]): Promise<QuoteBundle> {
  // validateResult:false のオーバーロードは Promise<any> を返す
  const raw: unknown = await yf.quote([...symbols], { return: "object" }, moduleOpts());
  const map = (raw ?? {}) as Record<string, Record<string, unknown> | undefined>;

  const fetchedAt = new Date().toISOString();
  const bySymbol: Record<string, QuoteSnapshot> = {};

  for (const symbol of symbols) {
    const q = map[symbol];
    bySymbol[symbol] = {
      symbol,
      price: num(q?.regularMarketPrice),
      currency: str(q?.currency),
      marketState: str(q?.marketState),
      marketTime: toIso(q?.regularMarketTime),
    };
  }

  return { bySymbol, fetchedAt };
}

// ---------- ヒストリカル ----------

interface RawChartQuote {
  date?: unknown;
  open?: unknown;
  high?: unknown;
  low?: unknown;
  close?: unknown;
  adjclose?: unknown;
  volume?: unknown;
}

interface RawChartResult {
  meta?: Record<string, unknown>;
  events?: { splits?: unknown };
  quotes?: RawChartQuote[];
}

async function callChart(symbol: string, period1: string): Promise<RawChartResult> {
  const res: unknown = await yf.chart(
    symbol,
    { period1, interval: "1d", includePrePost: false, events: "split", return: "array" },
    moduleOpts(),
  );
  return (res ?? {}) as RawChartResult;
}

/**
 * 全期間の日足を取得する。仕様書 §4 の `range=max` 相当。
 * ATH の算出とチャート描画の両方をこの1本で賄うので、Yahoo への発信は銘柄あたり1日1回で済む。
 */
export async function fetchDailyHistory(symbol: string): Promise<HistorySeries> {
  let res: RawChartResult;
  try {
    res = await callChart(symbol, HISTORY_PERIOD1);
  } catch (e) {
    // period1 が古すぎて弾かれる銘柄への保険
    if (e instanceof Error && e.name === "TimeoutError") throw e;
    res = await callChart(symbol, HISTORY_PERIOD1_FALLBACK);
  }

  const timezone = str(res.meta?.exchangeTimezoneName) ?? "UTC";
  const toDateKey = makeDateKeyFormatter(timezone);

  const bars: DailyBar[] = [];
  const seen = new Set<DateKey>();

  for (const q of res.quotes ?? []) {
    // Yahoo は休場・データ欠損・進行中の当日バーで null 行を混ぜてくる。ここで必ず落とす。
    const open = num(q.open);
    const high = num(q.high);
    const low = num(q.low);
    const close = num(q.close);
    const date = toDateKey(q.date);
    if (date === null || open === null || high === null || low === null || close === null) continue;
    if (seen.has(date)) continue;
    seen.add(date);
    bars.push({ date, open, high, low, close, adjclose: num(q.adjclose), volume: num(q.volume) });
  }

  bars.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // ★取得元のスケール異常(未調整の株式分割・1日だけ 1/10 で入っているバー)をここで直す。
  // ATH もチャートもこの系列 1 本から作るので、入口で直せば下流は何も意識しなくてよい。
  const normalized = normalizeDailyBars(symbol, bars);

  const splits = res.events?.splits;
  const splitCount = Array.isArray(splits)
    ? splits.length
    : splits && typeof splits === "object"
      ? Object.keys(splits).length
      : 0;

  return {
    symbol,
    bars: normalized.bars,
    firstTradeDate: toDateKey(res.meta?.firstTradeDate) ?? bars[0]?.date ?? null,
    timezone,
    splitCount,
    corrections: normalized.corrections,
    fetchedAt: new Date().toISOString(),
  };
}

// ---------- 全期間最高値 ----------

/**
 * 全期間最高値を求める。
 *
 * 既定は終値ベース(`ATH_PRICE_BASIS = "close"`)。比較対象の分子である
 * `regularMarketPrice` は実際の取引値であり、Yahoo の `close`(株式分割は遡及調整済み・
 * 配当は未調整)と同じ基準になる。`adjclose` を使うと過去値が配当ぶん系統的に切り下がり、
 * ATH が不当に低く出て X が甘くなる(=シグナルが出にくくなる)。
 */
export function computeAllTimeHigh(series: HistorySeries, symbol: string = series.symbol): AllTimeHigh {
  const basis = ATH_BASIS_OVERRIDES[symbol] ?? ATH_PRICE_BASIS;
  let best = -Infinity;
  let bestDate: DateKey | null = null;

  for (const b of series.bars) {
    const v = basis === "high" ? b.high : basis === "adjclose" ? (b.adjclose ?? b.close) : b.close;
    if (v > best) {
      best = v;
      bestDate = b.date;
    }
  }

  return best === -Infinity ? { value: null, date: null } : { value: best, date: bestDate };
}

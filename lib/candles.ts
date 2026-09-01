import type { Candle, CandleInterval, DailyBar, DateKey, NavRow } from "./types";

/**
 * 'YYYY-MM-DD' を UTC のエポックミリ秒に変換する。
 * ローカルタイムゾーンを経由しないので実行環境に依存しない。
 */
function dateKeyToUtcMs(d: DateKey): number {
  return Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
}

/** ISO週(月曜始まり)のキー。その週の月曜の 'YYYY-MM-DD' を返す */
export function weekKey(d: DateKey): string {
  const ms = dateKeyToUtcMs(d);
  const dow = new Date(ms).getUTCDay(); // 0=日曜
  const mondayMs = ms - ((dow + 6) % 7) * 86_400_000;
  return new Date(mondayMs).toISOString().slice(0, 10);
}

export const monthKey = (d: DateKey): string => d.slice(0, 7);
export const yearKey = (d: DateKey): string => d.slice(0, 4);

function groupKeyFor(interval: CandleInterval): (d: DateKey) => string {
  switch (interval) {
    case "weekly":
      return weekKey;
    case "monthly":
      return monthKey;
    case "yearly":
      return yearKey;
    default:
      return (d) => d;
  }
}

/**
 * 日足を週足 / 月足 / 年足に集計する。
 *
 * - `bars` は日付昇順・重複なしであること(lib/yahoo.ts が保証する)
 * - 年足は Yahoo に interval が無いのでここで日足から直接生成する。
 *   月足を経由しないので月をまたぐ高値・安値も正しく拾える。
 * - 出力の `time` はグループ内の「最初の実取引日」。月初1日のような架空の日付を
 *   使わないことで lightweight-charts の BusinessDay 文字列として自然になり、
 *   足種を切り替えても時間軸が揃う。
 * - 進行中の週 / 月 / 年も出力する(実際の証券ツールと同じ挙動)。
 */
export function aggregate(bars: readonly DailyBar[], interval: CandleInterval): Candle[] {
  if (bars.length === 0) return [];

  const keyOf = groupKeyFor(interval);
  const out: Candle[] = [];
  let currentKey = "";
  let current: Candle | null = null;

  for (const bar of bars) {
    const key = keyOf(bar.date);
    if (key !== currentKey) {
      if (current) out.push(current);
      currentKey = key;
      current = {
        time: bar.date,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume ?? 0,
      };
    } else if (current) {
      if (bar.high > current.high) current.high = bar.high;
      if (bar.low < current.low) current.low = bar.low;
      current.close = bar.close;
      current.volume += bar.volume ?? 0;
    }
  }
  if (current) out.push(current);

  return out;
}

/** 直近 N 年より新しいバーだけに絞る(日足の転送量抑制用) */
export function trimToRecentYears(bars: readonly DailyBar[], years: number): DailyBar[] {
  if (bars.length === 0) return [];
  const lastMs = dateKeyToUtcMs(bars[bars.length - 1].date);
  const cutoff = lastMs - years * 365.25 * 86_400_000;
  return bars.filter((b) => dateKeyToUtcMs(b.date) >= cutoff);
}

/**
 * 表示期間で絞り込む。`months` が null なら全件。
 *
 * 基準は「今日」ではなく**最後のローソクの日付**。休場明けや取得遅延で
 * 直近数日ぶんが欠けているとき、今日を基準にすると 1ヶ月表示が
 * 数本しか出ないという分かりにくい挙動になるため。
 */
export function sliceToPeriod(candles: readonly Candle[], months: number | null): Candle[] {
  if (months === null || candles.length === 0) return [...candles];

  const last = candles[candles.length - 1].time;
  const y = Number(last.slice(0, 4));
  const m = Number(last.slice(5, 7)) - 1;
  const d = Number(last.slice(8, 10));
  // Date.UTC は月の繰り下がりを自動で処理する(1月 − 3ヶ月 → 前年10月)
  const cutoff = Date.UTC(y, m - months, d);

  return candles.filter((c) => dateKeyToUtcMs(c.time) >= cutoff);
}

/**
 * 1日1値の基準価額から擬似 OHLC を作る。
 *
 * 投資信託の基準価額は 1 営業日に 1 度しか公表されず、日中の高値・安値は存在しない。
 * そこで `open = 前日の基準価額` として当日の値動きを 1 本の実体で表す。
 *
 * ★日足のローソクは「前日比の向きを示す近似」でしかないが、週足・月足・年足に
 *   集計すればその期間の高値・安値は**実際の基準価額**から正しく求まる
 *   (aggregate() が期間内の high/low を取り直すため)。
 */
export function synthesizeOhlc(rows: readonly NavRow[]): DailyBar[] {
  const bars: DailyBar[] = [];
  let prev: number | null = null;

  for (const r of rows) {
    const open = prev ?? r.nav; // 初日は始値が無いので実体ゼロにする
    bars.push({
      date: r.date,
      open,
      high: Math.max(open, r.nav),
      low: Math.min(open, r.nav),
      close: r.nav,
      adjclose: null,
      volume: null,
    });
    prev = r.nav;
  }

  return bars;
}

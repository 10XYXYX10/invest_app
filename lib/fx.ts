import type { DailyBar, DateKey } from "./types";

export interface FxLookup {
  /** その日以前で最も新しい USD/JPY 終値。FX 系列の開始より前なら null */
  rateOn(date: DateKey): number | null;
  /** その日ちょうどの FX バーが存在するか */
  hasExactBar(date: DateKey): boolean;
  from: DateKey | null;
  to: DateKey | null;
  size: number;
}

/** dates 内で date 以下の最大要素のインデックス。無ければ -1 */
function floorIndex(dates: readonly string[], date: string): number {
  let lo = 0;
  let hi = dates.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] <= date) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

/**
 * USD/JPY 日次系列から「その日以前で最も新しい終値」を引ける索引を作る。
 *
 * ドル円は週5日24時間、米国株は米国市場カレンダーで動くため営業日が完全には一致しない
 * (米国祝日に FX だけ動く / Yahoo 側の欠損行 / 元旦・クリスマスは FX も止まる)。
 * そこで同日のバーが無ければ**直近過去**の営業日で前方補完する。
 *
 * ★未来のレートは絶対に使わない。使うとチャートに look-ahead バイアスが入る。
 */
export function buildFxLookup(fxBars: readonly DailyBar[]): FxLookup {
  const clean = fxBars
    .filter((b) => Number.isFinite(b.close) && b.close > 0)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const dates = clean.map((b) => b.date);
  const rates = clean.map((b) => b.close);
  const exact = new Set(dates);

  // 呼び出しが日付昇順である前提でポインタを単調に進める(全体 O(n+m))。
  // 昇順でない呼び出しが来たら二分探索にフォールバックする。
  let p = -1;
  let last = "";

  return {
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
    size: dates.length,
    hasExactBar: (date) => exact.has(date),
    rateOn(date) {
      if (date < last) {
        p = floorIndex(dates, date);
      } else {
        while (p + 1 < dates.length && dates[p + 1] <= date) p++;
      }
      last = date;
      return p < 0 ? null : rates[p];
    },
  };
}

export interface ConvertedSeries {
  bars: DailyBar[];
  droppedBars: number;
  forwardFilled: number;
}

/** usdToJpy: OHLC × レート / jpyToUsd: OHLC ÷ レート */
export type ConvertDirection = "usdToJpy" | "jpyToUsd";

/**
 * 日足を通貨換算する。
 *
 * 仕様書 §3.2 のとおり「OHLC ×(または ÷)その日の終値レート」による近似。
 * 換算先通貨での日中高値・安値の厳密値は算出不能なため、これは意図的な近似である。
 *
 * 集計より**先に**日足レベルで換算するのが重要。逆順(元通貨で集計してから
 * 週末レートを掛ける)にすると、株安と円高が同時に起きた週の円建て安値を取り逃がす。
 *
 * ★呼ぶのは「表示通貨 ≠ 銘柄の建て通貨」のときだけ。同じなら換算そのものが不要で、
 *   FX 由来の誤差も droppedBars も発生しない(lib/services/history.ts を参照)。
 */
export function convertBars(
  src: readonly DailyBar[],
  fx: FxLookup,
  direction: ConvertDirection,
): ConvertedSeries {
  const bars: DailyBar[] = [];
  let droppedBars = 0;
  let forwardFilled = 0;

  for (const b of src) {
    const rate = fx.rateOn(b.date);
    if (rate === null || rate <= 0) {
      // FX 系列より古く換算できないバー
      droppedBars++;
      continue;
    }
    if (!fx.hasExactBar(b.date)) forwardFilled++;

    const k = direction === "usdToJpy" ? rate : 1 / rate;
    // ÷ の向きでは high/low が入れ替わらない(k > 0 の単調変換)ので順序はそのままでよい
    bars.push({
      date: b.date,
      open: b.open * k,
      high: b.high * k,
      low: b.low * k,
      close: b.close * k,
      adjclose: null,
      volume: b.volume,
    });
  }

  return { bars, droppedBars, forwardFilled };
}

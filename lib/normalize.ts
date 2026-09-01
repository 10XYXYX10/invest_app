import { SERIES_NORMALIZATION } from "./config";
import type { DailyBar, DateKey, NormalizationRule, SeriesCorrection } from "./types";

/**
 * 日足系列のスケール異常を補正する。
 *
 * ★なぜ必要か
 * 東証上場 ETF の日足は Yahoo 側で **株式分割が遡及調整されていない**ことがある
 * (`events.splits` も空で返るため `splitCount` では検知できない)。
 * 例: 2559.T は 2026-06-05 に 1:10 分割したが、それ以前のバーは 10 倍のまま残っている。
 * 補正しないと全期間最高値が現在値の 10 倍になり、X(下落率)が −90% になる。
 *
 * さらに **1 日だけ OHLC がまるごと 1/10 で記録されている**データ異常も混ざる
 * (例: 2559.T の 2026-06-08、1655.T の 2022-02-08〜09)。
 *
 * ★判別の考え方
 * 「段差が以降ずっと続く」なら分割、「数日で元の水準に戻る」ならデータ異常。
 * 段差の倍率が 2 / 2.5 / 10 のような**丸い比率**に一致することも条件に加え、
 * 通常の値動き(1 日で 1.8 倍以上動く広範囲 ETF は事実上存在しない)と区別する。
 *
 * 誤検知したときのために、`SERIES_NORMALIZATION` で銘柄ごとに手動指定 / 無効化できる。
 */

/** これ未満の段差は値動きとして扱い、一切触らない */
const MIN_JUMP = 1.8;
/** 分割・スケール異常で現れる「丸い」倍率 */
const ROUND_FACTORS = [2, 2.5, 3, 4, 5, 6, 8, 10, 20, 50, 100] as const;
/** 段差当日も価格は動くので、丸い倍率との一致は少し緩く見る */
const FACTOR_TOL = 0.06;
/** 「新しい水準が続いているか」を確認する後続バー数 */
const CONFIRM_BARS = 5;

function matchFactor(ratio: number): number | null {
  if (!Number.isFinite(ratio) || ratio < MIN_JUMP) return null;
  for (const f of ROUND_FACTORS) {
    if (Math.abs(ratio / f - 1) <= FACTOR_TOL) return f;
  }
  return null;
}

/** v は a と b のどちらの水準に近いか。比率で見たいので対数距離で比べる */
function closerTo(v: number, a: number, b: number): boolean {
  if (!(v > 0 && a > 0 && b > 0)) return false;
  return Math.abs(Math.log(v / a)) < Math.abs(Math.log(v / b));
}

/**
 * 価格だけを倍率 k 倍する。
 * 出来高は分割で逆方向に増減するが、ATH にもチャート描画にも使っていないので触らない
 * (中途半端に調整すると「補正済みの出来高」という別の誤解を生む)。
 */
function scaled(bar: DailyBar, k: number): DailyBar {
  return {
    ...bar,
    open: bar.open * k,
    high: bar.high * k,
    low: bar.low * k,
    close: bar.close * k,
    adjclose: bar.adjclose === null ? null : bar.adjclose * k,
  };
}

export interface NormalizedSeries {
  bars: DailyBar[];
  corrections: SeriesCorrection[];
}

/**
 * 日付昇順・欠損除去済みのバー配列を受け取り、補正済みの新しい配列を返す。
 * 入力は変更しない。
 */
export function normalizeDailyBars(symbol: string, bars: readonly DailyBar[]): NormalizedSeries {
  const rule: NormalizationRule = SERIES_NORMALIZATION[symbol] ?? "auto";
  if (rule === "off" || bars.length < 2) return { bars: [...bars], corrections: [] };
  if (rule === "auto") return autoNormalize(bars);
  return manualNormalize(bars, rule);
}

function autoNormalize(bars: readonly DailyBar[]): NormalizedSeries {
  const out: DailyBar[] = [...bars];
  const corrections: SeriesCorrection[] = [];

  for (let i = 1; i < out.length; i++) {
    const oldLevel = out[i - 1].close;
    const newLevel = out[i].close;
    if (!(oldLevel > 0 && newLevel > 0)) continue;

    // down: 価格が f 分の 1 に落ちた(1:f の分割、または下方向のスケール異常)
    // up  : 価格が f 倍に跳ねた(併合、または上方向のスケール異常)
    let factor = matchFactor(oldLevel / newLevel);
    let down = true;
    if (factor === null) {
      factor = matchFactor(newLevel / oldLevel);
      down = false;
    }
    if (factor === null) continue;

    // 新しい水準がどこまで続くかを見る。CONFIRM_BARS 本ぶん続けば分割、
    // 途中で旧水準に戻ればその区間がデータ異常。
    const limit = Math.min(out.length - 1, i + CONFIRM_BARS);
    let runEnd = i;
    while (runEnd < limit && closerTo(out[runEnd + 1].close, newLevel, oldLevel)) runEnd++;

    if (runEnd < limit) {
      // 旧水準に戻った → out[i..runEnd] が異常。旧水準へ掛け戻す。
      const k = down ? factor : 1 / factor;
      for (let j = i; j <= runEnd; j++) out[j] = scaled(out[j], k);
      corrections.push({ kind: "outlier", date: out[i].date, factor: k, bars: runEnd - i + 1 });
      continue;
    }

    // 系列の末尾で確認本数が足りないときは断定しない。
    // 最新 1 本だけの異常値を「分割」と誤認して全履歴を 10 分の 1 にする事故を防ぐ。
    if (runEnd - i + 1 < 2) {
      corrections.push({ kind: "suspect", date: out[i].date, factor: down ? factor : 1 / factor, bars: 1 });
      continue;
    }

    // 分割 → それ以前のバーを新しい水準に合わせる
    const k = down ? 1 / factor : factor;
    for (let j = 0; j < i; j++) out[j] = scaled(out[j], k);
    corrections.push({ kind: "split", date: out[i].date, factor: down ? factor : 1 / factor, bars: i });
  }

  return { bars: out, corrections };
}

function manualNormalize(
  bars: readonly DailyBar[],
  rule: Exclude<NormalizationRule, "auto" | "off">,
): NormalizedSeries {
  const out: DailyBar[] = [...bars];
  const corrections: SeriesCorrection[] = [];
  const indexOf = new Map<DateKey, number>(out.map((b, i) => [b.date, i]));

  // 異常バーを先に直してから分割を遡及調整する。
  // 逆順にすると、分割日より前にある異常バーへ倍率が二重に掛かる。
  for (const o of rule.outliers ?? []) {
    const i = indexOf.get(o.date);
    if (i === undefined || !Number.isFinite(o.factor) || o.factor === 0) continue;
    out[i] = scaled(out[i], o.factor);
    corrections.push({ kind: "outlier", date: o.date, factor: o.factor, bars: 1 });
  }

  for (const s of rule.splits ?? []) {
    if (!Number.isFinite(s.ratio) || s.ratio <= 0) continue;
    let n = 0;
    for (let j = 0; j < out.length; j++) {
      if (out[j].date >= s.date) break;
      out[j] = scaled(out[j], 1 / s.ratio);
      n++;
    }
    if (n > 0) corrections.push({ kind: "split", date: s.date, factor: s.ratio, bars: n });
  }

  return { bars: out, corrections };
}

/** 補正内容を画面に出す 1 行の日本語にする */
export function describeCorrection(c: SeriesCorrection): string {
  const ratio = c.factor >= 1 ? `1:${trim(c.factor)}` : `${trim(1 / c.factor)}:1`;
  if (c.kind === "split") {
    return `${c.date} の株式分割(${ratio})が取得元で未調整だったため、それ以前の ${c.bars} 本を自動補正しました`;
  }
  if (c.kind === "outlier") {
    return `${c.date} からの ${c.bars} 本は取得元の価格スケールが異常だったため、${trim(c.factor)} 倍して自動補正しました`;
  }
  return `${c.date} に ${ratio} 相当の段差があります。分割かデータ異常か判別できないため補正していません`;
}

function trim(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, "");
}

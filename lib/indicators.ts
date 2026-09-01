import { FX_BASE_RATE } from "./config";

/**
 * X(下落率) = (現在のドル建て価格 − 全期間最高値) ÷ 全期間最高値 × 100
 * 高値から下げているとき負の値になる(例: 10%暴落 → −10)。
 */
export function drawdownPct(priceUsd: number, allTimeHighUsd: number): number {
  return ((priceUsd - allTimeHighUsd) / allTimeHighUsd) * 100;
}

/**
 * Y(為替乖離) = (現在のUSD/JPY − 基準値) ÷ 基準値 × 100
 * 円安で正(例: 160円 → +6.67)。
 */
export function fxDeviationPct(usdJpy: number, base: number = FX_BASE_RATE): number {
  return ((usdJpy - base) / base) * 100;
}

/**
 * 現在レートから基準レートへ戻ったときの、外貨建て資産の円換算値の変化率。
 * 160円 → 150円 なら (150 − 160) ÷ 160 × 100 = −6.25%(円高で目減り)。
 *
 * ★ Y(= (rate − base) ÷ base × 100)とは分母が違うので値も違う。
 *   Y は指数の定義に合わせた値、こちらは「実際に何%減るか」を出すための値。
 *   同じ場面で両方出すと混乱するため、画面では用途を分けて使う。
 */
export function fxRevertImpactPct(usdJpy: number, base: number = FX_BASE_RATE): number {
  if (!(usdJpy > 0)) return 0;
  return ((base - usdJpy) / usdJpy) * 100;
}

/** 円ベース割安度指数 = X + Y */
export function indexValue(x: number, y: number): number {
  return x + y;
}

/** 買いシグナル判定: 指数 ≤ 対象ごとのしきい値 */
export function isBuySignal(index: number, threshold: number): boolean {
  return index <= threshold;
}

/** 数値が有限か。Yahoo は null / NaN を混ぜてくるので入口で弾く */
export function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

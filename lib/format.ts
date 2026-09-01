import { DISPLAY_TIME_ZONE } from "./config";
import type { AssetSource, Currency } from "./types";

const usd = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const jpy = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("ja-JP", { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "always" });
const pctPlain = new Intl.NumberFormat("ja-JP", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** 桁数ごとに Intl.NumberFormat を使い回す(生成コストが高い) */
const rateFormatters = new Map<number, Intl.NumberFormat>();
function rateFormatter(digits: number): Intl.NumberFormat {
  let f = rateFormatters.get(digits);
  if (!f) {
    f = new Intl.NumberFormat("ja-JP", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    rateFormatters.set(digits, f);
  }
  return f;
}

/**
 * 時刻は必ずタイムゾーンを固定して整形する。
 * サーバー(UTC)とブラウザ(JST)で結果が変わるとハイドレーションが壊れるため。
 */
const dateTime = new Intl.DateTimeFormat("ja-JP", {
  timeZone: DISPLAY_TIME_ZONE,
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export const DASH = "—";

export const fmtUsd = (v: number | null): string => (v === null ? DASH : `$${usd.format(v)}`);
export const fmtJpy = (v: number | null): string => (v === null ? DASH : `¥${jpy.format(v)}`);
/**
 * 為替レート。小数桁は通貨ペアで変える(ドル円 159.79 / ルピー円 1.6760)。
 * ★既定 2 桁はドル円のため。ルピー円を 2 桁で出すと日々の値動きが丸めで消えるので、
 *   呼び出し側は必ず FxSnapshot.fractionDigits を渡すこと。
 * ★基準値(base)の表示にはこれを使わない。1.65 が "1.6500" になり基準として読みにくい。
 */
export const fmtRate = (v: number | null, fractionDigits = 2): string =>
  v === null ? DASH : rateFormatter(fractionDigits).format(v);
/** 符号付きパーセント(+6.69% / -18.51%) */
export const fmtPct = (v: number | null): string => (v === null ? DASH : `${pct.format(v)}%`);
export const fmtPctPlain = (v: number | null): string => (v === null ? DASH : `${pctPlain.format(v)}%`);

export function fmtDateTime(iso: string | null): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? DASH : dateTime.format(d);
}

/** 'YYYY-MM-DD' を 'YYYY/MM/DD' に。日付キーは既に取引所ローカルなので変換しない */
export function fmtDateKey(key: string | null): string {
  return key ? key.replace(/-/g, "/") : DASH;
}

/**
 * 「◯分前」。now に依存するのでサーバーでは呼ばず、必ずマウント後に使う。
 */
export function fmtRelative(iso: string | null, now: number): string {
  if (!iso) return DASH;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return DASH;
  const sec = Math.max(0, Math.round((now - then) / 1000));
  if (sec < 60) return `${sec}秒前`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}分前`;
  const hour = Math.round(min / 60);
  if (hour < 24) return `${hour}時間前`;
  return `${Math.round(hour / 24)}日前`;
}

/**
 * 価格・最高値の呼び方は取得元で変わる。
 * ★`baseCurrency` で分岐してはいけない。東証上場 ETF も円建てだが基準価額ではない。
 */
export const priceLabel = (source: AssetSource): string => (source === "toushin" ? "基準価額" : "現在値");
export const athLabel = (source: AssetSource): string => (source === "toushin" ? "設定来高値" : "上場来高値");

/** 「この銘柄は何か」を 1 語で。詳細ページの取得元表示に使う */
export function sourceLabel(source: AssetSource, baseCurrency: Currency): string {
  if (source === "toushin") return "投資信託(基準価額)";
  return baseCurrency === "JPY" ? "国内上場ETF(東証)" : "米国上場ETF";
}

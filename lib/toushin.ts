import "server-only";

import { CACHE } from "./config";
import { isFiniteNumber } from "./indicators";
import type { AssetConfig, DateKey, IsoTimestamp, NavRow } from "./types";

/**
 * 投資信託協会(投信総合検索ライブラリー)から基準価額の全履歴を取得する。
 *
 * ★なぜ Yahoo ではないのか
 *   `yahoo-finance2` が叩く query2.finance.yahoo.com には日本の投資信託が存在しない。
 *   協会コード("0331418A")も ".T" 付きも 404 を返す。finance.yahoo.co.jp は別サービスで
 *   公開 API を持たないため、一次情報である投資信託協会の CSV を使う。
 *
 * ★特性
 *   - 設定来の**全履歴**を 1 リクエストで返す。期間指定パラメータは無い(差分取得ができない)。
 *     数百 KB あるので毎回叩かず SQLite に永続化する。lib/series.ts を参照。
 *   - 文字コードは Shift_JIS。UTF-8 として読むと日付列が壊れて全行落ちる。
 *   - 列は `年月日,基準価額(円),純資産総額（百万円）,分配金,決算期`。
 *     ★OHLC は無く 1 日 1 値(終値相当)しかない。ローソク足用の擬似 OHLC は
 *     lib/candles.ts の `synthesizeOhlc()` が作る。
 */
const CSV_ENDPOINT = "https://toushin-lib.fwg.ne.jp/FdsWeb/FDST030000/csv-file-download";

export interface ToushinSeries {
  symbol: string;
  /** 日付昇順・重複なし・基準価額が数値の行のみ */
  rows: NavRow[];
  firstTradeDate: DateKey | null;
  fetchedAt: IsoTimestamp;
}

/** '2018年10月31日' → '2018-10-31'。想定外の形式は null を返して行ごと捨てる */
function parseJpDate(raw: string): DateKey | null {
  const m = /^\s*(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日\s*$/.exec(raw);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

/** 空文字・ハイフン・カンマ区切りを許容して数値化する。数値でなければ null */
function parseNum(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const t = raw.trim().replace(/,/g, "");
  if (t === "" || t === "-" || t === "−") return null;
  const n = Number(t);
  return isFiniteNumber(n) ? n : null;
}

/**
 * CSV 本文をパースする。ネットワークから切り離してあるのでテストしやすい。
 * この CSV は引用符を含まないので単純な split で足りる。
 */
export function parseNavCsv(text: string): NavRow[] {
  const out: NavRow[] = [];
  const seen = new Set<DateKey>();

  // 1行目はヘッダ
  for (const line of text.split(/\r?\n/).slice(1)) {
    if (line.trim() === "") continue;
    const cols = line.split(",");
    const date = parseJpDate(cols[0] ?? "");
    const nav = parseNum(cols[1]);
    // 基準価額の無い行(休場・欠損)は Yahoo の null 行と同じく捨てる
    if (date === null || nav === null || nav <= 0) continue;
    if (seen.has(date)) continue;
    seen.add(date);
    out.push({
      date,
      nav,
      netAssets: parseNum(cols[2]),
      distribution: parseNum(cols[3]),
    });
  }

  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

export async function fetchToushinHistory(asset: AssetConfig): Promise<ToushinSeries> {
  if (!asset.isinCd) {
    throw new Error(`${asset.symbol}: isinCd が未設定です(source: "toushin" には必須)`);
  }

  const url = `${CSV_ENDPOINT}?isinCd=${encodeURIComponent(asset.isinCd)}&associFundCd=${encodeURIComponent(asset.symbol)}`;
  const res = await fetch(url, {
    // Next の Data Cache には載せない。永続化は SQLite が担う。
    cache: "no-store",
    signal: AbortSignal.timeout(CACHE.TOUSHIN_TIMEOUT_MS),
    headers: { accept: "text/csv,text/plain,*/*" },
  });
  if (!res.ok) {
    throw new Error(`投資信託協会の CSV 取得に失敗しました (${res.status} ${res.statusText})`);
  }

  // ★Shift_JIS。res.text() は UTF-8 前提なので使えない。
  const text = new TextDecoder("shift_jis").decode(await res.arrayBuffer());
  const rows = parseNavCsv(text);
  if (rows.length === 0) {
    throw new Error(`投資信託協会の CSV に有効な基準価額がありません (${asset.symbol})`);
  }

  return {
    symbol: asset.symbol,
    rows,
    firstTradeDate: rows[0].date,
    fetchedAt: new Date().toISOString(),
  };
}

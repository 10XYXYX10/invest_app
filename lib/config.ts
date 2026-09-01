import type {
  AssetConfig,
  ChartPeriod,
  FxPairConfig,
  FxPairId,
  NormalizationRule,
  ThemeConfig,
} from "./types";

/**
 * 為替乖離 Y を測る通貨ペア。基準値は「過去レンジの中央値」。
 *
 * ★銘柄の建て通貨ではなく「組入資産が実質どの通貨で動くか」で選ぶ。
 *   インド Nifty50 は円建て(投信の基準価額・東証 ETF)だが中身はルピー建てなので
 *   ドル円ではなくルピー円で測る。
 * ★ペアを増やしたら QUOTE_SYMBOLS に載ること(FX_PAIR_IDS 経由で自動)を確認する。
 */
export const FX_PAIRS: Readonly<Record<FxPairId, FxPairConfig>> = {
  USDJPY: {
    id: "USDJPY",
    symbol: "USDJPY=X",
    label: "ドル円",
    base: 150,
    fractionDigits: 2,
    baseNote: "仕様書 §1 の中央値、1 ドル 150 円を基準にしています。",
    exposureNote: "資産の 9 割以上が外貨(主にドル)建て",
  },
  INRJPY: {
    id: "INRJPY",
    symbol: "INRJPY=X",
    label: "ルピー円",
    base: 1.65,
    fractionDigits: 4,
    baseNote:
      "過去 10 年(月足)でおおよそ 1.4〜1.9 円のレンジ(最安 1.3849 円 / 2020-03-09、最高 1.9356 円 / 2024-07-03)に収まるため、その中央値 1.65 円を基準にしています。",
    exposureNote: "資産のほぼ全てがインドルピー建て",
  },
} as const;

/** 表示順。ヘッダーの並び順と QUOTE_SYMBOLS の順序を兼ねる */
export const FX_PAIR_IDS: readonly FxPairId[] = ["USDJPY", "INRJPY"];

/** AssetConfig.fxPairId 省略時のペア */
export const DEFAULT_FX_PAIR_ID: FxPairId = "USDJPY";

/**
 * ドル円の後方互換エイリアス。
 * ★lib/services/history.ts のチャート円換算と /api/health はドル円固定であり、
 *   銘柄ごとの Y の基準(FX_PAIRS)とは無関係。混同しないこと。
 */
export const FX_SYMBOL = FX_PAIRS.USDJPY.symbol;
export const FX_BASE_RATE = FX_PAIRS.USDJPY.base;

/**
 * 投資テーマ。一覧はこの順・この単位でグループ化する。
 * 同じ対象を「投資信託」と「上場 ETF」の両方で持つことがあるため、
 * 銘柄そのものではなくテーマを一覧の見出しにする。
 */
export const THEMES: readonly ThemeConfig[] = [
  { id: "world", name: "全世界株式", description: "先進国+新興国をまとめて保有する中核の対象" },
  { id: "sp500", name: "S&P500", description: "米国の大型株 500 社" },
  { id: "india", name: "インド Nifty50", description: "インド主要 50 社。成長期待が高いぶん値動きも大きい" },
  { id: "semi", name: "半導体", description: "循環が激しいため、しきい値を最も厳しく設定している" },
  { id: "usbond", name: "米国総合債券", description: "株式のクッション役" },
] as const;

/**
 * 投資対象。仕様書 §2。
 * 銘柄・しきい値の追加変更はこの配列を編集する(管理 UI は作らない)。
 * しきい値は「この値以下で点灯」。−10 / −20 はより深い下落を要求する厳しい条件。
 *
 * source について:
 * - "yahoo"   : yahoo-finance2 で日足 OHLC が取れる上場銘柄。米国上場(ドル建て)と
 *               東証上場(円建て)の両方がある。
 * - "toushin" : 日本の投資信託。★Yahoo の API では取得できない
 *               (query2.finance.yahoo.com は投信協会コードに 404 を返す)ため、
 *               投資信託協会の CSV(lib/toushin.ts)から基準価額を取る。円建て。
 *
 * ★配列の順序はテーマ順に揃えている。QUOTE_SYMBOLS の順序がキャッシュキーの一部に
 *   なるので、並べ替えると quote のキャッシュが 1 度だけ無効化される(実害はない)。
 */
export const ASSETS: readonly AssetConfig[] = [
  {
    id: "allcountry",
    symbol: "0331418A",
    isinCd: "JP90C000H1T1",
    name: "eMAXIS Slim全世界株式(オール・カントリー)",
    shortName: "オルカン(投信)",
    source: "toushin",
    baseCurrency: "JPY",
    themeId: "world",
    threshold: 0,
    risk: "low",
    riskLabel: "低",
    fxNote: "日本株が約5%含まれるため、為替の影響はドル円の変動幅よりわずかに小さくなります。",
  },
  {
    id: "2559",
    symbol: "2559.T",
    displaySymbol: "2559",
    name: "MAXIS全世界株式(オール・カントリー)上場投信",
    shortName: "全世界株ETF",
    source: "yahoo",
    baseCurrency: "JPY",
    themeId: "world",
    threshold: 0,
    risk: "low",
    riskLabel: "低",
    fxNote: "日本株が約5%含まれるため、為替の影響はドル円の変動幅よりわずかに小さくなります。",
  },
  {
    id: "1655",
    symbol: "1655.T",
    displaySymbol: "1655",
    name: "iシェアーズ S&P500 米国株ETF",
    shortName: "S&P500 ETF",
    source: "yahoo",
    baseCurrency: "JPY",
    themeId: "sp500",
    threshold: 0,
    risk: "low",
    riskLabel: "低",
    fxNote: "組入資産はすべて米国株(ドル建て)です。為替の影響をそのまま受けます。",
  },
  {
    id: "nifty50",
    symbol: "9I311244",
    isinCd: "JP90C000QLX9",
    name: "楽天・インド株Nifty50インデックス・ファンド",
    shortName: "インドNifty50(投信)",
    source: "toushin",
    baseCurrency: "JPY",
    themeId: "india",
    fxPairId: "INRJPY",
    threshold: -10,
    risk: "medium",
    riskLabel: "中",
    fxNote: "組入資産はインドルピー建てです。為替乖離 Y はドル円ではなくルピー円(基準 1.65 円)で計算しています。",
  },
  {
    id: "201a",
    symbol: "201A.T",
    displaySymbol: "201A",
    name: "iシェアーズ Nifty50 インド株ETF",
    shortName: "インドNifty50 ETF",
    source: "yahoo",
    baseCurrency: "JPY",
    themeId: "india",
    fxPairId: "INRJPY",
    threshold: -10,
    risk: "medium",
    riskLabel: "中",
    fxNote: "組入資産はインドルピー建てです。為替乖離 Y はドル円ではなくルピー円(基準 1.65 円)で計算しています。",
  },
  {
    id: "smh",
    symbol: "SMH",
    name: "ヴァンエック 半導体 ETF",
    shortName: "半導体",
    source: "yahoo",
    baseCurrency: "USD",
    themeId: "semi",
    threshold: -20,
    risk: "high",
    riskLabel: "強",
  },
  {
    id: "agg",
    symbol: "AGG",
    name: "米国総合債券",
    shortName: "米国債券",
    source: "yahoo",
    baseCurrency: "USD",
    themeId: "usbond",
    threshold: 0,
    risk: "low",
    riskLabel: "低",
  },
] as const;

/** テーマ順にグループ化した一覧。銘柄が 0 件のテーマは落とす */
export function assetsByTheme(): readonly { theme: ThemeConfig; assets: readonly AssetConfig[] }[] {
  return THEMES.map((theme) => ({ theme, assets: ASSETS.filter((a) => a.themeId === theme.id) })).filter(
    (g) => g.assets.length > 0,
  );
}

/**
 * 日足系列のスケール補正方針(lib/normalize.ts)。既定は全銘柄 "auto"。
 *
 * 東証上場 ETF は Yahoo 側で株式分割が遡及調整されないことがあり
 * (2559.T の 2026-06-05 の 1:10 分割、1655.T の 2017-09-28 の 1:10 分割。
 *  どちらも events.splits は空で返る)、放置すると最高値が 10 倍のままになる。
 * 1 日だけ OHLC が 1/10 で記録されるデータ異常も実在する
 * (2559.T 2026-06-08、1655.T 2022-02-08〜09)。
 *
 * 自動判定が誤ったときはここに書いて上書きする:
 *   "off"                                              補正しない
 *   { splits: [{ date: "2026-06-05", ratio: 10 }] }    その日より前を ÷10
 *   { outliers: [{ date: "2026-06-08", factor: 10 }] } その日の OHLC を ×10
 */
export const SERIES_NORMALIZATION: Readonly<Record<string, NormalizationRule>> = {};

export const ASSET_BY_ID: ReadonlyMap<string, AssetConfig> = new Map(ASSETS.map((a) => [a.id, a]));

/**
 * quote 取得でまとめて問い合わせるシンボル。
 * ★順序が `unstable_cache` のキーの一部になるため固定する。
 * ★投信(source: "toushin")は Yahoo に存在しないので必ず除外する。
 *   混ぜるとバンドル全体のレスポンスが壊れる。
 * ★為替は FX_PAIRS の全ペアを載せる。1 リクエストにまとめて問い合わせるので
 *   ペアが増えても Yahoo へのリクエスト回数は増えない。
 */
export const QUOTE_SYMBOLS: readonly string[] = [
  ...ASSETS.filter((a) => a.source === "yahoo").map((a) => a.symbol),
  ...FX_PAIR_IDS.map((id) => FX_PAIRS[id].symbol),
];

/**
 * 全期間最高値をどの系列で取るか。
 *
 * - "close"    : 日足終値の最大。比較対象の現在値(regularMarketPrice)と同じ基準になるため既定。
 * - "high"     : 日足ザラ場高値の最大。X が数%深く出る。
 * - "adjclose" : 配当再投資込み。分子も adjclose に揃えないと基準がずれるので通常は使わない。
 */
export const ATH_PRICE_BASIS: "close" | "high" | "adjclose" = "close";

/** 銘柄ごとに ATH の基準を上書きしたい場合はここに書く(例: AGG を配当込みで見る) */
export const ATH_BASIS_OVERRIDES: Readonly<Record<string, "close" | "high" | "adjclose">> = {};

export const CACHE = {
  /** 現在値のサーバーキャッシュ秒数。仕様書 §4 の「30〜60秒程度」 */
  QUOTES_REVALIDATE_SEC: 45,
  /** 全期間履歴のサーバーキャッシュ秒数。仕様書 §4 の「長め(1日程度)」 */
  HISTORY_REVALIDATE_SEC: 60 * 60 * 24,
  /** クライアントのポーリング間隔。仕様書 §4 の「SWRで60秒おき」 */
  CLIENT_REFRESH_MS: 60_000,
  /** チャート(履歴)のポーリング間隔。60秒は不要 */
  CHART_REFRESH_MS: 5 * 60_000,
  /** Yahoo へのリクエストタイムアウト */
  YAHOO_TIMEOUT_MS: 8_000,
  /**
   * 投信の基準価額を投資信託協会から取り直す間隔。
   * 基準価額は 1 営業日に 1 度しか更新されず、CSV は設定来の全履歴を一括で返す
   * (差分 API が無い)ため、短い間隔で叩く意味が無い。
   * 実データは SQLite に永続化されるので、この間隔の内側は DB だけで応答する。
   */
  NAV_REVALIDATE_SEC: 6 * 60 * 60,
  /** 投資信託協会へのリクエストタイムアウト。CSV が数百 KB あるので Yahoo より長め */
  TOUSHIN_TIMEOUT_MS: 20_000,
} as const;

/** 仕様書 §4 の `range=max` 相当。Yahoo 側が firstTradeDate にクランプする */
export const HISTORY_PERIOD1 = "1970-01-01";
/** period1 が古すぎて弾かれた場合のフォールバック */
export const HISTORY_PERIOD1_FALLBACK = "2000-01-01";

/** 日足チャートで返す最大遡及年数(転送量の抑制)。週/月/年足は全期間 */
export const DAILY_CHART_LOOKBACK_YEARS = 10;

/**
 * チャートの表示期間。足種(ローソクの粒度)とは独立した「X 軸の範囲」。
 * 期間の絞り込みはクライアント側で行うので、切り替えても再フェッチは発生しない。
 */
export const CHART_PERIODS: readonly { value: ChartPeriod; label: string; months: number | null }[] = [
  { value: "1m", label: "1ヶ月", months: 1 },
  { value: "6m", label: "6ヶ月", months: 6 },
  { value: "1y", label: "1年", months: 12 },
  { value: "3y", label: "3年", months: 36 },
  { value: "5y", label: "5年", months: 60 },
  { value: "10y", label: "10年", months: 120 },
  { value: "all", label: "全期間", months: null },
] as const;

/** チャートを開いたときの既定の表示期間 */
export const DEFAULT_CHART_PERIOD: ChartPeriod = "1y";

/** この時間より古い取得時刻は「鮮度が落ちている」として警告色にする */
export const STALE_AFTER_MS = 5 * 60_000;

/** 画面表示用のタイムゾーン。サーバー(UTC)とブラウザ(JST)で表示がずれないよう固定する */
export const DISPLAY_TIME_ZONE = "Asia/Tokyo";

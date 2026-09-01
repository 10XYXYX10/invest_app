/**
 * アプリ全体で共有する型。
 *
 * ★重要: `unstable_cache` はキャッシュヒット時に JSON デシリアライズした値を返し、
 * ミス時は関数の戻り値をそのまま返す。`Date` / `Map` / `Set` / `undefined` を
 * キャッシュ境界を越える型に入れると「初回は Date・2回目以降は string」という
 * 非対称バグになるため、日付は 'YYYY-MM-DD'、時刻は ISO8601 文字列に潰しきる。
 */

export type RiskLevel = "low" | "medium" | "high";
export type DataStatus = "live" | "stale" | "error";
export type CandleInterval = "daily" | "weekly" | "monthly" | "yearly";
export type ChartKind = "line" | "candlestick";

/** 価格の建て通貨。表示通貨の指定にも使う */
export type Currency = "USD" | "JPY";
/** 価格系列の取得元。yahoo = 海外上場 ETF、toushin = 投資信託協会の基準価額 */
export type AssetSource = "yahoo" | "toushin";
/** チャートの表示期間 */
export type ChartPeriod = "1m" | "6m" | "1y" | "3y" | "5y" | "10y" | "all";

/**
 * 日足系列に加えた補正の記録(lib/normalize.ts)。
 * - "split"   : 取得元で未調整だった株式分割。効力発生日より前のバーを遡及調整した
 * - "outlier" : 1〜数日ぶんの価格スケールが異常だったので掛け戻した
 * - "suspect" : 段差を検出したが分割かデータ異常か判別できず、補正していない
 */
export interface SeriesCorrection {
  kind: "split" | "outlier" | "suspect";
  date: DateKey;
  /** 検出した倍率。1:10 の分割なら 10 */
  factor: number;
  /** 補正したバー数 */
  bars: number;
}

export interface ManualSplit {
  /** 分割の効力発生日。この日より前のバーが調整対象 */
  date: DateKey;
  /** 1:10 なら 10 */
  ratio: number;
}

export interface ManualOutlier {
  date: DateKey;
  /** その日の OHLC に掛ける倍率 */
  factor: number;
}

/**
 * 銘柄ごとの正規化方針。
 * "auto" が既定。自動判定が誤ったときだけ "off" か手動指定に切り替える。
 */
export type NormalizationRule =
  | "auto"
  | "off"
  | { splits?: readonly ManualSplit[]; outliers?: readonly ManualOutlier[] };

/** 'YYYY-MM-DD'(取引所ローカル日付)。lightweight-charts の BusinessDay 文字列と互換 */
export type DateKey = string;
/** ISO 8601 UTC 文字列 */
export type IsoTimestamp = string;

// ---------- 設定 ----------

/** 一覧をまとめる投資テーマ。同じ対象を投資信託と ETF の両方で持つことがある */
export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
}

/**
 * 為替乖離 Y を測る通貨ペア。
 * ★「価格の円換算」に使うペアとは別物。円換算は常にドル円(lib/services/history.ts)。
 */
export type FxPairId = "USDJPY" | "INRJPY";

export interface FxPairConfig {
  id: FxPairId;
  /** Yahoo ティッカー */
  symbol: string;
  /** 画面ラベル。例 "ドル円" */
  label: string;
  /** Y の基準値(中央値) */
  base: number;
  /**
   * レート表示の小数桁。
   * ★ルピー円は 1.65 付近なので 2 桁だと日々の値動きが丸めで消える。
   */
  fractionDigits: number;
  /** 基準値の根拠。UI にそのまま出す 1 文 */
  baseNote: string;
  /** 「中身は何建てか」の一文。円建て銘柄の注記に埋め込む */
  exposureNote: string;
}

export interface AssetConfig {
  /** URL に使う slug。例 "smh" */
  id: string;
  /** Yahoo ティッカー("SMH")または投信協会コード("0331418A") */
  symbol: string;
  name: string;
  shortName: string;
  /** 買いしきい値。指数がこの値以下でシグナル点灯 */
  threshold: number;
  risk: RiskLevel;
  riskLabel: string;
  /** 価格系列の取得元 */
  source: AssetSource;
  /**
   * 価格が本来何建てで公表されているか。
   * ★JPY 建て(投資信託の基準価額)は為替が既に織り込まれているため、
   *   割安度指数に為替乖離 Y を足すと二重計上になる。lib/services/dashboard.ts を参照。
   */
  baseCurrency: Currency;
  /** source === "toushin" のときのみ。投信協会 CSV の isinCd パラメータ */
  isinCd?: string;
  /** 所属する投資テーマ。ThemeConfig.id と対応する */
  themeId: string;
  /**
   * 為替乖離 Y をどの通貨ペアで測るか。省略時は DEFAULT_FX_PAIR_ID("USDJPY")。
   * ★ドル建て銘柄には付けてはいけない。ドル建ては Y が indexValue に入るため、
   *   ペアを変えると買いシグナルの意味そのものが変わる(円建ては参考値だけが変わる)。
   */
  fxPairId?: FxPairId;
  /** 画面に出すコード。省略時は symbol(Yahoo 用の "2559.T" ではなく "2559" と出したい) */
  displaySymbol?: string;
  /** この銘柄固有の為替の注意書き。テンプレの解説では拾えない事情を 1 文で */
  fxNote?: string;
}

// ---------- /api/quotes ----------

/**
 * 通貨ペア 1 本ぶんの現在値と乖離。
 * ★全フィールドを必須 + nullable にする。`undefined` はキャッシュ境界を越えられない。
 */
export interface FxSnapshot {
  /** 通貨ペア識別子。UI の出し分けキー */
  id: FxPairId;
  symbol: string;
  /** 画面ラベル。"ドル円" / "ルピー円" */
  label: string;
  /** 対円の現在レート */
  rate: number | null;
  /** 基準値(中央値)。USDJPY=150 / INRJPY=1.65 */
  base: number;
  /** レート表示の小数桁 */
  fractionDigits: number;
  /** 基準値の根拠。UI にそのまま出す */
  baseNote: string;
  /** 「中身は何建てか」の一文 */
  exposureNote: string;
  /** Y = (rate - base) / base * 100 */
  deviationPct: number | null;
  marketState: string | null;
  fetchedAt: IsoTimestamp | null;
  status: DataStatus;
}

export interface AssetQuote {
  id: string;
  symbol: string;
  /** 画面に出すコード(AssetConfig.displaySymbol ?? symbol) */
  displaySymbol: string;
  name: string;
  shortName: string;
  /** 価格系列の取得元。文言の出し分けに使う(投資信託か上場 ETF か) */
  source: AssetSource;
  themeId: string;
  risk: RiskLevel;
  riskLabel: string;
  threshold: number;

  /** 価格が本来公表されている通貨。UI はこちらを主表示にする */
  baseCurrency: Currency;
  /** 割安度指数に為替乖離 Y を含めているか(= baseCurrency === "USD") */
  usesFxDeviation: boolean;

  /** 現在価格(baseCurrency 建て)。X の分子はこれ */
  priceNative: number | null;
  /** 現在のドル建て価格。JPY 銘柄では priceNative / fx.rate */
  priceUsd: number | null;
  /** 現在の円建て価格。USD 銘柄では priceNative * fx.rate */
  priceJpy: number | null;

  /** 全期間最高値(baseCurrency 建て)。X の分母はこれ */
  allTimeHighNative: number | null;
  /** 全期間最高値(ドル建て) */
  allTimeHighUsd: number | null;
  /** 最高値の円換算。※当時のレートではなく現在レートでの換算 */
  allTimeHighJpy: number | null;
  allTimeHighDate: DateKey | null;
  /** 「全期間」の実際の起点。UI に出して誤解を防ぐ */
  historyStartDate: DateKey | null;

  /** X = (priceNative - allTimeHighNative) / allTimeHighNative * 100 */
  drawdownPct: number | null;
  /** 割安度指数。USD 建て = X + Y / JPY 建て = X。しきい値判定はこの値だけで行う */
  indexValue: number | null;
  isBuySignal: boolean;

  /**
   * 為替乖離 Y。★この銘柄の通貨ペア(fxPair)で計算した値。
   * 全銘柄が同じ値だった頃と違い、ペアが違えば値も違う
   * (インド Nifty50 だけルピー円基準)。
   */
  fxDeviationPct: number | null;
  /**
   * この銘柄の Y を測っている通貨ペアのスナップショット。
   * ★カード・詳細が payload.fxPairs を引かずに済むよう値ごと埋め込む。
   */
  fxPair: FxSnapshot;
  /**
   * 円建て銘柄だけの参考指数 = X + Y。
   * ★しきい値判定には使わない。円建て価格には為替が既に織り込まれているため、
   *   これは「ドル円が基準値へ戻った場合に割安度がどう見えるか」の目安に過ぎない。
   *   ドル建て銘柄は indexValue に Y が入っているので null。
   */
  fxAdjustedIndex: number | null;
  /**
   * 現在レートから基準レートへ戻ったときの、外貨部分の円換算値の変化率。
   * 円建て銘柄のみ。円高で負(= 目減り)。
   */
  fxRevertImpactPct: number | null;
  /** 銘柄固有の為替の注意書き */
  fxNote: string | null;

  currency: string | null;
  /** "REGULAR" | "CLOSED" | "PRE" | "POST" ... */
  marketState: string | null;
  quoteFetchedAt: IsoTimestamp | null;
  historyFetchedAt: IsoTimestamp | null;
  status: DataStatus;
  warnings: string[];
}

export interface DashboardPayload {
  /**
   * ドル円。★後方互換のために残す。銘柄ごとの基準は AssetQuote.fxPair を見ること。
   * UI からは参照しない(ヘッダーは fxPairs、カード/詳細は asset.fxPair)。
   */
  fx: FxSnapshot;
  /** 使用中の通貨ペア全て。FX_PAIR_IDS の順。ヘッダーの並列表示用 */
  fxPairs: FxSnapshot[];
  assets: AssetQuote[];
  /** レスポンスを組み立てた時刻(キャッシュヒットでも毎回更新される) */
  servedAt: IsoTimestamp;
  /** 子要素の中で最も悪い状態 */
  status: DataStatus;
  warnings: string[];
}

// ---------- /api/history/[symbol] ----------

export interface Candle {
  time: DateKey;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FxCoverage {
  from: DateKey | null;
  to: DateKey | null;
  /** FX 系列より古くて円換算できず除外したバー数 */
  droppedBars: number;
  /** 同日の FX バーが無く前営業日で補完したバー数(分母は sourceBars) */
  forwardFilled: number;
  /** 円換算の対象になった日足の本数。forwardFilled / droppedBars の分母 */
  sourceBars: number;
  fetchedAt: IsoTimestamp | null;
}

export interface HistoryPayload {
  id: string;
  symbol: string;
  name: string;
  interval: CandleInterval;
  /** 価格が本来公表されている通貨 */
  baseCurrency: Currency;
  /** このレスポンスの candles / 価格の通貨(リクエストの ?currency=) */
  currency: Currency;
  /** currency 建て・集計済み・昇順・重複なし */
  candles: Candle[];
  /**
   * 為替換算のカバレッジ。
   * currency === baseCurrency のときは換算していないので全て 0 になる。
   */
  fx: FxCoverage;

  /** 全期間最高値(baseCurrency 建て) */
  allTimeHighNative: number | null;
  allTimeHighUsd: number | null;
  allTimeHighJpy: number | null;
  allTimeHighDate: DateKey | null;
  historyStartDate: DateKey | null;

  historyFetchedAt: IsoTimestamp | null;
  servedAt: IsoTimestamp;
  status: DataStatus;
  warnings: string[];
}

// ---------- サーバー内部(キャッシュに載る形) ----------

export interface DailyBar {
  date: DateKey;
  open: number;
  high: number;
  low: number;
  close: number;
  adjclose: number | null;
  volume: number | null;
}

/**
 * 投資信託の基準価額 1 行分。投資信託協会 CSV の生に近い形。
 * OHLC が無いのが Yahoo の DailyBar との決定的な違い。
 */
export interface NavRow {
  date: DateKey;
  /** 基準価額(円) */
  nav: number;
  /** 純資産総額(百万円) */
  netAssets: number | null;
  /** 分配金(円)。無分配の日は null */
  distribution: number | null;
}

export interface HistorySeries {
  symbol: string;
  /** 日付昇順・重複なし・OHLC が null の行は除去済み */
  bars: DailyBar[];
  firstTradeDate: DateKey | null;
  /** 取引所タイムゾーン。日付キーの導出に使ったもの */
  timezone: string;
  splitCount: number;
  /** lib/normalize.ts がこの系列に加えた補正。空なら無補正 */
  corrections: SeriesCorrection[];
  /** Yahoo から実際に取得できた時刻 */
  fetchedAt: IsoTimestamp;
}

export interface QuoteSnapshot {
  symbol: string;
  price: number | null;
  currency: string | null;
  marketState: string | null;
  /** 取引所側のタイムスタンプ */
  marketTime: IsoTimestamp | null;
}

export interface QuoteBundle {
  bySymbol: Record<string, QuoteSnapshot>;
  fetchedAt: IsoTimestamp;
}

export interface AllTimeHigh {
  value: number | null;
  date: DateKey | null;
}

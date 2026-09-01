import { index, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * 投資信託の基準価額(日次)。
 *
 * 投資信託協会の CSV は差分取得ができず、毎回「設定来の全履歴」を返す。
 * そのぶんをここに永続化しておくことで、
 *   - プロセス再起動をまたいでも即座に応答できる(unstable_cache はメモリ/ファイルの揮発層)
 *   - 協会側が落ちていても直近の値でチャートを描ける
 *   - 遡って改訂された基準価額も upsert で自然に追随する
 *
 * symbol は投信協会コード(例 "0331418A")、date は 'YYYY-MM-DD'。
 */
export const navBars = sqliteTable(
  "nav_bars",
  {
    symbol: text("symbol").notNull(),
    date: text("date").notNull(),
    /** 基準価額(円) */
    close: real("close").notNull(),
    /** 純資産総額(百万円) */
    netAssets: real("net_assets"),
    /** 分配金(円) */
    distribution: real("distribution"),
  },
  (t) => [
    primaryKey({ columns: [t.symbol, t.date] }),
    // 銘柄ごとに日付昇順で全件読むのが唯一のアクセスパターン
    index("nav_bars_symbol_date_idx").on(t.symbol, t.date),
  ],
);

/** 銘柄ごとの取得メタ情報。再取得の要否はここの fetched_at で判断する */
export const seriesMeta = sqliteTable("series_meta", {
  symbol: text("symbol").primaryKey(),
  /** ISO 8601 UTC */
  fetchedAt: text("fetched_at").notNull(),
  firstTradeDate: text("first_trade_date"),
});

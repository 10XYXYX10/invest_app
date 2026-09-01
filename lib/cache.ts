import "server-only";
import { unstable_cache } from "next/cache";

import { CACHE } from "./config";
import { rememberGood } from "./lastGood";
import { fetchDailyHistory, fetchQuotes } from "./yahoo";
import type { HistorySeries, QuoteBundle } from "./types";

/**
 * キャッシュ層はこのファイルに閉じ込める。
 *
 * `unstable_cache` は Next 16 では将来 `use cache` に置き換わる予定だが、
 * 本プロジェクトは `cacheComponents` を有効にしていないので現状これが正しい選択。
 * 将来移行する際はこのファイルだけを `"use cache"` + `cacheLife`/`cacheTag` に書き換える。
 *
 * 注意:
 * - キャッシュキーは「関数のソース文字列 + 引数 + keyParts」から作られる。
 *   関数本体を編集するとキーが変わってキャッシュが飛ぶ。
 * - 引数は必ず同じ順序で渡すこと(`QUOTE_SYMBOLS` を定数化してあるのはこのため)。
 * - キャッシュ関数の中で `headers()` / `cookies()` を呼んではいけない。
 * - 戻り値は JSON プリミティブのみ(`lib/types.ts` の内部型がそれを保証している)。
 */

/** 全銘柄 + ドル円の現在値。閲覧者が何人いても Yahoo へは 1 req / 45秒 */
export const getCachedQuotes = unstable_cache(
  async (symbols: string[]): Promise<QuoteBundle> => {
    const bundle = await fetchQuotes(symbols);
    rememberGood("quotes", bundle);
    return bundle;
  },
  ["yf", "quotes", "v1"],
  { revalidate: CACHE.QUOTES_REVALIDATE_SEC, tags: ["quotes"] },
);

/** 銘柄ごとの全期間日足。symbol は引数なので自動でキャッシュキーに含まれる */
export const getCachedHistory = unstable_cache(
  async (symbol: string): Promise<HistorySeries> => {
    const series = await fetchDailyHistory(symbol);
    rememberGood(`history:${symbol}`, series);
    return series;
  },
  ["yf", "history", "v1"],
  { revalidate: CACHE.HISTORY_REVALIDATE_SEC, tags: ["history"] },
);

import "server-only";

interface Entry<T> {
  value: T;
  at: string;
}

/**
 * 直近で取得に成功した値をプロセス内に保持する(仕様書 §4 のフォールバック)。
 *
 * ★Vercel の制約: この Map は関数インスタンスごとに存在し、cold start では空、
 * デプロイをまたげば当然消える。したがって「直近値の保持」をここだけに頼ってはいけない。
 * 実際の永続層は `unstable_cache`(Vercel Data Cache)で、こちらはインスタンス・
 * リージョンを跨いで共有され再検証が失敗しても古い値を返す。
 * この Map は「Data Cache が完全に無効化された直後に Yahoo が 429/503 を返した」
 * という狭い穴を塞ぐベストエフォートに過ぎない。
 */
const store = new Map<string, Entry<unknown>>();

export function rememberGood<T>(key: string, value: T): void {
  store.set(key, { value, at: new Date().toISOString() });
}

export function recallGood<T>(key: string): Entry<T> | null {
  const hit = store.get(key);
  return hit ? (hit as Entry<T>) : null;
}

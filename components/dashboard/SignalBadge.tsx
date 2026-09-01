/**
 * シグナル状態バッジ(仕様書 §3.1)。
 * 色だけに頼らず必ずテキストと記号を添える。
 */
export function SignalBadge({ on, unknown }: { on: boolean; unknown?: boolean }) {
  if (unknown) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        <span aria-hidden>?</span> 判定不能
      </span>
    );
  }
  return on ? (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
      <span aria-hidden>●</span> 買いシグナル点灯
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
      <span aria-hidden>○</span> 待機
    </span>
  );
}

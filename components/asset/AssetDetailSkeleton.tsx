/**
 * 個別ページ(概要)のプレースホルダ。
 * ★AssetDetailClient の実レイアウト(状態行 → 指数カード → 6 マスの内訳 → 注記 → CTA)を
 *   なぞる。ブロック 1 枚で代用するとデータ到着時に大きく跳ねる。
 */
export function AssetDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="flex items-center justify-between gap-2">
        <div className="h-4 w-40 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
        <div className="h-5 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
      </div>

      <div className="h-36 animate-pulse rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />

      <div className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl border border-zinc-200 p-4 sm:grid-cols-3 dark:border-zinc-800">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="h-3 w-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
            <div className="h-4 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
          </div>
        ))}
      </div>

      <div className="h-40 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}

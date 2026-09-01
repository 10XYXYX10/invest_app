/**
 * FxHeader のプレースホルダ。
 * ★これが無いと、データ到着時に sticky ヘッダーが差し込まれて一覧全体が下にずれる。
 *   高さと通貨ペアの本数を実物に合わせること。
 */
export function FxHeaderSkeleton() {
  return (
    <div
      className="sticky top-0 z-10 -mx-4 mb-4 border-b border-zinc-200/70 px-4 py-2.5 sm:-mx-6 sm:px-6 dark:border-zinc-800/70"
      aria-hidden
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-1.5">
        <div className="h-7 w-44 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
        <div className="h-7 w-44 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
        <div className="ml-auto h-7 w-28 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
      </div>
    </div>
  );
}

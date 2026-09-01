import { assetsByTheme } from "@/lib/config";
import { FxHeaderSkeleton } from "./FxHeaderSkeleton";

const GROUPS = assetsByTheme();

export function DashboardSkeleton() {
  return (
    <div aria-hidden>
      {/* ヘッダーぶんの高さを先に確保する。無いとデータ到着時に一覧全体が下へずれる */}
      <FxHeaderSkeleton />
      <div className="flex flex-col gap-8">
      {GROUPS.map(({ theme, assets }) => (
        <section key={theme.id}>
          <div className="mb-3 h-8 w-48 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((a) => (
              <div
                key={a.id}
                className="h-72 animate-pulse rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
              />
            ))}
          </div>
        </section>
      ))}
      </div>
    </div>
  );
}

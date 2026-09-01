"use client";

import useSWR from "swr";

import { assetsByTheme } from "@/lib/config";
import type { AssetQuote, DashboardPayload } from "@/lib/types";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { AssetCard } from "./AssetCard";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { FxHeader } from "./FxHeader";

/**
 * テーマの並びと所属は config が唯一の情報源。
 * ここでは API が返した銘柄を id で引き当てるだけにする。
 */
const GROUPS = assetsByTheme();

export default function DashboardClient({ fallbackData }: { fallbackData?: DashboardPayload }) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<DashboardPayload>("/api/quotes", { fallbackData });

  // keepPreviousData により、取得に失敗しても data には直前の成功値が残る。
  // 画面を空にせず、その上にエラーの帯を重ねる(仕様書 §4)。
  if (!data) {
    return isLoading ? (
      <DashboardSkeleton />
    ) : (
      <ErrorNotice messages={[error instanceof Error ? error.message : "データを取得できませんでした"]} onRetry={() => void mutate()} />
    );
  }

  const byId = new Map<string, AssetQuote>(data.assets.map((a) => [a.id, a]));

  const notices = [
    ...data.warnings,
    ...(error instanceof Error ? [`最新の取得に失敗しました(表示は直近の値です): ${error.message}`] : []),
  ];

  return (
    <>
      <FxHeader pairs={data.fxPairs} onRefresh={() => void mutate()} isValidating={isValidating} />
      <div className="mx-auto w-full max-w-6xl" aria-live="polite">
        <ErrorNotice messages={notices} onRetry={() => void mutate()} />
        <div className="flex flex-col gap-8">
          {GROUPS.map(({ theme, assets }) => {
            const quotes = assets.map((a) => byId.get(a.id)).filter((q): q is AssetQuote => q !== undefined);
            if (quotes.length === 0) return null;
            return (
              <section key={theme.id}>
                <div className="mb-3 border-b border-zinc-200 pb-1.5 dark:border-zinc-800">
                  <h2 className="text-sm font-semibold">{theme.name}</h2>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{theme.description}</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {quotes.map((q) => (
                    <AssetCard key={q.id} asset={q} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}

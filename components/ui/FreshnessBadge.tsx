"use client";

import { STALE_AFTER_MS } from "@/lib/config";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import type { DataStatus } from "@/lib/types";
import { useNow } from "@/lib/useNow";

/**
 * データの鮮度(仕様書 §4「取得時刻を画面に表示する」)。
 *
 * 「◯分前」は現在時刻に依存しハイドレーションを壊すので、マウント後にだけ計算する。
 * サーバーで描画される初期 HTML には絶対時刻(タイムゾーン固定)だけを載せる。
 */
export function FreshnessBadge({
  fetchedAt,
  status,
  label = "取得",
}: {
  fetchedAt: string | null;
  status: DataStatus;
  label?: string;
}) {
  const now = useNow();

  const age = now !== 0 && fetchedAt ? now - new Date(fetchedAt).getTime() : 0;
  const warn = status !== "live" || age > STALE_AFTER_MS;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${
        warn
          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
      title={fetchedAt ?? undefined}
    >
      {label} {fmtDateTime(fetchedAt)}
      {now !== 0 ? <span className="opacity-70">({fmtRelative(fetchedAt, now)})</span> : null}
    </span>
  );
}

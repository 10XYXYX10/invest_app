"use client";

import Link from "next/link";
import useSWR from "swr";

import {
  DASH,
  athLabel,
  fmtDateKey,
  fmtJpy,
  fmtPct,
  fmtPctPlain,
  fmtRate,
  fmtUsd,
  priceLabel,
  sourceLabel,
} from "@/lib/format";
import type { AssetConfig, DashboardPayload } from "@/lib/types";
import { AssetDetailSkeleton } from "@/components/asset/AssetDetailSkeleton";
import { FxRiskNote } from "@/components/asset/FxRiskNote";
import { SignalBadge } from "@/components/dashboard/SignalBadge";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { FreshnessBadge } from "@/components/ui/FreshnessBadge";
import { Stat } from "@/components/ui/Stat";

/**
 * 個別ページ(概要)。
 *
 * ★専用の API は作らない。/api/quotes が全銘柄を 1 レスポンスで返すので、
 * 一覧と同じ SWR キーを共有すれば追加の通信なしに描画できる
 * (dedupe と keepPreviousData が効くため、一覧からの遷移は即座に表示される)。
 */
export default function AssetDetailClient({ asset: config }: { asset: AssetConfig }) {
  const { data, error, isLoading, mutate } = useSWR<DashboardPayload>("/api/quotes");

  const asset = data?.assets.find((a) => a.id === config.id) ?? null;

  if (!asset) {
    return isLoading ? (
      <AssetDetailSkeleton />
    ) : (
      <ErrorNotice
        messages={[error instanceof Error ? error.message : "この銘柄のデータを取得できませんでした"]}
        onRetry={() => void mutate()}
      />
    );
  }

  // 為替乖離 Y を測っているペア。銘柄ごとに違う(インド Nifty50 はルピー円)
  const pair = asset.fxPair;
  const pairSuffix = pair.id === "USDJPY" ? "" : `(${pair.label})`;

  const jpyBased = asset.baseCurrency === "JPY";
  const fmtMain = jpyBased ? fmtJpy : fmtUsd;
  const fmtSub = jpyBased ? fmtUsd : fmtJpy;

  const notices = [
    ...asset.warnings,
    ...(error instanceof Error ? [`最新の取得に失敗しました(表示は直近の値です): ${error.message}`] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {sourceLabel(asset.source, asset.baseCurrency)} · リスク {asset.riskLabel}
        </span>
        <FreshnessBadge fetchedAt={asset.quoteFetchedAt} status={asset.status} />
      </div>

      <ErrorNotice messages={notices} onRetry={() => void mutate()} />

      {/* ---- 指数とシグナル ---- */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <SignalBadge on={asset.isBuySignal} unknown={asset.indexValue === null} />
        <p className="mt-2 font-mono text-4xl font-semibold leading-none tabular-nums">
          {asset.indexValue === null ? DASH : fmtPct(asset.indexValue)}
        </p>
        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          {asset.usesFxDeviation ? "円ベース割安度指数 = X + Y" : "割安度指数 = X"} /{" "}
          しきい値 {fmtPctPlain(asset.threshold)} 以下で点灯
        </p>

        {asset.fxAdjustedIndex !== null ? (
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              為替調整後(参考){pairSuffix} = X + Y
            </span>
            <span className="font-mono text-xl tabular-nums">{fmtPct(asset.fxAdjustedIndex)}</span>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              シグナル判定には使いません(下の解説を参照)
            </span>
          </div>
        ) : null}
      </section>

      {/* ---- 数値の内訳 ---- */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-950">
        <Stat
          label={priceLabel(asset.source)}
          value={fmtMain(jpyBased ? asset.priceJpy : asset.priceUsd)}
          sub={fmtSub(jpyBased ? asset.priceUsd : asset.priceJpy)}
        />
        <Stat
          label={athLabel(asset.source)}
          value={fmtMain(jpyBased ? asset.allTimeHighJpy : asset.allTimeHighUsd)}
          sub={`${fmtSub(jpyBased ? asset.allTimeHighUsd : asset.allTimeHighJpy)} / ${fmtDateKey(asset.allTimeHighDate)}`}
        />
        <Stat
          label="高値からの下落率 X"
          value={fmtPct(asset.drawdownPct)}
          tone={asset.drawdownPct !== null && asset.drawdownPct < 0 ? "down" : undefined}
          sub="(現在値 − 最高値) ÷ 最高値"
        />
        <Stat
          label={`為替乖離 Y(${pair.label})`}
          value={fmtPct(asset.fxDeviationPct)}
          sub={`現在 ${fmtRate(pair.rate, pair.fractionDigits)} 円 / 中央値 ${pair.base} 円`}
        />
        <Stat label="しきい値" value={`${fmtPctPlain(asset.threshold)} 以下`} sub={`リスク度 ${asset.riskLabel}`} />
        <Stat
          label="全期間の起点"
          value={fmtDateKey(asset.historyStartDate)}
          sub={`コード ${asset.displaySymbol}`}
        />
      </dl>

      <FxRiskNote asset={asset} variant="full" />

      <Link
        href={`/asset/${asset.id}/chart`}
        prefetch
        className="flex h-12 items-center justify-center rounded-lg border border-zinc-300 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        チャートを表示
      </Link>
    </div>
  );
}

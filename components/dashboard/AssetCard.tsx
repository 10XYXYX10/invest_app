import Link from "next/link";

import { DASH, fmtJpy, fmtPct, fmtPctPlain, fmtUsd, priceLabel } from "@/lib/format";
import type { AssetQuote } from "@/lib/types";
import { FxRiskNote } from "@/components/asset/FxRiskNote";
import { SignalBadge } from "./SignalBadge";

const RISK_STYLE: Record<string, string> = {
  low: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  high: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
};

/**
 * 一覧カード(仕様書 §3.1)。
 *
 * ★一覧では「判断に必要な数字」だけを置き、内訳・最高値・解説・警告の全文は
 * 詳細ページ(/asset/[id])に送る。銘柄が増えても一覧が読めるようにするため。
 * ★カード全体を 1 つのリンクにする(モバイルでタップ範囲を稼ぐ)。
 * 中に別のリンクを置くと入れ子リンクになるので置かないこと。
 */
export function AssetCard({ asset }: { asset: AssetQuote }) {
  const unknown = asset.indexValue === null;
  const lit = asset.isBuySignal;

  // 建て通貨を主表示にする。投信の基準価額を「$242」と大書きしても実際には売買できない。
  const jpyBased = asset.baseCurrency === "JPY";
  const price = jpyBased ? fmtJpy(asset.priceJpy) : fmtUsd(asset.priceUsd);

  return (
    <Link
      href={`/asset/${asset.id}`}
      prefetch
      className={`flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:bg-zinc-950 dark:hover:bg-zinc-900 ${
        lit
          ? "border-emerald-500 ring-1 ring-emerald-500/30"
          : asset.status !== "live"
            ? "border-amber-300 dark:border-amber-800/70"
            : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{asset.name}</h3>
          <p className="font-mono text-[11px] text-zinc-400">{asset.displaySymbol}</p>
        </div>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${RISK_STYLE[asset.risk] ?? ""}`}>
          リスク {asset.riskLabel}
        </span>
      </header>

      <div>
        <SignalBadge on={lit} unknown={unknown} />
        <p className="mt-2 font-mono text-2xl font-semibold leading-none tabular-nums">
          {asset.indexValue === null ? DASH : fmtPct(asset.indexValue)}
        </p>
        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          {asset.usesFxDeviation ? "円ベース割安度指数 = X + Y" : "割安度指数 = X"}
          (しきい値 {fmtPctPlain(asset.threshold)} 以下)
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        <div className="min-w-0">
          <dt className="text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">高値からの下落率 X</dt>
          <dd
            className={`font-mono text-sm tabular-nums ${
              asset.drawdownPct !== null && asset.drawdownPct < 0 ? "text-rose-600 dark:text-rose-400" : ""
            }`}
          >
            {fmtPct(asset.drawdownPct)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">{priceLabel(asset.source)}</dt>
          <dd className="font-mono text-sm tabular-nums">{price}</dd>
        </div>
      </dl>

      {/* 円建て銘柄だけ、為替が基準へ戻った場合の参考指数を併記する。
          ★これはシグナル判定に使っていない。混同されないよう「参考」と明示する。 */}
      {asset.fxAdjustedIndex !== null ? (
        <div className="rounded-md bg-zinc-50 px-2.5 py-2 dark:bg-zinc-900/60">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              為替調整後(参考){asset.fxPair.id === "USDJPY" ? "" : `(${asset.fxPair.label})`} = X + Y
            </span>
            <span className="font-mono text-sm tabular-nums">{fmtPct(asset.fxAdjustedIndex)}</span>
          </div>
          <FxRiskNote asset={asset} variant="compact" />
        </div>
      ) : null}

      {asset.warnings.length > 0 ? (
        <p className="text-[11px] text-amber-700 dark:text-amber-400">
          <span aria-hidden>⚠ </span>
          注意 {asset.warnings.length} 件(詳細ページに表示)
        </p>
      ) : null}

      <span className="mt-auto flex h-11 items-center justify-center rounded-lg border border-zinc-300 text-sm font-medium dark:border-zinc-700">
        詳細を見る →
      </span>
    </Link>
  );
}

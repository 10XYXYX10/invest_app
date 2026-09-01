"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import useSWR from "swr";

import { CACHE, CHART_PERIODS, DEFAULT_CHART_PERIOD } from "@/lib/config";
import { sliceToPeriod } from "@/lib/candles";
import { athLabel, fmtDateKey, fmtJpy, fmtUsd } from "@/lib/format";
import type {
  AssetConfig,
  CandleInterval,
  ChartKind,
  ChartPeriod,
  Currency,
  HistoryPayload,
} from "@/lib/types";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { FreshnessBadge } from "@/components/ui/FreshnessBadge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

/**
 * lightweight-charts はブラウザ専用。
 * ★`ssr: false` は Server Component では使えないので、この Client Component の中で呼ぶ。
 * ダッシュボードの初期バンドルにチャートライブラリを載せない効果もある。
 */
const ChartCanvas = dynamic(() => import("./ChartCanvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />,
});

const INTERVALS: readonly { value: CandleInterval; label: string }[] = [
  { value: "daily", label: "日足" },
  { value: "weekly", label: "週足" },
  { value: "monthly", label: "月足" },
  { value: "yearly", label: "年足" },
];

const KINDS: readonly { value: ChartKind; label: string }[] = [
  { value: "line", label: "ライン" },
  { value: "candlestick", label: "ローソク足" },
];

const CURRENCIES: readonly { value: Currency; label: string }[] = [
  { value: "JPY", label: "¥ 円" },
  { value: "USD", label: "$ ドル" },
];

/** ローソクが 2 本以上ないとチャートとして意味を成さない */
const MIN_CANDLES = 2;

export default function ChartClient({ asset }: { asset: AssetConfig }) {
  const [interval, setInterval] = useState<CandleInterval>("daily");
  const [period, setPeriod] = useState<ChartPeriod>(DEFAULT_CHART_PERIOD);
  const [currency, setCurrency] = useState<Currency>(asset.baseCurrency);
  const [kind, setKind] = useState<ChartKind>("line");

  // SWR はキーごとにキャッシュするので、足種や通貨を戻したときは即時に再描画される。
  // ★期間はキーに含めない。表示範囲の絞り込みはクライアント側で行うので再フェッチ不要。
  const { data, error, isLoading, mutate } = useSWR<HistoryPayload>(
    `/api/history/${asset.id}?interval=${interval}&currency=${currency.toLowerCase()}`,
    { refreshInterval: CACHE.CHART_REFRESH_MS },
  );

  const all = data?.candles;

  // 足種ごとにデータが足りない期間は選ばせない(年足 × 1ヶ月、設定から1年の投信 × 10年 など)
  const periodOptions = useMemo(
    () =>
      CHART_PERIODS.map((p) => ({
        value: p.value,
        label: p.label,
        disabled: all !== undefined && sliceToPeriod(all, p.months).length < MIN_CANDLES,
      })),
    [all],
  );

  // 選択中の期間が選べなくなったら(足種を粗くしたときなど)最も近い有効な期間に寄せる
  const effectivePeriod = useMemo<ChartPeriod>(() => {
    const chosen = periodOptions.find((p) => p.value === period);
    if (!chosen?.disabled) return period;
    return periodOptions.find((p) => !p.disabled)?.value ?? "all";
  }, [period, periodOptions]);

  const candles = useMemo(() => {
    if (!all) return [];
    const months = CHART_PERIODS.find((p) => p.value === effectivePeriod)?.months ?? null;
    return sliceToPeriod(all, months);
  }, [all, effectivePeriod]);

  const converted = data !== undefined && data.currency !== data.baseCurrency;

  const notices = [
    ...(data?.warnings ?? []),
    ...(error instanceof Error ? [`最新の取得に失敗しました(表示は直近の値です): ${error.message}`] : []),
  ];

  /**
   * ★source と baseCurrency の両方を見る。
   * 東証上場 ETF(2559 など)は円建てだが基準価額ではないので、
   * どちらか一方だけで分岐すると必ず誤った文言が出る。
   */
  const subtitle =
    asset.source === "toushin"
      ? `基準価額${converted ? "(ドル換算)" : "(円)"}`
      : asset.baseCurrency === "JPY"
        ? `取引所の円建て価格${converted ? " → ドル換算" : ""}`
        : converted
          ? "円換算(ドル建て価格 × ドル円)"
          : "ドル建て価格";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
        <FreshnessBadge fetchedAt={data?.historyFetchedAt ?? null} status={data?.status ?? "error"} />
      </div>

      <ErrorNotice messages={notices} onRetry={() => void mutate()} />

      <div className="flex flex-wrap gap-2">
        <SegmentedControl value={interval} options={INTERVALS} onChange={setInterval} ariaLabel="足種" />
        <SegmentedControl value={effectivePeriod} options={periodOptions} onChange={setPeriod} ariaLabel="表示期間" />
        <SegmentedControl value={currency} options={CURRENCIES} onChange={setCurrency} ariaLabel="表示通貨" />
        <SegmentedControl value={kind} options={KINDS} onChange={setKind} ariaLabel="表示形式" />
      </div>

      {/* ★親に明示的な高さが必要。autoSize は ResizeObserver で親を測るため、
          高さが 0 だとチャートが描画されない。 */}
      <div className="h-[58vh] min-h-[320px] w-full sm:h-[65vh] lg:h-[70vh]">
        {candles.length > 0 ? (
          <ChartCanvas candles={candles} kind={kind} currency={currency} />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-zinc-300 text-sm text-zinc-500 dark:border-zinc-700">
            {isLoading ? "読み込み中…" : "表示できるデータがありません"}
          </div>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">{athLabel(asset.source)}</dt>
          <dd className="font-mono tabular-nums">
            {currency === "USD"
              ? `${fmtUsd(data?.allTimeHighUsd ?? null)} / ${fmtJpy(data?.allTimeHighJpy ?? null)}`
              : `${fmtJpy(data?.allTimeHighJpy ?? null)} / ${fmtUsd(data?.allTimeHighUsd ?? null)}`}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">最高値の日付</dt>
          <dd className="font-mono tabular-nums">{fmtDateKey(data?.allTimeHighDate ?? null)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">データ開始</dt>
          <dd className="font-mono tabular-nums">{fmtDateKey(data?.historyStartDate ?? null)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">本数(表示 / 全体)</dt>
          <dd className="font-mono tabular-nums">
            {candles.length} / {all?.length ?? 0}
          </dd>
        </div>
      </dl>

      <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        {converted ? (
          <>
            {data.currency === "JPY"
              ? "円換算のOHLCは「ドル建てのOHLC × その日のドル円終値」による近似です(円建ての日中高値・安値は厳密には算出できないため)。"
              : `ドル換算は「円建ての${asset.source === "toushin" ? "基準価額" : "価格"} ÷ その日のドル円終値」による近似です(実際にドルで売買できるわけではありません)。`}
            {data.fx.forwardFilled > 0
              ? ` ドル円の営業日が一致しない ${data.fx.forwardFilled} / ${data.fx.sourceBars} 本は直前営業日のレートで補完しています。`
              : null}
            {data.fx.droppedBars > 0 ? ` ドル円の履歴が及ばない ${data.fx.droppedBars} 本は除外しています。` : null}
          </>
        ) : (
          <>
            価格は
            {asset.source === "toushin"
              ? "公表された基準価額"
              : asset.baseCurrency === "JPY"
                ? "取引所の円建て価格"
                : "取引所のドル建て価格"}
            そのままで、為替換算はしていません。
          </>
        )}
        {asset.source === "toushin" && kind === "candlestick" && interval === "daily"
          ? " 基準価額は1日1値のため、日足のローソクは「始値 = 前営業日の基準価額」として合成した近似です(週足・月足・年足の高値・安値は実際の基準価額から求めています)。"
          : null}
        {interval === "daily" && asset.source === "yahoo"
          ? " 日足は直近10年に絞っています(週足・月足・年足は全期間)。"
          : null}
      </p>
    </div>
  );
}

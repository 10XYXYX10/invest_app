import { fmtPct, fmtRate } from "@/lib/format";
import type { FxSnapshot } from "@/lib/types";
import { FreshnessBadge } from "@/components/ui/FreshnessBadge";

/**
 * 共通ヘッダー。仕様書 §3.1「為替乖離 Y は共通ヘッダー等に現在のドル円とあわせて表示」。
 *
 * ★通貨ペアは 1 本ではない。インド Nifty50 はルピー円で Y を測るため、
 *   使っているペアを全て並べる(FX_PAIR_IDS の順)。
 */
export function FxHeader({
  pairs,
  onRefresh,
  isValidating = false,
}: {
  pairs: FxSnapshot[];
  onRefresh?: () => void;
  isValidating?: boolean;
}) {
  // 鮮度と休場はドル円(先頭)を代表にする。
  // 全ペアが同じ quote バンドル由来なので fetchedAt は 1 つしかない。
  const primary = pairs[0] ?? null;
  const closed = primary?.marketState === "CLOSED";

  return (
    <header className="sticky top-0 z-10 -mx-4 mb-4 border-b border-zinc-200/70 bg-white/85 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6 dark:border-zinc-800/70 dark:bg-black/85">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-5 gap-y-1.5">
          {pairs.map((p) => (
            <FxPairReadout key={p.id} fx={p} />
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {closed ? (
            <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              市場休場中(最終取引値)
            </span>
          ) : null}
          <FreshnessBadge fetchedAt={primary?.fetchedAt ?? null} status={primary?.status ?? "error"} />
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isValidating}
              aria-label="最新の値を取得"
              aria-busy={isValidating}
              className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              {isValidating ? "更新中…" : "更新"}
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

/**
 * ペア 1 本の読み取り。
 * ★「為替乖離 Y」の文字ラベルは出さない。ペアが 2 本あると 2 回出て幅が破綻するため、
 *   スクリーンリーダー向けの aria-label に寄せる。
 */
function FxPairReadout({ fx }: { fx: FxSnapshot }) {
  const yenWeak = fx.deviationPct !== null && fx.deviationPct > 0;

  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{fx.label}</span>
      <span className="font-mono text-base font-semibold tabular-nums sm:text-lg">
        {fmtRate(fx.rate, fx.fractionDigits)}
      </span>
      <span
        aria-label={`${fx.label}の為替乖離 Y`}
        className={`font-mono text-sm font-semibold tabular-nums ${
          yenWeak ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
        }`}
      >
        {fmtPct(fx.deviationPct)}
      </span>
      {/* 幅が厳しいスマホでは基準値を隠す。詳細ページと一覧の解説には必ず出ている */}
      <span className="hidden whitespace-nowrap text-[11px] text-zinc-400 sm:inline">基準 {fx.base}</span>
    </div>
  );
}

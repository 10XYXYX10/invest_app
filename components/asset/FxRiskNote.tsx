import { DASH, fmtPct, fmtRate } from "@/lib/format";
import type { AssetQuote } from "@/lib/types";

/**
 * 「円建て = 為替リスクなし」ではないことを伝える注記。
 *
 * 円建ての投資信託・国内 ETF は値札(基準価額・株価)が円で表示されるだけで、
 * 中身はほぼ外貨資産。円高になれば株価が動かなくても円換算の価値は目減りする。
 * 割安度指数に Y を足していないのは二重計上を避けるためであって、
 * 為替リスクが無いからではない ―― この差をここで埋める。
 *
 * ★文中の通貨・基準値は決め打ちしない。銘柄ごとの asset.fxPair から取る
 *  (インド Nifty50 はルピー円・基準 1.65)。
 */
export function FxRiskNote({ asset, variant }: { asset: AssetQuote; variant: "compact" | "full" }) {
  const fx = asset.fxPair;
  const drop = asset.fxRevertImpactPct;
  const dropText = drop === null ? DASH : `${Math.abs(drop).toFixed(1)}%`;
  const yenWeak = drop !== null && drop < 0;
  // ドル円以外で測っている銘柄だけ、参考指数にペア名を添えて取り違えを防ぐ
  const pairSuffix = fx.id === "USDJPY" ? "" : `(${fx.label})`;

  if (asset.baseCurrency === "USD") {
    if (variant === "compact") return null;
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300">
        <p>
          ドル建ての銘柄です。割安度指数に為替乖離 Y が含まれているため、為替リスクは指数に反映済みです。
          X はドル建て価格で計算しています(円建て価格を使うと為替が二重カウントになるため)。
        </p>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">{fx.baseNote}</p>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        円建てですが中身はほぼ外貨資産です。{fx.label}が {fx.base} 円に
        {yenWeak ? "戻ると" : "動くと"}
        <span className="font-medium text-zinc-700 dark:text-zinc-200">
          {" "}
          約 {dropText} {yenWeak ? "目減り" : "増加"}
        </span>
        します。
      </p>
    );
  }

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-xs leading-relaxed text-zinc-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-zinc-200">
      <h2 className="mb-2 text-sm font-semibold">「円建て」と「為替リスクなし」は別物</h2>

      <p>
        値札(基準価額・株価)が円で表示されるだけで、中身は海外の株式です。
        <strong className="font-semibold">{fx.exposureNote}</strong>
        なので、株価が動かなくても円高になれば円換算の価値は下がります。
      </p>

      <p className="mt-2 text-zinc-600 dark:text-zinc-300">
        例えるなら「値札は円で書いてあるけれど、中身は輸入食材のお弁当」です。
        値札は円表示でも、中身の価値は為替で変わります。
      </p>

      <p className="mt-2">
        いまの{fx.label} <span className="font-mono tabular-nums">{fmtRate(fx.rate, fx.fractionDigits)}</span> 円が
        基準の <span className="font-mono tabular-nums">{fx.base}</span> 円に戻ると、
        外貨部分は{" "}
        <strong className="font-semibold">
          約 {dropText} {yenWeak ? "目減り" : "増加"}
        </strong>
        します(株価が変わらないと仮定した場合)。
      </p>

      {/* ★基準値の根拠をここで開示する。1.65 がどこから来た数字かを画面で説明する */}
      <p className="mt-1.5 text-zinc-600 dark:text-zinc-300">{fx.baseNote}</p>

      {asset.fxNote ? <p className="mt-2 text-zinc-600 dark:text-zinc-300">{asset.fxNote}</p> : null}

      <p className="mt-3 border-t border-amber-200/70 pt-2 text-zinc-600 dark:border-amber-900/50 dark:text-zinc-300">
        そのため、割安度指数 X に為替乖離 Y を足した
        <span className="font-mono">
          {" "}
          為替調整後(参考){pairSuffix} = {fmtPct(asset.fxAdjustedIndex)}
        </span>{" "}
        も併記しています。
        <strong className="font-semibold">買いシグナルの判定には使いません</strong>
        ―― 円建て価格には過去の為替が既に織り込まれており、そこに Y を足すと二重計上になるためです。
        あくまで「為替が基準値へ戻ったときの割安度の目安」として見てください。
      </p>
    </section>
  );
}

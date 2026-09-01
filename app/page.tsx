import DashboardClient from "@/components/dashboard/DashboardClient";
import { FX_PAIRS, FX_PAIR_IDS } from "@/lib/config";

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 sm:px-6 lg:px-8">
      <DashboardClient />
      <section className="mx-auto mt-8 w-full max-w-6xl space-y-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        <h2 className="font-medium text-zinc-600 dark:text-zinc-300">指数の定義</h2>
        <p>
          X(下落率) = (現在価格 − 過去最高値) ÷ 過去最高値 × 100 /{" "}
          Y(為替乖離) = (現在の為替レート − 基準値) ÷ 基準値 × 100。
          指数がしきい値以下で買いシグナルが点灯します。
        </p>
        <p>
          <strong className="font-medium">為替の基準値(中央値)は通貨ペアごと</strong>に置いています(
          {FX_PAIR_IDS.map((id) => `${FX_PAIRS[id].label} ${FX_PAIRS[id].base} 円`).join(" / ")})。
          Y をどのペアで測るかは銘柄ごとに決めており、インド Nifty50 は組入資産がルピー建てのため
          {FX_PAIRS.INRJPY.label}、それ以外は{FX_PAIRS.USDJPY.label}を使います。
          各ペアの基準値の根拠は個別ページの為替の注記に書いています。
        </p>
        <p>
          <strong className="font-medium">ドル建て銘柄(米国上場ETF)</strong>は 円ベース割安度指数 = X + Y。
          X はドル建て価格で計算します(円建て価格を使うと為替が二重カウントになるため)。
        </p>
        <p>
          <strong className="font-medium">円建て銘柄(投資信託・国内上場ETF)</strong>は 割安度指数 = X のみ。
          価格が円建てで公表され為替が既に織り込まれているため、Y を足すと同じく二重カウントになります。
        </p>
        <p>
          ただし<strong className="font-medium">円建て = 為替リスクなし ではありません</strong>。
          中身はほぼ外貨資産なので、円高になれば現地の株価が変わらなくても円換算の価値は目減りします。
          そのため円建て銘柄には <strong className="font-medium">為替調整後(参考) = X + Y</strong> を併記しています
          (為替が基準値へ戻ったときの割安度の目安。買いシグナルの判定には使いません)。
        </p>
        <p>
          過去最高値は終値(投資信託は基準価額)ベースです。米国ETFは Yahoo Finance が返す範囲、
          投資信託は投資信託協会が公表する設定来の全期間に限られます。
        </p>
      </section>
    </main>
  );
}

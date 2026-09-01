import type { ReactNode } from "react";

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "up" | "down" | "muted" }) {
  const toneClass =
    tone === "up" ? "text-emerald-600 dark:text-emerald-400" : tone === "down" ? "text-rose-600 dark:text-rose-400" : "";
  return (
    <div className="min-w-0">
      <dt className="text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className={`font-mono text-sm tabular-nums ${toneClass}`}>{value}</dd>
      {sub ? <dd className="text-[11px] leading-tight text-zinc-400 dark:text-zinc-500">{sub}</dd> : null}
    </div>
  );
}

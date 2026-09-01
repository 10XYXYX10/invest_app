"use client";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** データが足りず選ばせても意味が無い選択肢(例: 設定から1年の投信 × 10年表示) */
  disabled?: boolean;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex gap-1 overflow-x-auto rounded-lg bg-zinc-100 p-1 [scrollbar-width:none] dark:bg-zinc-900 [&::-webkit-scrollbar]:hidden"
    >
      {options.map((o) => {
        const active = o.value === value;
        const disabled = o.disabled === true;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`h-9 shrink-0 rounded-md px-3 text-sm font-medium transition-colors ${
              disabled
                ? "cursor-not-allowed text-zinc-300 dark:text-zinc-700"
                : active
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

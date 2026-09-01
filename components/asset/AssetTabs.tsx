"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** 個別ページ内の「概要 / チャート」切り替え。3 階層目に入っても現在地が分かるようにする */
export function AssetTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const onChart = pathname?.endsWith("/chart") ?? false;

  const tabs = [
    { href: `/asset/${id}`, label: "概要", active: !onChart },
    { href: `/asset/${id}/chart`, label: "チャート", active: onChart },
  ];

  return (
    <nav className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900" aria-label="表示切り替え">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          prefetch
          aria-current={t.active ? "page" : undefined}
          className={`flex h-9 flex-1 items-center justify-center rounded-md text-sm font-medium transition-colors ${
            t.active
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
              : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

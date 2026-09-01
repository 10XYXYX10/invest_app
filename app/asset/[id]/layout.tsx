import Link from "next/link";
import { notFound } from "next/navigation";

import { ASSET_BY_ID } from "@/lib/config";
import { AssetTabs } from "@/components/asset/AssetTabs";

/**
 * ★静的生成の設定(generateStaticParams / dynamicParams)はここではなく各 page.tsx に置く。
 * layout に置いても配下の page には効かず、/asset/[id]/chart が 404 になる。
 */

export default async function AssetLayout({ children, params }: LayoutProps<"/asset/[id]">) {
  const { id } = await params;
  const asset = ASSET_BY_ID.get(id);
  if (!asset) notFound();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <div className="min-w-0">
        <Link href="/" className="text-xs text-zinc-500 hover:underline dark:text-zinc-400">
          ← 一覧に戻る
        </Link>
        <h1 className="mt-0.5 text-lg font-semibold">{asset.name}</h1>
        <p className="font-mono text-[11px] text-zinc-400">{asset.displaySymbol ?? asset.symbol}</p>
      </div>
      <AssetTabs id={asset.id} />
      {children}
    </main>
  );
}

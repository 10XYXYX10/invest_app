import type { Metadata } from "next";
import { notFound } from "next/navigation";

import AssetDetailClient from "@/components/asset/AssetDetailClient";
import { ASSETS, ASSET_BY_ID } from "@/lib/config";

/**
 * 対象は config.ts の銘柄に固定なのでビルド時に静的生成し、
 * それ以外のパスは routing 層で 404 にする(dynamicParams: false)。
 * これを付けないと未知の slug でも静的シェルが HTTP 200 で返ってしまう。
 * ★layout ではなく page ごとに書く必要がある(layout の指定は子 page に届かない)。
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return ASSETS.map((a) => ({ id: a.id }));
}

// ★robots は返さない。返すとルートレイアウトの noindex を上書きしてしまう。
export async function generateMetadata({ params }: PageProps<"/asset/[id]">): Promise<Metadata> {
  const { id } = await params;
  const asset = ASSET_BY_ID.get(id);
  return { title: asset ? asset.name : "投資対象" };
}

export default async function Page({ params }: PageProps<"/asset/[id]">) {
  const { id } = await params;
  const asset = ASSET_BY_ID.get(id);
  if (!asset) notFound();
  return <AssetDetailClient asset={asset} />;
}

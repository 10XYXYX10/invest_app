import { AssetDetailSkeleton } from "@/components/asset/AssetDetailSkeleton";

/**
 * ★layout.tsx の children としてレンダリングされるので、
 * 「← 一覧に戻る / 銘柄名 / タブ」は遷移中も出たまま中身だけ skeleton になる。
 */
export default function Loading() {
  return <AssetDetailSkeleton />;
}

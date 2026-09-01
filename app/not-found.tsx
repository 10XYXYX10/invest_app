import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="text-lg font-semibold">ページが見つかりません</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">指定された投資対象は登録されていません。</p>
      <Link href="/" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
        ダッシュボードに戻る
      </Link>
    </main>
  );
}

import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";

/** ★<main> は app/page.tsx と同じ指定にする。ずれるとデータ到着時にシェルが跳ねる */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 sm:px-6 lg:px-8">
      <DashboardSkeleton />
    </main>
  );
}

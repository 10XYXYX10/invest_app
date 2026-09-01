export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="h-11 w-72 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-[58vh] min-h-[320px] w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900 sm:h-[65vh] lg:h-[70vh]" />
    </div>
  );
}

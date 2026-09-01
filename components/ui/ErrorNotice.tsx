export function ErrorNotice({ messages, onRetry }: { messages: string[]; onRetry?: () => void }) {
  if (messages.length === 0) return null;
  return (
    <div
      role="alert"
      className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <div className="flex items-start justify-between gap-3">
        <ul className="min-w-0 list-disc space-y-0.5 pl-4">
          {messages.map((m, i) => (
            <li key={i} className="break-words">
              {m}
            </li>
          ))}
        </ul>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 rounded-md border border-amber-400 px-2 py-1 text-xs font-medium hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/40"
          >
            再取得
          </button>
        ) : null}
      </div>
    </div>
  );
}

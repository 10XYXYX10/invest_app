export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * SWR 用の JSON fetcher。
 *
 * API は失敗時も 503 + ペイロード(status: "error" / warnings)を返す設計なので、
 * body があればそれを採用して UI に理由を出す。body すら取れない場合だけ throw する。
 */
export async function jsonFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  const body = await res.json().catch(() => undefined);
  if (!res.ok && body === undefined) {
    throw new ApiError(`HTTP ${res.status}`, res.status);
  }
  return body as T;
}

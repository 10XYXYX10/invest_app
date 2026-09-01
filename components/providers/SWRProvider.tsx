"use client";

import type { ReactNode } from "react";
import { SWRConfig } from "swr";

import { CACHE } from "@/lib/config";
import { jsonFetcher } from "@/lib/fetcher";

export default function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: jsonFetcher,
        // 仕様書 §4: クライアントは60秒おきに再フェッチ
        refreshInterval: CACHE.CLIENT_REFRESH_MS,
        // 取得失敗時も直前の値を描画し続ける(仕様書 §4「直近の取得済み値を表示」)
        keepPreviousData: true,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 30_000,
        errorRetryCount: 3,
        errorRetryInterval: 5_000,
        // スマホのバッテリー・通信量の節約
        refreshWhenHidden: false,
        refreshWhenOffline: false,
      }}
    >
      {children}
    </SWRConfig>
  );
}

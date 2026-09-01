"use client";

import { useSyncExternalStore } from "react";

/**
 * 「◯分前」のような現在時刻依存の表示のための共有ティッカー。
 *
 * サーバーとクライアントで値が変わるため、`useEffect` + `setState` で埋めると
 * カスケードレンダーになる(React Compiler の lint も警告する)。
 * `useSyncExternalStore` なら購読開始時に初回の値が入り、サーバーでは
 * `getServerSnapshot` が 0 を返すのでハイドレーションが一致する。
 *
 * 0 は「まだクライアントで動いていない」ことを表す。
 */
const TICK_MS = 15_000;

let nowMs = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (timer === null) {
    nowMs = Date.now();
    timer = setInterval(() => {
      nowMs = Date.now();
      for (const l of listeners) l();
    }, TICK_MS);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const getSnapshot = () => nowMs;
const getServerSnapshot = () => 0;

/** クライアントでの現在時刻(ms)。サーバー描画中と初回ハイドレーション時は 0。 */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

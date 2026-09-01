"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  LineSeries,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type SeriesType,
  type Time,
} from "lightweight-charts";

import type { Candle, ChartKind, Currency } from "@/lib/types";

const UP = "#16a34a";
const DOWN = "#dc2626";
const LINE = "#2563eb";

function isDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Y 軸と十字カーソルの価格ラベル。
 *
 * ★ドルは必ず小数第2位まで出す。円と同じく Math.round すると $553.11 が $553 になり、
 *   1% 未満の値動きが軸から消えてしまう。
 */
function localizationOptions(currency: Currency) {
  return currency === "USD"
    ? {
        locale: "en-US",
        priceFormatter: (p: number) =>
          `$${p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      }
    : {
        locale: "ja-JP",
        priceFormatter: (p: number) => `¥${Math.round(p).toLocaleString("ja-JP")}`,
      };
}

function themeOptions(dark: boolean) {
  return {
    layout: {
      // 親要素の背景を透かすことでダークモードに自動追従する
      background: { color: "transparent" },
      textColor: dark ? "#a1a1aa" : "#71717a",
      attributionLogo: false,
    },
    grid: {
      vertLines: { color: dark ? "#27272a" : "#e4e4e7" },
      horzLines: { color: dark ? "#27272a" : "#e4e4e7" },
    },
  };
}

/**
 * lightweight-charts v5 の命令的ラッパ。ブラウザ専用なので必ず ssr:false で読み込む。
 *
 * v5 では `addCandlestickSeries()` は削除され `addSeries(CandlestickSeries, opts)` になった。
 */
export default function ChartCanvas({
  candles,
  kind,
  currency,
}: {
  candles: Candle[];
  kind: ChartKind;
  currency: Currency;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null);

  // (1) チャート本体。マウント時のみ。
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    const chart = createChart(box, {
      // 親要素のサイズに追従する(ResizeObserver)。★親に高さが無いと 0px で何も描かれない
      autoSize: true,
      ...themeOptions(isDark()),
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: false },
      crosshair: { mode: 1 },
      // localization は下の (1b) が設定する。あちらもマウント時に必ず走るので、
      // ここで初期値を持つと currency を依存に持てない (1) と二重管理になる。
    });
    chartRef.current = chart;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onTheme = () => chart.applyOptions(themeOptions(mq.matches));
    mq.addEventListener("change", onTheme);

    return () => {
      mq.removeEventListener("change", onTheme);
      // StrictMode の二重実行やページ離脱でリークしないよう必ず破棄する
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // (1b) 表示通貨。チャートを作り直すと不要な再描画とチラつきが出るのでオプションだけ差し替える。
  useEffect(() => {
    chartRef.current?.applyOptions({ localization: localizationOptions(currency) });
  }, [currency]);

  // (2) 系列の張り替え。表示形式の変更時のみ。
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    seriesRef.current =
      kind === "candlestick"
        ? chart.addSeries(CandlestickSeries, {
            upColor: UP,
            downColor: DOWN,
            borderUpColor: UP,
            borderDownColor: DOWN,
            wickUpColor: UP,
            wickDownColor: DOWN,
          })
        : chart.addSeries(LineSeries, { color: LINE, lineWidth: 2 });
  }, [kind]);

  // (3) データ投入。
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || candles.length === 0) return;

    // API 側で昇順・重複なしを保証しているのでここでは並べ替えない
    if (kind === "candlestick") {
      (series as ISeriesApi<"Candlestick">).setData(
        candles.map((c) => ({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close })) as CandlestickData[],
      );
    } else {
      (series as ISeriesApi<"Line">).setData(
        candles.map((c) => ({ time: c.time as Time, value: c.close })) as LineData[],
      );
    }
    chartRef.current?.timeScale().fitContent();
  }, [candles, kind]);

  return <div ref={boxRef} className="h-full w-full" />;
}

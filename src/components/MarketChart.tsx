"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";

export interface Kline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface MarketChartProps {
  data: Kline[];
  height?: number;
  symbol?: string;
}

export default function MarketChart({ data, height = 480, symbol }: MarketChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#09090b" },
        textColor: "#a1a1aa",
      },
      grid: {
        vertLines: { color: "#1c1c1f" },
        horzLines: { color: "#1c1c1f" },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: "#d4a843", width: 1, style: 2 },
        horzLine: { color: "#d4a843", width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: "#27272a",
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: "#27272a",
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height,
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    chartRef.current = chart;
    candleRef.current = candles;
    volumeRef.current = volume;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    if (!candleRef.current || !volumeRef.current || !data.length) return;

    const candleData = data.map((k) => ({
      time: Math.floor(k.time / 1000) as import("lightweight-charts").UTCTimestamp,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
    }));

    const volumeData = data.map((k) => ({
      time: Math.floor(k.time / 1000) as import("lightweight-charts").UTCTimestamp,
      value: k.volume ?? 0,
      color: k.close >= k.open ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)",
    }));

    candleRef.current.setData(candleData);
    volumeRef.current.setData(volumeData);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  if (!data.length) {
    return (
      <div className="flex h-[480px] items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/80 text-zinc-500">
        Sin datos de mercado
      </div>
    );
  }

  const last = data[data.length - 1];
  const first = data[0];
  const change = first ? ((last.close - first.open) / first.open) * 100 : 0;
  const isUp = change >= 0;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-zinc-800 px-5 py-4">
        <div>
          {symbol && (
            <div className="mb-1 text-xs font-medium text-zinc-500">{symbol} · Binance</div>
          )}
          <span className="text-2xl font-bold text-white">
            ${last.close.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
          <span className={`ml-3 text-sm font-medium ${isUp ? "text-green-500" : "text-red-500"}`}>
            {isUp ? "+" : ""}
            {change.toFixed(2)}%
          </span>
        </div>
        <div className="flex gap-4 text-xs text-zinc-500">
          <span>O <span className="text-zinc-300">{last.open.toFixed(2)}</span></span>
          <span>H <span className="text-green-500">{last.high.toFixed(2)}</span></span>
          <span>L <span className="text-red-500">{last.low.toFixed(2)}</span></span>
          <span>C <span className="text-zinc-300">{last.close.toFixed(2)}</span></span>
        </div>
      </div>
      <div ref={containerRef} />
    </div>
  );
}

export function parseKlines(raw: number[][]): Kline[] {
  return raw.map((k) => ({
    time: k[0],
    open: parseFloat(String(k[1])),
    high: parseFloat(String(k[2])),
    low: parseFloat(String(k[3])),
    close: parseFloat(String(k[4])),
    volume: parseFloat(String(k[5])),
  }));
}

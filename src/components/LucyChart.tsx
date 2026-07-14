"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
} from "lightweight-charts";
import type { Kline } from "./MarketChart";
import {
  calculateEMA,
  calculateSMA,
  type IndicatorValues,
} from "@/lib/indicators";

interface LucyChartProps {
  data: Kline[];
  height?: number;
  symbol?: string;
  indicators?: IndicatorValues;
}

export default function LucyChart({
  data,
  height = 420,
  symbol,
  indicators,
}: LucyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const lineRefs = useRef<ISeriesApi<"Line">[]>([]);
  const priceLineRefs = useRef<IPriceLine[]>([]);

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
      rightPriceScale: { borderColor: "#27272a", scaleMargins: { top: 0.1, bottom: 0.25 } },
      timeScale: { borderColor: "#27272a", timeVisible: true, secondsVisible: false },
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

    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

    chartRef.current = chart;
    candleRef.current = candles;
    volumeRef.current = volume;

    const handleResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      lineRefs.current = [];
      priceLineRefs.current = [];
    };
  }, [height]);

  useEffect(() => {
    if (!candleRef.current || !volumeRef.current || !chartRef.current || !data.length) return;

    const times = data.map(
      (k) => Math.floor(k.time / 1000) as import("lightweight-charts").UTCTimestamp
    );
    const closes = data.map((k) => k.close);

    candleRef.current.setData(
      data.map((k, i) => ({
        time: times[i],
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
      }))
    );

    volumeRef.current.setData(
      data.map((k, i) => ({
        time: times[i],
        value: k.volume ?? 0,
        color: k.close >= k.open ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)",
      }))
    );

    lineRefs.current.forEach((s) => chartRef.current?.removeSeries(s));
    lineRefs.current = [];
    priceLineRefs.current.forEach((pl) => candleRef.current?.removePriceLine(pl));
    priceLineRefs.current = [];

    if (indicators?.ema) {
      const fast = calculateEMA(closes, indicators.ema.fast);
      const slow = calculateEMA(closes, indicators.ema.slow);

      const fastSeries = chartRef.current.addSeries(LineSeries, {
        color: "#d4a843",
        lineWidth: 2,
        title: `EMA ${indicators.ema.fast}`,
      });
      fastSeries.setData(
        times
          .map((t, i) => (fast[i] !== null ? { time: t, value: fast[i]! } : null))
          .filter(Boolean) as { time: import("lightweight-charts").UTCTimestamp; value: number }[]
      );
      lineRefs.current.push(fastSeries);

      const slowSeries = chartRef.current.addSeries(LineSeries, {
        color: "#818cf8",
        lineWidth: 2,
        title: `EMA ${indicators.ema.slow}`,
      });
      slowSeries.setData(
        times
          .map((t, i) => (slow[i] !== null ? { time: t, value: slow[i]! } : null))
          .filter(Boolean) as { time: import("lightweight-charts").UTCTimestamp; value: number }[]
      );
      lineRefs.current.push(slowSeries);
    }

    if (indicators?.sma) {
      const sma = calculateSMA(closes, indicators.sma.period);
      const smaSeries = chartRef.current.addSeries(LineSeries, {
        color: "#38bdf8",
        lineWidth: 2,
        title: `SMA ${indicators.sma.period}`,
      });
      smaSeries.setData(
        times
          .map((t, i) => (sma[i] !== null ? { time: t, value: sma[i]! } : null))
          .filter(Boolean) as { time: import("lightweight-charts").UTCTimestamp; value: number }[]
      );
      lineRefs.current.push(smaSeries);
    }

    indicators?.levels?.forEach((level) => {
      const pl = candleRef.current!.createPriceLine({
        price: level.price,
        color: level.type === "support" ? "#22c55e" : "#ef4444",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: level.label || (level.type === "support" ? "Soporte" : "Resistencia"),
      });
      priceLineRefs.current.push(pl);
    });

    chartRef.current.timeScale().fitContent();
  }, [data, indicators]);

  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/80 text-zinc-500"
        style={{ height }}
      >
        Carga un par para ver la gráfica
      </div>
    );
  }

  const last = data[data.length - 1];

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-zinc-800 px-5 py-3">
        <div>
          {symbol && <div className="text-xs font-medium text-zinc-500">{symbol} · Binance</div>}
          <span className="text-xl font-bold text-white">
            ${last.close.toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </span>
        </div>
        <div className="flex gap-3 text-xs text-zinc-500">
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

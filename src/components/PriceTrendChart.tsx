"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { fetchMarketKlines } from "@/lib/binance";

interface Kline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface PriceTrendChartProps {
  symbol: string;
  interval?: string;
  height?: number;
}

function toChartTime(ms: number): UTCTimestamp {
  const sec = ms > 1_000_000_000_000 ? Math.floor(ms / 1000) : ms;
  return sec as UTCTimestamp;
}

const POLL_MS = 3000;

export default function PriceTrendChart({
  symbol,
  interval = "1h",
  height = 320,
}: PriceTrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const lineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const candlesRef = useRef(
    new Map<number, { time: number; open: number; high: number; low: number; close: number; volume: number }>()
  );
  const [loading, setLoading] = useState(true);

  const paintChart = useCallback((fit = false) => {
    if (!lineRef.current || !volumeRef.current) return;

    const sorted = [...candlesRef.current.values()].sort((a, b) => a.time - b.time);
    if (!sorted.length) return;

    const lineData = sorted.map((k) => ({
      time: toChartTime(k.time),
      value: k.close,
    }));

    const volumeData = sorted.map((k) => ({
      time: toChartTime(k.time),
      value: k.volume,
      color: k.close >= k.open ? "rgba(8, 153, 129, 0.85)" : "rgba(242, 54, 69, 0.85)",
    }));

    lineRef.current.setData(lineData);
    volumeRef.current.setData(volumeData);

    if (fit) {
      chartRef.current?.timeScale().fitContent();
    }
  }, []);

  const ingestKlines = useCallback(
    (raw: (number[] | Kline)[], fit: boolean) => {
      for (const k of raw) {
        const time = Array.isArray(k) ? k[0] : k.time;
        candlesRef.current.set(time, {
          time,
          open: Array.isArray(k) ? Number(k[1]) : Number(k.open),
          high: Array.isArray(k) ? Number(k[2]) : Number(k.high),
          low: Array.isArray(k) ? Number(k[3]) : Number(k.low),
          close: Array.isArray(k) ? Number(k[4]) : Number(k.close),
          volume: Array.isArray(k) ? Number(k[5]) : Number(k.volume || 0),
        });
      }
      paintChart(fit);
    },
    [paintChart]
  );

  // Crear chart una sola vez
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0d0d0d" },
        textColor: "#b0b3b8",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#1f1f1f", style: 1 },
        horzLines: { color: "#1f1f1f", style: 1 },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: "#a855f7", width: 1, style: 2, labelBackgroundColor: "#2a2a2a" },
        horzLine: { color: "#a855f7", width: 1, style: 2, labelBackgroundColor: "#2a2a2a" },
      },
      rightPriceScale: {
        borderColor: "#2a2a2a",
        scaleMargins: { top: 0.08, bottom: 0.25 },
        autoScale: true,
      },
      timeScale: {
        borderColor: "#2a2a2a",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 10,
        minBarSpacing: 4,
      },
      width: containerRef.current.clientWidth,
      height,
    });

    const line = chart.addSeries(LineSeries, {
      color: "#a855f7",
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
    });

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    chart.priceScale("").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chartRef.current = chart;
    lineRef.current = line;
    volumeRef.current = volume;

    const onResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
      chartRef.current = null;
      lineRef.current = null;
      volumeRef.current = null;
    };
  }, [height]);

  // Cargar historial + polling para mantener al día la última vela
  useEffect(() => {
    if (!symbol) return;

    let cancelled = false;
    candlesRef.current.clear();
    setLoading(true);

    async function refreshLatest() {
      try {
        const raw = await fetchMarketKlines(symbol, interval, 3);
        if (cancelled || !raw.length) return;
        ingestKlines(raw, false);
        setLoading(false);
      } catch {
        /* ignore */
      }
    }

    async function loadHistory() {
      try {
        const raw = await fetchMarketKlines(symbol, interval, 120);
        if (cancelled || !raw.length) return;
        ingestKlines(raw, true);
        setLoading(false);
      } catch {
        /* ignore */
      }
    }

    loadHistory().finally(() => setLoading(false));

    const pollId = setInterval(() => {
      if (!cancelled) refreshLatest();
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
  }, [symbol, interval, ingestKlines]);

  return (
    <div className="flex w-full flex-col rounded-[1.4rem] border border-white/8 bg-[#0b0f18]/80 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-gold animate-pulse" />
          <h2 className="text-sm font-semibold tracking-tight text-white">
            BTC · tendencia
          </h2>
        </div>
        <span className="text-[11px] font-mono text-zinc-500">
          {symbol} · {interval}
        </span>
      </div>
      <div className="relative w-full">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0d0d0d]/80 text-sm text-zinc-500">
            Cargando...
          </div>
        )}
        <div ref={containerRef} className="w-full" />
      </div>
    </div>
  );
}

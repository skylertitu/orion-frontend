'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { parseKlines } from '@/components/MarketChart';
import { MT_CANDLE_OPTIONS, MT_CHART_THEME, mtChartOptions } from '@/lib/chartTheme';

interface LiveChartProps {
  symbol: string;
  interval?: string;
  height?: number;
}

const INTERVALS = [
  { value: '1m', label: 'M1' },
  { value: '5m', label: 'M5' },
  { value: '15m', label: 'M15' },
  { value: '1h', label: 'H1' },
  { value: '4h', label: 'H4' },
  { value: '1d', label: 'D1' },
] as const;

const POLL_MS = 3000;

function toChartTime(ms: number): UTCTimestamp {
  const sec = ms > 1_000_000_000_000 ? Math.floor(ms / 1000) : ms;
  return sec as UTCTimestamp;
}

export default function LiveChart({
  symbol,
  interval: intervalProp = '1m',
  height = 480,
}: LiveChartProps) {
  const [interval, setChartInterval] = useState(intervalProp);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const lastBarTimeRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [ohlc, setOhlc] = useState({ open: 0, high: 0, low: 0, close: 0 });
  const [changePct, setChangePct] = useState(0);

  const paintChart = useCallback((fit = false) => {
    if (!candleRef.current || !volumeRef.current) return false;

    const sorted = [...candlesRef.current.values()].sort((a, b) => a.time - b.time);
    if (!sorted.length) return false;

    const candleData = sorted.map((k) => ({
      time: toChartTime(k.time),
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
    }));

    const volumeData = sorted.map((k) => ({
      time: toChartTime(k.time),
      value: k.volume,
      color: k.close >= k.open ? MT_CHART_THEME.volumeUp : MT_CHART_THEME.volumeDown,
    }));

    candleRef.current.setData(candleData);
    volumeRef.current.setData(volumeData);

    const last = sorted[sorted.length - 1];
    const first = sorted[0];
    lastBarTimeRef.current = toChartTime(last.time) as number;

    setOhlc({ open: last.open, high: last.high, low: last.low, close: last.close });
    setChangePct(first.open ? ((last.close - first.open) / first.open) * 100 : 0);

    if (fit) {
      chartRef.current?.timeScale().fitContent();
    }
    return true;
  }, []);

  const candlesRef = useRef(
    new Map<number, { time: number; open: number; high: number; low: number; close: number; volume: number }>()
  );

  const ingestKlines = useCallback(
    (raw: number[][], fit: boolean) => {
      const parsed = parseKlines(raw);
      for (const k of parsed) {
        candlesRef.current.set(k.time, {
          time: k.time,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
          volume: k.volume ?? 0,
        });
      }
      return paintChart(fit);
    },
    [paintChart]
  );

  const refreshLatest = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/market/klines?symbol=${symbol}&interval=${interval}&limit=3`
      );
      if (!res.ok) return;
      const raw = await res.json();
      if (!Array.isArray(raw) || !raw.length) return;

      const parsed = parseKlines(raw);
      const last = parsed[parsed.length - 1];
      const chartTime = toChartTime(last.time) as number;

      for (const k of parsed) {
        candlesRef.current.set(k.time, {
          time: k.time,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
          volume: k.volume ?? 0,
        });
      }

      if (!candleRef.current || !volumeRef.current) return;

      const point = {
        time: toChartTime(last.time),
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
      };

      const prevTime = lastBarTimeRef.current;
      if (prevTime === null) {
        paintChart(false);
      } else if (chartTime === prevTime) {
        candleRef.current.update(point);
        volumeRef.current.update({
          time: point.time,
          value: last.volume ?? 0,
          color: last.close >= last.open ? MT_CHART_THEME.volumeUp : MT_CHART_THEME.volumeDown,
        });
      } else if (chartTime > prevTime) {
        candleRef.current.update(point);
        volumeRef.current.update({
          time: point.time,
          value: last.volume ?? 0,
          color: last.close >= last.open ? MT_CHART_THEME.volumeUp : MT_CHART_THEME.volumeDown,
        });
        lastBarTimeRef.current = chartTime;
      }

      setOhlc({ open: last.open, high: last.high, low: last.low, close: last.close });
      setLive(true);
    } catch {
      setLive(false);
    }
  }, [symbol, interval, paintChart]);

  // Crear chart una sola vez
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, mtChartOptions(containerRef.current.clientWidth, height));
    const candles = chart.addSeries(CandlestickSeries, MT_CANDLE_OPTIONS);
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
      visible: false,
    });

    chartRef.current = chart;
    candleRef.current = candles;
    volumeRef.current = volume;

    const onResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
    };
  }, [height]);

  // Cargar historial + polling
  useEffect(() => {
    let cancelled = false;
    candlesRef.current.clear();
    lastBarTimeRef.current = null;
    setLoading(true);
    setLive(false);

    async function loadHistory() {
      const res = await fetch(
        `/api/market/klines?symbol=${symbol}&interval=${interval}&limit=200`
      );
      if (!res.ok) throw new Error('fetch failed');
      const raw = await res.json();
      if (cancelled || !Array.isArray(raw)) return;
      ingestKlines(raw, true);
      setLive(true);
    }

    loadHistory()
      .catch(() => setLive(false))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const pollId = setInterval(() => {
      if (!cancelled) refreshLatest();
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
  }, [symbol, interval, ingestKlines, refreshLatest]);

  const isUp = changePct >= 0;
  const priceDecimals = ohlc.close >= 1000 ? 2 : ohlc.close >= 1 ? 4 : 6;

  return (
    <div className="overflow-hidden rounded border border-[#2a2a2a] bg-[#0d0d0d]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2a2a2a] bg-[#141414] px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-white">{symbol}</span>
          <div className="flex gap-0.5">
            {INTERVALS.map((tf) => (
              <button
                key={tf.value}
                type="button"
                onClick={() => setChartInterval(tf.value)}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  interval === tf.value
                    ? 'bg-[#089981] text-white'
                    : 'text-zinc-400 hover:bg-[#1f1f1f] hover:text-white'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
          <span className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${live ? 'bg-[#089981]' : 'bg-red-500'}`} />
            {live ? 'Actualizando' : 'Sin datos'}
          </span>
        </div>

        <div className="flex flex-wrap items-baseline gap-4">
          <span className="font-mono text-xl font-bold text-white">
            {ohlc.close > 0
              ? ohlc.close.toLocaleString(undefined, {
                  minimumFractionDigits: priceDecimals,
                  maximumFractionDigits: priceDecimals,
                })
              : '—'}
          </span>
          <span className={`font-mono text-sm font-medium ${isUp ? 'text-[#089981]' : 'text-[#f23645]'}`}>
            {ohlc.close > 0 ? `${isUp ? '+' : ''}${changePct.toFixed(2)}%` : ''}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 border-b border-[#1f1f1f] bg-[#0d0d0d] px-4 py-1.5 font-mono text-xs text-zinc-500">
        <span>
          O <span className="text-zinc-300">{ohlc.open > 0 ? ohlc.open.toFixed(priceDecimals) : '—'}</span>
        </span>
        <span>
          H <span className="text-[#089981]">{ohlc.high > 0 ? ohlc.high.toFixed(priceDecimals) : '—'}</span>
        </span>
        <span>
          L <span className="text-[#f23645]">{ohlc.low > 0 ? ohlc.low.toFixed(priceDecimals) : '—'}</span>
        </span>
        <span>
          C <span className="text-zinc-300">{ohlc.close > 0 ? ohlc.close.toFixed(priceDecimals) : '—'}</span>
        </span>
      </div>

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0d0d0d]/80 text-sm text-zinc-500">
            Cargando velas...
          </div>
        )}
        <div ref={containerRef} />
      </div>
    </div>
  );
}

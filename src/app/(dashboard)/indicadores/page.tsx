"use client";

import { useCallback, useEffect, useState } from "react";
import IndicatorEditor, { DEFAULT_INDICATOR_VALUES } from "@/components/IndicatorEditor";
import { BINANCE_PAIRS, formatPair } from "@/lib/binance";
import { computeLatestIndicators, ComputedIndicators, IndicatorValues } from "@/lib/indicators";
import { parseKlines } from "@/components/MarketChart";

const STORAGE_KEY = "orion_indicator_config";

export default function IndicadoresPage() {
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [indicatorValues, setIndicatorValues] = useState<IndicatorValues>(DEFAULT_INDICATOR_VALUES);
  const [indicators, setIndicators] = useState<ComputedIndicators | null>(null);
  const [loading, setLoading] = useState(false);

  // Load configuration from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setIndicatorValues(JSON.parse(saved));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const handleValuesChange = (newValues: IndicatorValues) => {
    setIndicatorValues(newValues);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newValues));
    } catch {
      /* ignore */
    }
  };

  const fetchIndicators = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/market/klines?symbol=${selectedSymbol}&interval=1m&limit=150`
      );
      if (res.ok) {
        const raw = await res.json();
        if (Array.isArray(raw) && raw.length) {
          const parsed = parseKlines(raw);
          const closes = parsed.map((k) => k.close);
          const computed = computeLatestIndicators(closes, indicatorValues);
          setIndicators(computed);
        }
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [selectedSymbol, indicatorValues]);

  useEffect(() => {
    fetchIndicators();
    const interval = setInterval(fetchIndicators, 10000);
    return () => clearInterval(interval);
  }, [fetchIndicators]);

  // RSI status
  const rsi = indicators?.rsi;
  let rsiState = { label: "NEUTRAL", color: "bg-zinc-800 text-zinc-300 border-zinc-700" };
  if (rsi !== null && rsi !== undefined && indicatorValues.rsi) {
    if (rsi >= indicatorValues.rsi.overbought) {
      rsiState = { label: "SOBRECOMPRA", color: "bg-red-500/20 text-red-400 border-red-500/30" };
    } else if (rsi <= indicatorValues.rsi.oversold) {
      rsiState = { label: "SOBREVENDIDO", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
    }
  }

  // EMA trend
  const emaFast = indicators?.emaFast;
  const emaSlow = indicators?.emaSlow;
  let emaTrend = { label: "NEUTRAL", color: "bg-zinc-800 text-zinc-300 border-zinc-700" };
  if (emaFast && emaSlow) {
    if (emaFast > emaSlow) {
      emaTrend = { label: "ALCISTA (BULLISH CROSS)", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
    } else {
      emaTrend = { label: "BAJISTA (BEARISH CROSS)", color: "bg-red-500/20 text-red-400 border-red-500/30" };
    }
  }

  return (
    <div className="flex w-full flex-col gap-6 p-6 bg-zinc-950 text-white min-h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-black text-white">Análisis de Indicadores Técnicos</h1>
          <p className="text-xs text-zinc-400">
            Edita los parámetros numéricos y observa la señal calculada en tiempo real
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-zinc-400">Par de Análisis:</label>
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs font-mono text-white outline-none focus:border-gold"
          >
            {BINANCE_PAIRS.map((p) => (
              <option key={p.symbol} value={p.symbol}>
                {formatPair(p.symbol)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Editor Component */}
      <IndicatorEditor values={indicatorValues} onChange={handleValuesChange} />

      {/* Computed Results Section */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-5 backdrop-blur-md shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <h2 className="text-base font-bold text-white">
              Resultados en Tiempo Real ({formatPair(selectedSymbol)})
            </h2>
          </div>
          <button
            type="button"
            onClick={fetchIndicators}
            disabled={loading}
            className="text-xs text-gold hover:underline flex items-center gap-1"
          >
            {loading ? "Re-calculando..." : "Actualizar Señales"}
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* RSI Result */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400">RSI ({indicatorValues.rsi?.period})</span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${rsiState.color}`}>
                {rsiState.label}
              </span>
            </div>
            <div className="font-mono text-2xl font-black text-emerald-400">
              {rsi !== null && rsi !== undefined ? rsi.toFixed(2) : "—"}
            </div>
            <p className="text-[10px] text-zinc-500">
              Límites: &lt;{indicatorValues.rsi?.oversold} (Venta) | &gt;{indicatorValues.rsi?.overbought} (Compra)
            </p>
          </div>

          {/* EMA Result */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400">
                EMA ({indicatorValues.ema?.fast}/{indicatorValues.ema?.slow})
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${emaTrend.color}`}>
                {emaTrend.label}
              </span>
            </div>
            <div className="font-mono text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-500">Fast ({indicatorValues.ema?.fast}):</span>
                <span className="font-bold text-white">{emaFast ? `$${emaFast.toFixed(2)}` : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Slow ({indicatorValues.ema?.slow}):</span>
                <span className="font-bold text-white">{emaSlow ? `$${emaSlow.toFixed(2)}` : "—"}</span>
              </div>
            </div>
          </div>

          {/* MACD Result */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400">MACD Histograma</span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                  (indicators?.macd?.histogram || 0) >= 0
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-red-500/20 text-red-400 border-red-500/30"
                }`}
              >
                {(indicators?.macd?.histogram || 0) >= 0 ? "POSITIVO" : "NEGATIVO"}
              </span>
            </div>
            <div className="font-mono text-xl font-black text-purple-400">
              {indicators?.macd?.histogram ? indicators.macd.histogram.toFixed(4) : "—"}
            </div>
            <p className="text-[10px] text-zinc-500">
              MACD: {indicators?.macd?.macd?.toFixed(4) ?? "—"} | Signal: {indicators?.macd?.signal?.toFixed(4) ?? "—"}
            </p>
          </div>

          {/* SMA Result */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400">SMA ({indicatorValues.sma?.period})</span>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                PROMEDIO
              </span>
            </div>
            <div className="font-mono text-2xl font-black text-amber-400">
              {indicators?.sma ? `$${indicators.sma.toFixed(2)}` : "—"}
            </div>
            <p className="text-[10px] text-zinc-500">Media simple acumulada</p>
          </div>
        </div>
      </div>
    </div>
  );
}

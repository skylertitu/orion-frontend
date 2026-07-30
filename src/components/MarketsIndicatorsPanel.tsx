"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { BINANCE_PAIRS, formatPair } from "@/lib/binance";
import { computeLatestIndicators, ComputedIndicators, IndicatorValues } from "@/lib/indicators";
import { parseKlines } from "@/components/MarketChart";

interface LivePrice {
  symbol: string;
  price: number;
  change: number;
}

interface MarketsIndicatorsPanelProps {
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  prices: Map<string, LivePrice>;
}

const DEFAULT_INDICATOR_CONFIG: IndicatorValues = {
  rsi: { period: 14, overbought: 70, oversold: 30 },
  ema: { fast: 20, slow: 50 },
  sma: { period: 20 },
  macd: { fast: 12, slow: 26, signal: 9 },
};

export default function MarketsIndicatorsPanel({
  selectedSymbol,
  onSelectSymbol,
  prices,
}: MarketsIndicatorsPanelProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"markets" | "indicators">("markets");
  const [indicators, setIndicators] = useState<ComputedIndicators | null>(null);
  const [loadingIndicators, setLoadingIndicators] = useState(false);

  const fetchIndicators = useCallback(async () => {
    setLoadingIndicators(true);
    try {
      const res = await fetch(
        `/api/market/klines?symbol=${selectedSymbol}&interval=1m&limit=100`
      );
      if (res.ok) {
        const raw = await res.json();
        if (Array.isArray(raw) && raw.length) {
          const parsed = parseKlines(raw);
          const closes = parsed.map((k) => k.close);
          const computed = computeLatestIndicators(closes, DEFAULT_INDICATOR_CONFIG);
          setIndicators(computed);
        }
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingIndicators(false);
    }
  }, [selectedSymbol]);

  useEffect(() => {
    fetchIndicators();
    const interval = setInterval(fetchIndicators, 10000);
    return () => clearInterval(interval);
  }, [fetchIndicators]);

  const filteredPairs = useMemo(() => {
    if (!search) return BINANCE_PAIRS;
    return BINANCE_PAIRS.filter(
      (p) =>
        p.symbol.toLowerCase().includes(search.toLowerCase()) ||
        p.base.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  const activeTicker = prices.get(selectedSymbol);

  // RSI status badge logic
  const rsiValue = indicators?.rsi;
  let rsiBadge = { label: "Neutral", color: "bg-zinc-800 text-zinc-300 border-zinc-700" };
  if (rsiValue !== null && rsiValue !== undefined) {
    if (rsiValue >= 70) {
      rsiBadge = { label: "Sobrecompra", color: "bg-red-500/20 text-red-400 border-red-500/30" };
    } else if (rsiValue <= 30) {
      rsiBadge = { label: "Sobrevendido", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
    }
  }

  // EMA trend logic
  const emaFast = indicators?.emaFast;
  const emaSlow = indicators?.emaSlow;
  let emaTrend = { label: "Neutral", color: "bg-zinc-800 text-zinc-300" };
  if (emaFast && emaSlow) {
    if (emaFast > emaSlow) {
      emaTrend = { label: "Alcista (EMA20 > EMA50)", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
    } else {
      emaTrend = { label: "Bajista (EMA20 < EMA50)", color: "bg-red-500/20 text-red-400 border-red-500/30" };
    }
  }

  return (
    <div className="flex flex-col h-full rounded-2xl border border-emerald-500/20 bg-zinc-950/80 backdrop-blur-md shadow-xl overflow-hidden">
      {/* Header Panel Mercados e Indicadores */}
      <div className="border-b border-emerald-500/20 bg-emerald-950/20 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Mercados e Indicadores</h2>
              <p className="text-xs text-emerald-300/70">
                Par activo: <span className="font-bold text-white font-mono">{formatPair(selectedSymbol)}</span>
              </p>
            </div>
          </div>

          <div className="flex rounded-lg border border-zinc-800 bg-zinc-900/80 p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab("markets")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                activeTab === "markets" ? "bg-emerald-500 text-black" : "text-zinc-400 hover:text-white"
              }`}
            >
              Mercados
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("indicators")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                activeTab === "indicators" ? "bg-emerald-500 text-black" : "text-zinc-400 hover:text-white"
              }`}
            >
              Indicadores
            </button>
          </div>
        </div>
      </div>

      {activeTab === "markets" ? (
        <div className="flex flex-col flex-1 p-3 overflow-hidden">
          {/* Search bar */}
          <div className="relative mb-3">
            <input
              type="text"
              placeholder="Buscar par (BTC, ETH)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3.5 py-2 pl-9 text-xs text-white outline-none focus:border-emerald-500"
            />
            <svg className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* List of markets */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[380px]">
            {filteredPairs.map((p) => {
              const live = prices.get(p.symbol);
              const isSelected = selectedSymbol === p.symbol;
              const isPositive = (live?.change || 0) >= 0;

              return (
                <button
                  key={p.symbol}
                  type="button"
                  onClick={() => onSelectSymbol(p.symbol)}
                  className={`w-full flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
                    isSelected
                      ? "border-emerald-500/60 bg-emerald-500/10 shadow-md"
                      : "border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800 font-mono text-xs font-bold text-emerald-400">
                      {p.base.substring(0, 3)}
                    </div>
                    <div>
                      <div className="font-bold text-white text-xs font-mono">{formatPair(p.symbol)}</div>
                      <div className="text-[10px] text-zinc-500">Binance Spot</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-xs font-semibold text-white">
                      {live
                        ? `$${live.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                        : "—"}
                    </div>
                    {live && (
                      <span
                        className={`text-[10px] font-semibold ${
                          isPositive ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        {live.change.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Indicators View */
        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[440px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Análisis Técnico en Vivo (M1)
            </span>
            <button
              type="button"
              onClick={fetchIndicators}
              disabled={loadingIndicators}
              className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
            >
              {loadingIndicators ? "Calculando..." : "Actualizar"}
            </button>
          </div>

          {/* RSI Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">RSI (14)</span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${rsiBadge.color}`}>
                {rsiBadge.label}
              </span>
            </div>
            <div className="flex items-baseline justify-between font-mono">
              <span className="text-xl font-bold text-emerald-400">
                {rsiValue !== null && rsiValue !== undefined ? rsiValue.toFixed(1) : "—"}
              </span>
              <span className="text-xs text-zinc-500">Nivel 30 - 70</span>
            </div>
          </div>

          {/* EMA Crossover Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">Tendencia EMA (20/50)</span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${emaTrend.color}`}>
                {emaTrend.label}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
              <div className="rounded-lg bg-zinc-800/60 p-2">
                <span className="block text-[10px] text-zinc-400">EMA 20</span>
                <span className="text-white font-bold">
                  {emaFast ? `$${emaFast.toFixed(2)}` : "—"}
                </span>
              </div>
              <div className="rounded-lg bg-zinc-800/60 p-2">
                <span className="block text-[10px] text-zinc-400">EMA 50</span>
                <span className="text-white font-bold">
                  {emaSlow ? `$${emaSlow.toFixed(2)}` : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* MACD Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">MACD (12, 26, 9)</span>
              <span className="text-[10px] font-mono text-zinc-400">
                Hist:{" "}
                <span
                  className={
                    (indicators?.macd?.histogram || 0) >= 0 ? "text-emerald-400 font-bold" : "text-red-400 font-bold"
                  }
                >
                  {indicators?.macd?.histogram ? indicators.macd.histogram.toFixed(4) : "—"}
                </span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
              <div className="rounded-lg bg-zinc-800/60 p-2">
                <span className="block text-[10px] text-zinc-400">Línea MACD</span>
                <span className="text-white font-bold">
                  {indicators?.macd?.macd ? indicators.macd.macd.toFixed(4) : "—"}
                </span>
              </div>
              <div className="rounded-lg bg-zinc-800/60 p-2">
                <span className="block text-[10px] text-zinc-400">Señal</span>
                <span className="text-white font-bold">
                  {indicators?.macd?.signal ? indicators.macd.signal.toFixed(4) : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

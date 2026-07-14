"use client";

import { useEffect, useRef, useState } from "react";
import MarketChart, { parseKlines } from "@/components/MarketChart";
import {
  BINANCE_INTERVALS,
  BINANCE_PAIRS,
  DEFAULT_SYMBOL,
  SOLANA_PAIRS,
  formatPair,
} from "@/lib/binance";

interface Ticker {
  symbol: string;
  pair: string;
  price: number;
  change: number;
  volume: number;
}

type MarketFilter = "all" | "solana";

export default function MercadoPage() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [timeframe, setTimeframe] = useState("1h");
  const [filter, setFilter] = useState<MarketFilter>("all");
  const [klines, setKlines] = useState<ReturnType<typeof parseKlines>>([]);
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isFirstLoad = useRef(true);

  const visiblePairs =
    filter === "solana"
      ? BINANCE_PAIRS.filter((p) => p.network === "solana")
      : BINANCE_PAIRS;

  const visibleTickers = tickers.filter((t) =>
    visiblePairs.some((p) => p.symbol === t.pair)
  );

  useEffect(() => {
    let cancelled = false;

    async function loadTickers() {
      try {
        const res = await fetch("/api/market/tickers");
        if (!cancelled && res.ok) setTickers(await res.json());
      } catch {
        // optional
      }
    }

    loadTickers();
    const tickerTimer = window.setInterval(loadTickers, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(tickerTimer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadChart() {
      if (isFirstLoad.current) setLoading(true);
      setError("");

      try {
        const res = await fetch(
          `/api/market/klines?symbol=${symbol}&interval=${timeframe}&limit=200`
        );
        if (!res.ok) throw new Error("Error al cargar gráfica");
        const raw = await res.json();
        if (!cancelled) setKlines(parseKlines(raw));
      } catch {
        if (!cancelled) setError("No se pudieron cargar los datos de Binance");
      }

      if (!cancelled) {
        setLoading(false);
        isFirstLoad.current = false;
      }
    }

    loadChart();
    const chartTimer = window.setInterval(loadChart, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(chartTimer);
    };
  }, [symbol, timeframe]);

  const currentPair = BINANCE_PAIRS.find((p) => p.symbol === symbol);

  return (
    <div className="flex w-full flex-col gap-6 p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Mercado</h1>
          <p className="text-sm text-zinc-500">Datos en tiempo real desde Binance</p>
        </div>
        {currentPair?.network === "solana" && (
          <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-400">
            Ecosistema Solana
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        {(["all", "solana"] as MarketFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f);
              if (f === "solana" && !SOLANA_PAIRS.some((p) => p.symbol === symbol)) {
                setSymbol("SOLUSDT");
              }
            }}
            className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
              filter === f
                ? "bg-gold text-black"
                : "border border-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            {f === "all" ? "Todos" : "Solana"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {visibleTickers.map((t) => (
          <button
            key={t.pair}
            onClick={() => setSymbol(t.pair)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              symbol === t.pair
                ? "border-gold/50 bg-gold/5"
                : "border-zinc-800 bg-zinc-950/80 hover:border-zinc-700"
            }`}
          >
            <div className="text-xs font-medium text-zinc-500">{formatPair(t.pair)}</div>
            <div className="mt-1 text-lg font-bold text-white">
              ${t.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </div>
            <div className={`text-xs font-medium ${t.change >= 0 ? "text-green-500" : "text-red-500"}`}>
              {t.change >= 0 ? "+" : ""}
              {t.change.toFixed(2)}%
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border border-zinc-800 bg-zinc-950/80 p-1">
          {visiblePairs.map((p) => (
            <button
              key={p.symbol}
              onClick={() => setSymbol(p.symbol)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                symbol === p.symbol ? "bg-gold text-black" : "text-zinc-400 hover:text-white"
              }`}
            >
              {p.base}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950/80 p-1">
          {BINANCE_INTERVALS.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                timeframe === tf.value ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-[480px] items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/80 text-zinc-500">
          Cargando gráfica de Binance...
        </div>
      ) : (
        <MarketChart data={klines} symbol={formatPair(symbol)} />
      )}
    </div>
  );
}

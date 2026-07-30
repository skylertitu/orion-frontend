"use client";

import { useEffect, useRef, useState } from "react";
import LiveChart from "@/components/LiveChart";
import BrokerConnections from "@/components/BrokerConnections";
import { BINANCE_PAIRS, formatPair } from "@/lib/binance";

interface LivePrice {
  symbol: string;
  price: number;
  change: number;
}

const PRICE_FLUSH_MS = 400;

export default function MercadoPage() {
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [prices, setPrices] = useState<Map<string, LivePrice>>(new Map());
  const [streamConnected, setStreamConnected] = useState(false);
  const [streamError, setStreamError] = useState<string | undefined>();
  const [search, setSearch] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const streamOkRef = useRef(false);
  const pendingPrices = useRef(new Map<string, LivePrice>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const streams = BINANCE_PAIRS.map((p) => `${p.symbol.toLowerCase()}@ticker`).join("/");

    function markStream(ok: boolean, error?: string) {
      if (ok) {
        if (!streamOkRef.current) {
          streamOkRef.current = true;
          setStreamConnected(true);
        }
        setStreamError(undefined);
      } else {
        if (streamOkRef.current) {
          streamOkRef.current = false;
          setStreamConnected(false);
        }
        if (error) setStreamError(error);
      }
    }

    function flushPrices() {
      flushTimer.current = undefined;
      setPrices(new Map(pendingPrices.current));
    }

    function schedulePriceFlush() {
      if (flushTimer.current) return;
      flushTimer.current = setTimeout(flushPrices, PRICE_FLUSH_MS);
    }

    function connect() {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
      wsRef.current = ws;

      ws.onopen = () => markStream(true);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const d = msg.data ?? msg;
          if (!d.s) return;

          markStream(true);
          pendingPrices.current.set(d.s, {
            symbol: d.s,
            price: parseFloat(d.c),
            change: parseFloat(d.P),
          });
          schedulePriceFlush();
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        markStream(false, "WebSocket cerrado. Reintentando...");
        reconnectTimer.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        markStream(false, "No se pudo conectar al stream de Binance");
        ws.close();
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer.current);
      clearTimeout(flushTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  const filteredPairs = BINANCE_PAIRS.filter(
    (p) =>
      p.symbol.toLowerCase().includes(search.toLowerCase()) ||
      p.base.toLowerCase().includes(search.toLowerCase())
  );

  const selectedPrice = prices.get(selectedSymbol);

  return (
    <div className="flex w-full flex-col gap-6 p-6 bg-zinc-950 text-white min-h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-white">Mercados en Vivo</h1>
            <span className="rounded-full bg-gold/10 px-2.5 py-0.5 text-xs font-bold text-gold border border-gold/20">
              {formatPair(selectedSymbol)}
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            {selectedPrice
              ? `Cotización actual: $${selectedPrice.price.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${selectedPrice.change >= 0 ? "+" : ""}${selectedPrice.change.toFixed(2)}%)`
              : "Transmisión de precios Binance en vivo"}
          </p>
        </div>
      </div>

      <BrokerConnections streamConnected={streamConnected} streamError={streamError} />

      {/* Main Grid: Left Market Pairs List + Right Live Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Market Pairs List */}
        <div className="xl:col-span-4 flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-4 backdrop-blur-md shadow-xl max-h-[600px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Lista de Activos
            </span>
            <span className="text-[11px] text-gold font-mono">{filteredPairs.length} pares</span>
          </div>

          <div className="relative mb-3">
            <input
              type="text"
              placeholder="Buscar par (BTC, ETH)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 pl-9 text-xs text-white outline-none focus:border-gold"
            />
            <svg className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {filteredPairs.map((p) => {
              const live = prices.get(p.symbol);
              const isSelected = selectedSymbol === p.symbol;
              const isPositive = (live?.change || 0) >= 0;

              return (
                <button
                  key={p.symbol}
                  type="button"
                  onClick={() => setSelectedSymbol(p.symbol)}
                  className={`w-full flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
                    isSelected
                      ? "border-gold/60 bg-gold/10 shadow-md"
                      : "border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 font-mono text-xs font-bold text-gold">
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

        {/* Live Chart Container */}
        <div className="xl:col-span-8 flex flex-col rounded-2xl border border-gold/20 bg-zinc-950/80 backdrop-blur-md shadow-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-gold animate-ping" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Gráfico de Velas Japonesas - {formatPair(selectedSymbol)}
              </h2>
            </div>
          </div>

          <LiveChart symbol={selectedSymbol} interval="1m" height={540} />
        </div>
      </div>
    </div>
  );
}

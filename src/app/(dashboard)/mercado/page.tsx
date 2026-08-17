"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import BrokerConnections from "@/components/BrokerConnections";
import IndicatorScriptEditor from "@/components/IndicatorScriptEditor";
import LiveChart from "@/components/LiveChart";
import { getUser } from "@/lib/auth";
import { BINANCE_PAIRS, BINANCE_WS_URLS, fetchMarketStatus, fetchMarketTickers, formatPair, getPairInfo, type PairMarketStatus } from "@/lib/binance";
import {
  loadIndicatorScripts,
  type IndicatorScript,
} from "@/lib/indicatorScript";
import { hydrateIndicatorScripts, persistIndicatorScripts } from "@/lib/indicatorSync";
import { loadChartPrefs, saveChartPrefs } from "@/lib/chartPrefs";
import ModuleGate from "@/components/ModuleGate";

interface LivePrice {
  symbol: string;
  price: number;
  change: number;
  volume?: number;
  quoteVolume?: number;
  high?: number;
  low?: number;
}

const PRICE_FLUSH_MS = 400;
const REST_POLL_MS = 3000;

function formatUsd(value: number, digits = 2): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatCompact(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}

function priceDigits(price: number): number {
  if (price >= 1000) return 2;
  if (price >= 1) return 4;
  return 6;
}

function isPairLive(symbol: string, prices: Map<string, LivePrice>): boolean {
  const row = prices.get(symbol);
  return Boolean(row && Number.isFinite(row.price) && row.price > 0);
}

function pairHealth(
  symbol: string,
  prices: Map<string, LivePrice>,
  statusBySymbol: Map<string, PairMarketStatus>
): { working: boolean; reason: string } {
  const live = isPairLive(symbol, prices);
  const status = statusBySymbol.get(symbol);
  if (status && !status.trading) {
    return { working: false, reason: status.reason || "Bloqueada en Binance" };
  }
  if (!live) {
    return { working: false, reason: "Sin señal de precio" };
  }
  return { working: true, reason: status?.reason || "Operable" };
}

export default function MercadoPage() {
  const user = getUser();
  const isAdmin = user?.role === "admin";
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [prices, setPrices] = useState<Map<string, LivePrice>>(new Map());
  const [streamConnected, setStreamConnected] = useState(false);
  const [streamError, setStreamError] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"watch" | "gainers" | "losers">("watch");
  const [scripts, setScripts] = useState<IndicatorScript[]>([]);
  const [scriptErrors, setScriptErrors] = useState<Record<string, string>>({});
  const [rightTab, setRightTab] = useState<"watch" | "indicadores" | "consola">("watch");
  const [pairStatus, setPairStatus] = useState<Map<string, PairMarketStatus>>(new Map());
  const [chartReady, setChartReady] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const streamOkRef = useRef(false);
  const pendingPrices = useRef(new Map<string, LivePrice>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wsUrlIndex = useRef(0);

  useEffect(() => {
    let cancelled = false;

    function applyTickers(
      rows: Array<{
        pair?: string;
        symbol: string;
        price: number;
        change: number;
        volume?: number;
        quoteVolume?: number;
        high?: number;
        low?: number;
      }>
    ) {
      for (const row of rows) {
        const pair = row.pair || (row.symbol.endsWith("USDT") ? row.symbol : `${row.symbol}USDT`);
        const prev = pendingPrices.current.get(pair);
        pendingPrices.current.set(pair, {
          symbol: pair,
          price: row.price,
          change: row.change,
          volume: row.volume ?? prev?.volume,
          quoteVolume: row.quoteVolume ?? prev?.quoteVolume,
          high: row.high ?? prev?.high,
          low: row.low ?? prev?.low,
        });
      }
      setPrices(new Map(pendingPrices.current));
      if (!streamOkRef.current) {
        streamOkRef.current = true;
        setStreamConnected(true);
      }
      setStreamError(undefined);
    }

    async function loadTickers() {
      try {
        const rows = await fetchMarketTickers();
        if (cancelled) return;
        applyTickers(rows);
      } catch (err: unknown) {
        if (cancelled) return;
        if (!streamOkRef.current) {
          setStreamConnected(false);
          setStreamError(err instanceof Error ? err.message : "No se pudieron cargar los mercados");
        }
      }
    }

    void loadTickers();
    const pollId = setInterval(() => {
      if (!cancelled) void loadTickers();
    }, REST_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
  }, []);

  useEffect(() => {
    const streams = BINANCE_PAIRS.map((p) => `${p.symbol.toLowerCase()}@ticker`).join("/");

    function markStream(ok: boolean, error?: string) {
      if (ok) {
        if (!streamOkRef.current) {
          streamOkRef.current = true;
          setStreamConnected(true);
        }
        setStreamError(undefined);
      } else if (error && !streamOkRef.current) {
        setStreamError(error);
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

      const base = BINANCE_WS_URLS[wsUrlIndex.current % BINANCE_WS_URLS.length];
      const ws = new WebSocket(`${base}?streams=${streams}`);
      wsRef.current = ws;

      ws.onopen = () => markStream(true);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const d = msg.data ?? msg;
          if (!d.s) return;

          markStream(true);
          const prev = pendingPrices.current.get(d.s);
          pendingPrices.current.set(d.s, {
            symbol: d.s,
            price: parseFloat(d.c),
            change: parseFloat(d.P),
            volume: d.v != null ? parseFloat(d.v) : prev?.volume,
            quoteVolume: d.q != null ? parseFloat(d.q) : prev?.quoteVolume,
            high: d.h != null ? parseFloat(d.h) : prev?.high,
            low: d.l != null ? parseFloat(d.l) : prev?.low,
          });
          schedulePriceFlush();
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        wsUrlIndex.current = (wsUrlIndex.current + 1) % BINANCE_WS_URLS.length;
        reconnectTimer.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
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

  useEffect(() => {
    const prefs = loadChartPrefs();
    setSelectedSymbol(prefs.symbol);
    setScripts(loadIndicatorScripts());
    setChartReady(true);
    void hydrateIndicatorScripts().then((list) => {
      setScripts(list);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadStatus() {
      try {
        const rows = await fetchMarketStatus();
        if (cancelled) return;
        setPairStatus(new Map(rows.map((row) => [row.symbol, row])));
      } catch {
        /* keep ticker-only health */
      }
    }
    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistScripts = (next: IndicatorScript[]) => {
    setScripts(next);
    persistIndicatorScripts(next);
  };

  const allLive = useMemo(() => Array.from(prices.values()), [prices]);
  const gainers = useMemo(
    () => [...allLive].filter((p) => p.change > 0).sort((a, b) => b.change - a.change),
    [allLive]
  );
  const losers = useMemo(
    () => [...allLive].filter((p) => p.change < 0).sort((a, b) => a.change - b.change),
    [allLive]
  );

  const filteredPairs = useMemo(() => {
    const q = search.toLowerCase();
    let list = BINANCE_PAIRS.filter(
      (p) =>
        p.symbol.toLowerCase().includes(q) ||
        p.base.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q)
    );

    if (!isAdmin) {
      list = list.filter((p) => pairHealth(p.symbol, prices, pairStatus).working);
    }

    if (sortBy === "gainers") {
      list = [...list].sort(
        (a, b) => (prices.get(b.symbol)?.change ?? -Infinity) - (prices.get(a.symbol)?.change ?? -Infinity)
      );
    } else if (sortBy === "losers") {
      list = [...list].sort(
        (a, b) => (prices.get(a.symbol)?.change ?? Infinity) - (prices.get(b.symbol)?.change ?? Infinity)
      );
    } else {
      list = [...list].sort(
        (a, b) =>
          Number(pairHealth(b.symbol, prices, pairStatus).working) -
          Number(pairHealth(a.symbol, prices, pairStatus).working)
      );
    }
    return list;
  }, [search, sortBy, prices, pairStatus, isAdmin]);

  const selectedPrice = prices.get(selectedSymbol);
  const selectedInfo = getPairInfo(selectedSymbol);
  const selectedUp = (selectedPrice?.change || 0) >= 0;
  const digits = priceDigits(selectedPrice?.price || 0);
  const liveCount = allLive.length;
  const topMover = allLive.length
    ? [...allLive].sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0]
    : undefined;

  return (
    <ModuleGate moduleId="market">
    <div className="flex min-h-[calc(100vh-3.5rem)] w-full min-w-0 flex-col gap-3 bg-[#050505] p-3 text-white sm:p-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/80 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-base font-black text-white">Mercados</h1>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              streamConnected
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-red-500/30 bg-red-500/10 text-red-400"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${streamConnected ? "animate-pulse bg-emerald-400" : "bg-red-400"}`} />
            {streamConnected ? "Live" : "Offline"}
          </span>
          {isAdmin && (
            <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
              Admin
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">
              {selectedInfo?.name || formatPair(selectedSymbol)}
            </div>
            <div className="font-mono text-xl font-black text-white">
              {selectedPrice ? `$${formatUsd(selectedPrice.price, digits)}` : "—"}
              <span className={`ml-2 text-sm ${selectedUp ? "text-emerald-400" : "text-red-400"}`}>
                {selectedPrice ? `${selectedUp ? "+" : ""}${selectedPrice.change.toFixed(2)}%` : ""}
              </span>
            </div>
          </div>
          <div className="hidden gap-3 text-[11px] text-zinc-500 sm:flex">
            <span>H <span className="font-mono text-white">{selectedPrice?.high ? formatUsd(selectedPrice.high, digits) : "—"}</span></span>
            <span>L <span className="font-mono text-white">{selectedPrice?.low ? formatUsd(selectedPrice.low, digits) : "—"}</span></span>
            <span>Vol <span className="font-mono text-gold">{formatCompact(selectedPrice?.quoteVolume || 0)}</span></span>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0">
          {chartReady ? (
            <LiveChart
              symbol={selectedSymbol}
              height={680}
              scripts={scripts}
              onScriptsChange={persistScripts}
              adminTools={isAdmin}
              onScriptResults={(results) => {
                const next: Record<string, string> = {};
                for (const result of results) {
                  if (result.error) next[result.id] = result.error;
                }
                setScriptErrors(next);
              }}
            />
          ) : (
            <div className="flex h-[680px] items-center justify-center rounded-2xl border border-zinc-800/80 bg-zinc-950 text-sm text-zinc-500">
              Cargando gráfica...
            </div>
          )}
        </section>

        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/90">
          <div className="flex border-b border-zinc-800">
            {(
              [
                ["watch", "Watchlist"],
                ...(isAdmin ? ([["indicadores", "Indicadores"]] as const) : []),
                ["consola", "Consola"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setRightTab(id)}
                className={`flex-1 px-2 py-2.5 text-[11px] font-bold uppercase tracking-wide ${
                  rightTab === id ? "border-b-2 border-gold text-gold" : "text-zinc-500 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {rightTab === "watch" && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="space-y-2 px-3 pt-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar BTC, ETH, SOL…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3.5 py-2 pl-9 text-xs text-white outline-none focus:border-gold"
                  />
                  <svg className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="flex gap-1">
                  {(
                    [
                      ["watch", "Lista"],
                      ["gainers", "Alzas"],
                      ["losers", "Bajas"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSortBy(id)}
                      className={`flex-1 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        sortBy === id ? "bg-gold text-black" : "bg-zinc-900 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {isAdmin && (
              <div className="mt-2 flex items-center justify-between px-3 text-[10px] text-zinc-500">
                <span className="text-emerald-400">
                  {BINANCE_PAIRS.filter((p) => pairHealth(p.symbol, prices, pairStatus).working).length} funcionan
                </span>
                <span className="text-zinc-500">
                  {BINANCE_PAIRS.filter((p) => !pairHealth(p.symbol, prices, pairStatus).working).length} bloqueadas
                </span>
              </div>
              )}
              <div className="mt-1 max-h-[calc(100vh-16rem)] flex-1 space-y-1 overflow-y-auto px-2 pb-3">
                {filteredPairs.map((p) => {
                  const live = prices.get(p.symbol);
                  const health = pairHealth(p.symbol, prices, pairStatus);
                  const working = health.working;
                  const isSelected = selectedSymbol === p.symbol;
                  const isPositive = (live?.change || 0) >= 0;
                  return (
                    <button
                      key={p.symbol}
                      type="button"
                      disabled={isAdmin ? false : !working}
                      onClick={() => {
                        if (!isAdmin && !working) return;
                        setSelectedSymbol(p.symbol);
                        saveChartPrefs({ symbol: p.symbol });
                      }}
                      title={isAdmin ? health.reason : p.name}
                      className={`w-full rounded-xl border p-2.5 text-left transition-all ${
                        isAdmin && !working
                          ? "cursor-not-allowed border-zinc-800/60 bg-zinc-950/40 opacity-50 grayscale"
                          : isSelected
                            ? "border-gold/50 bg-gold/10"
                            : "border-transparent hover:border-zinc-800 hover:bg-zinc-900/70"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${working ? "bg-emerald-400" : "bg-zinc-600"}`} />
                            <div className={`truncate font-mono text-xs font-bold ${working ? "text-white" : "text-zinc-500"}`}>
                              {formatPair(p.symbol)}
                            </div>
                          </div>
                          <div className="truncate text-[10px] text-zinc-500">
                            {isAdmin && !working ? `Bloqueada · ${health.reason}` : p.name}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-mono text-xs font-semibold ${working ? "text-white" : "text-zinc-600"}`}>
                            {working && live ? formatUsd(live.price, priceDigits(live.price)) : "—"}
                          </div>
                          {working && live && (
                            <span className={`text-[10px] font-bold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                              {isPositive ? "+" : ""}
                              {live.change.toFixed(2)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {isAdmin && rightTab === "indicadores" && (
            <div className="max-h-[calc(100vh-16rem)] overflow-y-auto p-2">
              <IndicatorScriptEditor
                compact
                scripts={scripts}
                onChange={persistScripts}
                errors={scriptErrors}
              />
            </div>
          )}

          {rightTab === "consola" && (
            <div className="flex max-h-[calc(100vh-16rem)] flex-col gap-3 overflow-y-auto p-3">
              {isAdmin && (
                <div className="rounded-xl border border-gold/20 bg-gold/5 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gold">Operación</span>
                    <Link href="/admin" className="text-[11px] font-semibold text-gold hover:underline">
                      Usuarios →
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <MiniStat label="Pares live" value={String(liveCount)} />
                    <MiniStat label="Alzas" value={String(gainers.length)} positive />
                    <MiniStat label="Bajas" value={String(losers.length)} negative />
                    <MiniStat label="Mover" value={topMover ? formatPair(topMover.symbol) : "—"} />
                  </div>
                </div>
              )}
              <BrokerConnections streamConnected={streamConnected} streamError={streamError} />
            </div>
          )}
        </aside>
      </div>
    </div>
    </ModuleGate>
  );
}

function MiniStat({
  label,
  value,
  positive,
  negative,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-black/30 px-3 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{label}</div>
      <div
        className={`mt-0.5 truncate font-mono text-sm font-bold ${
          positive ? "text-emerald-400" : negative ? "text-red-400" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

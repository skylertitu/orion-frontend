"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import LiveChart, { CHART_INTERVALS } from "@/components/LiveChart";
import { getUser } from "@/lib/auth";
import { hasCapability } from "@/lib/plans";
import { isStaff } from "@/lib/roles";
import { BINANCE_PAIRS, BINANCE_WS_URLS, fetchMarketStatus, fetchMarketTickers, formatPair, type BinancePair, type PairMarketStatus } from "@/lib/binance";
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

const WATCH_GROUPS: Array<{ id: string; label: string; match: (p: BinancePair) => boolean }> = [
  { id: "majors", label: "PRINCIPALES", match: (p) => ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT"].includes(p.symbol) },
  { id: "solana", label: "SOLANA", match: (p) => p.network === "solana" && p.symbol !== "SOLUSDT" },
  { id: "ethereum", label: "ETHEREUM", match: (p) => p.network === "ethereum" && p.symbol !== "ETHUSDT" },
  { id: "otros", label: "OTROS", match: (p) => !["bitcoin", "solana", "ethereum"].includes(p.network) && p.symbol !== "BNBUSDT" },
];

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
  const isAdmin = isStaff(user);
  const canTrade = hasCapability(user, "manual_orders") || isAdmin;
  const canIndicators =
    isAdmin || hasCapability(user, "indicators_library") || hasCapability(user, "indicators_editor");
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [prices, setPrices] = useState<Map<string, LivePrice>>(new Map());
  const [streamConnected, setStreamConnected] = useState(false);
  const [streamError, setStreamError] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"watch" | "gainers" | "losers">("watch");
  const [scripts, setScripts] = useState<IndicatorScript[]>([]);
  const [scriptErrors, setScriptErrors] = useState<Record<string, string>>({});
  const [rightTab, setRightTab] = useState<"watch" | "indicadores" | "consola">("watch");
  const [panelOpen, setPanelOpen] = useState(false);
  const [ticketSide, setTicketSide] = useState<"buy" | "sell">("buy");
  const [qty, setQty] = useState("0.01");
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [interval, setChartTf] = useState(() => loadChartPrefs().interval);
  const [pairStatus, setPairStatus] = useState<Map<string, PairMarketStatus>>(new Map());
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      setSearch(q);
      setSearchOpen(true);
    }
  }, []);

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
  const selectedUp = (selectedPrice?.change || 0) >= 0;
  const digits = priceDigits(selectedPrice?.price || 0);

  type PanelTab = "watch" | "indicadores" | "consola";

  function openPanel(tab: PanelTab) {
    if (panelOpen && rightTab === tab) {
      setPanelOpen(false);
      return;
    }
    setRightTab(tab);
    setPanelOpen(true);
  }

  function selectPair(symbol: string) {
    if (!isAdmin && !pairHealth(symbol, prices, pairStatus).working) return;
    setSelectedSymbol(symbol);
    saveChartPrefs({ symbol });
  }

  const watchlistBody = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-zinc-800/80 px-2 py-2">
        <span className="flex-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Seguimiento</span>
        <button type="button" onClick={() => setSearchOpen((v) => !v)} className={`h-7 w-7 rounded-md ${searchOpen ? "text-gold" : "text-zinc-500 hover:text-white"}`}>
          ⌕
        </button>
        <button type="button" onClick={() => setSortBy(sortBy === "gainers" ? "watch" : "gainers")} className={`h-7 w-7 rounded-md text-[11px] font-bold ${sortBy === "gainers" ? "text-emerald-400" : "text-zinc-500"}`}>↑</button>
        <button type="button" onClick={() => setSortBy(sortBy === "losers" ? "watch" : "losers")} className={`h-7 w-7 rounded-md text-[11px] font-bold ${sortBy === "losers" ? "text-red-400" : "text-zinc-500"}`}>↓</button>
      </div>
      {searchOpen && (
        <div className="border-b border-zinc-800/80 px-2 py-2">
          <input
            autoFocus
            type="search"
            autoComplete="off"
            placeholder="BTC, ETH, SOL…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-zinc-800 bg-[#111111] px-2 py-1.5 text-xs text-white outline-none focus:border-gold/50"
          />
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,1.4fr)_1fr_0.9fr] gap-1 border-b border-zinc-800/80 px-2 py-1.5 text-[10px] uppercase tracking-wide text-zinc-600">
        <span>Símbolo</span>
        <span className="text-right">Precio</span>
        <span className="text-right">24h</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {sortBy === "watch" && !search
          ? WATCH_GROUPS.map((group) => {
              const rows = filteredPairs.filter(group.match);
              if (!rows.length) return null;
              const collapsed = Boolean(collapsedGroups[group.id]);
              return (
                <div key={group.id}>
                  <button
                    type="button"
                    onClick={() => setCollapsedGroups((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                    className="flex w-full items-center gap-1 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
                  >
                    {group.label}
                  </button>
                  {!collapsed &&
                    rows.map((p) => (
                      <WatchRow
                        key={p.symbol}
                        pair={p}
                        live={prices.get(p.symbol)}
                        selected={selectedSymbol === p.symbol}
                        working={pairHealth(p.symbol, prices, pairStatus).working}
                        admin={isAdmin}
                        onSelect={() => selectPair(p.symbol)}
                      />
                    ))}
                </div>
              );
            })
          : filteredPairs.map((p) => (
              <WatchRow
                key={p.symbol}
                pair={p}
                live={prices.get(p.symbol)}
                selected={selectedSymbol === p.symbol}
                working={pairHealth(p.symbol, prices, pairStatus).working}
                admin={isAdmin}
                onSelect={() => selectPair(p.symbol)}
              />
            ))}
      </div>
    </div>
  );

  return (
    <ModuleGate moduleId="market">
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-[#0a0a0a] text-white">
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-zinc-800/80 bg-[#0a0a0a] px-3">
        <span className="font-mono text-sm font-bold text-white">{formatPair(selectedSymbol)}</span>
        <span className={`font-mono text-lg font-black ${selectedUp ? "text-emerald-400" : "text-gold"}`}>
          {selectedPrice ? formatUsd(selectedPrice.price, digits) : "—"}
        </span>
        <span className={`font-mono text-xs font-bold ${selectedUp ? "text-emerald-400" : "text-red-400"}`}>
          {selectedPrice ? `${selectedUp ? "+" : ""}${selectedPrice.change.toFixed(2)}%` : ""}
        </span>
        <span
          className={`hidden items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase sm:inline-flex ${
            streamConnected
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${streamConnected ? "animate-pulse bg-emerald-400" : "bg-red-400"}`} />
          {streamConnected ? "Live" : "Offline"}
        </span>
        <div className="ml-2 hidden items-center rounded-md border border-zinc-800 p-0.5 md:flex">
          {CHART_INTERVALS.map((tf) => (
            <button
              key={tf.value}
              type="button"
              onClick={() => {
                setChartTf(tf.value);
                saveChartPrefs({ interval: tf.value });
              }}
              className={`rounded px-2 py-1 text-[10px] font-bold ${
                interval === tf.value ? "bg-gold text-black" : "text-zinc-500 hover:text-white"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
        <div className="ml-auto hidden gap-3 text-[10px] text-zinc-500 lg:flex">
          <span>H <span className="font-mono text-zinc-200">{selectedPrice?.high ? formatUsd(selectedPrice.high, digits) : "—"}</span></span>
          <span>L <span className="font-mono text-zinc-200">{selectedPrice?.low ? formatUsd(selectedPrice.low, digits) : "—"}</span></span>
          <span>Vol <span className="font-mono text-gold">{formatCompact(selectedPrice?.quoteVolume || 0)}</span></span>
        </div>
        <div className="ml-auto flex gap-1 xl:hidden">
          <button type="button" onClick={() => openPanel("watch")} className="rounded-md border border-zinc-800 px-2 py-1 text-[10px] font-bold uppercase text-zinc-300">
            Lista
          </button>
          <Link href={canTrade ? `/trading?symbol=${selectedSymbol}` : "/cuentas"} className="rounded-md bg-gold px-2 py-1 text-[10px] font-black uppercase text-black">
            Operar
          </Link>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-800/80 bg-[#0a0a0a] lg:flex">
          {watchlistBody}
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            {chartReady ? (
              <LiveChart
                symbol={selectedSymbol}
                interval={interval}
                fill
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
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">Cargando gráfica...</div>
            )}
          </div>
          <div className="shrink-0 border-t border-zinc-800/80 bg-[#0a0a0a]">
            <div className="flex gap-4 border-b border-zinc-800/80 px-4 text-[11px] font-bold uppercase tracking-wider">
              <span className="border-b-2 border-gold py-2 text-gold">Posiciones</span>
              <span className="py-2 text-zinc-600">Órdenes</span>
              <span className="py-2 text-zinc-600">Historial</span>
            </div>
            <div className="px-4 py-6 text-center text-xs text-zinc-500">Sin posiciones abiertas en este símbolo.</div>
          </div>
        </div>

        <aside className="hidden w-72 shrink-0 flex-col border-l border-zinc-800/80 bg-[#0a0a0a] xl:flex">
          <div className="flex border-b border-zinc-800/80 p-1">
            <button
              type="button"
              onClick={() => setTicketSide("buy")}
              className={`flex-1 rounded-md py-2 text-[11px] font-black uppercase ${
                ticketSide === "buy" ? "bg-emerald-500/15 text-emerald-400" : "text-zinc-500 hover:text-white"
              }`}
            >
              Comprar
            </button>
            <button
              type="button"
              onClick={() => setTicketSide("sell")}
              className={`flex-1 rounded-md py-2 text-[11px] font-black uppercase ${
                ticketSide === "sell" ? "bg-red-500/15 text-red-400" : "text-zinc-500 hover:text-white"
              }`}
            >
              Vender
            </button>
          </div>
          <div className="space-y-3 p-4">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Precio
              <input
                readOnly
                value={selectedPrice ? formatUsd(selectedPrice.price, digits) : "—"}
                className="mt-1 w-full rounded-md border border-zinc-800 bg-[#111111] px-3 py-2 font-mono text-sm text-white"
              />
            </label>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Cantidad
              <input
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-800 bg-[#111111] px-3 py-2 font-mono text-sm text-white outline-none focus:border-gold/50"
              />
            </label>
            <Link
              href={canTrade ? `/trading?symbol=${selectedSymbol}&side=${ticketSide}` : "/cuentas"}
              className={`flex h-11 items-center justify-center rounded-md text-[12px] font-black uppercase tracking-wide ${
                ticketSide === "buy" ? "bg-gold text-black hover:bg-gold-light" : "bg-red-500 text-white hover:bg-red-400"
              }`}
            >
              {ticketSide === "buy" ? "Comprar" : "Vender"} {formatPair(selectedSymbol)}
            </Link>
            <p className="text-[11px] leading-relaxed text-zinc-600">
              {canTrade ? "Abre el motor para enviar la orden DEMO o LIVE." : "Conecta cuenta o usa el plan Analista para operar."}
            </p>
          </div>
          {canIndicators && (
            <div className="mt-auto border-t border-zinc-800/80 p-3">
              <Link
                href="/indicadores"
                className="block w-full rounded-md border border-zinc-800 py-2 text-center text-[11px] font-bold uppercase text-zinc-400 hover:text-gold"
              >
                Indicadores
              </Link>
            </div>
          )}
        </aside>

        {panelOpen && (
          <button type="button" aria-label="Cerrar panel" className="absolute inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setPanelOpen(false)} />
        )}

        <aside
          className={`absolute inset-y-0 right-0 z-30 flex w-[min(100%,20rem)] flex-col overflow-hidden border-l border-zinc-800 bg-[#0a0a0a] transition-transform duration-200 lg:hidden ${
            panelOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-zinc-800 px-2 py-1.5">
            <span className="text-[11px] font-bold uppercase text-zinc-400">Lista</span>
            <button type="button" onClick={() => setPanelOpen(false)} className="h-7 w-7 text-zinc-500">×</button>
          </div>
          {watchlistBody}
        </aside>
      </div>
    </div>
    </ModuleGate>
  );
}

function WatchRow({
  pair,
  live,
  selected,
  working,
  admin,
  onSelect,
}: {
  pair: BinancePair;
  live?: LivePrice;
  selected: boolean;
  working: boolean;
  admin: boolean;
  onSelect: () => void;
}) {
  const price = live?.price;
  const pct = live?.change;
  const up = (pct || 0) >= 0;
  const tone = !working ? "text-zinc-600" : up ? "text-[#26a69a]" : "text-[#ef5350]";
  const digits = priceDigits(price || 0);

  return (
    <button
      type="button"
      disabled={admin ? false : !working}
      onClick={onSelect}
      className={`grid w-full grid-cols-[minmax(0,1.4fr)_1fr_0.9fr] items-center gap-1 border-l-2 px-2 py-[6px] text-left text-[12px] ${
        selected ? "border-gold bg-gold/[0.07]" : "border-transparent hover:bg-white/[0.03]"
      } ${!working ? "opacity-40" : ""}`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${working ? "bg-[#26a69a]" : "bg-zinc-600"}`} />
        <span className="truncate font-medium text-white">{formatPair(pair.symbol)}</span>
      </span>
      <span className={`text-right font-mono ${working ? "text-white" : "text-zinc-600"}`}>
        {working && price ? formatUsd(price, digits) : "—"}
      </span>
      <span className={`text-right font-mono ${tone}`}>
        {working && pct != null ? `${up ? "+" : ""}${pct.toFixed(2)}%` : "—"}
      </span>
    </button>
  );
}

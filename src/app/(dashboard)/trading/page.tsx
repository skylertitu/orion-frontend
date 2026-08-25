"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LiveChart from "@/components/LiveChart";
import LucySignalsPanel from "@/components/LucySignalsPanel";
import SystemControlBoard from "@/components/SystemControlBoard";
import ModuleGate from "@/components/ModuleGate";
import PlanGate from "@/components/PlanGate";
import MotorIntegrations from "@/components/MotorIntegrations";
import JupiterMarketsPanel from "@/components/JupiterMarketsPanel";
import { api, type BrokerAccountPublic, type BrokerStatus } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { hasCapability } from "@/lib/plans";
import { isStaff } from "@/lib/roles";
import { toast } from "@/lib/toast";
import { loadUiPrefs } from "@/lib/uiPrefs";
import { BINANCE_PAIRS, DEFAULT_SYMBOL, formatPair, fetchMarketTickers } from "@/lib/binance";
import { loadChartPrefs, saveChartPrefs } from "@/lib/chartPrefs";
import { hydrateIndicatorScripts, persistIndicatorScripts } from "@/lib/indicatorSync";
import type { IndicatorScript } from "@/lib/indicatorScript";

const inputClass =
  "w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-gold";

type EnginePosition = {
  broker: string;
  ticket: string | number;
  symbol: string;
  side: string;
  quantity: number;
  lot?: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  sl?: number;
  tp?: number;
  openTime?: string;
  comment?: string;
  brokerAccountId?: number;
};

type LastOrder = {
  at: string;
  broker: string;
  symbol: string;
  side: string;
  amount: string;
  ticket?: string | number;
  price?: number;
};

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizePosition(raw: Record<string, unknown>): EnginePosition {
  const side = String(raw.side || "").toLowerCase();
  return {
    broker: String(raw.broker || ""),
    ticket: (raw.ticket as string | number) ?? "",
    symbol: String(raw.symbol || ""),
    side: side === "sell" || side === "short" ? "sell" : "buy",
    quantity: asNumber(raw.quantity ?? raw.qty),
    lot: raw.lot != null ? asNumber(raw.lot) : undefined,
    openPrice: asNumber(raw.openPrice ?? raw.entry),
    currentPrice: asNumber(raw.currentPrice ?? raw.current),
    profit: asNumber(raw.profit ?? raw.pnl),
    sl: raw.sl != null ? asNumber(raw.sl) : undefined,
    tp: raw.tp != null ? asNumber(raw.tp) : undefined,
    openTime: typeof raw.openTime === "string" ? raw.openTime : undefined,
    comment: typeof raw.comment === "string" ? raw.comment : undefined,
    brokerAccountId: raw.brokerAccountId != null ? asNumber(raw.brokerAccountId) : undefined,
  };
}

function money(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function priceDigits(price: number): number {
  if (price >= 1000) return 2;
  if (price >= 1) return 4;
  return 6;
}

type MotorTab = "control" | "integraciones" | "operar" | "jupiter";

export default function TradingPage() {
  const user = getUser();
  const isAdmin = isStaff(user);
  const canJupiter = hasCapability(user, "jupiter_execute");
  const canSignals = hasCapability(user, "lucy_signals");
  const [tab, setTab] = useState<MotorTab>(isAdmin ? "control" : "operar");
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [broker, setBroker] = useState("binance");
  const [accountId, setAccountId] = useState<number | "">("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [positions, setPositions] = useState<EnginePosition[]>([]);
  const [accounts, setAccounts] = useState<BrokerAccountPublic[]>([]);
  const [brokers, setBrokers] = useState<BrokerStatus[]>([]);
  const [scripts, setScripts] = useState<IndicatorScript[]>([]);
  const [livePrice, setLivePrice] = useState(0);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null);

  const isMt = broker === "mt5";

  useEffect(() => {
    const prefs = loadChartPrefs();
    setSymbol(prefs.symbol);
    void hydrateIndicatorScripts().then(setScripts);
  }, []);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("tab");
    if (raw === "control" || raw === "integraciones" || raw === "operar" || raw === "jupiter") {
      if (!isAdmin && (raw === "control" || raw === "integraciones" || raw === "jupiter")) {
        setTab("operar");
        return;
      }
      if (raw === "jupiter" && !canJupiter) {
        setTab("operar");
        return;
      }
      setTab(raw);
    }
  }, [isAdmin, canJupiter]);

  function goTab(next: MotorTab) {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState({}, "", url);
  }

  const loadAccounts = useCallback(async () => {
    const [accRes, brokerRes] = await Promise.all([api.brokerAccounts.list(), api.engine.brokers()]);
    if (accRes.success && Array.isArray(accRes.data)) setAccounts(accRes.data);
    if (brokerRes.success && Array.isArray(brokerRes.data)) setBrokers(brokerRes.data);
  }, []);

  const loadPositions = useCallback(async () => {
    const res = await api.engine.positions();
    if (!res.success || !Array.isArray(res.data)) return;
    setPositions((res.data as Record<string, unknown>[]).map(normalizePosition));
  }, []);

  useEffect(() => {
    void loadAccounts();
    void loadPositions();
    const id = setInterval(() => void loadPositions(), 8000);
    return () => clearInterval(id);
  }, [loadAccounts, loadPositions]);

  useEffect(() => {
    let cancelled = false;
    async function loadPrice() {
      try {
        const rows = await fetchMarketTickers();
        const row = rows.find((r) => r.symbol === symbol || r.pair === symbol);
        if (!cancelled && row) setLivePrice(row.price);
      } catch {
        const res = await api.engine.price(broker, symbol);
        if (!cancelled && res.success && res.data?.price) setLivePrice(res.data.price);
      }
    }
    void loadPrice();
    const id = setInterval(() => void loadPrice(), 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol, broker]);

  const brokerAccounts = useMemo(
    () => accounts.filter((a) => a.brokerId === broker),
    [accounts, broker]
  );
  const connectedAccounts = useMemo(
    () => accounts.filter((a) => a.status === "connected"),
    [accounts]
  );

  useEffect(() => {
    const primary = brokerAccounts.find((a) => a.isPrimary && a.status === "connected")
      || brokerAccounts.find((a) => a.status === "connected")
      || brokerAccounts[0];
    setAccountId(primary?.id ?? "");
  }, [broker, brokerAccounts]);

  const selectedAccount = brokerAccounts.find((a) => a.id === accountId);
  const canTrade = Boolean(selectedAccount && selectedAccount.status === "connected");
  const qty = parseFloat(quantity);
  const notional = Number.isFinite(qty) && livePrice > 0 ? qty * livePrice : 0;
  const openPnl = positions.reduce((sum, p) => sum + p.profit, 0);
  const brokerLabel = broker === "mt5" ? "MetaTrader 5" : broker === "bybit" ? "Bybit" : "Binance";

  function persistScripts(next: IndicatorScript[]) {
    setScripts(next);
    persistIndicatorScripts(next);
  }

  function selectSymbol(next: string) {
    setSymbol(next);
    saveChartPrefs({ symbol: next });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!canTrade) {
      toast.error("Conecta una cuenta en Cuentas Broker antes de operar.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error(isMt ? "Indica el lote (por ejemplo 0.10)." : "Indica una cantidad válida.");
      return;
    }

    const mode = (selectedAccount?.executionMode || "demo") === "live" ? "LIVE" : "DEMO";
    if (mode === "LIVE" || loadUiPrefs().confirmOrders) {
      const ok = window.confirm(
        `¿Enviar ${side === "buy" ? "COMPRA" : "VENTA"} ${mode} de ${qty} ${symbol} en ${brokerLabel}?`
      );
      if (!ok) return;
    }

    setLoading(true);
    const payload = {
      broker,
      symbol,
      side,
      comment: "Orion Motor Trading",
      brokerAccountId: typeof accountId === "number" ? accountId : undefined,
      sl: sl ? Number(sl) : undefined,
      tp: tp ? Number(tp) : undefined,
      ...(isMt ? { lot: qty } : { quantity: qty }),
    };
    const res = await api.engine.order(payload);
    if (res.success) {
      const data = (res.data || {}) as { ticket?: string | number; executedPrice?: number };
      toast.success(
        `${side === "buy" ? "Compra" : "Venta"} ${(selectedAccount?.executionMode || "demo") === "live" ? "enviada" : "DEMO"} · ${brokerLabel}${data.ticket ? ` · ticket ${data.ticket}` : ""}`
      );
      setLastOrder({
        at: new Date().toISOString(),
        broker: brokerLabel,
        symbol,
        side,
        amount: isMt ? `${qty} lotes` : `${qty} ${formatPair(symbol).split("/")[0]}`,
        ticket: data.ticket,
        price: data.executedPrice || livePrice,
      });
      setQuantity("");
      setSl("");
      setTp("");
      void loadPositions();
    } else {
      toast.error(res.error || "El broker rechazó la orden");
    }
    setLoading(false);
  }

  async function closePosition(pos: EnginePosition) {
    if (!pos.ticket) return;
    if (loadUiPrefs().confirmOrders || (selectedAccount?.executionMode || "demo") === "live") {
      const ok = window.confirm(`¿Cerrar ${formatPair(pos.symbol)} ticket ${pos.ticket}?`);
      if (!ok) return;
    }
    const key = `${pos.broker}-${pos.ticket}`;
    setClosing(key);
    const res = await api.engine.closePosition(pos.broker, pos.ticket);
    if (res.success) {
      toast.success(`Posición ${formatPair(pos.symbol)} cerrada`);
      void loadPositions();
    } else {
      toast.error(res.error || "No se pudo cerrar la posición");
    }
    setClosing(null);
  }

  return (
    <PlanGate capability="manual_orders">
    <div className="flex w-full min-w-0 flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-white">Motor Trading</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            {isAdmin
              ? "Todo el control del motor vive aquí: estado, integraciones, órdenes y mercados Jupiter."
              : "Elige cuenta, par y cantidad, envía la orden al broker y sigue el resultado en la gráfica."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
        {(isAdmin
          ? [
              { id: "control" as const, label: "Control" },
              { id: "integraciones" as const, label: "Integraciones" },
              { id: "operar" as const, label: "Operar" },
              ...(canJupiter ? [{ id: "jupiter" as const, label: "Jupiter" }] : []),
            ]
          : [{ id: "operar" as const, label: "Operar" }]
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => goTab(item.id)}
            className={`rounded-xl px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${
              tab === item.id ? "bg-gold text-black" : "border border-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {isAdmin && tab === "control" && <SystemControlBoard />}
      {isAdmin && tab === "integraciones" && <MotorIntegrations />}
      {tab === "jupiter" && canJupiter && (
        <ModuleGate moduleId="jupiter">
          <JupiterMarketsPanel />
        </ModuleGate>
      )}
      {tab === "operar" && (
      <ModuleGate moduleId="trading">

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="P&L abierto"
          value={openPnl === 0 && positions.length === 0 ? "—" : `$${money(openPnl)}`}
          hint={`${positions.length} posición${positions.length === 1 ? "" : "es"}`}
          tone={openPnl > 0 ? "up" : openPnl < 0 ? "down" : "neutral"}
        />
        <StatCard
          label="Cuentas listas"
          value={`${connectedAccounts.length}/${accounts.length || 0}`}
          hint={
            connectedAccounts.length
              ? connectedAccounts.some((a) => (a.executionMode || "demo") === "live")
                ? "Hay al menos una cuenta LIVE"
                : "Listas en DEMO"
              : "Conecta un broker primero"
          }
        />
        <StatCard
          label="Par activo"
          value={formatPair(symbol)}
          hint={livePrice > 0 ? `$${money(livePrice, priceDigits(livePrice))}` : "Cargando precio"}
        />
      </div>

      {!connectedAccounts.length && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          No hay cuentas conectadas. Ve a{" "}
          <Link href="/cuentas" className="font-bold underline">
            Cuentas Broker
          </Link>{" "}
          y prueba la conexión antes de comprar o vender.
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-zinc-800/80 bg-zinc-950 p-5">
          <div>
            <h2 className="font-bold text-white">Nueva orden</h2>
            <p className="text-[11px] text-zinc-500">
              {(selectedAccount?.executionMode || "demo") === "live"
                ? "LIVE: esta orden sale al broker de verdad."
                : "DEMO: precios reales, la orden no sale al exchange."}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-500">Broker</label>
            <select
              value={broker}
              onChange={(e) => setBroker(e.target.value)}
              className={inputClass}
            >
              <option value="binance">Binance</option>
              <option value="bybit">Bybit</option>
              <option value="mt5">MetaTrader 5</option>
            </select>
            <p className="mt-1 text-[11px] text-zinc-600">
              {brokers.find((b) => b.id === broker)?.message
                || (selectedAccount?.status === "connected" ? "Cuenta conectada" : "Sin cuenta lista")}
            </p>
          </div>

          {brokerAccounts.length > 0 && (
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Cuenta</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : "")}
                className={inputClass}
              >
                {brokerAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.accountName} · {(acc.executionMode || "demo") === "live" ? "LIVE" : "DEMO"} · {acc.status}
                    {acc.isPrimary ? " · principal" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSide("buy")}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${
                side === "buy" ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-400"
              }`}
            >
              Comprar
            </button>
            <button
              type="button"
              onClick={() => setSide("sell")}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${
                side === "sell" ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-400"
              }`}
            >
              Vender
            </button>
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-500">Par</label>
            <select value={symbol} onChange={(e) => selectSymbol(e.target.value)} className={inputClass}>
              {BINANCE_PAIRS.map((p) => (
                <option key={p.symbol} value={p.symbol}>
                  {formatPair(p.symbol)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-500">{isMt ? "Lotes" : "Cantidad"}</label>
            <input
              type="number"
              step="any"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={isMt ? "0.10" : "0.001"}
              required
              className={inputClass}
            />
            {!isMt && livePrice > 0 && Number.isFinite(qty) && qty > 0 && (
              <p className="mt-1 text-[11px] text-zinc-500">≈ ${money(notional)} USDT al precio actual</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Stop loss</label>
              <input type="number" step="any" min="0" value={sl} onChange={(e) => setSl(e.target.value)} placeholder="Opcional" className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Take profit</label>
              <input type="number" step="any" min="0" value={tp} onChange={(e) => setTp(e.target.value)} placeholder="Opcional" className={inputClass} />
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3 text-xs text-zinc-300">
            Vas a <span className={side === "buy" ? "font-bold text-emerald-400" : "font-bold text-red-400"}>{side === "buy" ? "COMPRAR" : "VENDER"}</span>{" "}
            {quantity || "—"} {isMt ? "lotes" : formatPair(symbol)} en <span className="font-semibold text-white">{brokerLabel}</span>
            {livePrice > 0 ? ` @ $${money(livePrice, priceDigits(livePrice))}` : ""}.
          </div>

          <button
            type="submit"
            disabled={loading || !canTrade}
            className={`w-full rounded-xl py-3 text-sm font-bold disabled:opacity-40 ${
              side === "buy" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
            }`}
          >
            {loading ? "Enviando al broker..." : !canTrade ? "Cuenta no conectada" : side === "buy" ? "Enviar compra" : "Enviar venta"}
          </button>
        </form>

        <div className="min-w-0 space-y-4">
          <LiveChart
            symbol={symbol}
            height={380}
            scripts={scripts}
            onScriptsChange={persistScripts}
          />
          {lastOrder && (
            <div className="rounded-2xl border border-gold/20 bg-gold/5 px-4 py-3 text-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gold">Última orden</div>
              <div className="mt-1 text-white">
                {lastOrder.side === "buy" ? "Compra" : "Venta"} {lastOrder.amount} de {formatPair(lastOrder.symbol)} en {lastOrder.broker}
                {lastOrder.price ? ` @ $${money(lastOrder.price, priceDigits(lastOrder.price))}` : ""}
                {lastOrder.ticket ? ` · ticket ${lastOrder.ticket}` : ""}
              </div>
              <div className="text-[11px] text-zinc-500">{new Date(lastOrder.at).toLocaleString("es")}</div>
            </div>
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-zinc-800/80 bg-zinc-950 p-5">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <div>
            <h2 className="font-bold text-white">Posiciones abiertas</h2>
            <p className="text-[11px] text-zinc-500">Lo que el broker reporta ahora mismo. Puedes cerrar desde aquí.</p>
          </div>
          <span className="rounded-md border border-zinc-700 px-2 py-0.5 font-mono text-xs text-zinc-300">
            {positions.length}
          </span>
        </div>

        {positions.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            No hay posiciones abiertas. Cuando envíes una orden, aparecerá aquí con su P&L.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
                <tr className="border-b border-zinc-800">
                  <th className="px-3 py-2">Par</th>
                  <th className="px-3 py-2">Lado</th>
                  <th className="px-3 py-2">Cantidad</th>
                  <th className="px-3 py-2">Entrada</th>
                  <th className="px-3 py-2">Actual</th>
                  <th className="px-3 py-2">P&L</th>
                  <th className="px-3 py-2">SL / TP</th>
                  <th className="px-3 py-2">Broker</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => {
                  const key = `${pos.broker}-${pos.ticket}-${pos.symbol}`;
                  const digits = priceDigits(pos.currentPrice || pos.openPrice);
                  return (
                    <tr key={key} className="border-b border-zinc-900 hover:bg-zinc-900/40">
                      <td className="px-3 py-3 font-bold text-white">{formatPair(pos.symbol)}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            pos.side === "buy"
                              ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                              : "border border-red-500/30 bg-red-500/15 text-red-400"
                          }`}
                        >
                          {pos.side === "buy" ? "COMPRA" : "VENTA"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-zinc-300">
                        {pos.lot ? `${pos.lot} lot` : pos.quantity || "—"}
                      </td>
                      <td className="px-3 py-3 text-zinc-300">{money(pos.openPrice, digits)}</td>
                      <td className="px-3 py-3 text-white">{money(pos.currentPrice, digits)}</td>
                      <td className={`px-3 py-3 font-bold ${pos.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {pos.profit >= 0 ? "+" : ""}
                        {money(pos.profit)}
                      </td>
                      <td className="px-3 py-3 text-zinc-500">
                        {pos.sl || pos.tp ? `${pos.sl ?? "—"} / ${pos.tp ?? "—"}` : "—"}
                      </td>
                      <td className="px-3 py-3 uppercase text-zinc-400">{pos.broker}</td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          disabled={!pos.ticket || closing === `${pos.broker}-${pos.ticket}`}
                          onClick={() => void closePosition(pos)}
                          className="rounded-lg border border-zinc-700 px-2 py-1 text-[10px] font-bold uppercase text-zinc-300 hover:border-red-500/40 hover:text-red-400 disabled:opacity-40"
                        >
                          {closing === `${pos.broker}-${pos.ticket}` ? "Cerrando..." : "Cerrar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canSignals && <LucySignalsPanel />}
      </ModuleGate>
      )}
    </div>
    </PlanGate>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "up" | "down" | "neutral";
}) {
  const valueClass =
    tone === "up" ? "text-emerald-400" : tone === "down" ? "text-red-400" : "text-white";
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mt-1 font-mono text-xl font-bold ${valueClass}`}>{value}</div>
      <div className="mt-1 text-[11px] text-zinc-500">{hint}</div>
    </div>
  );
}

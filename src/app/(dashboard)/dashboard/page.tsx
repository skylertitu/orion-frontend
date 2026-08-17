"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PriceTrendChart from "@/components/PriceTrendChart";
import { api, BrokerStatus, SignalRecord } from "@/lib/api";
import { getUser } from "@/lib/auth";

interface OpenPosition {
  ticket: string;
  symbol: string;
  side: string;
  entry: string;
  current: string;
  qty: string;
  pnl: string;
  isProfit: boolean;
  broker: string;
}

function formatNum(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatPnl(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNum(value)}`;
}

function confidenceLabel(raw: number): string {
  const pct = raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
  return `${pct}%`;
}

export default function DashboardPage() {
  const user = getUser();
  const [timeStr, setTimeStr] = useState("--:--:--");
  const [brokers, setBrokers] = useState<BrokerStatus[]>([]);
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [signals, setSignals] = useState<SignalRecord[]>([]);
  const [lucyPending, setLucyPending] = useState(true);
  const [backendOk, setBackendOk] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      setTimeStr(new Date().toLocaleTimeString("es", { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [brokersRes, positionsRes, lucyRes, signalsRes] = await Promise.all([
        api.engine.brokers(),
        api.engine.positions(),
        api.lucy.health(),
        user ? api.signals.list(user.id, { limit: 8 }) : Promise.resolve({ success: true, data: [] }),
      ]);

      if (cancelled) return;

      if (brokersRes.success && brokersRes.data) {
        setBrokers(brokersRes.data);
        setBackendOk(true);
      } else {
        setBackendOk(false);
      }

      if (positionsRes.success && Array.isArray(positionsRes.data)) {
        setPositions(
          positionsRes.data.map((pos: any) => {
            const profit = Number(pos.profit || 0);
            return {
              ticket: String(pos.ticket ?? ""),
              symbol: String(pos.symbol || "—"),
              side: String(pos.side || "").toUpperCase(),
              entry: formatNum(Number(pos.openPrice)),
              current: formatNum(Number(pos.currentPrice)),
              qty: String(pos.quantity ?? pos.lot ?? "—"),
              pnl: formatPnl(profit),
              isProfit: profit >= 0,
              broker: String(pos.broker || "—"),
            };
          })
        );
      } else {
        setPositions([]);
      }

      const lucyData = lucyRes.data as { pending?: boolean; alive?: boolean } | undefined;
      setLucyPending(Boolean(lucyData?.pending) || lucyData?.alive === false || !lucyRes.success);

      if (signalsRes.success && Array.isArray(signalsRes.data)) {
        setSignals(signalsRes.data);
      } else {
        setSignals([]);
      }
    }

    void load();
    const interval = setInterval(() => void load(), 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  const pnlTotal = useMemo(
    () =>
      positions.reduce((sum, pos) => {
        const n = Number(pos.pnl.replace(/[+$,]/g, ""));
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0),
    [positions]
  );
  const connectedBrokers = brokers.filter((b) => b.connected);
  const uniquePairs = new Set(positions.map((p) => p.symbol)).size;
  const executedSignals = signals.filter((s) => s.executed).length;

  return (
    <div className="flex min-h-screen min-w-0 flex-col gap-6 p-4 text-white bg-[#07090e] font-sans sm:p-6">
      <div className="flex flex-col gap-2 border-b border-zinc-800/60 pb-3 text-xs text-zinc-400 font-mono sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span>AutoTrade</span>
          <span>/</span>
          <span className="text-white font-bold">Dashboard</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <span className="hidden items-center gap-1.5 text-zinc-400 sm:flex">
            <span className={`h-1.5 w-1.5 rounded-full ${backendOk ? "bg-emerald-400" : "bg-red-400"}`} />
            {brokers.map((b) => b.label).join(" · ") || "Sin brokers"}
          </span>
          <span className="rounded-md border border-zinc-800 bg-[#111726] px-2 py-0.5 text-[11px] text-zinc-300 font-mono">
            {timeStr}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Datos reales del backend — actualizado {timeStr}
          </p>
        </div>

        <div
          className={`flex items-center gap-2 rounded-full border px-3.5 py-1 text-xs font-semibold ${
            backendOk
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${backendOk ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
          <span>
            {backendOk
              ? `Backend activo · ${connectedBrokers.length}/${brokers.length || 0} brokers`
              : "Backend no disponible"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-5">
          <span className="text-xs font-medium text-zinc-400">P&L abierto</span>
          <div
            className={`mt-2 text-2xl font-bold font-mono ${
              pnlTotal >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {formatPnl(pnlTotal)}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500 font-medium">Suma de posiciones actuales</div>
        </div>

        <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-5">
          <span className="text-xs font-medium text-zinc-400">Posiciones abiertas</span>
          <div className="mt-2 text-2xl font-bold font-mono text-white">{positions.length}</div>
          <div className="mt-1 text-[11px] text-zinc-500 font-medium">
            {uniquePairs} {uniquePairs === 1 ? "par activo" : "pares activos"}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-5">
          <span className="text-xs font-medium text-zinc-400">Señales Lucy</span>
          <div className="mt-2 text-2xl font-bold font-mono text-white">{signals.length}</div>
          <div className="mt-1 text-[11px] text-zinc-500 font-medium">
            {lucyPending ? "Lucy pendiente de conectar" : `${executedSignals} ejecutadas`}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-5">
          <span className="text-xs font-medium text-zinc-400">Brokers conectados</span>
          <div className="mt-2 text-2xl font-bold font-mono text-white">
            {connectedBrokers.length}/{brokers.length || 0}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500 font-medium">
            Mercado público no implica cuenta de trading
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Estado por broker
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(brokers.length ? brokers : [
            { id: "binance", label: "Binance", connected: false, enabled: false, message: "Sin datos" },
            { id: "bybit", label: "Bybit", connected: false, enabled: false, message: "Sin datos" },
            { id: "mt5", label: "MetaTrader 5", connected: false, enabled: false, message: "Sin datos" },
          ] as BrokerStatus[]).map((broker) => (
            <div
              key={broker.id}
              className="flex items-center justify-between rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-4"
            >
              <div>
                <div className="text-xs text-zinc-400 font-medium">{broker.label}</div>
                <div className="text-sm font-medium text-white mt-1">
                  {broker.message || (broker.connected ? "Responde" : "Sin respuesta")}
                </div>
              </div>
              <span
                className={`rounded-md border px-2.5 py-1 text-[10px] font-mono font-semibold ${
                  broker.connected
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-zinc-700 bg-zinc-900 text-zinc-400"
                }`}
              >
                {broker.connected ? "connected" : "offline"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 flex flex-col gap-6">
          <PriceTrendChart symbol="BTCUSDT" interval="1h" height={340} />

          <div className="flex flex-col rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-5">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-800/60 pb-3">
              <h2 className="text-sm font-bold text-white">Posiciones abiertas</h2>
              <span className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs font-mono font-semibold text-blue-300">
                {positions.length} activas
              </span>
            </div>

            {positions.length === 0 ? (
              <p className="py-8 text-center text-xs text-zinc-500">
                No hay posiciones abiertas en las cuentas conectadas.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="text-[10px] text-zinc-500 uppercase border-b border-zinc-800/60">
                    <tr>
                      <th className="py-2.5 px-3">Par</th>
                      <th className="py-2.5 px-3">Lado</th>
                      <th className="py-2.5 px-3">Entrada</th>
                      <th className="py-2.5 px-3">Actual</th>
                      <th className="py-2.5 px-3">Qty</th>
                      <th className="py-2.5 px-3">P&L</th>
                      <th className="py-2.5 px-3">Broker</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {positions.map((pos) => (
                      <tr key={`${pos.broker}-${pos.ticket}-${pos.symbol}`} className="hover:bg-zinc-900/40">
                        <td className="py-3 px-3 font-bold text-white">{pos.symbol}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                              pos.side === "BUY"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : "bg-red-500/20 text-red-400 border border-red-500/30"
                            }`}
                          >
                            {pos.side}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-zinc-300">{pos.entry}</td>
                        <td className="py-3 px-3 text-white font-bold">{pos.current}</td>
                        <td className="py-3 px-3 text-zinc-400">{pos.qty}</td>
                        <td className={`py-3 px-3 font-bold ${pos.isProfit ? "text-emerald-400" : "text-red-400"}`}>
                          {pos.pnl}
                        </td>
                        <td className="py-3 px-3 text-zinc-400">{pos.broker}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-5">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-zinc-800/60 pb-3">
              <h2 className="text-sm font-bold text-white">Señales</h2>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                  lucyPending
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                }`}
              >
                {lucyPending ? "LUCY PENDIENTE" : "LUCY ACTIVA"}
              </span>
            </div>

            <div className="space-y-3 font-mono">
              {signals.length === 0 ? (
                <p className="py-8 text-center text-xs text-zinc-500">
                  {lucyPending
                    ? "Lucy aún no está conectada. No hay señales inventadas."
                    : "No hay señales registradas."}
                </p>
              ) : (
                signals.map((sig) => {
                  const action = String(sig.action || "").toUpperCase();
                  return (
                    <div
                      key={sig.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-3 text-xs"
                    >
                      <span className="text-zinc-500 text-[10px]">
                        {new Date(sig.createdAt).toLocaleTimeString("es", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{sig.symbol}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                            action === "BUY"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {action} {confidenceLabel(sig.confidence)}
                        </span>
                      </div>
                      <span className={sig.executed ? "text-emerald-400 font-bold" : "text-zinc-500"}>
                        {sig.executed ? "ok" : "-"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-800/60 text-center">
            <Link href="/lucy" className="text-xs text-gold hover:underline">
              Ver estado de Lucy →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

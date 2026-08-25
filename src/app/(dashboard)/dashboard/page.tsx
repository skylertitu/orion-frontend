"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PriceTrendChart from "@/components/PriceTrendChart";
import { api, BrokerStatus, SignalRecord } from "@/lib/api";
import { displayName as userDisplayName, getUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";

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

function greetingForHour(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default function DashboardPage() {
  const router = useRouter();
  const user = getUser();
  const [timeStr, setTimeStr] = useState("--:--:--");
  const [brokers, setBrokers] = useState<BrokerStatus[]>([]);
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [signals, setSignals] = useState<SignalRecord[]>([]);
  const [lucyPending, setLucyPending] = useState(true);
  const [backendOk, setBackendOk] = useState(false);

  useEffect(() => {
    if (!isStaff(user)) {
      router.replace("/mercado");
    }
  }, [user, router]);

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
  const displayName = userDisplayName(user);
  const brokerCards = (brokers.length
    ? brokers
    : ([
        { id: "binance", label: "Binance", connected: false, enabled: false, message: "Cargando" },
        { id: "bybit", label: "Bybit", connected: false, enabled: false, message: "Cargando" },
        { id: "mt5", label: "MetaTrader 5", connected: false, enabled: false, message: "Cargando" },
      ] as BrokerStatus[]));

  if (!isStaff(user)) return null;

  return (
    <div className="relative min-h-full min-w-0 overflow-hidden bg-[#07090e] font-sans text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,_rgba(212,168,67,0.10),transparent_58%)]" />
      <div className="relative mx-auto flex w-full max-w-[1400px] flex-col gap-8 p-5 sm:p-8">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold/80">
              AutoTrade desk
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {greetingForHour()}, {displayName}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-400">
              Resumen de tu cuenta, mercado y posiciones. El detalle de brokers vive en Motor.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-white/8 bg-white/[0.03] px-3.5 py-1.5 text-[11px] text-zinc-400">
              <span className={`mr-2 inline-block h-1.5 w-1.5 rounded-full ${backendOk ? "bg-emerald-400" : "bg-zinc-500"}`} />
              {backendOk ? "Sesión en vivo" : "Conectando"}
              <span className="ml-3 font-mono text-zinc-500">{timeStr}</span>
            </div>
            <Link
              href="/trading"
              className="rounded-full bg-gold px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-black transition hover:bg-gold-light"
            >
              Operar
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "P&L abierto",
              value: formatPnl(pnlTotal),
              hint: "Suma de posiciones actuales",
              tone: pnlTotal >= 0 ? "text-emerald-400" : "text-red-400",
            },
            {
              label: "Posiciones",
              value: String(positions.length),
              hint: `${uniquePairs} ${uniquePairs === 1 ? "par activo" : "pares activos"}`,
              tone: "text-white",
            },
            {
              label: "Señales",
              value: String(signals.length),
              hint: lucyPending ? "Lucy aún no conectada" : `${executedSignals} ejecutadas`,
              tone: "text-white",
            },
            {
              label: "Brokers listos",
              value: `${connectedBrokers.length}/${brokers.length || 0}`,
              hint: "API pública no es cuenta de trading",
              tone: "text-white",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="relative overflow-hidden rounded-[1.35rem] border border-white/8 bg-[#0b0f18]/80 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)]"
            >
              <div className="absolute inset-y-4 left-0 w-px bg-gradient-to-b from-gold/80 via-gold/20 to-transparent" />
              <p className="pl-3 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                {card.label}
              </p>
              <p className={`mt-3 pl-3 font-mono text-[1.7rem] font-semibold tracking-tight ${card.tone}`}>
                {card.value}
              </p>
              <p className="mt-2 pl-3 text-[12px] text-zinc-500">{card.hint}</p>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {brokerCards.map((broker) => (
            <div
              key={broker.id}
              className="flex items-center justify-between rounded-[1.2rem] border border-white/8 bg-white/[0.02] px-4 py-3.5"
            >
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">{broker.label}</p>
                <p className="mt-1 truncate text-sm text-zinc-200">
                  {broker.connected
                    ? broker.message || "Responde"
                    : broker.id === "bybit"
                      ? "No disponible en este país"
                      : broker.id === "mt5"
                        ? "OrionBridge no adjunto"
                        : broker.message || "Sin respuesta"}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                  broker.connected
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-white/5 text-zinc-500"
                }`}
              >
                {broker.connected ? "Live" : "Standby"}
              </span>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-6 lg:col-span-8">
            <PriceTrendChart symbol="BTCUSDT" interval="1h" height={340} />

            <div className="rounded-[1.4rem] border border-white/8 bg-[#0b0f18]/80 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Posiciones abiertas</h2>
                <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-zinc-400">
                  {positions.length} activas
                </span>
              </div>
              {positions.length === 0 ? (
                <p className="py-10 text-center text-sm text-zinc-500">
                  No hay posiciones abiertas. Cuando operes, el P&L aparece aquí.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                      <tr className="border-b border-white/6">
                        <th className="px-3 py-2.5 font-medium">Par</th>
                        <th className="px-3 py-2.5 font-medium">Lado</th>
                        <th className="px-3 py-2.5 font-medium">Entrada</th>
                        <th className="px-3 py-2.5 font-medium">Actual</th>
                        <th className="px-3 py-2.5 font-medium">Qty</th>
                        <th className="px-3 py-2.5 font-medium">P&L</th>
                        <th className="px-3 py-2.5 font-medium">Broker</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((pos) => (
                        <tr
                          key={`${pos.broker}-${pos.ticket}-${pos.symbol}`}
                          className="border-b border-white/4 last:border-0"
                        >
                          <td className="px-3 py-3 font-semibold text-white">{pos.symbol}</td>
                          <td className="px-3 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                pos.side === "BUY" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                              }`}
                            >
                              {pos.side}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-mono text-zinc-400">{pos.entry}</td>
                          <td className="px-3 py-3 font-mono text-white">{pos.current}</td>
                          <td className="px-3 py-3 font-mono text-zinc-500">{pos.qty}</td>
                          <td className={`px-3 py-3 font-mono font-semibold ${pos.isProfit ? "text-emerald-400" : "text-red-400"}`}>
                            {pos.pnl}
                          </td>
                          <td className="px-3 py-3 text-zinc-500">{pos.broker}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <aside className="flex flex-col rounded-[1.4rem] border border-white/8 bg-[#0b0f18]/80 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)] lg:col-span-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Señales</h2>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                {lucyPending ? "Lucy en espera" : "Lucy activa"}
              </span>
            </div>
            <div className="flex-1 space-y-2">
              {signals.length === 0 ? (
                <p className="py-10 text-center text-sm text-zinc-500">
                  Lucy todavía no envía señales. El panel queda listo para cuando se conecte.
                </p>
              ) : (
                signals.map((sig) => {
                  const action = String(sig.action || "").toUpperCase();
                  return (
                    <div
                      key={sig.id}
                      className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.02] px-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{sig.symbol}</p>
                        <p className="text-[11px] text-zinc-500">
                          {new Date(sig.createdAt).toLocaleTimeString("es", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-[11px] font-semibold ${action === "BUY" ? "text-emerald-400" : "text-red-400"}`}>
                          {action} {confidenceLabel(sig.confidence)}
                        </p>
                        <p className="text-[10px] text-zinc-600">{sig.executed ? "ejecutada" : "en cola"}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <Link href="/lucy" className="mt-4 text-center text-xs text-gold/90 hover:text-gold">
              Ver Lucy
            </Link>
          </aside>
        </section>
      </div>
    </div>
  );
}

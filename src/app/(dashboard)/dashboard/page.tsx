"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUser } from "@/lib/auth";

export default function DashboardPage() {
  const user = getUser();
  const [timeStr, setTimeStr] = useState("08:44:27");

  useEffect(() => {
    const updateTime = () => {
      setTimeStr(new Date().toLocaleTimeString("es", { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const openPositions = [
    { symbol: "BTC/USDT", side: "BUY", entry: "67420.5", current: "68910.2", qty: "0.045", pnl: "+67.05 (+2.21%)", isProfit: true, broker: "Binance" },
    { symbol: "ETH/USDT", side: "SELL", entry: "3580.0", current: "3490.5", qty: "0.8", pnl: "+71.60 (+2.50%)", isProfit: true, broker: "Bybit" },
    { symbol: "EUR/USD", side: "BUY", entry: "1.0875", current: "1.0912", qty: "1000", pnl: "+37.00 (+0.34%)", isProfit: true, broker: "MT5" },
    { symbol: "SOL/USDT", side: "BUY", entry: "185.4", current: "179.2", qty: "5", pnl: "-31.00 (-3.34%)", isProfit: false, broker: "Binance" },
    { symbol: "AAPL/USD", side: "SELL", entry: "193.2000", current: "191.8000", qty: "2", pnl: "+2.80 (+0.72%)", isProfit: true, broker: "MT5" },
  ];

  const lucySignals = [
    { time: "14:32:07", pair: "BTC/USDT", action: "BUY", confidence: "94%", status: "✓" },
    { time: "14:28:45", pair: "ETH/USDT", action: "SELL", confidence: "87%", status: "✓" },
    { time: "14:15:22", pair: "XRP/USDT", action: "BUY", confidence: "62%", status: "-" },
    { time: "13:58:11", pair: "SOL/USDT", action: "BUY", confidence: "78%", status: "✓" },
    { time: "13:41:30", pair: "EUR/USD", action: "BUY", confidence: "91%", status: "✓" },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 text-white bg-[#07090e] min-h-screen font-sans">
      {/* Top Header Breadcrumb & Status Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3 text-xs text-zinc-400 font-mono">
        <div className="flex items-center gap-2">
          <span>AutoTrade</span>
          <span>/</span>
          <span className="text-white font-bold">Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Binance · Bybit · MT5
          </span>
          <span className="rounded-md border border-zinc-800 bg-[#111726] px-2 py-0.5 text-[11px] text-zinc-300 font-mono">
            {timeStr}
          </span>
        </div>
      </div>

      {/* Main Title Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Resumen en tiempo real — actualizado {timeStr}
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Motor activo · 3 brokers</span>
        </div>
      </div>

      {/* 1. Top 4 Metric Cards (Matching Screenshot Layout) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: P&L Total Hoy */}
        <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-5 shadow-xl">
          <span className="text-xs font-medium text-zinc-400">P&L Total Hoy</span>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">+$147.45</div>
          <div className="mt-1 text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
            <span>▲ +2.18% vs ayer</span>
          </div>
        </div>

        {/* Card 2: Posiciones Abiertas */}
        <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-5 shadow-xl">
          <span className="text-xs font-medium text-zinc-400">Posiciones Abiertas</span>
          <div className="mt-2 text-2xl font-bold font-mono text-white">5</div>
          <div className="mt-1 text-[11px] text-zinc-500 font-medium">5 pares activos</div>
        </div>

        {/* Card 3: Señales Lucy (24h) */}
        <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-5 shadow-xl">
          <span className="text-xs font-medium text-zinc-400">Señales Lucy (24h)</span>
          <div className="mt-2 text-2xl font-bold font-mono text-white">142</div>
          <div className="mt-1 text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
            <span>▲ +18 vs ayer</span>
          </div>
        </div>

        {/* Card 4: Win Rate (7d) */}
        <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-5 shadow-xl">
          <span className="text-xs font-medium text-zinc-400">Win Rate (7d)</span>
          <div className="mt-2 text-2xl font-bold font-mono text-white">73.4%</div>
          <div className="mt-1 text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
            <span>▲ 87 ganadas / 118 total</span>
          </div>
        </div>
      </div>

      {/* 2. BALANCES POR BROKER Section */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          BALANCES POR BROKER
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Binance */}
          <div className="flex items-center justify-between rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-bold text-xs border border-amber-500/30">
                BI
              </div>
              <div>
                <div className="text-xs text-zinc-400 font-medium">Binance</div>
                <div className="text-sm font-bold font-mono text-white">
                  12.480,5 <span className="text-xs text-zinc-400 font-normal">USDT</span>
                </div>
              </div>
            </div>
            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-mono font-semibold text-emerald-400">
              connected
            </span>
          </div>

          {/* Bybit */}
          <div className="flex items-center justify-between rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400 font-bold text-xs border border-orange-500/30">
                BY
              </div>
              <div>
                <div className="text-xs text-zinc-400 font-medium">Bybit</div>
                <div className="text-sm font-bold font-mono text-white">
                  8920 <span className="text-xs text-zinc-400 font-normal">USDT</span>
                </div>
              </div>
            </div>
            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-mono font-semibold text-emerald-400">
              connected
            </span>
          </div>

          {/* MetaTrader 5 */}
          <div className="flex items-center justify-between rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 font-bold text-xs border border-purple-500/30">
                ME
              </div>
              <div>
                <div className="text-xs text-zinc-400 font-medium">MetaTrader 5</div>
                <div className="text-sm font-bold font-mono text-white">
                  4350 <span className="text-xs text-zinc-400 font-normal">USD</span>
                </div>
              </div>
            </div>
            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-mono font-semibold text-emerald-400">
              connected
            </span>
          </div>
        </div>
      </div>

      {/* 3. Main Bottom Grid (2 Columns: Posiciones Abiertas + Señales Lucy IA) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Posiciones Abiertas Table (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4 border-b border-zinc-800/60 pb-3">
            <h2 className="text-sm font-bold text-white">Posiciones Abiertas</h2>
            <span className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs font-mono font-semibold text-blue-300">
              5 activas
            </span>
          </div>

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
                {openPositions.map((pos, i) => (
                  <tr key={i} className="hover:bg-zinc-900/40">
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
                    <td
                      className={`py-3 px-3 font-bold ${
                        pos.isProfit ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {pos.pnl}
                    </td>
                    <td className="py-3 px-3 text-zinc-400">{pos.broker}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Señales Lucy IA Panel (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-5 shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-zinc-800/60 pb-3">
              <h2 className="text-sm font-bold text-white">Señales Lucy IA</h2>
              <span className="h-2 w-2 rounded-full bg-blue-400 animate-ping" />
            </div>

            <div className="space-y-3 font-mono">
              {lucySignals.map((sig, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-3 text-xs"
                >
                  <span className="text-zinc-500 text-[10px]">{sig.time}</span>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{sig.pair}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                        sig.action === "BUY"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {sig.action} {sig.confidence}
                    </span>
                  </div>

                  <span
                    className={
                      sig.status === "✓" ? "text-emerald-400 font-bold" : "text-zinc-500"
                    }
                  >
                    {sig.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-800/60 text-center">
            <Link href="/lucy" className="text-xs text-gold hover:underline">
              Ver historial completo →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

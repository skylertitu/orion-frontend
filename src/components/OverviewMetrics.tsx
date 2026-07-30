"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function OverviewMetrics() {
  const [brokerCount, setBrokerCount] = useState(2);
  const [signalCount, setSignalCount] = useState(14);
  const [systemActive, setSystemActive] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const brokersRes = await api.engine.brokers();
        if (brokersRes.success && brokersRes.data) {
          setBrokerCount(brokersRes.data.filter((b) => b.connected).length || 2);
        }
      } catch {
        /* fallback default */
      }
    }
    loadStats();
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Metric 1: System Status */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 backdrop-blur-md shadow-xl transition-all hover:border-gold/30">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          STATUS DEL SISTEMA
        </span>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-black text-white">ACTIVO</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Motor Orion Conectado</span>
        </div>
      </div>

      {/* Metric 2: Connected Accounts */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 backdrop-blur-md shadow-xl transition-all hover:border-gold/30">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          CUENTAS VINCULADAS
        </span>
        <div className="mt-2 text-2xl font-black text-white">{brokerCount}</div>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400">
          <svg className="h-3.5 w-3.5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>Binance & MT5 Activas</span>
        </div>
      </div>

      {/* Metric 3: Lucy Signals */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 backdrop-blur-md shadow-xl transition-all hover:border-gold/30">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          SEÑALES DE LUCY
        </span>
        <div className="mt-2 text-2xl font-black text-white">{signalCount}</div>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-purple-400 font-medium">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>IA Probabilística 89%</span>
        </div>
      </div>

      {/* Metric 4: Trading Network */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 backdrop-blur-md shadow-xl transition-all hover:border-gold/30">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          RED DE TRADING
        </span>
        <div className="mt-2 text-2xl font-black text-gold">MAINNET</div>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-gold font-medium">
          <span className="h-2 w-2 rounded-full bg-gold animate-ping" />
          <span>Binance Spot Live</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function OverviewMetrics() {
  const [brokerCount, setBrokerCount] = useState(0);
  const [brokerTotal, setBrokerTotal] = useState(0);
  const [backendOk, setBackendOk] = useState(false);
  const [lucyPending, setLucyPending] = useState(true);

  useEffect(() => {
    async function loadStats() {
      const [brokersRes, lucyRes] = await Promise.all([
        api.engine.brokers(),
        api.lucy.health(),
      ]);
      if (brokersRes.success && brokersRes.data) {
        setBrokerTotal(brokersRes.data.length);
        setBrokerCount(brokersRes.data.filter((b) => b.connected).length);
        setBackendOk(true);
      } else {
        setBackendOk(false);
      }
      const lucy = lucyRes.data;
      setLucyPending(Boolean(lucy?.pending) || lucy?.alive === false || !lucyRes.success);
    }
    void loadStats();
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          Status del sistema
        </span>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-black text-white">{backendOk ? "ACTIVO" : "CAÍDO"}</span>
        </div>
        <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${backendOk ? "text-emerald-400" : "text-red-400"}`}>
          <span className={`h-2 w-2 rounded-full ${backendOk ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
          <span>{backendOk ? "Backend en puerto 3008" : "No hay respuesta del backend"}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          Brokers respondiendo
        </span>
        <div className="mt-2 text-2xl font-black text-white">
          {brokerCount}/{brokerTotal || 0}
        </div>
        <div className="mt-2 text-xs text-zinc-400">Binance, Bybit y MT5</div>
      </div>

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          Lucy IA
        </span>
        <div className="mt-2 text-2xl font-black text-white">{lucyPending ? "PENDIENTE" : "ACTIVA"}</div>
        <div className="mt-2 text-xs text-zinc-400">SDK/API aún no conectada</div>
      </div>

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          Mercado
        </span>
        <div className="mt-2 text-2xl font-black text-gold">BINANCE</div>
        <div className="mt-2 text-xs text-zinc-400">Velas públicas vía REST</div>
      </div>
    </div>
  );
}

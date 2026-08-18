"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { formatPair } from "@/lib/binance";

interface SignalRow {
  id: number;
  symbol: string;
  action: string;
  confidence: number;
  reason?: string;
  price: number;
  executed: boolean;
  source: string;
  createdAt: string;
}

export default function LucyPanel() {
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [lucyStatus, setLucyStatus] = useState<{
    connected: boolean;
    pending: boolean;
    reason: string;
  }>({
    connected: false,
    pending: true,
    reason: "Lucy SDK/API aún no está implementada.",
  });

  const loadSignals = useCallback(async () => {
    setLoading(true);
    try {
      const health = await api.lucy.health();
      const data = health.data;
      setLucyStatus({
        connected: Boolean(data?.alive) && !data?.pending,
        pending: Boolean(data?.pending) || data?.alive === false || !health.success,
        reason: data?.reason || "Lucy SDK/API aún no está implementada.",
      });
      const userId = getUser()?.id;
      if (!userId) return;
      const res = await api.signals.list(userId, { source: "lucy", limit: 12 });
      if (res.success && res.data) {
        setSignals(res.data as SignalRow[]);
      }
    } catch {
      setLucyStatus({
        connected: false,
        pending: true,
        reason: "No se pudo consultar el estado de Lucy.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSignals();
    const interval = setInterval(loadSignals, 20000);
    return () => clearInterval(interval);
  }, [loadSignals]);

  const avgConfidence = signals.length
    ? Math.round(
        (signals.reduce((acc, s) => acc + (s.confidence || 0), 0) / signals.length) *
          (signals[0]?.confidence <= 1 ? 100 : 1)
      )
    : 0;

  return (
    <div className="flex flex-col h-full rounded-2xl border border-purple-500/20 bg-zinc-950/80 backdrop-blur-md shadow-xl overflow-hidden">
      {/* Header Panel Conexión Lucy */}
      <div className="border-b border-purple-500/20 bg-purple-950/20 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <svg className="h-6 w-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-950 ${lucyStatus.connected ? "bg-emerald-500" : "bg-amber-500"}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Conexión Lucy IA</h2>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                  lucyStatus.connected
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                }`}>
                  {lucyStatus.connected ? "ONLINE" : "PENDIENTE"}
                </span>
              </div>
              <p className="text-xs text-purple-300/70">{lucyStatus.reason}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadSignals}
            disabled={loading}
            className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-2 text-purple-300 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
            title="Actualizar señales"
          >
            <svg className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-2.5 text-center">
            <span className="block text-[10px] uppercase tracking-wider text-zinc-400">API</span>
            <span className="font-mono text-xs font-bold text-zinc-300">{lucyStatus.connected ? "ok" : "off"}</span>
          </div>
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-2.5 text-center">
            <span className="block text-[10px] uppercase tracking-wider text-zinc-400">Confianza</span>
            <span className="font-mono text-xs font-bold text-purple-300">{signals.length ? `${avgConfidence}%` : "—"}</span>
          </div>
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-2.5 text-center">
            <span className="block text-[10px] uppercase tracking-wider text-zinc-400">Auto-Trading</span>
            <span className="font-mono text-xs font-bold text-zinc-400">OFF</span>
          </div>
        </div>
      </div>

      {/* Signals List Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-2.5 bg-zinc-900/40">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Señales en Tiempo Real
        </span>
        <span className="text-[11px] text-purple-400 font-mono font-medium">
          {signals.length} disponibles
        </span>
      </div>

      {/* Signals List Body */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/50 p-2 space-y-1 max-h-[420px]">
        {signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-zinc-500">
            <svg className="mb-2 h-8 w-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p className="text-xs">No hay señales de Lucy. Eso es normal mientras la API esté pendiente.</p>
          </div>
        ) : (
          signals.map((s) => {
            const isBuy = s.action?.toLowerCase() === "buy" || s.action?.toLowerCase() === "comprar";
            const confidencePct = Math.round((s.confidence || 0) * 100);

            return (
              <div
                key={s.id}
                className="group flex flex-col gap-1.5 rounded-xl border border-transparent p-3 transition-all hover:border-zinc-800 hover:bg-zinc-900/50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
                        isBuy
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-red-500/20 text-red-400 border border-red-500/30"
                      }`}
                    >
                      {isBuy ? "COMPRA" : "VENTA"}
                    </span>
                    <span className="font-bold text-white text-sm">
                      {formatPair(s.symbol)}
                    </span>
                  </div>

                  <div className="text-right font-mono text-xs font-semibold text-zinc-200">
                    ${Number(s.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Progress confidence bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span>Confianza IA</span>
                    <span className="font-mono text-purple-300 font-semibold">{confidencePct}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 to-emerald-400 transition-all duration-500"
                      style={{ width: `${confidencePct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1">
                  <span>{new Date(s.createdAt).toLocaleTimeString("es")}</span>
                  {s.executed ? (
                    <span className="flex items-center gap-1 text-emerald-400 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Ejecutada
                    </span>
                  ) : (
                    <span className="text-amber-400">Pendiente</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

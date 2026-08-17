"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, type SystemModuleStatus, type SystemOverview } from "@/lib/api";
import { toast } from "@/lib/toast";

function tone(mod: SystemModuleStatus): string {
  if (!mod.enabled) return "border-zinc-700 bg-zinc-900/80";
  if (mod.health === "ok") return "border-emerald-500/30 bg-emerald-500/5";
  if (mod.health === "pending") return "border-amber-500/30 bg-amber-500/5";
  if (mod.health === "paused") return "border-zinc-700 bg-zinc-900/80";
  return "border-red-500/30 bg-red-500/5";
}

function pill(mod: SystemModuleStatus): string {
  if (!mod.enabled) return "border-zinc-600 bg-zinc-800 text-zinc-300";
  if (mod.health === "ok") return "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
  if (mod.health === "pending") return "border-amber-500/40 bg-amber-500/15 text-amber-300";
  if (mod.health === "paused") return "border-zinc-600 bg-zinc-800 text-zinc-300";
  return "border-red-500/40 bg-red-500/15 text-red-300";
}

function extraTone(ok: boolean): string {
  return ok
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    : "border-red-500/30 bg-red-500/10 text-red-300";
}

export default function SystemControlBoard({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<SystemOverview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (notify = false) => {
    const res = await api.admin.system();
    if (res.success && res.data) setData(res.data);
    else if (notify) toast.error(res.error || "No se pudo leer el estado del motor");
  }, []);

  useEffect(() => {
    void load(true);
    const id = setInterval(() => void load(false), compact ? 12000 : 8000);
    return () => clearInterval(id);
  }, [load, compact]);

  async function toggle(mod: SystemModuleStatus) {
    const next = !mod.enabled;
    if (
      !next &&
      !window.confirm(
        `¿Apagar ${mod.name} para los usuarios?\nTú sigues viéndolo como admin. Ellos verán que el módulo no está disponible.`
      )
    ) {
      return;
    }
    setBusy(mod.id);
    const res = await api.admin.toggleModule(mod.id, next);
    if (res.success && res.data) {
      setData(res.data);
      toast.success(res.message || (mod.enabled ? `${mod.name} apagado para usuarios` : `${mod.name} activado`));
    } else {
      toast.error(res.error || "No se pudo cambiar el módulo");
    }
    setBusy(null);
  }

  const down = data?.modules.filter((m) => m.enabled && m.health === "down").length ?? 0;
  const paused = data?.modules.filter((m) => !m.enabled).length ?? 0;
  const pending = data?.modules.filter((m) => m.enabled && m.health === "pending").length ?? 0;
  const workerErrors = data?.worker?.errors?.slice(-8) ?? [];

  if (compact) {
    return (
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Control del motor</p>
            <p className="text-xs text-zinc-400">
              {down ? `${down} con error` : pending ? `${pending} pendientes` : paused ? `${paused} apagados` : "Todo en marcha"}
            </p>
          </div>
          <Link href="/trading" className="text-[11px] font-bold uppercase text-gold hover:underline">
            Ver resumen
          </Link>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {(data?.modules || []).map((mod) => (
            <div key={mod.id} className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${tone(mod)}`}>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white">{mod.name}</p>
                <p className={`truncate text-[10px] ${mod.error ? "text-red-300" : "text-zinc-500"}`}>
                  {mod.error || mod.label}
                </p>
              </div>
              <button
                type="button"
                disabled={busy === mod.id}
                onClick={() => void toggle(mod)}
                className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold uppercase disabled:opacity-40 ${
                  mod.enabled
                    ? "border border-zinc-700 text-zinc-300 hover:border-red-500/40 hover:text-red-300"
                    : "bg-gold text-black"
                }`}
              >
                {busy === mod.id ? "..." : mod.enabled ? "Apagar" : "Activar"}
              </button>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white">Control del motor</h2>
          <p className="text-sm text-zinc-400">
            Resumen de lo que funciona y lo que no: Lucy, mercado, brokers, worker y cuentas. Apaga un módulo para los
            usuarios sin perder tu acceso de admin.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase">
          <span className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-red-300">{down} con error</span>
          <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-300">
            {pending} pendientes
          </span>
          <span className="rounded-lg border border-zinc-700 px-2 py-1 text-zinc-400">{paused} apagados</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(data?.modules || []).map((mod) => (
          <article key={mod.id} className={`flex flex-col rounded-2xl border p-4 ${tone(mod)}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-white">{mod.name}</h3>
                <p className="text-[11px] text-zinc-500">{mod.description}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${pill(mod)}`}>
                {mod.label}
              </span>
            </div>
            {mod.detail && <p className="mt-3 text-xs text-zinc-300">{mod.detail}</p>}
            {mod.error && <p className="mt-2 text-xs text-red-300">{mod.error}</p>}
            {mod.note && <p className="mt-2 text-[11px] text-zinc-500">Nota: {mod.note}</p>}
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                disabled={busy === mod.id}
                onClick={() => void toggle(mod)}
                className={`flex-1 rounded-xl px-3 py-2 text-[11px] font-bold uppercase tracking-wide disabled:opacity-40 ${
                  mod.enabled
                    ? "border border-zinc-700 text-zinc-300 hover:border-red-500/40 hover:text-red-300"
                    : "bg-gold text-black"
                }`}
              >
                {busy === mod.id ? "Cambiando..." : mod.enabled ? "Apagar para usuarios" : "Activar para usuarios"}
              </button>
              {mod.href && (
                <Link
                  href={mod.href}
                  className="rounded-xl border border-zinc-800 px-3 py-2 text-[11px] font-bold uppercase text-zinc-400 hover:text-white"
                >
                  Ir
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`rounded-xl border px-3 py-2 text-xs font-bold ${extraTone(Boolean(data?.extras?.database))}`}>
          Base de datos {data?.extras?.database ? "ok" : "caída"}
        </div>
        <div className={`rounded-xl border px-3 py-2 text-xs font-bold ${extraTone(Boolean(data?.extras?.firebaseAdmin))}`}>
          Firebase admin {data?.extras?.firebaseAdmin ? "ok" : "off"}
        </div>
        <div className={`rounded-xl border px-3 py-2 text-xs font-bold ${extraTone(Boolean(data?.extras?.firebaseAuth))}`}>
          Firebase auth {data?.extras?.firebaseAuth ? "ok" : "off"}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <h3 className="text-sm font-bold text-white">Brokers / merchants</h3>
          <div className="mt-3 space-y-2">
            {(data?.brokers || []).map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-300">{b.label}</span>
                <span className={b.connected ? "text-emerald-400" : b.error ? "text-red-300" : "text-zinc-500"}>
                  {b.connected ? "conectado" : b.error || b.message || "offline"}
                </span>
              </div>
            ))}
            {!data?.brokers?.length && <p className="text-xs text-zinc-500">Sin datos de brokers.</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <h3 className="text-sm font-bold text-white">Errores recientes del worker</h3>
          {workerErrors.length === 0 ? (
            <p className="mt-3 text-xs text-zinc-500">Sin errores en el último ciclo.</p>
          ) : (
            <ul className="mt-3 space-y-1 font-mono text-[11px] text-red-300">
              {workerErrors.map((err, i) => (
                <li key={`${err}-${i}`} className="truncate" title={err}>
                  {err}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-zinc-600">
            Worker {data?.worker?.running ? "en marcha" : "parado"}
            {data?.worker?.lastCycleAt
              ? ` · último ciclo ${new Date(data.worker.lastCycleAt).toLocaleTimeString("es")}`
              : ""}
            {typeof data?.worker?.openPositions === "number" ? ` · ${data.worker.openPositions} abiertas` : ""}
          </p>
        </div>
      </div>
    </section>
  );
}

"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, type JupiterStatus, type SystemModuleStatus, type SystemOverview } from "@/lib/api";
import { toast } from "@/lib/toast";

export default function MotorIntegrations() {
  const [data, setData] = useState<SystemOverview | null>(null);
  const [jupiter, setJupiter] = useState<JupiterStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [sys, jup] = await Promise.all([api.admin.system(), api.admin.jupiterStatus()]);
    if (sys.success && sys.data) setData(sys.data);
    if (jup.success && jup.data) setJupiter(jup.data);
    else if (!jup.success) setJupiter({ connected: false, hasKey: false, keySource: "none", keyHint: null, error: jup.error });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(mod: SystemModuleStatus) {
    setBusy(mod.id);
    const res = await api.admin.toggleModule(mod.id, !mod.enabled);
    if (res.success && res.data) {
      setData(res.data);
      toast.success(res.message || (mod.enabled ? `${mod.name} apagado para usuarios` : `${mod.name} activado`));
    } else {
      toast.error(res.error || "No se pudo cambiar el módulo");
    }
    setBusy(null);
  }

  async function saveKey(e: FormEvent) {
    e.preventDefault();
    setBusy("jupiter-key");
    const res = await api.admin.setJupiterKey(apiKey);
    if (res.success && res.data) {
      setJupiter(res.data);
      setApiKey("");
      toast.success(res.message || "API key guardada");
      void load();
    } else {
      toast.error(res.error || "No se pudo guardar la key");
    }
    setBusy(null);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-black text-white">Integraciones</h2>
        <p className="text-sm text-zinc-400">
          Conectores del motor. Desde aquí se apagan para usuarios y se pega la API key de Jupiter Portal.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-white">Jupiter (Solana)</h3>
            <p className="text-xs text-zinc-500">
              Precios y rutas de swap. Crea la key en portal.jup.ag → API Keys y pégala aquí. El swap se firma con Phantom en la pestaña Jupiter.
            </p>
          </div>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
              loading && !jupiter
                ? "border-zinc-600 bg-zinc-800 text-zinc-300"
                : jupiter?.connected
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                  : "border-amber-500/40 bg-amber-500/15 text-amber-300"
            }`}
          >
            {loading && !jupiter
              ? "Cargando"
              : jupiter?.connected
                ? "Conectado"
                : jupiter?.hasKey
                  ? "Key inválida"
                  : "Sin key"}
          </span>
        </div>
        <p className="mt-3 text-xs text-zinc-400">
          {loading && !jupiter
            ? "Consultando Jupiter..."
            : jupiter?.error ||
              (jupiter?.sample ? `SOL $${jupiter.sample.usdPrice.toFixed(2)}` : "Esperando ping")}
          {jupiter?.keyHint ? ` · key ${jupiter.keyHint} (${jupiter.keySource})` : ""}
        </p>
        <form onSubmit={saveKey} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Pega la API key de Jupiter"
            className="flex-1 rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-gold"
          />
          <button
            type="submit"
            disabled={busy === "jupiter-key" || !apiKey.trim()}
            className="rounded-xl bg-gold px-4 py-2 text-[11px] font-bold uppercase text-black disabled:opacity-40"
          >
            {busy === "jupiter-key" ? "Guardando..." : "Guardar key"}
          </button>
        </form>
        <div className="mt-3 flex gap-3 text-[11px]">
          <a href="https://portal.jup.ag" target="_blank" rel="noreferrer" className="text-gold hover:underline">
            Abrir Jupiter Portal
          </a>
          <Link href="/trading?tab=jupiter" className="text-zinc-400 hover:text-white">
            Ver mercados
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(data?.modules || []).map((mod) => (
          <article key={mod.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-white">{mod.name}</h3>
                <p className="text-[11px] text-zinc-500">{mod.description}</p>
              </div>
              <span className="text-[10px] font-bold uppercase text-zinc-400">{mod.label}</span>
            </div>
            {mod.detail && <p className="mt-2 text-xs text-zinc-300">{mod.detail}</p>}
            {mod.error && <p className="mt-1 text-xs text-red-300">{mod.error}</p>}
            <button
              type="button"
              disabled={busy === mod.id}
              onClick={() => void toggle(mod)}
              className={`mt-3 w-full rounded-xl px-3 py-2 text-[11px] font-bold uppercase disabled:opacity-40 ${
                mod.enabled
                  ? "border border-zinc-700 text-zinc-300 hover:border-red-500/40 hover:text-red-300"
                  : "bg-gold text-black"
              }`}
            >
              {mod.enabled ? "Apagar para usuarios" : "Activar para usuarios"}
            </button>
          </article>
        ))}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <h3 className="text-sm font-bold text-white">Brokers CEX / MT5</h3>
        <div className="mt-3 space-y-2">
          {(data?.brokers || []).map((b) => (
            <div key={b.id} className="flex items-center justify-between text-sm">
              <span className="text-zinc-300">{b.label}</span>
              <span className={b.connected ? "text-emerald-400" : "text-zinc-500"}>
                {b.connected ? "conectado" : b.message || "offline"}
              </span>
            </div>
          ))}
        </div>
        <Link href="/cuentas" className="mt-3 inline-block text-[11px] font-bold uppercase text-gold hover:underline">
          Administrar cuentas
        </Link>
      </div>
    </div>
  );
}

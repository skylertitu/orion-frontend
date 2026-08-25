"use client";

import { useEffect, useState } from "react";
import LucySignalsPanel from "@/components/LucySignalsPanel";
import { api } from "@/lib/api";
import ModuleGate from "@/components/ModuleGate";
import PlanGate from "@/components/PlanGate";

export default function SenalesPage() {
  const [pending, setPending] = useState(true);
  const [reason, setReason] = useState("Comprobando el feed de señales...");

  useEffect(() => {
    async function check() {
      const res = await api.lucy.health();
      const data = res.data;
      const isPending = Boolean(data?.pending) || data?.alive === false || !res.success;
      setPending(isPending);
      setReason(
        data?.reason ||
          (isPending
            ? "El feed de señales queda listo. Lucy aún no está generando alertas."
            : "Hay conexión con el servicio de señales.")
      );
    }
    void check();
  }, []);

  return (
    <ModuleGate moduleId="lucy">
      <PlanGate capability="lucy_signals">
        <div className="flex min-h-[calc(100vh-3.5rem)] w-full min-w-0 flex-col gap-6 bg-zinc-950 p-4 text-white sm:p-6">
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4">
            <h1 className="text-xl font-black text-white">Señales</h1>
            <p className="mt-1 text-xs text-zinc-400">
              Alertas de compra y venta. Lucy analiza una vez; aquí ves el mismo feed, sin auto-trading.
            </p>
            <p className="mt-1 text-xs text-zinc-500">{reason}</p>
          </div>

          {pending && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              Todavía no hay generación automática. Cuando Lucy publique, aparecen aquí.
            </div>
          )}

          <LucySignalsPanel />
        </div>
      </PlanGate>
    </ModuleGate>
  );
}

"use client";

import { useEffect, useState } from "react";
import LucyChat from "@/components/LucyChat";
import LucyPanel from "@/components/LucyPanel";
import { api } from "@/lib/api";
import ModuleGate from "@/components/ModuleGate";

export default function LucyPage() {
  const [pending, setPending] = useState(true);
  const [reason, setReason] = useState("Comprobando estado de Lucy...");

  useEffect(() => {
    async function check() {
      const res = await api.lucy.health();
      const data = res.data;
      const isPending = Boolean(data?.pending) || data?.alive === false || !res.success;
      setPending(isPending);
      setReason(
        data?.reason ||
          (isPending
            ? "Lucy SDK/API aún no está implementada."
            : "Lucy respondió al health check.")
      );
    }
    void check();
  }, []);

  return (
    <ModuleGate moduleId="lucy">
    <div className="flex min-h-[calc(100vh-3.5rem)] w-full min-w-0 flex-col gap-6 bg-zinc-950 p-4 text-white sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-purple-500/30 bg-zinc-900/40 p-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-black leading-tight text-white">Lucy IA</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                pending
                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
              }`}
            >
              {pending ? "PENDIENTE" : "API CONECTADA"}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">{reason}</p>
        </div>
      </div>

      {pending && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
          Lucy no opera ni genera señales todavía. El chat no inventa precios ni recomendaciones de mercado.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5">
          <LucyPanel />
        </div>
        <div className="xl:col-span-7 min-h-[550px]">
          <LucyChat />
        </div>
      </div>
    </div>
    </ModuleGate>
  );
}

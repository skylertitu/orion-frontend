"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LucyChat from "@/components/LucyChat";
import LucyPanel from "@/components/LucyPanel";
import LucySignalsPanel from "@/components/LucySignalsPanel";
import { api } from "@/lib/api";
import ModuleGate from "@/components/ModuleGate";
import PlanGate from "@/components/PlanGate";
import { getUser } from "@/lib/auth";
import { hasCapability } from "@/lib/plans";
import { isStaff } from "@/lib/roles";

export default function LucyPage() {
  const router = useRouter();
  const user = getUser();
  const canControl = hasCapability(user, "lucy_control");
  const [pending, setPending] = useState(true);
  const [reason, setReason] = useState("Comprobando estado de Lucy...");

  useEffect(() => {
    if (!isStaff(user)) {
      router.replace("/senales");
    }
  }, [user, router]);

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

  if (!isStaff(user)) return null;

  return (
    <ModuleGate moduleId="lucy">
      <PlanGate capability="lucy_signals">
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
              <p className="mt-1 text-xs text-zinc-400">
                {canControl
                  ? "Lucy controla la compra/venta del desk. Autoejecuta solo en tu cuenta."
                  : "Feed de señales. Lucy analiza una vez; tú ves la misma alerta, sin auto-trading."}
              </p>
              <p className="mt-1 text-xs text-zinc-500">{reason}</p>
            </div>
          </div>

          {pending && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              Lucy todavía no genera señales. El feed queda listo para cuando se conecte el SDK.
            </div>
          )}

          {canControl ? (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              <div className="xl:col-span-5">
                <LucyPanel />
              </div>
              <div className="min-h-[550px] xl:col-span-7">
                <LucyChat />
              </div>
            </div>
          ) : (
            <LucySignalsPanel />
          )}
        </div>
      </PlanGate>
    </ModuleGate>
  );
}

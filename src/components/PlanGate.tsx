"use client";

import type { ReactNode } from "react";
import { getUser } from "@/lib/auth";
import { PLAN_DENIED, type PlanCapability, hasCapability } from "@/lib/plans";

export default function PlanGate({
  capability,
  children,
}: {
  capability: PlanCapability;
  children: ReactNode;
}) {
  const user = getUser();
  if (hasCapability(user, capability)) return <>{children}</>;

  return (
    <div className="flex min-h-[40vh] items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-center">
        <h1 className="text-lg font-black text-white">Esta función no está en tu plan</h1>
        <p className="mt-2 text-sm text-zinc-400">
          {PLAN_DENIED[capability] || "Administración asigna el plan Analista, Señales o Builder."}
        </p>
      </div>
    </div>
  );
}

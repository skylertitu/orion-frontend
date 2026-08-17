"use client";

import BrokerAccountsPanel from "@/components/BrokerAccountsPanel";
import ModuleGate from "@/components/ModuleGate";

export default function CuentasPage() {
  return (
    <ModuleGate moduleId="accounts">
      <div className="flex w-full min-w-0 flex-col gap-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Cuentas</h1>
            <p className="text-sm text-zinc-500">Brokers conectados</p>
          </div>
        </div>
        <BrokerAccountsPanel />
      </div>
    </ModuleGate>
  );
}

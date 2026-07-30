"use client";

import BrokerAccountsPanel from "@/components/BrokerAccountsPanel";

export default function CuentasPage() {
  return (
    <div className="flex w-full flex-col gap-5 p-6">
      <div>
        <h1 className="text-xl font-bold text-white">Cuentas</h1>
        <p className="text-sm text-zinc-500">Brokers conectados</p>
      </div>
      <BrokerAccountsPanel />
    </div>
  );
}

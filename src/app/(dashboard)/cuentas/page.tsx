"use client";

import WalletConnectPanel from "@/components/WalletConnectPanel";
import ModuleGate from "@/components/ModuleGate";
import PlanGate from "@/components/PlanGate";

export default function CuentasPage() {
  return (
    <ModuleGate moduleId="accounts">
      <PlanGate capability="wallets">
        <div className="flex min-h-[calc(100vh-3.5rem)] w-full min-w-0 flex-col bg-[#07090e] p-4 text-white sm:p-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold/80">Private desk</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Cuentas</h1>
            <p className="mt-1 max-w-xl text-sm text-zinc-500">
              Tesorería on-chain en Devnet: SOL y todas las monedas SPL de la wallet.
            </p>
          </div>
        </div>
          <WalletConnectPanel />
        </div>
      </PlanGate>
    </ModuleGate>
  );
}

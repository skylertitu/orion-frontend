"use client";

import { useEffect, useState } from "react";
import {
  type WalletProviderName,
  connectWallet,
  disconnectWallet,
  awaitInstalledWallets,
  getActiveWallet,
} from "@/lib/solanaWallet";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

const META: Record<WalletProviderName, { label: string; icon: string }> = {
  phantom: { label: "Phantom", icon: "\u{1F47B}" },
  solflare: { label: "Solflare", icon: "\u2600\uFE0F" },
};

function short(addr: string) {
  return addr.length > 10 ? `${addr.slice(0, 4)}\u2026${addr.slice(-4)}` : addr;
}

export default function WalletBadge() {
  const [wallet, setWallet] = useState("");
  const [walletName, setWalletName] = useState<WalletProviderName | null>(null);
  const [installed, setInstalled] = useState<WalletProviderName[]>([]);
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    const active = getActiveWallet();
    if (active) {
      setWallet(active.address);
      setWalletName(active.name);
    }
    void awaitInstalledWallets().then(setInstalled);
  }, []);

  useEffect(() => {
    if (!wallet) {
      setLinked(false);
      return;
    }
    void api.wallets.list().then((res) => {
      if (res.success && Array.isArray(res.data)) {
        setLinked(res.data.some((w: { address: string }) => w.address === wallet));
      }
    });
  }, [wallet]);

  async function handleConnect(name: WalletProviderName) {
    setBusy(true);
    try {
      const active = await connectWallet(name);
      setWallet(active.address);
      setWalletName(active.name);

      const nonceRes = await api.wallets.nonce(active.address);
      const nonce = nonceRes.data;
      if (nonceRes.success && nonce?.message) {
        const sig = await import("@/lib/solanaWallet").then((m) =>
          m.signWalletMessage(nonce.message)
        );
        await api.wallets.link({
          address: active.address,
          signature: sig,
          nonce: nonce.nonce,
          issuedAt: nonce.issuedAt,
          label: META[active.name].label,
        });
        setLinked(true);
      }
      toast.success(`${META[active.name].label} conectada`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo conectar");
    }
    setBusy(false);
  }

  async function handleDisconnect() {
    await disconnectWallet();
    setWallet("");
    setWalletName(null);
    setLinked(false);
    toast.success("Billetera desconectada");
  }

  if (!wallet) {
    return (
      <div className="flex items-center gap-1.5">
        {installed.length > 0 ? (
          installed.map((n) => (
            <button
              key={n}
              type="button"
              disabled={busy}
              onClick={() => void handleConnect(n)}
              className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-[10px] font-bold uppercase text-zinc-300 hover:border-gold hover:text-gold disabled:opacity-40"
            >
              {META[n].icon} {META[n].label}
            </button>
          ))
        ) : (
          <span className="text-[10px] text-zinc-600">Sin wallet</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${linked ? "bg-emerald-400" : "bg-amber-400"}`}
      />
      <span className="text-[10px] font-semibold text-zinc-300">
        {walletName ? META[walletName].icon : ""} {short(wallet)}
      </span>
      {!linked && (
        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
          sin vincular
        </span>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void handleDisconnect()}
        className="text-[10px] text-zinc-600 hover:text-red-400 disabled:opacity-40"
      >
        \u2715
      </button>
    </div>
  );
}

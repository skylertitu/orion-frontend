"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, type SolanaBalance, type WalletPublic } from "@/lib/api";
import { toast } from "@/lib/toast";
import WalletTreasuryCard from "@/components/WalletTreasuryCard";
import {
  connectPhantom,
  connectSolflare,
  disconnectPhantom,
  disconnectSolflare,
  getPhantom,
  getSolflare,
  isPhantomInstalled,
  isSolflareInstalled,
  looksLikeSolanaAddress,
  signPhantomMessage,
  signSolflareMessage,
  waitForPhantom,
  waitForSolflare,
} from "@/lib/solanaWallet";

const inputClass =
  "w-full rounded-xl border border-zinc-800 bg-black/60 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-gold";

type WalletKind = "phantom" | "solflare";
type ModalStep = "choose" | "manual" | "connect";

const WALLET_APPS: Array<{
  id: WalletKind;
  label: string;
  installUrl: string;
}> = [
  { id: "phantom", label: "Phantom", installUrl: "https://phantom.app/download" },
  { id: "solflare", label: "Solflare", installUrl: "https://solflare.com" },
];

export default function WalletConnectPanel() {
  const [wallets, setWallets] = useState<WalletPublic[]>([]);
  const [balances, setBalances] = useState<Record<string, SolanaBalance>>({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<WalletKind | null>(null);
  const [savingManual, setSavingManual] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ModalStep>("choose");
  const [accountName, setAccountName] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [phantomOk, setPhantomOk] = useState(false);
  const [solflareOk, setSolflareOk] = useState(false);

  const installed = { phantom: phantomOk, solflare: solflareOk };

  const loadBalances = useCallback(async (rows: WalletPublic[]) => {
    const next: Record<string, SolanaBalance> = {};
    await Promise.all(
      rows.map(async (row) => {
        const res = await api.wallets.balance(row.address);
        if (res.success && res.data) next[row.address] = res.data;
      })
    );
    setBalances(next);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const walletsRes = await api.wallets.list();
    if (walletsRes.success && Array.isArray(walletsRes.data)) {
      setWallets(walletsRes.data);
      void loadBalances(walletsRes.data);
    } else {
      toast.error(walletsRes.error || "No se pudieron cargar las wallets");
    }
    setLoading(false);
  }, [loadBalances]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([waitForPhantom(4000), waitForSolflare(4000)]);
      if (cancelled) return;
      setPhantomOk(isPhantomInstalled());
      setSolflareOk(isSolflareInstalled());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function closeModal() {
    setOpen(false);
    setStep("choose");
    setAccountName("");
    setManualAddress("");
    setConnecting(null);
  }

  function openCreate() {
    setStep("choose");
    setAccountName("");
    setManualAddress("");
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function linkExtension(kind: WalletKind) {
    const app = WALLET_APPS.find((item) => item.id === kind);
    const isInstalled = kind === "phantom" ? isPhantomInstalled() : isSolflareInstalled();
    if (!isInstalled) {
      window.open(app?.installUrl, "_blank", "noreferrer");
      toast.info(`Instala ${app?.label} y recarga esta pestaña`);
      return;
    }
    setConnecting(kind);
    try {
      const address = kind === "phantom" ? await connectPhantom() : await connectSolflare();
      const nonceRes = await api.wallets.nonce(address);
      const nonce = nonceRes.data;
      if (!nonceRes.success || !nonce?.message) {
        throw new Error(nonceRes.error || "No se pudo crear el nonce");
      }
      toast.info(`Firma en ${app?.label}`);
      const signature =
        kind === "phantom"
          ? await signPhantomMessage(nonce.message)
          : await signSolflareMessage(nonce.message);
      const linkRes = await api.wallets.link({
        address,
        signature,
        nonce: nonce.nonce,
        issuedAt: nonce.issuedAt,
        label: accountName.trim() || app?.label || "Solana",
      });
      if (!linkRes.success) {
        throw new Error(linkRes.error || "No se pudo vincular la wallet");
      }
      closeModal();
      toast.success("Cuenta conectada en Devnet");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo conectar la wallet");
    }
    setConnecting(null);
  }

  async function handleManual(e: FormEvent) {
    e.preventDefault();
    const name = accountName.trim();
    const address = manualAddress.trim();
    if (!name) {
      toast.error("Ponle un nombre a la cuenta");
      return;
    }
    if (!looksLikeSolanaAddress(address)) {
      toast.error("Pega una dirección Solana válida");
      return;
    }
    setSavingManual(true);
    const res = await api.wallets.linkManual({ address, label: name });
    if (res.success) {
      closeModal();
      toast.success("Cuenta creada en Devnet (solo lectura hasta que firmes)");
      load();
    } else {
      toast.error(res.error || "No se pudo vincular la dirección");
    }
    setSavingManual(false);
  }

  async function handlePrimary(id: number) {
    const res = await api.wallets.setPrimary(id);
    if (res.success) load();
    else toast.error(res.error || "No se pudo marcar como principal");
  }

  async function handleUnlink(wallet: WalletPublic) {
    if (!confirm("¿Desvincular esta cuenta?")) return;
    const res = await api.wallets.unlink(wallet.id);
    if (!res.success) {
      toast.error(res.error || "No se pudo desvincular");
      return;
    }
    try {
      if (getPhantom()?.publicKey?.toString() === wallet.address) await disconnectPhantom();
      if (getSolflare()?.publicKey?.toString() === wallet.address) await disconnectSolflare();
    } catch {
      /* la extensión puede no estar inyectada */
    }
    load();
  }

  return (
    <div className="space-y-5">
      {wallets.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl bg-gold px-4 py-2 text-xs font-black uppercase tracking-wide text-black"
          >
            + Crear
          </button>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] px-4 py-10 text-center text-sm text-zinc-500">
          Cargando…
        </div>
      ) : wallets.length === 0 ? (
        <div className="flex min-h-[52vh] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-[#0a0d16] px-6 py-16">
          <p className="text-sm font-semibold text-white">Sin cuentas</p>
          <p className="mt-1 max-w-sm text-center text-xs text-zinc-500">
            Crea una en Devnet: a mano o conectando Phantom / Solflare.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-6 rounded-xl bg-gold px-6 py-3 text-xs font-black uppercase tracking-wide text-black"
          >
            + Crear
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {wallets.map((wallet) => (
            <WalletTreasuryCard
              key={wallet.id}
              wallet={wallet}
              balance={balances[wallet.address]}
              onRefresh={() => void loadBalances(wallets)}
              onUnlink={() => void handleUnlink(wallet)}
              onPrimary={wallet.isPrimary ? undefined : () => void handlePrimary(wallet.id)}
            />
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/70" onClick={closeModal} />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-[#0a0d16] shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
              <div>
                <h3 className="text-sm font-black text-white">Crear cuenta</h3>
                <p className="mt-0.5 text-[11px] text-zinc-500">Devnet. Elige a mano o conecta la extensión.</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg px-2 py-1 text-xs font-bold uppercase text-zinc-400 hover:text-white"
              >
                Cerrar
              </button>
            </div>

            <div className="p-5">
              {step === "choose" && (
                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={() => setStep("manual")}
                    className="rounded-2xl border border-zinc-800 bg-black/40 px-4 py-4 text-left hover:border-gold/40"
                  >
                    <div className="text-sm font-black text-white">A mano</div>
                    <div className="mt-1 text-[11px] text-zinc-500">Nombre de la cuenta y pegas la dirección.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("connect")}
                    className="rounded-2xl border border-gold/30 bg-gold/10 px-4 py-4 text-left hover:border-gold/60"
                  >
                    <div className="text-sm font-black text-gold">Conectar</div>
                    <div className="mt-1 text-[11px] text-gold/70">Abre Phantom o Solflare y firma.</div>
                  </button>
                </div>
              )}

              {step === "manual" && (
                <form onSubmit={handleManual} className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setStep("choose")}
                    className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 hover:text-gold"
                  >
                    ← Volver
                  </button>
                  <label className="block text-xs text-zinc-500">
                    Nombre de la cuenta
                    <input
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      required
                      placeholder="Ej. Desk Devnet"
                      className={`${inputClass} mt-1.5`}
                    />
                  </label>
                  <label className="block text-xs text-zinc-500">
                    Dirección de la wallet
                    <input
                      value={manualAddress}
                      onChange={(e) => setManualAddress(e.target.value)}
                      required
                      spellCheck={false}
                      placeholder="Pega la dirección Solana"
                      className={`${inputClass} mt-1.5 font-mono`}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={savingManual}
                    className="w-full rounded-xl bg-gold px-4 py-2.5 text-xs font-black uppercase tracking-wide text-black disabled:opacity-40"
                  >
                    {savingManual ? "Guardando…" : "Guardar"}
                  </button>
                </form>
              )}

              {step === "connect" && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setStep("choose")}
                    className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 hover:text-gold"
                  >
                    ← Volver
                  </button>
                  <label className="block text-xs text-zinc-500">
                    Nombre de la cuenta (opcional)
                    <input
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder="Ej. Phantom desk"
                      className={`${inputClass} mt-1.5`}
                    />
                  </label>
                  <div className="grid gap-3">
                    {WALLET_APPS.map((app) => {
                      const ready = installed[app.id];
                      const busy = connecting === app.id;
                      return (
                        <button
                          key={app.id}
                          type="button"
                          disabled={connecting !== null}
                          onClick={() => void linkExtension(app.id)}
                          className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-left hover:border-gold/40 disabled:opacity-40"
                        >
                          <div>
                            <div className="text-sm font-black text-white">{app.label}</div>
                            <div className="text-[11px] text-zinc-500">
                              {ready ? "Extensión detectada · abre la app" : "No está instalada"}
                            </div>
                          </div>
                          <span className="text-xs font-bold uppercase tracking-wide text-gold">
                            {busy ? "Abriendo…" : ready ? "Abrir" : "Instalar"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

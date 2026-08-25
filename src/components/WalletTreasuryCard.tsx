"use client";

import { useState } from "react";
import Link from "next/link";
import { api, type SolanaBalance, type WalletPublic } from "@/lib/api";
import { safeExternalUrl } from "@/lib/safeUrl";
import { toast } from "@/lib/toast";

function formatSol(value: number | undefined, hidden: boolean) {
  if (hidden) return "••••••••";
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 })} SOL`;
}

function formatToken(value: number, hidden: boolean, decimals = 6) {
  if (hidden) return "••••••";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function shortAddr(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export default function WalletTreasuryCard({
  wallet,
  balance,
  onRefresh,
  onUnlink,
  onPrimary,
}: {
  wallet: WalletPublic;
  balance?: SolanaBalance;
  onRefresh: () => void;
  onUnlink: () => void;
  onPrimary?: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState<"airdrop" | null>(null);
  const cluster = balance?.cluster || "devnet";
  const explorerHref = safeExternalUrl(balance?.explorerUrl);
  const tokens = balance?.tokens || [
    { mint: "", symbol: "USDC", name: "USD Coin", initials: "US", decimals: 6, amount: "0", uiAmount: 0 },
    { mint: "", symbol: "EURC", name: "EUR Coin", initials: "EU", decimals: 6, amount: "0", uiAmount: 0 },
  ];

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(wallet.address);
      toast.success("Dirección copiada");
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  async function depositAirdrop() {
    await copyAddress();
    if (cluster === "mainnet-beta") {
      toast.info("Dirección copiada para depositar.");
      return;
    }
    setBusy("airdrop");
    const res = await api.wallets.airdrop(wallet.address, 1);
    if (res.success) {
      toast.success("1 SOL de prueba en Devnet");
      onRefresh();
    } else {
      await copyAddress();
      toast.error(res.error || "El RPC no dio airdrop. Dirección copiada; usa faucet.solana.com");
    }
    setBusy(null);
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#12151c] p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-sky-300/90">On-chain treasury</p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5.93" />
              <path d="M14 11a5 5 0 0 0-7.07 0L5.52 12.4a5 5 0 0 0 7.07 7.07L14 18.07" />
            </svg>
            <h3 className="text-sm font-semibold text-white">Wallet Balance</h3>
          </div>
          <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-500">
            {wallet.label ? `${wallet.label} · ` : ""}
            {shortAddr(wallet.address)}
            {wallet.isPrimary ? " · Principal" : ""}
            {wallet.verified === false ? " · Lectura" : ""}
            {" · "}
            {cluster}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setHidden((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-zinc-300 hover:text-white"
            aria-label={hidden ? "Mostrar saldos" : "Ocultar saldos"}
          >
            {hidden ? (
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 3l18 18" />
                <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
                <path d="M9.9 5.1A10.5 10.5 0 0 1 12 5c7 0 10 7 10 7a18 18 0 0 1-3.2 4.1" />
                <path d="M6.1 6.2C3.5 8 2 12 2 12s3 7 10 7c1.7 0 3.2-.4 4.5-1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-zinc-300 hover:text-white"
            aria-label="Actualizar"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 12a9 9 0 1 1-2.6-6.4" />
              <path d="M21 4v6h-6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">Total Solana</p>
        <p className="mt-1 font-mono text-xl font-semibold leading-none tracking-tight text-sky-300">
          {formatSol(balance?.sol, hidden)}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() =>
            toast.info("Envía desde Phantom o Solflare. El desk muestra el saldo; no firma transferencias desde aquí.")
          }
          className="flex items-center justify-center gap-1 rounded-xl bg-white px-2 py-1.5 text-[11px] font-semibold text-black"
        >
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 19V5" />
            <path d="M6 11l6-6 6 6" />
          </svg>
          Send
        </button>
        <button
          type="button"
          disabled={busy === "airdrop"}
          onClick={() => void depositAirdrop()}
          className="flex items-center justify-center gap-1 rounded-xl bg-[#1d2128] px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-[#252a33] disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14" />
            <path d="M6 13l6 6 6-6" />
          </svg>
          {busy === "airdrop" ? "…" : "Deposit"}
        </button>
        <Link
          href="/trading?tab=jupiter"
          className="flex items-center justify-center gap-1 rounded-xl bg-[#1d2128] px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-[#252a33]"
        >
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 7h10v10" />
            <path d="M7 17L17 7" />
          </svg>
          Trade
        </Link>
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">SPL utility tokens</p>
        <div className="grid grid-cols-2 gap-1.5">
          {tokens.map((token) => (
            <div
              key={`${token.symbol}-${token.mint || token.symbol}`}
              className="flex items-center justify-between gap-2 rounded-xl bg-[#1a1e26] px-2 py-1.5"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[8px] font-black text-white">
                  {token.initials || token.symbol.slice(0, 2)}
                </div>
                <span className="truncate text-[11px] font-semibold text-white">{token.symbol}</span>
              </div>
              <span className="shrink-0 font-mono text-[11px] text-zinc-200">
                {formatToken(token.uiAmount, hidden, Math.min(token.decimals || 6, 4))}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap justify-end gap-1.5">
        {onPrimary && !wallet.isPrimary && (
          <button
            type="button"
            onClick={onPrimary}
            className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-bold uppercase text-zinc-300 hover:text-white"
          >
            Principal
          </button>
        )}
        {explorerHref && (
          <a
            href={explorerHref}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-bold uppercase text-zinc-300 hover:text-white"
          >
            Explorer
          </a>
        )}
        <button
          type="button"
          onClick={onUnlink}
          className="rounded-md border border-red-500/20 px-2 py-1 text-[10px] font-bold uppercase text-red-400 hover:bg-red-500/10"
        >
          Desvincular
        </button>
      </div>
    </article>
  );
}

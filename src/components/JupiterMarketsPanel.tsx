"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  api,
  type JupiterPriceRow,
  type JupiterQuote,
  type SolanaBalance,
  type SolanaNetworkStatus,
  type WalletPublic,
  type WalletTransferPublic,
} from "@/lib/api";
import {
  connectPhantom,
  disconnectPhantom,
  isPhantomInstalled,
  reconnectPhantom,
  signJupiterTransaction,
  signPhantomMessage,
  waitForPhantom,
} from "@/lib/solanaWallet";
import { toast } from "@/lib/toast";
import { safeExternalUrl } from "@/lib/safeUrl";

function money(value: number | null, digits = 4): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: digits });
}

function shortAddr(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function explorerTx(hash: string, cluster?: string): string {
  if (hash.startsWith("SIMULATED-")) return "";
  if (hash.startsWith("http")) return safeExternalUrl(hash) || "";
  const base = `https://solscan.io/tx/${hash}`;
  const url = cluster && cluster !== "mainnet-beta" ? `${base}?cluster=${cluster}` : base;
  return safeExternalUrl(url) || "";
}

export default function JupiterMarketsPanel() {
  const [prices, setPrices] = useState<JupiterPriceRow[]>([]);
  const [quote, setQuote] = useState<JupiterQuote | null>(null);
  const [swaps, setSwaps] = useState<WalletTransferPublic[]>([]);
  const [network, setNetwork] = useState<SolanaNetworkStatus | null>(null);
  const [linked, setLinked] = useState<WalletPublic | null>(null);
  const [balance, setBalance] = useState<SolanaBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [linking, setLinking] = useState(false);
  const [airdropping, setAirdropping] = useState(false);
  const [wallet, setWallet] = useState("");
  const [phantomInstalled, setPhantomInstalled] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [lastTx, setLastTx] = useState("");
  const [input, setInput] = useState("SOL");
  const [output, setOutput] = useState("USDC");
  const [amount, setAmount] = useState("0.1");

  const demoMode = (network?.executionMode || "demo") !== "live";
  const cluster = network?.cluster || "devnet";

  const loadBalance = useCallback(async (address: string) => {
    if (!address) {
      setBalance(null);
      return;
    }
    const res = await api.wallets.balance(address);
    if (res.success && res.data) setBalance(res.data);
  }, []);

  const load = useCallback(async (notify = false) => {
    setLoading(true);
    const [priceRes, transferRes, networkRes, walletsRes] = await Promise.all([
      api.jupiter.prices(),
      api.wallets.transfers(),
      api.wallets.network(),
      api.wallets.list(),
    ]);
    if (priceRes.success && Array.isArray(priceRes.data)) {
      setPrices(priceRes.data);
      setLoadError(null);
    } else {
      setLoadError(priceRes.error || "No se pudieron leer los mercados de Jupiter");
      if (notify) toast.error(priceRes.error || "No se pudieron leer los mercados de Jupiter");
    }
    if (transferRes.success && Array.isArray(transferRes.data)) {
      setSwaps(transferRes.data.filter((row) => row.type === "swap").slice(0, 6));
    }
    if (networkRes.success && networkRes.data) setNetwork(networkRes.data);
    if (walletsRes.success && Array.isArray(walletsRes.data)) {
      const primary = walletsRes.data.find((row) => row.isPrimary) || walletsRes.data[0] || null;
      setLinked(primary);
    }
    setLoading(false);
  }, []);

  async function linkWallet(address: string, notify = true) {
    setLinking(true);
    try {
      const nonceRes = await api.wallets.nonce(address);
      if (!nonceRes.success || !nonceRes.data?.message) {
        throw new Error(nonceRes.error || "No se pudo crear el nonce");
      }
      toast.info("Firma el mensaje en Phantom para vincular la wallet");
      const signature = await signPhantomMessage(nonceRes.data.message);
      const linkRes = await api.wallets.link({
        address,
        signature,
        nonce: nonceRes.data.nonce,
        issuedAt: nonceRes.data.issuedAt,
        label: "Phantom",
      });
      if (!linkRes.success || !linkRes.data) {
        throw new Error(linkRes.error || "No se pudo vincular la billetera");
      }
      setLinked(linkRes.data);
      if (notify) toast.success("Billetera verificada y vinculada a tu usuario");
    } catch (err) {
      if (notify) toast.error(err instanceof Error ? err.message : "No se firmó el mensaje");
    }
    setLinking(false);
  }

  useEffect(() => {
    let cancelled = false;
    let detach: (() => void) | undefined;

    async function attachPhantom() {
      const phantom = await waitForPhantom();
      if (cancelled || !phantom) return;
      setPhantomInstalled(true);

      const onConnect = (pubkey?: { toString(): string } | null) => {
        const next = pubkey?.toString() || phantom.publicKey?.toString() || "";
        if (next) setWallet(next);
      };
      const onDisconnect = () => {
        setWallet("");
        setBalance(null);
      };
      const onAccount = (pubkey?: { toString(): string } | null) => {
        setWallet(pubkey?.toString() || "");
      };
      phantom.on?.("connect", onConnect);
      phantom.on?.("disconnect", onDisconnect);
      phantom.on?.("accountChanged", onAccount);
      detach = () => {
        phantom.off?.("connect", onConnect);
        phantom.off?.("disconnect", onDisconnect);
        phantom.off?.("accountChanged", onAccount);
      };

      setConnecting(true);
      try {
        const address = await connectPhantom();
        if (!cancelled && address) setWallet(address);
      } catch {
        const trusted = await reconnectPhantom();
        if (!cancelled && trusted) setWallet(trusted);
      }
      if (!cancelled) setConnecting(false);
    }

    void attachPhantom();
    void load(true);
    const id = setInterval(() => void load(false), 20000);
    return () => {
      cancelled = true;
      detach?.();
      clearInterval(id);
    };
  }, [load]);

  useEffect(() => {
    if (wallet) void loadBalance(wallet);
  }, [wallet, loadBalance]);

  async function handleConnect() {
    setPhantomInstalled(isPhantomInstalled());
    if (!isPhantomInstalled()) {
      window.open("https://phantom.app/download", "_blank", "noreferrer");
      toast.info("Instala Phantom y recarga esta pestaña");
      return;
    }
    setConnecting(true);
    try {
      const address = await connectPhantom();
      setWallet(address);
      toast.success(`Phantom ${shortAddr(address)}`);
      if (!linked || linked.address !== address) {
        await linkWallet(address);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo abrir Phantom");
    }
    setConnecting(false);
  }

  async function handleDisconnect() {
    await disconnectPhantom();
    setWallet("");
    setBalance(null);
    toast.success("Phantom desconectado de esta sesión");
  }

  async function handleAirdrop() {
    if (!wallet) {
      toast.error("Conecta Phantom primero");
      return;
    }
    setAirdropping(true);
    const res = await api.wallets.airdrop(wallet, 1);
    if (res.success && res.data) {
      setBalance(res.data);
      toast.success(`+1 SOL de prueba en ${res.data.cluster}`);
    } else {
      toast.error(res.error || "El RPC no dio airdrop. Usa faucet.solana.com");
      const faucet = safeExternalUrl(network?.faucetUrl);
      if (faucet) window.open(faucet, "_blank", "noreferrer");
    }
    setAirdropping(false);
  }

  async function requestQuote(e: FormEvent) {
    e.preventDefault();
    setQuoting(true);
    setQuote(null);
    const res = await api.jupiter.quote(input, output, Number(amount));
    if (res.success && res.data) {
      setQuote(res.data);
    } else {
      toast.error(res.error || "No hay ruta de swap");
    }
    setQuoting(false);
  }

  async function handleSwap() {
    if (!wallet) {
      toast.error("Conecta Phantom antes de ejecutar");
      return;
    }
    const qty = Number(amount);
    if (!(qty > 0) || input === output) {
      toast.error("Elige tokens distintos y una cantidad válida");
      return;
    }
    setSwapping(true);
    try {
      if (demoMode) {
        const exec = await api.jupiter.simulate({ taker: wallet, input, output, amount: qty });
        if (!exec.success || exec.data?.status !== "Success") {
          throw new Error(exec.error || exec.data?.error || "No se simuló el swap");
        }
        setLastTx(exec.data.signature || "");
        toast.success(exec.message || "Swap DEMO simulado");
        void load(false);
        return;
      }
      const orderRes = await api.jupiter.order(input, output, qty, wallet);
      if (!orderRes.success || !orderRes.data?.transaction || !orderRes.data.requestId) {
        throw new Error(orderRes.error || "Jupiter no armó la transacción");
      }
      setQuote(orderRes.data);
      toast.info("Firma el swap en Phantom");
      const signed = await signJupiterTransaction(orderRes.data.transaction);
      const exec = await api.jupiter.execute({
        signedTransaction: signed,
        requestId: orderRes.data.requestId,
        taker: wallet,
        input,
        output,
        amount: qty,
      });
      if (!exec.success || exec.data?.status !== "Success") {
        throw new Error(exec.error || exec.data?.error || "El swap no se confirmó");
      }
      setLastTx(exec.data.solscanUrl || exec.data.signature || "");
      toast.success(exec.message || "Swap confirmado on-chain");
      void load(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo ejecutar el swap");
    }
    setSwapping(false);
  }

  const symbols = prices.length ? prices.map((p) => p.symbol) : ["SOL", "USDC", "USDT", "JUP"];
  const jupiterOk = prices.length > 0;
  const walletLinked = Boolean(linked && wallet && linked.address === wallet);
  const phase0Ready = phantomInstalled && Boolean(wallet) && jupiterOk;
  const lastTxUrl = lastTx ? explorerTx(lastTx, cluster) : "";
  const faucetHref = safeExternalUrl(network?.faucetUrl);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white">Mercados Jupiter</h2>
          <p className="text-sm text-zinc-400">
            {demoMode
              ? "Demo/Devnet: conecta Phantom, firma el nonce y simula swaps sin fondos reales."
              : "Live/Mainnet: cada swap pide aprobación en Phantom y mueve fondos reales."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {wallet && (
            <button
              type="button"
              onClick={() => void handleDisconnect()}
              className="rounded-xl border border-zinc-700 px-3 py-2 text-[11px] font-bold uppercase text-zinc-400 hover:text-white"
            >
              Salir
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleConnect()}
            disabled={connecting || linking}
            className="rounded-xl border border-zinc-700 px-3 py-2 text-[11px] font-bold uppercase text-zinc-200 hover:border-gold hover:text-gold disabled:opacity-40"
          >
            {connecting || linking
              ? linking
                ? "Firmando..."
                : "Abriendo Phantom..."
              : wallet
                ? shortAddr(wallet)
                : phantomInstalled
                  ? "Conectar Phantom"
                  : "Instalar Phantom"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-xs text-zinc-400">
        <p>
          Red Orion: <span className="font-bold text-white uppercase">{cluster}</span>
          {" · "}
          modo <span className="font-bold text-white uppercase">{network?.executionMode || "demo"}</span>
          {network?.rpcHost ? ` · RPC ${network.rpcHost}` : ""}
          {balance ? ` · saldo ${balance.sol.toFixed(4)} SOL` : ""}
        </p>
        <p className="mt-1">{network?.phantomHint}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <PhaseCheck ok={phantomInstalled} label="Extensión Phantom" detail={phantomInstalled ? "Detectada" : "No está en este navegador"} />
        <PhaseCheck ok={Boolean(wallet)} label="Sesión Phantom" detail={wallet ? shortAddr(wallet) : "Pendiente de conectar"} />
        <PhaseCheck
          ok={walletLinked}
          label="Firma / usuario"
          detail={walletLinked ? "Wallet vinculada" : linking ? "Esperando firma" : "Falta signMessage"}
        />
        <PhaseCheck
          ok={jupiterOk}
          label="Jupiter API"
          detail={jupiterOk ? "Precios en vivo" : loadError || "Sin key o sin precios"}
        />
      </div>
      {phase0Ready && (
        <p className="text-xs text-emerald-400">
          {walletLinked
            ? demoMode
              ? "Listo para prácticas: Ver ruta y Simular swap. El airdrop pide SOL de Devnet."
              : "Wallet vinculada. Ver ruta no gasta SOL. Ejecutar swap sí es on-chain."
            : "Phantom conectado. Pulsa Conectar otra vez o Vincular para firmar el nonce."}
        </p>
      )}

      {wallet && (
        <div className="flex flex-wrap gap-2">
          {!walletLinked && (
            <button
              type="button"
              disabled={linking}
              onClick={() => void linkWallet(wallet)}
              className="rounded-xl border border-gold/40 px-3 py-2 text-[11px] font-bold uppercase text-gold disabled:opacity-40"
            >
              {linking ? "Firmando..." : "Vincular con firma"}
            </button>
          )}
          {demoMode && (
            <>
              <button
                type="button"
                disabled={airdropping}
                onClick={() => void handleAirdrop()}
                className="rounded-xl border border-zinc-700 px-3 py-2 text-[11px] font-bold uppercase text-zinc-200 disabled:opacity-40"
              >
                {airdropping ? "Pidiendo SOL..." : "Airdrop Devnet"}
              </button>
              {faucetHref && (
                <a
                  href={faucetHref}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-zinc-700 px-3 py-2 text-[11px] font-bold uppercase text-zinc-400 hover:text-white"
                >
                  Faucet web
                </a>
              )}
            </>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
        <table className="w-full text-left text-xs font-mono">
          <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
            <tr className="border-b border-zinc-800">
              <th className="px-3 py-2">Token</th>
              <th className="px-3 py-2">USD</th>
              <th className="px-3 py-2">24h</th>
              <th className="px-3 py-2">Liquidez</th>
            </tr>
          </thead>
          <tbody>
            {loading && prices.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-zinc-500" colSpan={4}>
                  Consultando Jupiter...
                </td>
              </tr>
            ) : prices.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-amber-200/90" colSpan={4}>
                  {loadError || "Jupiter no devolvió precios. Pega la API key en Motor → Integraciones y vuelve a esta pestaña."}
                </td>
              </tr>
            ) : (
              prices.map((row) => (
                <tr key={row.mint} className="border-b border-zinc-900">
                  <td className="px-3 py-3">
                    <span className="font-bold text-white">{row.symbol}</span>
                    <span className="ml-2 text-zinc-500">{row.name}</span>
                  </td>
                  <td className="px-3 py-3 text-white">{row.usdPrice != null ? `$${money(row.usdPrice)}` : "—"}</td>
                  <td className={`px-3 py-3 ${(row.change24h ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {row.change24h == null ? "—" : `${row.change24h >= 0 ? "+" : ""}${row.change24h.toFixed(2)}%`}
                  </td>
                  <td className="px-3 py-3 text-zinc-400">
                    {row.liquidity != null ? `$${Math.round(row.liquidity).toLocaleString("en-US")}` : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={requestQuote} className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <h3 className="font-bold text-white">Swap</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          <select value={input} onChange={(e) => setInput(e.target.value)} className="rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white">
            {symbols.map((s) => (
              <option key={`in-${s}`} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={output} onChange={(e) => setOutput(e.target.value)} className="rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white">
            {symbols.map((s) => (
              <option key={`out-${s}`} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={quoting || input === output}
            className="rounded-xl border border-zinc-700 px-4 py-2 text-[11px] font-bold uppercase text-zinc-200 disabled:opacity-40"
          >
            {quoting ? "Cotizando..." : "Ver ruta"}
          </button>
          <button
            type="button"
            disabled={swapping || input === output || !wallet}
            onClick={() => void handleSwap()}
            className="rounded-xl bg-gold px-4 py-2 text-[11px] font-bold uppercase text-black disabled:opacity-40"
          >
            {swapping ? "Ejecutando..." : demoMode ? "Simular swap" : "Ejecutar swap"}
          </button>
        </div>
        <p className="text-[11px] text-zinc-500">
          {demoMode
            ? "Ver ruta consulta Jupiter. Simular swap registra un fill DEMO; no mueve SOL."
            : "Ver ruta solo consulta Jupiter. Ejecutar swap pide firma en Phantom y mueve fondos reales."}
        </p>
        {quote && (
          <p className="text-sm text-zinc-300">
            {quote.inUi} {quote.input.symbol} → {money(quote.outUi, 6)} {quote.output.symbol}
            {quote.priceImpactPct != null ? ` · impacto ${Number(quote.priceImpactPct).toFixed(3)}%` : ""}
          </p>
        )}
        {lastTxUrl && (
          <a
            href={lastTxUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-[11px] font-bold text-gold hover:underline"
          >
            Ver en Solscan
          </a>
        )}
        {lastTx.startsWith("SIMULATED-") && (
          <p className="text-[11px] font-mono text-emerald-400">Fill DEMO {lastTx}</p>
        )}
      </form>

      {swaps.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <h3 className="text-sm font-bold text-white">Últimos swaps</h3>
          <ul className="mt-3 space-y-2 text-xs text-zinc-400">
            {swaps.map((row) => {
              const href = row.txHash ? explorerTx(row.txHash, cluster) : "";
              return (
                <li key={row.id} className="flex items-center justify-between gap-2">
                  <span>
                    {row.asset} · {row.amount} · {row.status}
                    {row.note?.startsWith("DEMO") ? " · DEMO" : ""}
                  </span>
                  {href ? (
                    <a href={href} target="_blank" rel="noreferrer" className="font-mono text-gold hover:underline">
                      {shortAddr(row.txHash || "")}
                    </a>
                  ) : row.txHash ? (
                    <span className="font-mono text-zinc-500">{shortAddr(row.txHash)}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function PhaseCheck({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 text-xs font-semibold ${ok ? "text-emerald-400" : "text-zinc-400"}`}>
        {ok ? "OK" : "Falta"} · {detail}
      </p>
    </div>
  );
}

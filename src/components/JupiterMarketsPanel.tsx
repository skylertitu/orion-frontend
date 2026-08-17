"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, type JupiterPriceRow, type JupiterQuote, type WalletTransferPublic } from "@/lib/api";
import { connectPhantom, getPhantom, signJupiterTransaction } from "@/lib/solanaWallet";
import { toast } from "@/lib/toast";

function money(value: number | null, digits = 4): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: digits });
}

function shortAddr(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export default function JupiterMarketsPanel() {
  const [prices, setPrices] = useState<JupiterPriceRow[]>([]);
  const [quote, setQuote] = useState<JupiterQuote | null>(null);
  const [swaps, setSwaps] = useState<WalletTransferPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [quoting, setQuoting] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [wallet, setWallet] = useState("");
  const [lastTx, setLastTx] = useState("");
  const [input, setInput] = useState("SOL");
  const [output, setOutput] = useState("USDC");
  const [amount, setAmount] = useState("0.1");

  const load = useCallback(async (notify = false) => {
    setLoading(true);
    const [priceRes, transferRes] = await Promise.all([
      api.jupiter.prices(),
      api.wallets.transfers(),
    ]);
    if (priceRes.success && Array.isArray(priceRes.data)) {
      setPrices(priceRes.data);
    } else if (notify) {
      toast.error(priceRes.error || "No se pudieron leer los mercados de Jupiter");
    }
    if (transferRes.success && Array.isArray(transferRes.data)) {
      setSwaps(transferRes.data.filter((row) => row.type === "swap").slice(0, 6));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const phantom = getPhantom();
    if (phantom?.publicKey) setWallet(phantom.publicKey.toString());
    void load(true);
    const id = setInterval(() => void load(false), 20000);
    return () => clearInterval(id);
  }, [load]);

  async function handleConnect() {
    try {
      const address = await connectPhantom();
      setWallet(address);
      toast.success(`Phantom ${shortAddr(address)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo abrir Phantom");
    }
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
      setLastTx(exec.data.signature || exec.data.solscanUrl || "");
      toast.success(exec.message || "Swap confirmado on-chain");
      void load(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo ejecutar el swap");
    }
    setSwapping(false);
  }

  const symbols = prices.length ? prices.map((p) => p.symbol) : ["SOL", "USDC", "USDT", "JUP"];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white">Mercados Jupiter</h2>
          <p className="text-sm text-zinc-400">
            Precios de Solana y swap real: Phantom firma, Jupiter aterriza la transacción.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleConnect()}
          className="rounded-xl border border-zinc-700 px-3 py-2 text-[11px] font-bold uppercase text-zinc-200 hover:border-gold hover:text-gold"
        >
          {wallet ? shortAddr(wallet) : "Conectar Phantom"}
        </button>
      </div>

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
            {swapping ? "Ejecutando..." : "Ejecutar swap"}
          </button>
        </div>
        {quote && (
          <p className="text-sm text-zinc-300">
            {quote.inUi} {quote.input.symbol} → {money(quote.outUi, 6)} {quote.output.symbol}
            {quote.priceImpactPct != null ? ` · impacto ${Number(quote.priceImpactPct).toFixed(3)}%` : ""}
          </p>
        )}
        {lastTx && (
          <a
            href={lastTx.startsWith("http") ? lastTx : `https://solscan.io/tx/${lastTx}`}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-[11px] font-bold text-gold hover:underline"
          >
            Ver en Solscan
          </a>
        )}
      </form>

      {swaps.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <h3 className="text-sm font-bold text-white">Últimos swaps</h3>
          <ul className="mt-3 space-y-2 text-xs text-zinc-400">
            {swaps.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-2">
                <span>
                  {row.asset} · {row.amount} · {row.status}
                </span>
                {row.txHash && (
                  <a
                    href={`https://solscan.io/tx/${row.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-gold hover:underline"
                  >
                    {shortAddr(row.txHash)}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, Trade, PortfolioItem } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { BINANCE_PAIRS, DEFAULT_SYMBOL, formatPair } from "@/lib/binance";

const inputClass =
  "w-full rounded-lg border border-zinc-800 bg-black px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20";

export default function TradingPage() {
  const user = getUser();
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [type, setType] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    if (!user) return;
    const [tradesRes, portfolioRes] = await Promise.all([
      api.trades.list(user.id),
      api.portfolio.get(user.id),
    ]);
    if (tradesRes.success && tradesRes.data) setTrades(tradesRes.data);
    if (portfolioRes.success && portfolioRes.data) setPortfolio(portfolioRes.data);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function fetchPrice() {
    try {
      const res = await fetch(`/api/market/price?symbol=${symbol}`);
      const data = await res.json();
      if (data.price) setPrice(data.price.toFixed(4));
    } catch {
      setError("No se pudo obtener el precio de Binance");
    }
  }

  useEffect(() => {
    fetchPrice();
  }, [symbol]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    setSuccess("");
    setLoading(true);

    const res = await api.trades.create({
      userId: user.id,
      symbol,
      type,
      quantity: parseFloat(quantity),
      price: parseFloat(price),
    });

    if (res.success) {
      setSuccess(`Orden de ${type === "buy" ? "compra" : "venta"} ejecutada en Binance (${formatPair(symbol)})`);
      setQuantity("");
      loadData();
    } else {
      setError(res.error || "Error al ejecutar la transacción");
    }
    setLoading(false);
  }

  const solanaPairs = BINANCE_PAIRS.filter((p) => p.network === "solana");
  const otherPairs = BINANCE_PAIRS.filter((p) => p.network !== "solana");

  return (
    <div className="flex w-full flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Trading</h1>
        <p className="text-sm text-zinc-500">Opera con pares spot de Binance</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6"
          >
            <h2 className="font-semibold text-white">Nueva transacción</h2>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-400">
                {success}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType("buy")}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                  type === "buy" ? "bg-green-600 text-white" : "bg-zinc-800 text-zinc-400"
                }`}
              >
                Comprar
              </button>
              <button
                type="button"
                onClick={() => setType("sell")}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                  type === "sell" ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-400"
                }`}
              >
                Vender
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Par (Binance)
              </label>
              <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className={inputClass}>
                <optgroup label="Principales">
                  {otherPairs.map((p) => (
                    <option key={p.symbol} value={p.symbol}>
                      {formatPair(p.symbol)} — {p.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Solana">
                  {solanaPairs.map((p) => (
                    <option key={p.symbol} value={p.symbol}>
                      {formatPair(p.symbol)} — {p.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Cantidad
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                placeholder="0.00"
                className={inputClass}
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Precio (USDT)
                </label>
                <button type="button" onClick={fetchPrice} className="text-xs text-gold hover:text-gold-light">
                  Precio Binance
                </button>
              </div>
              <input
                type="number"
                step="any"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                placeholder="0.00"
                className={inputClass}
              />
            </div>

            {quantity && price && (
              <div className="rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-400">
                Total:{" "}
                <span className="font-semibold text-white">
                  ${(parseFloat(quantity) * parseFloat(price)).toFixed(2)} USDT
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                type === "buy"
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-red-600 text-white hover:bg-red-700"
              }`}
            >
              {loading ? "Procesando..." : type === "buy" ? "Comprar" : "Vender"}
            </button>
          </form>

          {portfolio.length > 0 && (
            <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6">
              <h3 className="mb-3 font-semibold text-white">Mi Portfolio</h3>
              <div className="space-y-2">
                {portfolio.map((p) => (
                  <div key={p.id} className="flex justify-between text-sm">
                    <span className="font-medium text-white">{formatPair(p.symbol)}</span>
                    <span className="text-zinc-500">
                      {Number(p.quantity).toFixed(6)} @ ${Number(p.averagePrice).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80">
            <div className="border-b border-zinc-800 px-6 py-4">
              <h2 className="font-semibold text-white">Historial de transacciones</h2>
            </div>
            {trades.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-zinc-500">
                No hay transacciones aún
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                      <th className="px-6 py-3 font-medium">Fecha</th>
                      <th className="px-6 py-3 font-medium">Par</th>
                      <th className="px-6 py-3 font-medium">Tipo</th>
                      <th className="px-6 py-3 font-medium">Cantidad</th>
                      <th className="px-6 py-3 font-medium">Precio</th>
                      <th className="px-6 py-3 font-medium">Total</th>
                      <th className="px-6 py-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((t) => (
                      <tr key={t.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                        <td className="px-6 py-3 text-zinc-500">
                          {new Date(t.createdAt).toLocaleString("es")}
                        </td>
                        <td className="px-6 py-3 font-medium text-white">{formatPair(t.symbol)}</td>
                        <td className="px-6 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              t.type === "buy"
                                ? "bg-green-500/10 text-green-400"
                                : "bg-red-500/10 text-red-400"
                            }`}
                          >
                            {t.type === "buy" ? "Compra" : "Venta"}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-zinc-300">{Number(t.quantity).toFixed(6)}</td>
                        <td className="px-6 py-3 text-zinc-300">${Number(t.price).toFixed(4)}</td>
                        <td className="px-6 py-3 font-medium text-white">${Number(t.total).toFixed(2)}</td>
                        <td className="px-6 py-3 capitalize text-zinc-500">{t.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

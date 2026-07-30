"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { BINANCE_PAIRS, DEFAULT_SYMBOL, formatPair } from "@/lib/binance";
import LucySignalsPanel from "@/components/LucySignalsPanel";

const inputClass =
  "w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-gold";

export default function TradingPage() {
  const user = getUser();
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [broker, setBroker] = useState("binance");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("");
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadPositions = useCallback(async () => {
    const res = await api.engine.positions(broker);
    if (res.success && res.data) setPositions(res.data);
  }, [broker]);

  useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    setSuccess("");
    setLoading(true);

    const qty = parseFloat(quantity);
    if (!qty) {
      setError("Cantidad inválida");
      setLoading(false);
      return;
    }

    const res = await api.engine.order({
      broker,
      symbol,
      side,
      quantity: qty,
    });

    if (res.success) {
      setSuccess("Orden enviada al broker");
      setQuantity("");
      loadPositions();
    } else {
      setError(res.error || "Error al ejecutar orden");
    }
    setLoading(false);
  }

  return (
    <div className="flex w-full flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-white">Trading</h1>
        <p className="text-sm text-zinc-500">Órdenes reales vía broker conectado</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-5 lg:col-span-1"
        >
          <h2 className="font-semibold text-white">Nueva orden</h2>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {success && <p className="text-sm text-green-400">{success}</p>}

          <div>
            <label className="mb-1 block text-xs text-zinc-500">Broker</label>
            <select value={broker} onChange={(e) => setBroker(e.target.value)} className={inputClass}>
              <option value="binance">Binance</option>
              <option value="bybit">Bybit</option>
              <option value="mt5">MT5</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSide("buy")}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
                side === "buy" ? "bg-green-600 text-white" : "bg-zinc-800 text-zinc-400"
              }`}
            >
              Comprar
            </button>
            <button
              type="button"
              onClick={() => setSide("sell")}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
                side === "sell" ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-400"
              }`}
            >
              Vender
            </button>
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-500">Par</label>
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className={inputClass}>
              {BINANCE_PAIRS.map((p) => (
                <option key={p.symbol} value={p.symbol}>
                  {formatPair(p.symbol)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-500">Cantidad</label>
            <input
              type="number"
              step="any"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50 ${
              side === "buy" ? "bg-green-600" : "bg-red-600"
            }`}
          >
            {loading ? "Enviando..." : side === "buy" ? "Comprar" : "Vender"}
          </button>
        </form>

        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="mb-3 font-semibold text-white">Posiciones abiertas</h2>
            {positions.length === 0 ? (
              <p className="text-sm text-zinc-500">Sin posiciones</p>
            ) : (
              <div className="space-y-2">
                {positions.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-white">{p.symbol}</span>
                    <span className={p.profit >= 0 ? "text-green-400" : "text-red-400"}>
                      {p.side} · {p.profit?.toFixed?.(2) ?? p.profit}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <LucySignalsPanel />
        </div>
      </div>
    </div>
  );
}

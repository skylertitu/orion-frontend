"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, Trade, PortfolioItem } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { BINANCE_PAIRS, DEFAULT_SYMBOL, formatPair } from "@/lib/binance";

const inputClass =
  "w-full rounded-lg border border-zinc-800 bg-black px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20";

export default function TradingPage() {
  const user = getUser();
  
  // Estados para broker y conexión
  const [broker, setBroker] = useState<"binance" | "mt5">("binance");
  const [brokersStatus, setBrokersStatus] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  
  // Campos del formulario
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [mtSymbol, setMtSymbol] = useState("EURUSD");
  const [type, setType] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("");
  const [lot, setLot] = useState("0.01");
  const [price, setPrice] = useState("");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [comment, setComment] = useState("");

  // Historial y portfolio tradicionales
  const [trades, setTrades] = useState<Trade[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [tradesRes, portfolioRes, brokersRes, positionsRes] = await Promise.all([
        api.trades.list(user.id),
        api.portfolio.get(user.id),
        api.engine.brokers(),
        api.engine.positions()
      ]);

      if (tradesRes.success && tradesRes.data) setTrades(tradesRes.data);
      if (portfolioRes.success && portfolioRes.data) setPortfolio(portfolioRes.data);
      if (brokersRes.success && brokersRes.data) setBrokersStatus(brokersRes.data);
      if (positionsRes.success && positionsRes.data) setPositions(positionsRes.data);
    } catch (err) {
      console.error("Error al cargar datos del trading engine:", err);
    }
  }, [user]);

  useEffect(() => {
    loadData();
    // Auto-refresh de posiciones y estados cada 10 segundos
    const interval = setInterval(() => {
      loadData();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  async function fetchPrice() {
    if (broker !== "binance") return;
    try {
      const res = await api.engine.price("binance", symbol);
      if (res.success && res.data) {
        setPrice(res.data.price.toFixed(4));
      }
    } catch {
      setError("No se pudo obtener el precio de Binance");
    }
  }

  useEffect(() => {
    if (broker === "binance") {
      fetchPrice();
    } else {
      setPrice(""); // MT5 opera a precio de mercado del broker directamente
    }
  }, [symbol, broker]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    setSuccess("");
    setLoading(true);

    const activeSymbol = broker === "binance" ? symbol : mtSymbol.toUpperCase();

    const orderData: any = {
      broker,
      symbol: activeSymbol,
      side: type,
    };

    if (broker === "binance") {
      orderData.quantity = parseFloat(quantity);
    } else {
      orderData.lot = parseFloat(lot);
      if (sl) orderData.sl = parseFloat(sl);
      if (tp) orderData.tp = parseFloat(tp);
      if (comment) orderData.comment = comment;
    }

    const res = await api.engine.order(orderData);

    if (res.success) {
      setSuccess(
        `Orden de ${type === "buy" ? "compra" : "venta"} ejecutada con éxito en ${
          broker === "binance" ? "Binance" : "MetaTrader 5"
        } (${activeSymbol})`
      );
      setQuantity("");
      setSl("");
      setTp("");
      setComment("");
      loadData();
    } else {
      setError(res.error || "Error al ejecutar la orden");
    }
    setLoading(false);
  }

  async function handleClosePosition(posBroker: string, ticket: string | number) {
    setError("");
    setSuccess("");
    setLoading(true);
    const res = await api.engine.closePosition(posBroker, ticket);
    if (res.success) {
      setSuccess(`Posición #${ticket} cerrada correctamente en ${posBroker.toUpperCase()}`);
      loadData();
    } else {
      setError(res.error || "No se pudo cerrar la posición");
    }
    setLoading(false);
  }

  const solanaPairs = BINANCE_PAIRS.filter((p) => p.network === "solana");
  const otherPairs = BINANCE_PAIRS.filter((p) => p.network !== "solana");

  return (
    <div className="flex w-full flex-col gap-6 p-8">
      {/* Encabezado */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Trading Terminal</h1>
          <p className="text-sm text-zinc-500">
            Opera múltiples brokers y exchanges de forma unificada
          </p>
        </div>

        {/* Estado de los Brokers en Tiempo Real */}
        <div className="flex flex-wrap gap-3">
          {brokersStatus.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-400"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  b.connected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-red-500"
                }`}
              />
              <span className="font-semibold text-white">{b.label}</span>
              <span className="text-[10px] text-zinc-600">({b.connected ? "conectado" : "offline"})</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna Izquierda: Formulario de Nueva Orden */}
        <div className="lg:col-span-1 space-y-4">
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white">Nueva Orden</h2>
              
              {/* Selector de Broker */}
              <select
                value={broker}
                onChange={(e) => {
                  setBroker(e.target.value as "binance" | "mt5");
                  setError("");
                  setSuccess("");
                }}
                className="rounded border border-zinc-800 bg-black px-2 py-1 text-xs font-semibold text-gold outline-none"
              >
                <option value="binance">Binance Spot</option>
                <option value="mt5">MetaTrader 4 / 5</option>
              </select>
            </div>

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

            {/* Dirección BUY / SELL */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType("buy")}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                  type === "buy"
                    ? "bg-green-600 text-white shadow-[0_4px_12px_rgba(22,163,74,0.3)]"
                    : "bg-zinc-800 text-zinc-400"
                }`}
              >
                Comprar
              </button>
              <button
                type="button"
                onClick={() => setType("sell")}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                  type === "sell"
                    ? "bg-red-600 text-white shadow-[0_4px_12px_rgba(220,38,38,0.3)]"
                    : "bg-zinc-800 text-zinc-400"
                }`}
              >
                Vender
              </button>
            </div>

            {/* Símbolo */}
            {broker === "binance" ? (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Par (Binance)
                </label>
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className={inputClass}
                >
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
            ) : (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Símbolo (MetaTrader)
                </label>
                <input
                  type="text"
                  value={mtSymbol}
                  onChange={(e) => setMtSymbol(e.target.value)}
                  required
                  placeholder="Ej: US30, EURUSD, XAUUSD"
                  className={inputClass}
                />
                <span className="mt-1 block text-[10px] text-zinc-500">
                  Usa símbolos de tu cuenta de broker (ej: US30, XAUUSD.ecn)
                </span>
              </div>
            )}

            {/* Volumen / Cantidad */}
            {broker === "binance" ? (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Cantidad (Monto)
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
            ) : (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Volumen (Lotes)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={lot}
                  onChange={(e) => setLot(e.target.value)}
                  required
                  placeholder="0.01"
                  className={inputClass}
                />
              </div>
            )}

            {/* Configuración MT5 Adicional (SL, TP, Comment) */}
            {broker === "mt5" && (
              <div className="grid gap-3 grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-zinc-400">
                    Stop Loss (SL)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={sl}
                    onChange={(e) => setSl(e.target.value)}
                    placeholder="0"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-zinc-400">
                    Take Profit (TP)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={tp}
                    onChange={(e) => setTp(e.target.value)}
                    placeholder="0"
                    className={inputClass}
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-[11px] font-semibold text-zinc-400">
                    Comentario (Opcional)
                  </label>
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Orion AutoTrading"
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {/* Precio informativo para Binance */}
            {broker === "binance" && price && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Precio Estimado (USDT)
                  </label>
                  <button
                    type="button"
                    onClick={fetchPrice}
                    className="text-xs text-gold hover:text-gold-light"
                  >
                    Actualizar
                  </button>
                </div>
                <input
                  type="text"
                  readOnly
                  value={`$${price} USDT`}
                  className={`${inputClass} bg-zinc-900 border-zinc-800 text-zinc-400 cursor-not-allowed`}
                />
                {quantity && (
                  <div className="mt-2 rounded-lg border border-zinc-800 bg-black px-3 py-2 text-xs text-zinc-400">
                    Total aprox:{" "}
                    <span className="font-semibold text-white">
                      ${(parseFloat(quantity) * parseFloat(price)).toFixed(2)} USDT
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Botón de Enviar */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                type === "buy"
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-red-600 text-white hover:bg-red-700"
              }`}
            >
              {loading ? "Procesando..." : type === "buy" ? "Comprar Mercado" : "Vender Mercado"}
            </button>
          </form>

          {/* Binance Spot Portfolio */}
          {broker === "binance" && portfolio.length > 0 && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6">
              <h3 className="mb-3 font-semibold text-white">Mi Portfolio (Binance)</h3>
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

        {/* Columna Derecha: Posiciones Abiertas y Historial */}
        <div className="lg:col-span-2 space-y-6">
          {/* Posiciones Abiertas en MetaTrader / Binance */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80">
            <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
              <h2 className="font-semibold text-white">Posiciones Activas (Trading Engine)</h2>
              <span className="rounded-full bg-gold/10 px-2.5 py-0.5 text-xs font-semibold text-gold">
                {positions.length} activas
              </span>
            </div>

            {positions.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-zinc-500">
                No hay posiciones abiertas en brokers conectados actualmente
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                      <th className="px-6 py-3 font-medium">Broker</th>
                      <th className="px-6 py-3 font-medium">Ticket</th>
                      <th className="px-6 py-3 font-medium">Símbolo</th>
                      <th className="px-6 py-3 font-medium">Tipo</th>
                      <th className="px-6 py-3 font-medium">Lote / Cant</th>
                      <th className="px-6 py-3 font-medium">Precio Entrada</th>
                      <th className="px-6 py-3 font-medium">Precio Actual</th>
                      <th className="px-6 py-3 font-medium text-right">Beneficio</th>
                      <th className="px-6 py-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((p) => (
                      <tr key={p.ticket} className="border-b border-zinc-800/50 hover:bg-zinc-900/30">
                        <td className="px-6 py-3 font-semibold text-gold uppercase">
                          {p.broker}
                        </td>
                        <td className="px-6 py-3 text-zinc-400">#{p.ticket}</td>
                        <td className="px-6 py-3 font-bold text-white">{p.symbol}</td>
                        <td className="px-6 py-3">
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs font-bold uppercase ${
                              p.side === "buy"
                                ? "bg-green-500/10 text-green-400"
                                : "bg-red-500/10 text-red-400"
                            }`}
                          >
                            {p.side}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-zinc-300 font-mono">
                          {p.lot ?? p.quantity}
                        </td>
                        <td className="px-6 py-3 text-zinc-300 font-mono">
                          ${Number(p.openPrice).toFixed(p.openPrice < 10 ? 5 : 2)}
                        </td>
                        <td className="px-6 py-3 text-zinc-300 font-mono">
                          ${Number(p.currentPrice).toFixed(p.currentPrice < 10 ? 5 : 2)}
                        </td>
                        <td
                          className={`px-6 py-3 text-right font-bold font-mono ${
                            p.profit >= 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          ${Number(p.profit).toFixed(2)}
                        </td>
                        <td className="px-6 py-3 text-center">
                          <button
                            onClick={() => handleClosePosition(p.broker, p.ticket)}
                            disabled={loading}
                            className="rounded bg-red-600/15 border border-red-600/30 px-2.5 py-1 text-xs font-semibold text-red-400 transition-colors hover:bg-red-600 hover:text-white"
                          >
                            Cerrar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Historial General */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80">
            <div className="border-b border-zinc-800 px-6 py-4">
              <h2 className="font-semibold text-white">Historial de órdenes registradas</h2>
            </div>
            {trades.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-zinc-500">
                No hay historial de órdenes
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                      <th className="px-6 py-3 font-medium">Fecha</th>
                      <th className="px-6 py-3 font-medium">Símbolo</th>
                      <th className="px-6 py-3 font-medium">Tipo</th>
                      <th className="px-6 py-3 font-medium">Cantidad</th>
                      <th className="px-6 py-3 font-medium">Precio</th>
                      <th className="px-6 py-3 font-medium">Total</th>
                      <th className="px-6 py-3 font-medium text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((t) => (
                      <tr key={t.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                        <td className="px-6 py-3 text-zinc-500 text-xs">
                          {new Date(t.createdAt).toLocaleString("es")}
                        </td>
                        <td className="px-6 py-3 font-medium text-white">{formatPair(t.symbol)}</td>
                        <td className="px-6 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${
                              t.type === "buy"
                                ? "bg-green-500/10 text-green-400"
                                : "bg-red-500/10 text-red-400"
                            }`}
                          >
                            {t.type === "buy" ? "Compra" : "Venta"}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-zinc-300 font-mono">{Number(t.quantity).toFixed(6)}</td>
                        <td className="px-6 py-3 text-zinc-300 font-mono">${Number(t.price).toFixed(4)}</td>
                        <td className="px-6 py-3 font-medium text-white font-mono">${Number(t.total).toFixed(2)}</td>
                        <td className="px-6 py-3 text-center">
                          <span className="capitalize text-xs rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-zinc-400">
                            {t.status}
                          </span>
                        </td>
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

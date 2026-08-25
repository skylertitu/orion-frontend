"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import ModuleGate from "@/components/ModuleGate";
import PlanGate from "@/components/PlanGate";
import { api, type BrokerAccountPublic, type StrategyRecord, type StrategyType } from "@/lib/api";
import { toast } from "@/lib/toast";
import { BINANCE_PAIRS } from "@/lib/binance";

const inputClass =
  "w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-gold";

const INTERVALS = ["1m", "5m", "15m", "1h", "4h"];

type FormState = {
  name: string;
  description: string;
  type: StrategyType;
  broker: string;
  brokerAccountId: string;
  symbol: string;
  pairSymbol: string;
  interval: string;
  quantity: string;
  stopLoss: string;
  takeProfit: string;
  rsiPeriod: string;
  rsiOversold: string;
  rsiOverbought: string;
  zEntry: string;
  zExit: string;
  lookback: string;
};

const EMPTY: FormState = {
  name: "",
  description: "",
  type: "indicator_combination",
  broker: "binance",
  brokerAccountId: "",
  symbol: "BTCUSDT",
  pairSymbol: "ETHUSDT",
  interval: "15m",
  quantity: "0.001",
  stopLoss: "2",
  takeProfit: "4",
  rsiPeriod: "14",
  rsiOversold: "30",
  rsiOverbought: "70",
  zEntry: "2",
  zExit: "0.5",
  lookback: "100",
};

function num(value: string, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function buildConfig(form: FormState): Record<string, unknown> {
  const quantity = num(form.quantity, 0.001);
  const base = {
    type: form.type,
    broker: form.broker,
    symbol: form.symbol,
    interval: form.interval,
    quantity,
    stop_loss_pct: num(form.stopLoss, 2),
    take_profit_pct: num(form.takeProfit, 4),
    logic: "AND" as const,
    ...(form.brokerAccountId ? { brokerAccountId: Number(form.brokerAccountId) } : {}),
  };

  if (form.type === "spread_zscore") {
    return {
      ...base,
      pairSymbol: form.pairSymbol,
      lookback: num(form.lookback, 100),
      zscore_entry: num(form.zEntry, 2),
      zscore_exit: num(form.zExit, 0.5),
      indicators: {},
      entryConditions: [],
      exitConditions: [],
    };
  }

  const period = Math.round(num(form.rsiPeriod, 14));
  const oversold = num(form.rsiOversold, 30);
  const overbought = num(form.rsiOverbought, 70);
  return {
    ...base,
    indicators: { rsi: { period, oversold, overbought } },
    entryConditions: [{ indicator: "rsi", operator: "<", value: oversold }],
    exitConditions: [{ indicator: "rsi", operator: ">", value: overbought }],
  };
}

function typeLabel(type: string) {
  if (type === "spread_zscore") return "Spread z-score";
  if (type === "lucy") return "Lucy IA";
  return "Indicadores (RSI)";
}

export default function EstrategiasPage() {
  const [items, setItems] = useState<StrategyRecord[]>([]);
  const [accounts, setAccounts] = useState<BrokerAccountPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const brokerAccounts = useMemo(
    () => accounts.filter((a) => a.brokerId === form.broker && a.status === "connected"),
    [accounts, form.broker]
  );

  async function load() {
    setLoading(true);
    const [strRes, accRes] = await Promise.all([api.strategies.list(), api.brokerAccounts.list()]);
    if (strRes.success && strRes.data) setItems(strRes.data);
    else toast.error(strRes.error || "No se pudieron cargar las estrategias");
    if (accRes.success && accRes.data) setAccounts(accRes.data);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Pon un nombre a la estrategia.");
      return;
    }
    setSaving(true);
    const res = await api.strategies.create({
      name: form.name.trim(),
      description: form.description.trim(),
      config: buildConfig(form),
    });
    if (res.success && res.data) {
      toast.success("Estrategia creada. Actívala para que el worker la ejecute.");
      setForm(EMPTY);
      setItems((prev) => [res.data as StrategyRecord, ...prev]);
    } else {
      toast.error(res.error || "No se pudo crear");
    }
    setSaving(false);
  }

  async function toggle(item: StrategyRecord) {
    const res = await api.strategies.toggle(item.id);
    if (res.success && res.data) {
      setItems((prev) => prev.map((s) => (s.id === item.id ? res.data as StrategyRecord : s)));
      toast.success(res.data.isActive ? "Worker la tomará en el próximo ciclo" : "Estrategia pausada");
    } else {
      toast.error(res.error || "No se pudo cambiar el estado");
    }
  }

  async function remove(item: StrategyRecord) {
    if (!window.confirm(`¿Eliminar “${item.name}”?`)) return;
    const res = await api.strategies.remove(item.id);
    if (res.success) {
      setItems((prev) => prev.filter((s) => s.id !== item.id));
      toast.success("Estrategia eliminada");
    } else {
      toast.error(res.error || "No se pudo eliminar");
    }
  }

  return (
    <ModuleGate moduleId="worker">
      <PlanGate capability="strategies_auto">
      <div className="flex min-h-[calc(100vh-3.5rem)] min-w-0 flex-col gap-6 bg-[#07090e] p-4 text-white sm:p-6">
        <div>
          <h1 className="text-xl font-black text-white">Estrategias</h1>
          <p className="mt-0.5 text-xs text-zinc-400">
            El worker (cada 30s) opera las que estén activas. Lucy no se puede activar todavía.
          </p>
        </div>

        <form
          onSubmit={onCreate}
          className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-5 space-y-4"
        >
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Nueva estrategia</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs text-zinc-400">
              Nombre
              <input className={`${inputClass} mt-1`} value={form.name} onChange={(e) => patch("name", e.target.value)} />
            </label>
            <label className="text-xs text-zinc-400">
              Tipo
              <select className={`${inputClass} mt-1`} value={form.type} onChange={(e) => patch("type", e.target.value as StrategyType)}>
                <option value="indicator_combination">Indicadores (RSI)</option>
                <option value="spread_zscore">Spread z-score</option>
              </select>
            </label>
            <label className="text-xs text-zinc-400">
              Broker
              <select className={`${inputClass} mt-1`} value={form.broker} onChange={(e) => patch("broker", e.target.value)}>
                <option value="binance">Binance</option>
                <option value="bybit">Bybit</option>
                <option value="mt5">MetaTrader 5</option>
              </select>
            </label>
            <label className="text-xs text-zinc-400">
              Cuenta
              <select
                className={`${inputClass} mt-1`}
                value={form.brokerAccountId}
                onChange={(e) => patch("brokerAccountId", e.target.value)}
              >
                <option value="">Primaria del broker</option>
                {brokerAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountName} ({a.executionMode || "demo"})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-zinc-400">
              Símbolo
              <select className={`${inputClass} mt-1`} value={form.symbol} onChange={(e) => patch("symbol", e.target.value)}>
                {BINANCE_PAIRS.map((p) => (
                  <option key={p.symbol} value={p.symbol}>
                    {p.base} — {p.symbol}
                  </option>
                ))}
              </select>
            </label>
            {form.type === "spread_zscore" && (
              <label className="text-xs text-zinc-400">
                Par (spread)
                <select className={`${inputClass} mt-1`} value={form.pairSymbol} onChange={(e) => patch("pairSymbol", e.target.value)}>
                  {BINANCE_PAIRS.map((p) => (
                    <option key={p.symbol} value={p.symbol}>
                      {p.symbol}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-xs text-zinc-400">
              Intervalo
              <select className={`${inputClass} mt-1`} value={form.interval} onChange={(e) => patch("interval", e.target.value)}>
                {INTERVALS.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-zinc-400">
              Cantidad
              <input className={`${inputClass} mt-1`} value={form.quantity} onChange={(e) => patch("quantity", e.target.value)} />
            </label>
            <label className="text-xs text-zinc-400">
              Stop loss %
              <input className={`${inputClass} mt-1`} value={form.stopLoss} onChange={(e) => patch("stopLoss", e.target.value)} />
            </label>
            <label className="text-xs text-zinc-400">
              Take profit %
              <input className={`${inputClass} mt-1`} value={form.takeProfit} onChange={(e) => patch("takeProfit", e.target.value)} />
            </label>
            {form.type === "indicator_combination" ? (
              <>
                <label className="text-xs text-zinc-400">
                  RSI periodo
                  <input className={`${inputClass} mt-1`} value={form.rsiPeriod} onChange={(e) => patch("rsiPeriod", e.target.value)} />
                </label>
                <label className="text-xs text-zinc-400">
                  RSI oversold (entrada)
                  <input className={`${inputClass} mt-1`} value={form.rsiOversold} onChange={(e) => patch("rsiOversold", e.target.value)} />
                </label>
                <label className="text-xs text-zinc-400">
                  RSI overbought (salida)
                  <input className={`${inputClass} mt-1`} value={form.rsiOverbought} onChange={(e) => patch("rsiOverbought", e.target.value)} />
                </label>
              </>
            ) : (
              <>
                <label className="text-xs text-zinc-400">
                  Z-score entrada
                  <input className={`${inputClass} mt-1`} value={form.zEntry} onChange={(e) => patch("zEntry", e.target.value)} />
                </label>
                <label className="text-xs text-zinc-400">
                  Z-score salida
                  <input className={`${inputClass} mt-1`} value={form.zExit} onChange={(e) => patch("zExit", e.target.value)} />
                </label>
                <label className="text-xs text-zinc-400">
                  Lookback
                  <input className={`${inputClass} mt-1`} value={form.lookback} onChange={(e) => patch("lookback", e.target.value)} />
                </label>
              </>
            )}
          </div>
          <label className="block text-xs text-zinc-400">
            Descripción
            <input className={`${inputClass} mt-1`} value={form.description} onChange={(e) => patch("description", e.target.value)} />
          </label>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-gold px-5 py-2 text-xs font-bold text-black hover:bg-gold/90 disabled:opacity-50"
            >
              {saving ? "Creando…" : "Crear estrategia"}
            </button>
          </div>
        </form>

        <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-5">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-400">
            {loading ? "Cargando…" : `${items.length} estrategia${items.length === 1 ? "" : "s"}`}
          </h2>
          {items.length === 0 && !loading ? (
            <p className="text-sm text-zinc-500">Aún no hay estrategias. Crea una para que el worker pueda operar.</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => {
                const cfg = item.config || {};
                const lucyBlocked = cfg.type === "lucy";
                return (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-white">{item.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          item.isActive
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-zinc-800 text-zinc-400"
                        }`}>
                          {item.isActive ? "ACTIVA" : "PAUSADA"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-500">
                        {typeLabel(cfg.type || "")} · {cfg.broker} · {cfg.symbol}
                        {cfg.pairSymbol ? `/${cfg.pairSymbol}` : ""} · {cfg.interval || "1m"} · qty {cfg.quantity ?? "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void toggle(item)}
                        disabled={lucyBlocked && !item.isActive}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 hover:border-gold hover:text-gold disabled:opacity-40"
                      >
                        {item.isActive ? "Pausar" : lucyBlocked ? "Lucy pendiente" : "Activar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(item)}
                        className="rounded-lg border border-red-500/30 px-3 py-1.5 text-[11px] font-semibold text-red-400 hover:bg-red-500/10"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </PlanGate>
    </ModuleGate>
  );
}

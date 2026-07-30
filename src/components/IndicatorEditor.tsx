"use client";

import { useEffect, useState } from "react";
import { IndicatorValues } from "@/lib/indicators";

export const DEFAULT_INDICATOR_VALUES: IndicatorValues = {
  rsi: { period: 14, overbought: 70, oversold: 30 },
  ema: { fast: 20, slow: 50 },
  sma: { period: 20 },
  macd: { fast: 12, slow: 26, signal: 9 },
};

interface IndicatorEditorProps {
  values: IndicatorValues;
  onChange: (newValues: IndicatorValues) => void;
}

export default function IndicatorEditor({ values, onChange }: IndicatorEditorProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const updateRsi = (field: keyof NonNullable<IndicatorValues["rsi"]>, val: number) => {
    onChange({
      ...values,
      rsi: {
        ...(values.rsi || DEFAULT_INDICATOR_VALUES.rsi!),
        [field]: val,
      },
    });
  };

  const updateEma = (field: keyof NonNullable<IndicatorValues["ema"]>, val: number) => {
    onChange({
      ...values,
      ema: {
        ...(values.ema || DEFAULT_INDICATOR_VALUES.ema!),
        [field]: val,
      },
    });
  };

  const updateMacd = (field: keyof NonNullable<IndicatorValues["macd"]>, val: number) => {
    onChange({
      ...values,
      macd: {
        ...(values.macd || DEFAULT_INDICATOR_VALUES.macd!),
        [field]: val,
      },
    });
  };

  const updateSma = (val: number) => {
    onChange({
      ...values,
      sma: { period: val },
    });
  };

  const resetAll = () => {
    onChange(DEFAULT_INDICATOR_VALUES);
  };

  const rsi = values.rsi || DEFAULT_INDICATOR_VALUES.rsi!;
  const ema = values.ema || DEFAULT_INDICATOR_VALUES.ema!;
  const macd = values.macd || DEFAULT_INDICATOR_VALUES.macd!;
  const sma = values.sma || DEFAULT_INDICATOR_VALUES.sma!;

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-5 backdrop-blur-md shadow-xl text-white">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div>
          <h2 className="text-base font-bold text-white">Editor de Indicadores Técnicos</h2>
          <p className="text-xs text-zinc-400">Configura y ajusta los parámetros de cálculo</p>
        </div>

        <button
          type="button"
          onClick={resetAll}
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
        >
          Valores por defecto
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* RSI Config */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-emerald-400">RSI (Relative Strength Index)</span>
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
              Activo
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-[10px] text-zinc-400 uppercase">Período</label>
              <input
                type="number"
                min={2}
                max={100}
                value={rsi.period}
                onChange={(e) => updateRsi("period", parseInt(e.target.value) || 14)}
                className="w-full rounded-lg border border-zinc-800 bg-black px-2.5 py-1.5 font-mono text-xs text-white outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-zinc-400 uppercase">Sobrecompra</label>
              <input
                type="number"
                min={50}
                max={95}
                value={rsi.overbought}
                onChange={(e) => updateRsi("overbought", parseInt(e.target.value) || 70)}
                className="w-full rounded-lg border border-zinc-800 bg-black px-2.5 py-1.5 font-mono text-xs text-red-400 outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-zinc-400 uppercase">Sobrevendido</label>
              <input
                type="number"
                min={5}
                max={50}
                value={rsi.oversold}
                onChange={(e) => updateRsi("oversold", parseInt(e.target.value) || 30)}
                className="w-full rounded-lg border border-zinc-800 bg-black px-2.5 py-1.5 font-mono text-xs text-emerald-400 outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* EMA Config */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-blue-400">EMA (Media Móvil Exponencial)</span>
            <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-mono text-blue-300">
              Activo
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[10px] text-zinc-400 uppercase">EMA Rápida</label>
              <input
                type="number"
                min={2}
                max={200}
                value={ema.fast}
                onChange={(e) => updateEma("fast", parseInt(e.target.value) || 20)}
                className="w-full rounded-lg border border-zinc-800 bg-black px-2.5 py-1.5 font-mono text-xs text-white outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-zinc-400 uppercase">EMA Lenta</label>
              <input
                type="number"
                min={5}
                max={300}
                value={ema.slow}
                onChange={(e) => updateEma("slow", parseInt(e.target.value) || 50)}
                className="w-full rounded-lg border border-zinc-800 bg-black px-2.5 py-1.5 font-mono text-xs text-white outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* MACD Config */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-purple-400">MACD (Convergence Divergence)</span>
            <span className="rounded bg-purple-500/20 px-2 py-0.5 text-[10px] font-mono text-purple-300">
              Activo
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-[10px] text-zinc-400 uppercase">Rápida</label>
              <input
                type="number"
                min={2}
                max={100}
                value={macd.fast}
                onChange={(e) => updateMacd("fast", parseInt(e.target.value) || 12)}
                className="w-full rounded-lg border border-zinc-800 bg-black px-2.5 py-1.5 font-mono text-xs text-white outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-zinc-400 uppercase">Lenta</label>
              <input
                type="number"
                min={5}
                max={200}
                value={macd.slow}
                onChange={(e) => updateMacd("slow", parseInt(e.target.value) || 26)}
                className="w-full rounded-lg border border-zinc-800 bg-black px-2.5 py-1.5 font-mono text-xs text-white outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-zinc-400 uppercase">Señal</label>
              <input
                type="number"
                min={2}
                max={50}
                value={macd.signal}
                onChange={(e) => updateMacd("signal", parseInt(e.target.value) || 9)}
                className="w-full rounded-lg border border-zinc-800 bg-black px-2.5 py-1.5 font-mono text-xs text-white outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </div>

        {/* SMA Config */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-amber-400">SMA (Media Móvil Simple)</span>
            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-mono text-amber-300">
              Activo
            </span>
          </div>

          <div>
            <label className="mb-1 block text-[10px] text-zinc-400 uppercase">Período SMA</label>
            <input
              type="number"
              min={2}
              max={200}
              value={sma.period}
              onChange={(e) => updateSma(parseInt(e.target.value) || 20)}
              className="w-full rounded-lg border border-zinc-800 bg-black px-2.5 py-1.5 font-mono text-xs text-white outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

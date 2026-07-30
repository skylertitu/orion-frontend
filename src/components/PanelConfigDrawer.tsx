"use client";

import { useEffect, useState } from "react";

export interface PanelConfig {
  showLucy: boolean;
  showMarketsIndicators: boolean;
  showChart: boolean;
  layoutMode: "3-col" | "2-col" | "stacked";
}

export const DEFAULT_PANEL_CONFIG: PanelConfig = {
  showLucy: true,
  showMarketsIndicators: true,
  showChart: true,
  layoutMode: "3-col",
};

interface PanelConfigDrawerProps {
  config: PanelConfig;
  onChange: (newConfig: PanelConfig) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function PanelConfigDrawer({
  config,
  onChange,
  isOpen,
  onClose,
}: PanelConfigDrawerProps) {
  if (!isOpen) return null;

  function togglePanel(key: keyof Omit<PanelConfig, "layoutMode">) {
    onChange({
      ...config,
      [key]: !config[key],
    });
  }

  function setLayout(mode: PanelConfig["layoutMode"]) {
    onChange({
      ...config,
      layoutMode: mode,
    });
  }

  function resetDefault() {
    onChange(DEFAULT_PANEL_CONFIG);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-label="Cerrar modal"
      />
      
      <div className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-950 p-6 text-white shadow-2xl transition-transform duration-300 ease-in-out">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10 text-gold border border-gold/20">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Configurar Paneles</h2>
              <p className="text-xs text-zinc-400">Personaliza la visibilidad y diseño</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6 overflow-y-auto py-6">
          {/* Section 1: Checkboxes for 3 Panels */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Visibilidad de Paneles ("Vistos")
            </h3>
            <div className="space-y-3">
              {/* Panel 1: Lucy */}
              <label
                onClick={() => togglePanel("showLucy")}
                className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all ${
                  config.showLucy
                    ? "border-purple-500/40 bg-purple-500/10 text-white"
                    : "border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      config.showLucy ? "bg-purple-500/20 text-purple-400" : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Panel 1: Conexión Lucy</div>
                    <div className="text-xs text-zinc-400">Estado de bot Lucy, latencia y señales IA</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.showLucy}
                  onChange={() => {}}
                  className="h-5 w-5 rounded border-zinc-700 bg-zinc-900 text-purple-600 focus:ring-purple-500"
                />
              </label>

              {/* Panel 2: Markets & Indicators */}
              <label
                onClick={() => togglePanel("showMarketsIndicators")}
                className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all ${
                  config.showMarketsIndicators
                    ? "border-emerald-500/40 bg-emerald-500/10 text-white"
                    : "border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      config.showMarketsIndicators ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Panel 2: Indicadores y Mercados</div>
                    <div className="text-xs text-zinc-400">Pares en vivo, RSI, EMA, MACD y SMA</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.showMarketsIndicators}
                  onChange={() => {}}
                  className="h-5 w-5 rounded border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-emerald-500"
                />
              </label>

              {/* Panel 3: Live Chart */}
              <label
                onClick={() => togglePanel("showChart")}
                className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all ${
                  config.showChart
                    ? "border-gold/40 bg-gold/10 text-white"
                    : "border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      config.showChart ? "bg-gold/20 text-gold" : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Panel 3: La Gráfica</div>
                    <div className="text-xs text-zinc-400">Velas en vivo, volumen y temporalidades</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.showChart}
                  onChange={() => {}}
                  className="h-5 w-5 rounded border-zinc-700 bg-zinc-900 text-gold focus:ring-gold"
                />
              </label>
            </div>
          </div>

          {/* Section 2: Layout mode selector */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Distribución de Disposición
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setLayout("3-col")}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-3 text-xs font-medium transition-colors ${
                  config.layoutMode === "3-col"
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
                }`}
              >
                <div className="flex gap-1">
                  <div className="h-5 w-2 rounded-xs bg-current opacity-80" />
                  <div className="h-5 w-2 rounded-xs bg-current opacity-80" />
                  <div className="h-5 w-2 rounded-xs bg-current opacity-80" />
                </div>
                <span>3 Columnas</span>
              </button>

              <button
                type="button"
                onClick={() => setLayout("2-col")}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-3 text-xs font-medium transition-colors ${
                  config.layoutMode === "2-col"
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
                }`}
              >
                <div className="flex gap-1">
                  <div className="h-5 w-3 rounded-xs bg-current opacity-80" />
                  <div className="h-5 w-4 rounded-xs bg-current opacity-80" />
                </div>
                <span>2 Columnas</span>
              </button>

              <button
                type="button"
                onClick={() => setLayout("stacked")}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-3 text-xs font-medium transition-colors ${
                  config.layoutMode === "stacked"
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
                }`}
              >
                <div className="flex flex-col gap-1">
                  <div className="h-1.5 w-6 rounded-xs bg-current opacity-80" />
                  <div className="h-1.5 w-6 rounded-xs bg-current opacity-80" />
                  <div className="h-1.5 w-6 rounded-xs bg-current opacity-80" />
                </div>
                <span>Apilado</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
          <button
            type="button"
            onClick={resetDefault}
            className="text-xs text-zinc-400 hover:text-white hover:underline"
          >
            Restablecer por defecto
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-black hover:bg-gold-light"
          >
            Guardar y Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}

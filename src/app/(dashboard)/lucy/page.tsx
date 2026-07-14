"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, LucyAnalysis } from "@/lib/api";
import { parseKlines } from "@/components/MarketChart";
import LucyChart from "@/components/LucyChart";
import { BINANCE_PAIRS, DEFAULT_SYMBOL, formatPair } from "@/lib/binance";
import {
  computeLatestIndicators,
  type IndicatorValues,
} from "@/lib/indicators";

const inputClass =
  "w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20";

const smallInputClass =
  "w-full rounded-lg border border-zinc-800 bg-black px-2 py-1.5 text-xs text-white outline-none focus:border-gold";

const trendLabels = {
  bullish: { label: "Alcista", color: "text-green-400 bg-green-500/10 border-green-500/30" },
  bearish: { label: "Bajista", color: "text-red-400 bg-red-500/10 border-red-500/30" },
  neutral: { label: "Neutral", color: "text-zinc-400 bg-zinc-800 border-zinc-700" },
};

const actionLabels = {
  buy: { label: "Comprar", color: "bg-green-500/10 text-green-400" },
  sell: { label: "Vender", color: "bg-red-500/10 text-red-400" },
  hold: { label: "Mantener", color: "bg-zinc-800 text-zinc-400" },
};

const DEFAULT_SCRIPT = `// Estrategia personalizada para Lucy
// Variables disponibles: rsi, ema_fast, ema_slow, sma, macd

if (rsi < 30 && close > ema_fast) {
  signal = "buy"
} else if (rsi > 70 && close < ema_slow) {
  signal = "sell"
} else {
  signal = "hold"
}`;

type SidePanel = "indicators" | "code";

export default function LucyPage() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [timeframe, setTimeframe] = useState("1h");
  const [klines, setKlines] = useState<ReturnType<typeof parseKlines>>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [panel, setPanel] = useState<SidePanel>("indicators");
  const [alive, setAlive] = useState<boolean | null>(null);
  const [analysis, setAnalysis] = useState<LucyAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [useRsi, setUseRsi] = useState(true);
  const [rsiPeriod, setRsiPeriod] = useState("14");
  const [rsiOverbought, setRsiOverbought] = useState("70");
  const [rsiOversold, setRsiOversold] = useState("30");

  const [useEma, setUseEma] = useState(true);
  const [emaFast, setEmaFast] = useState("9");
  const [emaSlow, setEmaSlow] = useState("21");

  const [useSma, setUseSma] = useState(false);
  const [smaPeriod, setSmaPeriod] = useState("50");

  const [useMacd, setUseMacd] = useState(false);
  const [macdFast, setMacdFast] = useState("12");
  const [macdSlow, setMacdSlow] = useState("26");
  const [macdSignal, setMacdSignal] = useState("9");

  const [levels, setLevels] = useState<{ label: string; price: string; type: "support" | "resistance" }[]>([
    { label: "Soporte 1", price: "", type: "support" },
    { label: "Resistencia 1", price: "", type: "resistance" },
  ]);

  const [script, setScript] = useState(DEFAULT_SCRIPT);

  const indicatorConfig = useMemo((): IndicatorValues => {
    const config: IndicatorValues = {};
    if (useRsi) {
      config.rsi = {
        period: Number(rsiPeriod),
        overbought: Number(rsiOverbought),
        oversold: Number(rsiOversold),
      };
    }
    if (useEma) {
      config.ema = { fast: Number(emaFast), slow: Number(emaSlow) };
    }
    if (useSma) {
      config.sma = { period: Number(smaPeriod) };
    }
    if (useMacd) {
      config.macd = {
        fast: Number(macdFast),
        slow: Number(macdSlow),
        signal: Number(macdSignal),
      };
    }
    const validLevels = levels
      .filter((l) => l.price && !isNaN(Number(l.price)))
      .map((l) => ({
        label: l.label,
        price: Number(l.price),
        type: l.type,
      }));
    if (validLevels.length) config.levels = validLevels;
    return config;
  }, [
    useRsi, rsiPeriod, rsiOverbought, rsiOversold,
    useEma, emaFast, emaSlow,
    useSma, smaPeriod,
    useMacd, macdFast, macdSlow, macdSignal,
    levels,
  ]);

  const computed = useMemo(() => {
    if (!klines.length) return null;
    return computeLatestIndicators(
      klines.map((k) => k.close),
      indicatorConfig
    );
  }, [klines, indicatorConfig]);

  const loadChart = useCallback(async () => {
    setChartLoading(true);
    try {
      const res = await fetch(
        `/api/market/klines?symbol=${symbol}&interval=${timeframe}&limit=100`
      );
      if (res.ok) {
        setKlines(parseKlines(await res.json()));
      }
    } catch {
      // silent
    }
    setChartLoading(false);
  }, [symbol, timeframe]);

  const checkHealth = useCallback(async () => {
    const res = await api.lucy.health();
    setAlive(res.success && res.data?.alive === true);
  }, []);

  useEffect(() => {
    loadChart();
  }, [loadChart]);

  useEffect(() => {
    checkHealth();
    const timer = window.setInterval(checkHealth, 30000);
    return () => window.clearInterval(timer);
  }, [checkHealth]);

  function buildPayload() {
    const ohlcv = klines.map((k) => [k.time, k.open, k.high, k.low, k.close]);
    return {
      symbol,
      interval: timeframe,
      data: ohlcv,
      indicators: { ...indicatorConfig, computed },
      script: script.trim() || undefined,
    };
  }

  async function handleAnalyze() {
    if (!klines.length) {
      setError("Carga la gráfica antes de analizar");
      return;
    }
    setLoading(true);
    setError("");
    setAnalysis(null);

    const res = await api.lucy.analyze(buildPayload());
    if (res.success && res.data) {
      setAnalysis(res.data);
    } else {
      setError(res.error || "Lucy no pudo analizar el mercado");
    }
    setLoading(false);
  }

  async function handleSignals() {
    setLoading(true);
    setError("");
    setAnalysis(null);

    const res = await api.lucy.signals(symbol);
    if (res.success && res.data) {
      setAnalysis(res.data);
    } else {
      setError(res.error || "No se pudieron obtener señales de Lucy");
    }
    setLoading(false);
  }

  function addLevel(type: "support" | "resistance") {
    const count = levels.filter((l) => l.type === type).length + 1;
    setLevels([
      ...levels,
      {
        label: type === "support" ? `Soporte ${count}` : `Resistencia ${count}`,
        price: "",
        type,
      },
    ]);
  }

  function updateLevel(index: number, field: "label" | "price", value: string) {
    setLevels(levels.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  function removeLevel(index: number) {
    setLevels(levels.filter((_, i) => i !== index));
  }

  const trend = analysis ? trendLabels[analysis.trend] : null;

  return (
    <div className="flex w-full flex-col gap-6 p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Lucy AI</h1>
          <p className="text-sm text-zinc-500">Gráfica con indicadores y código personalizado</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/80 px-3 py-1.5 text-xs text-zinc-400">
          <span
            className={`h-2 w-2 rounded-full ${
              alive === null ? "bg-zinc-600" : alive ? "bg-green-500" : "bg-red-500"
            }`}
          />
          {alive === null ? "Verificando..." : alive ? "Lucy conectada" : "Lucy desconectada"}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Par
          </label>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className={inputClass}>
            <optgroup label="Principales">
              {BINANCE_PAIRS.filter((p) => p.network !== "solana").map((p) => (
                <option key={p.symbol} value={p.symbol}>
                  {formatPair(p.symbol)}
                </option>
              ))}
            </optgroup>
            <optgroup label="Solana">
              {BINANCE_PAIRS.filter((p) => p.network === "solana").map((p) => (
                <option key={p.symbol} value={p.symbol}>
                  {formatPair(p.symbol)}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Intervalo
          </label>
          <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} className={inputClass}>
            <option value="15m">15m</option>
            <option value="1h">1h</option>
            <option value="4h">4h</option>
            <option value="1d">1d</option>
          </select>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-black hover:bg-gold-light disabled:opacity-50"
        >
          {loading ? "Analizando..." : "Analizar con Lucy"}
        </button>
        <button
          onClick={handleSignals}
          disabled={loading}
          className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
        >
          Obtener señales
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {chartLoading ? (
            <div className="flex h-[420px] items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/80 text-zinc-500">
              Cargando gráfica...
            </div>
          ) : (
            <LucyChart
              data={klines}
              symbol={formatPair(symbol)}
              indicators={indicatorConfig}
            />
          )}
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80">
          <div className="flex border-b border-zinc-800">
            {(["indicators", "code"] as SidePanel[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setPanel(tab)}
                className={`flex-1 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  panel === tab
                    ? "border-b-2 border-gold text-gold"
                    : "text-zinc-500 hover:text-white"
                }`}
              >
                {tab === "indicators" ? "Indicadores" : "Código"}
              </button>
            ))}
          </div>

          <div className="max-h-[420px] overflow-y-auto p-4">
            {panel === "indicators" && (
              <div className="space-y-5">
                <section>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
                    <input type="checkbox" checked={useRsi} onChange={(e) => setUseRsi(e.target.checked)} className="accent-gold" />
                    RSI
                  </label>
                  {useRsi && (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-xs text-zinc-500">Periodo</span>
                        <input value={rsiPeriod} onChange={(e) => setRsiPeriod(e.target.value)} className={smallInputClass} />
                      </div>
                      <div>
                        <span className="text-xs text-zinc-500">Sobrecompra</span>
                        <input value={rsiOverbought} onChange={(e) => setRsiOverbought(e.target.value)} className={smallInputClass} />
                      </div>
                      <div>
                        <span className="text-xs text-zinc-500">Sobreventa</span>
                        <input value={rsiOversold} onChange={(e) => setRsiOversold(e.target.value)} className={smallInputClass} />
                      </div>
                    </div>
                  )}
                  {useRsi && computed?.rsi !== null && computed?.rsi !== undefined && (
                    <div className="mt-2 text-xs text-zinc-400">
                      Valor actual: <span className="font-medium text-white">{computed.rsi.toFixed(2)}</span>
                    </div>
                  )}
                </section>

                <section>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
                    <input type="checkbox" checked={useEma} onChange={(e) => setUseEma(e.target.checked)} className="accent-gold" />
                    EMA
                  </label>
                  {useEma && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-xs text-zinc-500">Rápida</span>
                        <input value={emaFast} onChange={(e) => setEmaFast(e.target.value)} className={smallInputClass} />
                      </div>
                      <div>
                        <span className="text-xs text-zinc-500">Lenta</span>
                        <input value={emaSlow} onChange={(e) => setEmaSlow(e.target.value)} className={smallInputClass} />
                      </div>
                    </div>
                  )}
                  {useEma && computed && (
                    <div className="mt-2 space-y-1 text-xs text-zinc-400">
                      {computed.emaFast !== null && (
                        <div>EMA {emaFast}: <span className="text-gold">{computed.emaFast.toFixed(4)}</span></div>
                      )}
                      {computed.emaSlow !== null && (
                        <div>EMA {emaSlow}: <span className="text-indigo-400">{computed.emaSlow.toFixed(4)}</span></div>
                      )}
                    </div>
                  )}
                </section>

                <section>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
                    <input type="checkbox" checked={useSma} onChange={(e) => setUseSma(e.target.checked)} className="accent-gold" />
                    SMA
                  </label>
                  {useSma && (
                    <input value={smaPeriod} onChange={(e) => setSmaPeriod(e.target.value)} className={smallInputClass} placeholder="Periodo" />
                  )}
                  {useSma && computed?.sma !== null && computed?.sma !== undefined && (
                    <div className="mt-2 text-xs text-zinc-400">
                      Valor actual: <span className="text-sky-400">{computed.sma.toFixed(4)}</span>
                    </div>
                  )}
                </section>

                <section>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
                    <input type="checkbox" checked={useMacd} onChange={(e) => setUseMacd(e.target.checked)} className="accent-gold" />
                    MACD
                  </label>
                  {useMacd && (
                    <div className="grid grid-cols-3 gap-2">
                      <input value={macdFast} onChange={(e) => setMacdFast(e.target.value)} className={smallInputClass} placeholder="Fast" />
                      <input value={macdSlow} onChange={(e) => setMacdSlow(e.target.value)} className={smallInputClass} placeholder="Slow" />
                      <input value={macdSignal} onChange={(e) => setMacdSignal(e.target.value)} className={smallInputClass} placeholder="Signal" />
                    </div>
                  )}
                  {useMacd && computed?.macd && (
                    <div className="mt-2 space-y-1 text-xs text-zinc-400">
                      <div>MACD: <span className="text-white">{computed.macd.macd.toFixed(4)}</span></div>
                      <div>Señal: <span className="text-white">{computed.macd.signal.toFixed(4)}</span></div>
                      <div>Histograma: <span className={computed.macd.histogram >= 0 ? "text-green-400" : "text-red-400"}>{computed.macd.histogram.toFixed(4)}</span></div>
                    </div>
                  )}
                </section>

                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-white">Niveles en gráfica</span>
                    <div className="flex gap-1">
                      <button onClick={() => addLevel("support")} className="rounded px-2 py-0.5 text-xs text-green-400 hover:bg-green-500/10">+ Soporte</button>
                      <button onClick={() => addLevel("resistance")} className="rounded px-2 py-0.5 text-xs text-red-400 hover:bg-red-500/10">+ Resistencia</button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {levels.map((level, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          value={level.label}
                          onChange={(e) => updateLevel(i, "label", e.target.value)}
                          className={`${smallInputClass} flex-1`}
                          placeholder="Nombre"
                        />
                        <input
                          value={level.price}
                          onChange={(e) => updateLevel(i, "price", e.target.value)}
                          className={`${smallInputClass} w-24`}
                          placeholder="Precio"
                          type="number"
                          step="any"
                        />
                        <button onClick={() => removeLevel(i)} className="text-xs text-zinc-600 hover:text-red-400">×</button>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {panel === "code" && (
              <div className="space-y-3">
                <p className="text-xs text-zinc-500">
                  Escribe tu lógica de trading. Lucy recibirá este código junto con los indicadores.
                </p>
                <textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  rows={16}
                  spellCheck={false}
                  className="w-full resize-none rounded-lg border border-zinc-800 bg-black p-3 font-mono text-xs leading-relaxed text-green-400 outline-none focus:border-gold"
                />
                <button
                  onClick={() => setScript(DEFAULT_SCRIPT)}
                  className="text-xs text-zinc-500 hover:text-gold"
                >
                  Restaurar plantilla
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {!alive && alive !== null && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          Lucy no está disponible. Los indicadores y la gráfica funcionan, pero el análisis remoto requiere el servicio en{" "}
          <code className="text-xs">localhost:5000</code>.
        </div>
      )}

      {analysis && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 lg:col-span-1">
            <h2 className="mb-4 font-semibold text-white">Resumen Lucy</h2>
            {trend && (
              <div className={`mb-4 inline-flex rounded-lg border px-3 py-1.5 text-sm font-medium ${trend.color}`}>
                Tendencia {trend.label}
              </div>
            )}
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Soporte</span>
                <span className="font-medium text-white">${analysis.support?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Resistencia</span>
                <span className="font-medium text-white">${analysis.resistance?.toLocaleString()}</span>
              </div>
            </div>
            {analysis.patterns?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {analysis.patterns.map((p) => (
                  <span key={p} className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 lg:col-span-2">
            <div className="border-b border-zinc-800 px-6 py-4">
              <h2 className="font-semibold text-white">Señales</h2>
            </div>
            {!analysis.signals?.length ? (
              <div className="px-6 py-12 text-center text-sm text-zinc-500">Sin señales</div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {analysis.signals.map((signal, i) => {
                  const action = actionLabels[signal.action];
                  return (
                    <div key={i} className="flex items-center justify-between px-6 py-4">
                      <div>
                        <div className="font-medium text-white">{signal.symbol}</div>
                        <div className="text-xs text-zinc-500">
                          {new Date(signal.timestamp).toLocaleString("es")}
                        </div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${action.color}`}>
                        {action.label}
                      </span>
                      <div className="text-right">
                        <div className="text-sm font-medium text-white">{signal.confidence}%</div>
                        <div className="text-xs text-zinc-500">confianza</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

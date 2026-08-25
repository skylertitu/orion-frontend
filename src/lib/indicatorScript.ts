import {
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSMA,
} from "@/lib/indicators";
import { sessionBoxes, sessionLevels } from "@/lib/sessionMath";

export type IndicatorCategory = "trend" | "oscillator" | "sessions" | "volume" | "custom";

export const INDICATOR_CATEGORIES: Array<{ id: IndicatorCategory; label: string }> = [
  { id: "trend", label: "Tendencia" },
  { id: "oscillator", label: "Osciladores" },
  { id: "sessions", label: "Sesiones" },
  { id: "volume", label: "Volumen" },
  { id: "custom", label: "Personalizado" },
];

export type IndicatorScript = {
  id: string;
  name: string;
  enabled: boolean;
  source: string;
  category?: IndicatorCategory;
  blocked?: boolean;
  sourceHash?: string;
};

export type ScriptPlot = {
  title: string;
  color: string;
  values: (number | null)[];
  style: "line" | "histogram";
  lineWidth: number;
};

export type ScriptHLine = {
  price: number;
  color: string;
  title?: string;
};

export type ScriptBox = {
  time1: number;
  time2: number;
  high: number;
  low: number;
  color: string;
  title?: string;
};

export type ScriptRay = {
  time1: number;
  time2: number;
  price: number;
  color: string;
  lineWidth: number;
  dashed?: boolean;
  title?: string;
};

export type ScriptResult = {
  id: string;
  title: string;
  overlay: boolean;
  plots: ScriptPlot[];
  hlines: ScriptHLine[];
  boxes: ScriptBox[];
  rays: ScriptRay[];
  error?: string;
};

const STORAGE_KEY = "orion_indicator_scripts_v1";

export const HAGAMOS_SCRIPT = `indicator("Hagamos Profits 3.0", { overlay: true })
const tz = input(-3, "UTC")

const sessions = [
  { name: "Frankfurt", sess: "0300-0305", color: "#ffe500" },
  { name: "Apertura Londres", sess: "0400-0501", color: "#e90000" },
  { name: "HM 1", sess: "0530-0540", color: "#0064ff" },
  { name: "HM 2", sess: "0730-0740", color: "#f57f17" },
  { name: "Trampa NY", sess: "1000-1101", color: "#00cbff" },
  { name: "Cierre Londres", sess: "1155-1206", color: "#c0c0c0" },
  { name: "Asia", sess: "1800-0201", color: "#7622ff" },
]

for (const s of sessions) {
  for (const r of ta.sessionBoxes(s.sess, tz)) {
    box(r.time1, r.time2, r.high, r.low, { color: s.color, title: s.name })
  }
}

for (const r of ta.sessionLevels("1800-0201", tz, "0300-0401")) {
  ray(r.time1, r.time2, r.high, { color: "#7622ff", title: "Asia High" })
  ray(r.time1, r.time2, r.low, { color: "#7622ff", title: "Asia Low" })
  ray(r.time1, r.time2, (r.high + r.low) / 2, { color: "#f23645", dashed: true, title: "Asia 50%" })
  ray(r.time1, r.time2, r.open, { color: "#00bcd4", title: "Asia Open" })
}
`;

export const BLANK_SCRIPT = `// Indicador Orion — JavaScript
indicator("Mi indicador", { overlay: true })
plot(ta.ema(close, 21), { title: "EMA 21", color: "#d4a843" })
`;

export const DEFAULT_SCRIPTS: IndicatorScript[] = [
  {
    id: "hagamos",
    name: "Hagamos Profits 3.0",
    enabled: true,
    category: "sessions",
    source: HAGAMOS_SCRIPT,
  },
  {
    id: "ema",
    name: "EMA",
    enabled: true,
    category: "trend",
    source: `indicator("EMA", { overlay: true })
plot(ta.ema(close, 20), { title: "EMA 20", color: "#d4a843" })
plot(ta.ema(close, 50), { title: "EMA 50", color: "#818cf8" })
`,
  },
  {
    id: "sma",
    name: "SMA",
    enabled: false,
    category: "trend",
    source: `indicator("SMA", { overlay: true })
plot(ta.sma(close, 20), { title: "SMA 20", color: "#38bdf8" })
`,
  },
  {
    id: "rsi",
    name: "RSI",
    enabled: true,
    category: "oscillator",
    source: `indicator("RSI", { overlay: false })
const length = input(14, "Length")
plot(ta.rsi(close, length), { title: "RSI", color: "#f0d080" })
hline(70, { color: "#f23645", title: "OB" })
hline(30, { color: "#089981", title: "OS" })
`,
  },
  {
    id: "macd",
    name: "MACD",
    enabled: true,
    category: "oscillator",
    source: `indicator("MACD", { overlay: false })
const m = ta.macd(close, 12, 26, 9)
plot(m.histogram, { title: "Hist", style: "histogram" })
plot(m.macd, { title: "MACD", color: "#60a5fa" })
plot(m.signal, { title: "Signal", color: "#f97316" })
`,
  },
];

export function inferIndicatorCategory(name: string, source: string): IndicatorCategory {
  const blob = `${name}\n${source}`.toLowerCase();
  if (looksLikeHagamosProfits(source) || /sessionboxes|sessionlevels/.test(blob)) return "sessions";
  if (/\b(rsi|macd|stoch|cci)\b/.test(blob)) return "oscillator";
  if (/\b(obv|mfi|volume)\b/.test(blob) && !/\b(ema|sma)\b/.test(blob)) return "volume";
  if (/\b(ema|sma|wma|bollinger|supertrend|ichimoku)\b/.test(blob)) return "trend";
  if (/\b(obv|mfi|vwap)\b/.test(blob)) return "volume";
  return "custom";
}

export function normalizeIndicatorCategory(raw: unknown, name: string, source: string): IndicatorCategory {
  if (raw === "trend" || raw === "oscillator" || raw === "sessions" || raw === "volume" || raw === "custom") {
    return raw;
  }
  return inferIndicatorCategory(name, source);
}

export function indicatorCategoryLabel(category: IndicatorCategory | undefined, name = "", source = ""): string {
  const id = normalizeIndicatorCategory(category, name, source);
  return INDICATOR_CATEGORIES.find((c) => c.id === id)?.label || "Personalizado";
}

function normalizeScript(raw: Partial<IndicatorScript>, fallbackId: string): IndicatorScript | null {
  if (!raw || typeof raw.source !== "string" || raw.source.length >= 200_000) return null;
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Indicador";
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : fallbackId,
    name,
    enabled: raw.enabled !== false && raw.blocked !== true,
    blocked: raw.blocked === true,
    sourceHash: typeof raw.sourceHash === "string" ? raw.sourceHash : undefined,
    source: raw.source,
    category: normalizeIndicatorCategory(raw.category, name, raw.source),
  };
}

export function newIndicatorScript(overrides?: Partial<IndicatorScript>): IndicatorScript {
  const source = overrides?.source ?? BLANK_SCRIPT;
  const name = overrides?.name ?? "Nuevo indicador";
  return {
    id: `script_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    enabled: true,
    ...overrides,
    name,
    source,
    category: normalizeIndicatorCategory(overrides?.category, name, source),
  };
}

export function loadIndicatorScripts(): IndicatorScript[] {
  if (typeof window === "undefined") return DEFAULT_SCRIPTS.map((s) => ({ ...s }));
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SCRIPTS.map((s) => ({ ...s }));
    const parsed = JSON.parse(raw) as Partial<IndicatorScript>[];
    if (!Array.isArray(parsed)) return DEFAULT_SCRIPTS.map((s) => ({ ...s }));
    const list = migrateIndicatorScripts(
      parsed
        .map((item, index) => normalizeScript(item, `script_loaded_${index}`))
        .filter((item): item is IndicatorScript => item != null)
    );
    const serialized = JSON.stringify(list);
    if (serialized !== raw) saveIndicatorScripts(list);
    return list;
  } catch {
    return DEFAULT_SCRIPTS.map((s) => ({ ...s }));
  }
}

export function saveIndicatorScripts(scripts: IndicatorScript[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
  } catch {
    /* ignore */
  }
}

function rolling(src: number[], length: number, fn: (slice: number[]) => number): (number | null)[] {
  const len = Math.max(1, Math.floor(length));
  return src.map((_, i) => {
    if (i < len - 1) return null;
    return fn(src.slice(i - len + 1, i + 1));
  });
}

function asSeries(value: unknown, length: number): (number | null)[] {
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : null));
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Array.from({ length }, () => value);
  }
  return Array.from({ length }, () => null);
}

export function looksLikeHagamosProfits(source: string): boolean {
  return /Hagamos Profits|ictbox\s*\(|@FF42|Trampa NY|Trampa de NY|sessionLevels\(|ta\.sessionBoxes\(/i.test(
    source
  );
}

export function looksLikePineScript(source: string): boolean {
  if (looksLikeHagamosProfits(source) && /ta\.sessionBoxes|indicator\("Hagamos Profits 3\.0", \{ overlay/.test(source)) {
    return false;
  }
  const s = source;
  if (/\/\/\s*@version\s*=/.test(s)) return true;
  if (/\binput\.(session|bool|int|color|string|source)\s*\(/.test(s)) return true;
  if (/\b(plotshape|bgcolor|box\.new|line\.new|table\.new|request\.security|barstate\.|timeframe\.)\b/.test(s)) return true;
  if (/\w+\s*\([^)]*\)\s*=>/.test(s)) return true;
  if (/\b:=\s*/.test(s) && /\b(na|nz|not na|var\s+(line|box|label|float|int))\b/.test(s)) return true;
  return false;
}

export function migrateIndicatorScripts(scripts: IndicatorScript[]): IndicatorScript[] {
  return scripts.map((script) => {
    if (looksLikePineScript(script.source) && looksLikeHagamosProfits(script.source)) {
      return {
        ...script,
        name: /nuevo indicador/i.test(script.name) ? "Hagamos Profits 3.0" : script.name,
        source: HAGAMOS_SCRIPT,
      };
    }
    return script;
  });
}

function pineErrorMessage(): string {
  return "Este código es Pine Script de TradingView. Orion no lo ejecuta: usa JavaScript con plot(), ta.ema(), ta.rsi() y hline().";
}

function friendlyScriptError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Error en el script";
  if (/Malformed arrow function|Unexpected token|Unexpected identifier|missing \) after argument list/i.test(message)) {
    return `${pineErrorMessage()} Detalle: ${message}`;
  }
  return message;
}

const FORBIDDEN_API =
  /\b(localStorage|sessionStorage|indexedDB|document|window|globalThis|fetch|XMLHttpRequest|WebSocket|eval|Function|importScripts|navigator)\b/;

function forbiddenApiError(source: string): string | null {
  if (FORBIDDEN_API.test(source)) {
    return "Este script usa APIs bloqueadas (almacenamiento, red o el navegador).";
  }
  return null;
}

export type IndicatorBar = {
  time?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export function runIndicatorScript(script: IndicatorScript, bars: IndicatorBar[]): ScriptResult {
  const empty = { plots: [] as ScriptPlot[], hlines: [] as ScriptHLine[], boxes: [] as ScriptBox[], rays: [] as ScriptRay[] };
  const source =
    looksLikeHagamosProfits(script.source) && looksLikePineScript(script.source)
      ? HAGAMOS_SCRIPT
      : script.source;

  if (looksLikePineScript(source)) {
    return {
      id: script.id,
      title: script.name || "Script",
      overlay: true,
      ...empty,
      error: pineErrorMessage(),
    };
  }

  const blocked = forbiddenApiError(source);
  if (blocked) {
    return {
      id: script.id,
      title: script.name || "Script",
      overlay: true,
      ...empty,
      error: blocked,
    };
  }

  const n = bars.length;
  const close = bars.map((b) => b.close);
  const open = bars.map((b) => b.open);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const volume = bars.map((b) => b.volume);
  const time = bars.map((b) => b.time ?? 0);
  const barRows = bars.map((b) => ({
    time: b.time ?? 0,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
  }));

  let title = script.name || "Script";
  let overlay = true;
  const plots: ScriptPlot[] = [];
  const hlines: ScriptHLine[] = [];
  const boxes: ScriptBox[] = [];
  const rays: ScriptRay[] = [];

  const ta = {
    sma: (src: number[], length: number) => calculateSMA(asSeries(src, n).map((v) => v ?? 0), length),
    ema: (src: number[], length: number) => calculateEMA(asSeries(src, n).map((v) => v ?? 0), length),
    rsi: (src: number[], length: number) => calculateRSI(asSeries(src, n).map((v) => v ?? 0), length),
    macd: (src: number[], fast = 12, slow = 26, signal = 9) =>
      calculateMACD(asSeries(src, n).map((v) => v ?? 0), fast, slow, signal),
    highest: (src: number[], length: number) => rolling(asSeries(src, n).map((v) => v ?? 0), length, (s) => Math.max(...s)),
    lowest: (src: number[], length: number) => rolling(asSeries(src, n).map((v) => v ?? 0), length, (s) => Math.min(...s)),
    change: (src: number[], length = 1) => {
      const series = asSeries(src, n);
      return series.map((v, i) => {
        const prev = series[i - length];
        if (v == null || prev == null) return null;
        return v - prev;
      });
    },
    sessionBoxes: (sess: string, tz = -3) => sessionBoxes(barRows, sess, tz),
    sessionLevels: (sess: string, tz = -3, extendSess?: string) => sessionLevels(barRows, sess, tz, extendSess),
  };

  const api = {
    indicator: (name: string, opts?: { overlay?: boolean }) => {
      if (name) title = String(name);
      if (opts && opts.overlay === false) overlay = false;
    },
    plot: (series: unknown, opts?: { title?: string; color?: string; style?: string; linewidth?: number }) => {
      const isHist = opts?.style === "histogram";
      plots.push({
        title: opts?.title || "Plot",
        color: opts?.color || (isHist ? "" : "#d4a843"),
        values: asSeries(series, n),
        style: isHist ? "histogram" : "line",
        lineWidth: opts?.linewidth || 2,
      });
    },
    hline: (price: number, opts?: { color?: string; title?: string }) => {
      if (Number.isFinite(price)) {
        hlines.push({ price, color: opts?.color || "#666666", title: opts?.title });
      }
    },
    box: (
      time1: number,
      time2: number,
      boxHigh: number,
      boxLow: number,
      opts?: { color?: string; title?: string }
    ) => {
      if (!Number.isFinite(time1) || !Number.isFinite(time2) || !Number.isFinite(boxHigh) || !Number.isFinite(boxLow)) return;
      boxes.push({
        time1,
        time2,
        high: boxHigh,
        low: boxLow,
        color: opts?.color || "#7622ff",
        title: opts?.title,
      });
    },
    ray: (
      time1: number,
      time2: number,
      price: number,
      opts?: { color?: string; title?: string; linewidth?: number; dashed?: boolean }
    ) => {
      if (!Number.isFinite(time1) || !Number.isFinite(time2) || !Number.isFinite(price)) return;
      rays.push({
        time1,
        time2,
        price,
        color: opts?.color || "#d4a843",
        lineWidth: opts?.linewidth || 2,
        dashed: Boolean(opts?.dashed),
        title: opts?.title,
      });
    },
    input: (value: number) => value,
    ta,
    close,
    open,
    high,
    low,
    volume,
    time,
    color: {
      gold: "#d4a843",
      green: "#089981",
      red: "#f23645",
      blue: "#60a5fa",
      orange: "#f97316",
    },
  };

  try {
    const fn = new Function(
      "indicator",
      "plot",
      "hline",
      "box",
      "ray",
      "input",
      "ta",
      "close",
      "open",
      "high",
      "low",
      "volume",
      "time",
      "color",
      `"use strict";\n${source}`
    );
    fn(
      api.indicator,
      api.plot,
      api.hline,
      api.box,
      api.ray,
      api.input,
      api.ta,
      close,
      open,
      high,
      low,
      volume,
      time,
      api.color
    );
  } catch (err) {
    return {
      id: script.id,
      title,
      overlay,
      ...empty,
      error: friendlyScriptError(err),
    };
  }

  return { id: script.id, title, overlay, plots, hlines, boxes, rays };
}

type WorkerJob = {
  resolve: (results: ScriptResult[]) => void;
  reject: (error: Error) => void;
};

let indicatorWorker: Worker | null = null;
let workerSeq = 0;
const workerJobs = new Map<number, WorkerJob>();

function getIndicatorWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;
  if (indicatorWorker) return indicatorWorker;
  try {
    indicatorWorker = new Worker(new URL("./indicator.worker.ts", import.meta.url), { type: "module" });
    indicatorWorker.onmessage = (event: MessageEvent) => {
      const { id, results, error } = event.data as {
        id: number;
        results?: ScriptResult[];
        error?: string;
      };
      const job = workerJobs.get(id);
      if (!job) return;
      workerJobs.delete(id);
      if (error) job.reject(new Error(error));
      else job.resolve(results || []);
    };
    indicatorWorker.onerror = () => {
      for (const job of workerJobs.values()) {
        job.reject(new Error("El aislador de indicadores falló"));
      }
      workerJobs.clear();
      indicatorWorker?.terminate();
      indicatorWorker = null;
    };
    return indicatorWorker;
  } catch {
    return null;
  }
}

function sandboxFailure(scripts: IndicatorScript[], message: string): ScriptResult[] {
  return scripts.map((script) => ({
    id: script.id,
    title: script.name || "Script",
    overlay: true,
    plots: [],
    hlines: [],
    boxes: [],
    rays: [],
    error: message,
  }));
}

/** Runs indicator scripts in a Web Worker so they cannot touch localStorage or the page. */
export async function runIndicatorScriptsSandboxed(
  scripts: IndicatorScript[],
  bars: IndicatorBar[]
): Promise<ScriptResult[]> {
  const worker = getIndicatorWorker();
  if (!worker) {
    return sandboxFailure(scripts, "No se pudo aislar la ejecución de indicadores");
  }
  const id = ++workerSeq;
  try {
    return await new Promise<ScriptResult[]>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        workerJobs.delete(id);
        reject(new Error("El indicador tardó demasiado"));
      }, 2500);
      workerJobs.set(id, {
        resolve: (results) => {
          window.clearTimeout(timer);
          resolve(results);
        },
        reject: (error) => {
          window.clearTimeout(timer);
          reject(error);
        },
      });
      worker.postMessage({ id, scripts, bars });
    });
  } catch (err: unknown) {
    return sandboxFailure(scripts, err instanceof Error ? err.message : "Error al ejecutar indicadores");
  }
}

export function extraScriptPaneHeight(scripts: IndicatorScript[]): number {
  return scripts.filter((s) => s.enabled).length > 0
    ? scripts.filter((s) => {
        if (!s.enabled) return false;
        const overlayHint = /overlay\s*:\s*false/.test(s.source);
        return overlayHint;
      }).length * 120
    : 0;
}

import { BINANCE_SYMBOLS } from "@/lib/binance";

const STORAGE_KEY = "orion_chart_prefs_v1";

export type ChartStyle = "candles" | "line";

export type ChartPrefs = {
  symbol: string;
  interval: string;
  chartStyle: ChartStyle;
};

const INTERVALS = new Set(["1m", "5m", "15m", "1h", "4h", "1d"]);

export const DEFAULT_CHART_PREFS: ChartPrefs = {
  symbol: "BTCUSDT",
  interval: "15m",
  chartStyle: "candles",
};

function normalizePrefs(raw: Partial<ChartPrefs> | null | undefined): ChartPrefs {
  const symbol =
    typeof raw?.symbol === "string" && BINANCE_SYMBOLS.includes(raw.symbol)
      ? raw.symbol
      : DEFAULT_CHART_PREFS.symbol;
  const interval =
    typeof raw?.interval === "string" && INTERVALS.has(raw.interval)
      ? raw.interval
      : DEFAULT_CHART_PREFS.interval;
  const chartStyle: ChartStyle = raw?.chartStyle === "line" ? "line" : "candles";
  return { symbol, interval, chartStyle };
}

export function loadChartPrefs(): ChartPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_CHART_PREFS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CHART_PREFS };
    return normalizePrefs(JSON.parse(raw) as Partial<ChartPrefs>);
  } catch {
    return { ...DEFAULT_CHART_PREFS };
  }
}

export function saveChartPrefs(patch: Partial<ChartPrefs>): ChartPrefs {
  const next = normalizePrefs({ ...loadChartPrefs(), ...patch });
  if (typeof window === "undefined") return next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
  return next;
}

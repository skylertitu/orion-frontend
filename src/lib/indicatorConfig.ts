import { DEFAULT_INDICATOR_VALUES, type IndicatorValues } from "@/lib/indicators";

export { DEFAULT_INDICATOR_VALUES };

export const INDICATOR_STORAGE_KEY = "orion_indicator_config";

export interface IndicatorToggles {
  ema: boolean;
  sma: boolean;
  rsi: boolean;
  macd: boolean;
}

export const DEFAULT_TOGGLES: IndicatorToggles = {
  ema: true,
  sma: true,
  rsi: true,
  macd: true,
};

export interface IndicatorConfig {
  values: IndicatorValues;
  toggles: IndicatorToggles;
}

export function loadIndicatorConfig(): IndicatorConfig {
  if (typeof window === "undefined") {
    return { values: DEFAULT_INDICATOR_VALUES, toggles: DEFAULT_TOGGLES };
  }
  try {
    const raw = localStorage.getItem(INDICATOR_STORAGE_KEY);
    if (!raw) return { values: DEFAULT_INDICATOR_VALUES, toggles: DEFAULT_TOGGLES };
    const parsed = JSON.parse(raw) as Partial<IndicatorConfig> & IndicatorValues;
    if (parsed && typeof parsed === "object" && "values" in parsed) {
      return {
        values: { ...DEFAULT_INDICATOR_VALUES, ...(parsed.values || {}) },
        toggles: { ...DEFAULT_TOGGLES, ...(parsed.toggles || {}) },
      };
    }
    return {
      values: { ...DEFAULT_INDICATOR_VALUES, ...(parsed as IndicatorValues) },
      toggles: DEFAULT_TOGGLES,
    };
  } catch {
    return { values: DEFAULT_INDICATOR_VALUES, toggles: DEFAULT_TOGGLES };
  }
}

export function saveIndicatorConfig(config: IndicatorConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(INDICATOR_STORAGE_KEY, JSON.stringify(config));
  } catch {
    /* ignore */
  }
}

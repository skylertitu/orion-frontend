import { ColorType, type DeepPartial, type ChartOptions } from "lightweight-charts";

/** Paleta inspirada en MetaTrader 5 (tema oscuro) */
export const MT_CHART_THEME = {
  background: "#0a0a0a",
  text: "#a1a1aa",
  grid: "#1c1c1c",
  border: "#27272a",
  crosshair: "#71717a",
  up: "#22c55e",
  down: "#ef4444",
  volumeUp: "rgba(34, 197, 94, 0.4)",
  volumeDown: "rgba(239, 68, 68, 0.4)",
  accent: "#eab308",
} as const;

export function mtChartOptions(width: number, height: number): DeepPartial<ChartOptions> {
  return {
    layout: {
      background: { type: ColorType.Solid, color: MT_CHART_THEME.background },
      textColor: MT_CHART_THEME.text,
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      fontSize: 11,
      attributionLogo: false,
    },
    grid: {
      vertLines: { color: MT_CHART_THEME.grid, style: 1 },
      horzLines: { color: MT_CHART_THEME.grid, style: 1 },
    },
    crosshair: {
      mode: 0,
      vertLine: {
        color: MT_CHART_THEME.crosshair,
        width: 1,
        style: 2,
        labelBackgroundColor: "#2a2a2a",
      },
      horzLine: {
        color: MT_CHART_THEME.crosshair,
        width: 1,
        style: 2,
        labelBackgroundColor: "#2a2a2a",
      },
    },
    rightPriceScale: {
      borderColor: MT_CHART_THEME.border,
      scaleMargins: { top: 0.05, bottom: 0.22 },
      autoScale: true,
    },
    timeScale: {
      borderColor: MT_CHART_THEME.border,
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 8,
      barSpacing: 8,
      minBarSpacing: 4,
    },
    width,
    height,
  };
}

export const MT_CANDLE_OPTIONS = {
  upColor: MT_CHART_THEME.up,
  downColor: MT_CHART_THEME.down,
  borderUpColor: MT_CHART_THEME.up,
  borderDownColor: MT_CHART_THEME.down,
  wickUpColor: MT_CHART_THEME.up,
  wickDownColor: MT_CHART_THEME.down,
} as const;

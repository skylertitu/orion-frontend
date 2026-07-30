import { ColorType, type DeepPartial, type ChartOptions } from "lightweight-charts";

/** Paleta inspirada en MetaTrader 5 (tema oscuro) */
export const MT_CHART_THEME = {
  background: "#0d0d0d",
  text: "#b0b3b8",
  grid: "#1f1f1f",
  border: "#2a2a2a",
  crosshair: "#6a6a6a",
  up: "#089981",
  down: "#f23645",
  volumeUp: "rgba(8, 153, 129, 0.45)",
  volumeDown: "rgba(242, 54, 69, 0.45)",
  accent: "#4a9eff",
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

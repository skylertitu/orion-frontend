import {
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type ISeriesPrimitive,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { ScriptResult } from "@/lib/indicatorScript";
import { MT_CHART_THEME } from "@/lib/chartTheme";
import { SessionOverlayPrimitive, type OverlayBox, type OverlayRay } from "@/lib/sessionOverlay";

export type ChartBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type IndicatorSeriesBag = {
  series: Array<ISeriesApi<"Line"> | ISeriesApi<"Histogram">>;
  primitives: ISeriesPrimitive<Time>[];
  host: ISeriesApi<"Candlestick"> | null;
};

export function emptyIndicatorBag(): IndicatorSeriesBag {
  return { series: [], primitives: [], host: null };
}

function toUtc(ms: number): UTCTimestamp {
  return (ms > 1_000_000_000_000 ? Math.floor(ms / 1000) : ms) as UTCTimestamp;
}

function linePoints(
  times: UTCTimestamp[],
  values: (number | null)[]
): { time: UTCTimestamp; value: number }[] {
  const out: { time: UTCTimestamp; value: number }[] = [];
  for (let i = 0; i < times.length; i++) {
    const v = values[i];
    if (v != null) out.push({ time: times[i], value: v });
  }
  return out;
}

function lastFinite(values: (number | null)[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    if (v != null && Number.isFinite(v)) return v;
  }
  return null;
}

function looksOscillator(result: ScriptResult): boolean {
  if (/rsi/i.test(result.title)) return true;
  const vals = result.plots.flatMap((p) => p.values.filter((v): v is number => v != null && Number.isFinite(v)));
  if (vals.length < 8) return false;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  return min >= -2 && max <= 102 && max - min > 5 && max > 40;
}

function clearBag(chart: IChartApi, bag: IndicatorSeriesBag): void {
  if (bag.host) {
    for (const primitive of bag.primitives) {
      try {
        bag.host.detachPrimitive(primitive);
      } catch {
        /* already gone */
      }
    }
  }
  bag.primitives = [];
  bag.host = null;
  for (const series of bag.series) {
    try {
      chart.removeSeries(series);
    } catch {
      /* already gone */
    }
  }
  bag.series = [];
  while (chart.panes().length > 1) {
    chart.removePane(chart.panes().length - 1);
  }
}

export function extraPaneHeightFromResults(results: ScriptResult[]): number {
  return results.filter((r) => !r.overlay && !r.error && r.plots.length > 0).length * 120;
}

export function lastScriptReadouts(
  results: ScriptResult[]
): { title: string; value: number; up?: boolean }[] {
  const out: { title: string; value: number; up?: boolean }[] = [];
  for (const result of results) {
    if (result.error) continue;
    for (const plot of result.plots) {
      const value = lastFinite(plot.values);
      if (value == null) continue;
      out.push({
        title: plot.title || result.title,
        value,
        up: plot.style === "histogram" ? value >= 0 : undefined,
      });
    }
  }
  return out.slice(0, 6);
}

function hasDrawables(result: ScriptResult): boolean {
  return result.plots.length > 0 || result.hlines.length > 0 || (result.boxes?.length ?? 0) > 0 || (result.rays?.length ?? 0) > 0;
}

export function applyScriptIndicators(
  chart: IChartApi,
  bars: ChartBar[],
  results: ScriptResult[],
  bag: IndicatorSeriesBag,
  candleSeries?: ISeriesApi<"Candlestick"> | null
): void {
  clearBag(chart, bag);
  if (!bars.length) return;

  const times = bars.map((b) => toUtc(b.time));
  let nextPane = 1;
  const overlayBoxes: OverlayBox[] = [];
  const overlayRays: OverlayRay[] = [];

  for (const result of results) {
    if (result.error || !hasDrawables(result)) continue;
    const paneIndex = result.overlay ? 0 : nextPane;
    if (!result.overlay && result.plots.length > 0) nextPane += 1;

    const oscillator = !result.overlay && looksOscillator(result);
    let firstSeries: ISeriesApi<"Line"> | ISeriesApi<"Histogram"> | null = null;

    for (const plot of result.plots) {
      if (plot.style === "histogram") {
        const hist = chart.addSeries(
          HistogramSeries,
          {
            title: plot.title,
            priceLineVisible: false,
            lastValueVisible: false,
          },
          paneIndex
        );
        hist.setData(
          times.flatMap((time, i) => {
            const value = plot.values[i];
            if (value == null) return [];
            return [
              {
                time,
                value,
                color: plot.color
                  ? plot.color
                  : value >= 0
                    ? MT_CHART_THEME.volumeUp
                    : MT_CHART_THEME.volumeDown,
              },
            ];
          })
        );
        bag.series.push(hist);
        firstSeries ??= hist;
        continue;
      }

      const lineWidth = Math.min(4, Math.max(1, plot.lineWidth || 2)) as 1 | 2 | 3 | 4;
      const line = chart.addSeries(
        LineSeries,
        {
          color: plot.color || "#d4a843",
          lineWidth,
          title: plot.title,
          lastValueVisible: true,
          priceLineVisible: false,
          ...(oscillator
            ? {
                autoscaleInfoProvider: () => ({
                  priceRange: { minValue: 0, maxValue: 100 },
                }),
              }
            : {}),
        },
        paneIndex
      );
      line.setData(linePoints(times, plot.values));
      bag.series.push(line);
      firstSeries ??= line;
    }

    if (firstSeries && result.hlines.length) {
      for (const hl of result.hlines) {
        firstSeries.createPriceLine({
          price: hl.price,
          color: hl.color,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: hl.title || "",
        });
      }
    }

    if (result.overlay) {
      for (const box of result.boxes || []) {
        overlayBoxes.push({
          time1: toUtc(box.time1),
          time2: toUtc(box.time2),
          priceHigh: box.high,
          priceLow: box.low,
          color: box.color,
          title: box.title,
        });
      }
      for (const ray of result.rays || []) {
        overlayRays.push({
          time1: toUtc(ray.time1),
          time2: toUtc(ray.time2),
          price: ray.price,
          color: ray.color,
          lineWidth: ray.lineWidth || 2,
          dashed: ray.dashed,
          title: ray.title,
        });
      }
    }
  }

  if (candleSeries && (overlayBoxes.length || overlayRays.length)) {
    const primitive = new SessionOverlayPrimitive();
    candleSeries.attachPrimitive(primitive);
    primitive.setData(overlayBoxes, overlayRays);
    bag.host = candleSeries;
    bag.primitives.push(primitive);
  }

  const panes = chart.panes();
  if (panes.length <= 1) {
    panes[0]?.setStretchFactor(1);
    return;
  }
  panes[0].setStretchFactor(3.4);
  for (let i = 1; i < panes.length; i++) {
    panes[i].setStretchFactor(1);
  }
}

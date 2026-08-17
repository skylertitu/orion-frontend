import type {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
  UTCTimestamp,
} from "lightweight-charts";

export type DrawingTool = "cursor" | "hline" | "trend" | "fib" | "rect";

export type DrawingPoint = { time: UTCTimestamp; price: number };

export type ChartDrawing = {
  id: string;
  type: "hline" | "trend" | "fib" | "rect";
  p1: DrawingPoint;
  p2?: DrawingPoint;
  color: string;
};

type BitmapTarget = {
  useBitmapCoordinateSpace: (fn: (scope: {
    context: CanvasRenderingContext2D;
    horizontalPixelRatio: number;
    verticalPixelRatio: number;
    mediaSize: { width: number; height: number };
  }) => void) => void;
};

const STORAGE_KEY = "orion_chart_drawings_v1";
const FIB_LEVELS = [
  { level: 0, color: "#94a3b8" },
  { level: 0.236, color: "#f97316" },
  { level: 0.382, color: "#eab308" },
  { level: 0.5, color: "#d4a843" },
  { level: 0.618, color: "#22c55e" },
  { level: 0.786, color: "#38bdf8" },
  { level: 1, color: "#94a3b8" },
];

function hexToRgba(color: string, alpha: number): string {
  const hex = color.replace("#", "");
  if (hex.length !== 6) return color;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function loadChartDrawings(symbol: string): ChartDrawing[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, ChartDrawing[]>;
    return Array.isArray(parsed[symbol]) ? parsed[symbol] : [];
  } catch {
    return [];
  }
}

export function saveChartDrawings(symbol: string, drawings: ChartDrawing[]): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, ChartDrawing[]>) : {};
    parsed[symbol] = drawings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

class DrawingRenderer {
  constructor(
    private readonly _items: ChartDrawing[],
    private readonly _preview: ChartDrawing | null,
    private readonly _chart: IChartApi | null,
    private readonly _series: ISeriesApi<"Candlestick"> | null,
    private readonly _selectedId: string | null
  ) {}

  draw(target: BitmapTarget): void {
    const chart = this._chart;
    const series = this._series;
    if (!chart || !series) return;
    const timeScale = chart.timeScale();
    const all = this._preview ? [...this._items, this._preview] : this._items;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const xr = scope.horizontalPixelRatio;
      const yr = scope.verticalPixelRatio;
      const width = scope.mediaSize.width * xr;
      ctx.save();
      ctx.font = `${Math.round(10 * yr)}px Segoe UI, sans-serif`;
      ctx.lineJoin = "round";

      for (const item of all) {
        const selected = item.id === this._selectedId && item.id !== "preview";
        const y1 = series.priceToCoordinate(item.p1.price);
        if (y1 == null) continue;

        if (item.type === "hline") {
          ctx.strokeStyle = item.color;
          ctx.lineWidth = Math.max(1, (selected ? 3 : 1.5) * yr);
          ctx.setLineDash([6 * xr, 4 * xr]);
          ctx.beginPath();
          ctx.moveTo(0, Math.round(y1 * yr));
          ctx.lineTo(width, Math.round(y1 * yr));
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = item.color;
          ctx.fillText(
            `R ${item.p1.price >= 100 ? item.p1.price.toFixed(2) : item.p1.price.toFixed(4)}`,
            8 * xr,
            Math.round(y1 * yr) - 4 * yr
          );
          continue;
        }

        if (!item.p2) continue;
        const x1 = timeScale.timeToCoordinate(item.p1.time as Time);
        const x2 = timeScale.timeToCoordinate(item.p2.time as Time);
        const y2 = series.priceToCoordinate(item.p2.price);
        if (x1 == null || x2 == null || y2 == null) continue;

        if (item.type === "trend") {
          ctx.strokeStyle = item.color;
          ctx.lineWidth = Math.max(1, (selected ? 3 : 2) * yr);
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(Math.round(x1 * xr), Math.round(y1 * yr));
          ctx.lineTo(Math.round(x2 * xr), Math.round(y2 * yr));
          ctx.stroke();
          continue;
        }

        if (item.type === "rect") {
          const left = Math.round(Math.min(x1, x2) * xr);
          const top = Math.round(Math.min(y1, y2) * yr);
          const w = Math.max(2, Math.round(Math.abs(x2 - x1) * xr));
          const h = Math.max(2, Math.round(Math.abs(y2 - y1) * yr));
          ctx.fillStyle = hexToRgba(item.color, selected ? 0.22 : 0.12);
          ctx.strokeStyle = item.color;
          ctx.lineWidth = Math.max(1, (selected ? 2 : 1) * yr);
          ctx.fillRect(left, top, w, h);
          ctx.strokeRect(left + 0.5, top + 0.5, w, h);
          continue;
        }

        if (item.type === "fib") {
          const topPrice = Math.max(item.p1.price, item.p2.price);
          const botPrice = Math.min(item.p1.price, item.p2.price);
          const range = topPrice - botPrice || 1;
          const left = Math.round(Math.min(x1, x2) * xr);
          const right = Math.round(Math.max(x1, x2) * xr);
          for (const fib of FIB_LEVELS) {
            const price = topPrice - range * fib.level;
            const y = series.priceToCoordinate(price);
            if (y == null) continue;
            ctx.strokeStyle = fib.color;
            ctx.lineWidth = Math.max(1, (selected ? 2 : 1) * yr);
            ctx.setLineDash(fib.level === 0.5 ? [] : [4 * xr, 3 * xr]);
            ctx.beginPath();
            ctx.moveTo(left, Math.round(y * yr));
            ctx.lineTo(Math.max(right, left + 40 * xr), Math.round(y * yr));
            ctx.stroke();
            ctx.fillStyle = fib.color;
            ctx.fillText(`${(fib.level * 100).toFixed(1)}%  ${price.toFixed(price >= 100 ? 2 : 4)}`, left + 4 * xr, Math.round(y * yr) - 3 * yr);
          }
          ctx.setLineDash([]);
        }
      }
      ctx.restore();
    });
  }
}

class DrawingPaneView {
  constructor(private readonly _renderer: DrawingRenderer) {}
  zOrder() {
    return "top" as const;
  }
  renderer() {
    return this._renderer;
  }
}

export class DrawingPrimitive implements ISeriesPrimitive<Time> {
  private _chart: IChartApi | null = null;
  private _series: ISeriesApi<"Candlestick"> | null = null;
  private _requestUpdate: (() => void) | null = null;
  private _items: ChartDrawing[] = [];
  private _preview: ChartDrawing | null = null;
  private _selectedId: string | null = null;
  private _views: DrawingPaneView[] = [];

  attached(param: SeriesAttachedParameter<Time>): void {
    this._chart = param.chart as IChartApi;
    this._series = param.series as ISeriesApi<"Candlestick">;
    this._requestUpdate = param.requestUpdate;
    this._rebuild();
  }

  detached(): void {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
    this._views = [];
  }

  setDrawings(
    items: ChartDrawing[],
    preview: ChartDrawing | null = null,
    selectedId: string | null = null
  ): void {
    this._items = items;
    this._preview = preview;
    this._selectedId = selectedId;
    this._rebuild();
    this._requestUpdate?.();
  }

  updateAllViews(): void {
    this._rebuild();
  }

  paneViews() {
    return this._views;
  }

  private _rebuild(): void {
    this._views = [
      new DrawingPaneView(
        new DrawingRenderer(this._items, this._preview, this._chart, this._series, this._selectedId)
      ),
    ];
  }
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function hitTestDrawing(
  chart: IChartApi,
  series: ISeriesApi<"Candlestick">,
  items: ChartDrawing[],
  x: number,
  y: number,
  tolerance = 8
): ChartDrawing | null {
  const timeScale = chart.timeScale();
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    const y1 = series.priceToCoordinate(item.p1.price);
    if (y1 == null) continue;

    if (item.type === "hline") {
      if (Math.abs(y1 - y) <= tolerance) return item;
      continue;
    }
    if (!item.p2) continue;
    const x1 = timeScale.timeToCoordinate(item.p1.time as Time);
    const x2 = timeScale.timeToCoordinate(item.p2.time as Time);
    const y2 = series.priceToCoordinate(item.p2.price);
    if (x1 == null || x2 == null || y2 == null) continue;

    if (item.type === "trend") {
      if (distToSegment(x, y, x1, y1, x2, y2) <= tolerance) return item;
      continue;
    }
    if (item.type === "rect") {
      const left = Math.min(x1, x2);
      const right = Math.max(x1, x2);
      const top = Math.min(y1, y2);
      const bot = Math.max(y1, y2);
      if (x >= left - 2 && x <= right + 2 && y >= top - 2 && y <= bot + 2) return item;
      continue;
    }
    if (item.type === "fib") {
      const topPrice = Math.max(item.p1.price, item.p2.price);
      const botPrice = Math.min(item.p1.price, item.p2.price);
      const range = topPrice - botPrice || 1;
      const left = Math.min(x1, x2);
      const right = Math.max(x1, x2) + 40;
      if (x < left - 4 || x > right + 4) continue;
      for (const fib of FIB_LEVELS) {
        const py = series.priceToCoordinate(topPrice - range * fib.level);
        if (py != null && Math.abs(py - y) <= tolerance) return item;
      }
    }
  }
  return null;
}

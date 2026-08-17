import type {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
  UTCTimestamp,
} from "lightweight-charts";

type BitmapTarget = {
  useBitmapCoordinateSpace: (fn: (scope: {
    context: CanvasRenderingContext2D;
    horizontalPixelRatio: number;
    verticalPixelRatio: number;
  }) => void) => void;
};

export type OverlayBox = {
  time1: UTCTimestamp;
  time2: UTCTimestamp;
  priceHigh: number;
  priceLow: number;
  color: string;
  title?: string;
};

export type OverlayRay = {
  time1: UTCTimestamp;
  time2: UTCTimestamp;
  price: number;
  color: string;
  lineWidth: number;
  dashed?: boolean;
  title?: string;
};

function hexToRgba(color: string, alpha: number): string {
  const raw = color.trim();
  if (raw.startsWith("rgba") || raw.startsWith("rgb")) return raw;
  const hex = raw.replace("#", "");
  if (hex.length !== 3 && hex.length !== 6) return raw;
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

class OverlayRenderer {
  constructor(
    private readonly _boxes: OverlayBox[],
    private readonly _rays: OverlayRay[],
    private readonly _chart: IChartApi | null,
    private readonly _series: ISeriesApi<"Candlestick"> | null
  ) {}

  drawBackground(target: BitmapTarget): void {
    this._drawBoxes(target);
  }

  draw(target: BitmapTarget): void {
    this._drawRays(target);
  }

  private _drawBoxes(target: BitmapTarget): void {
    const chart = this._chart;
    const series = this._series;
    if (!chart || !series || this._boxes.length === 0) return;
    const timeScale = chart.timeScale();
    const barSpacing = timeScale.options().barSpacing ?? 6;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const xr = scope.horizontalPixelRatio;
      const yr = scope.verticalPixelRatio;
      ctx.save();
      ctx.font = `${Math.round(10 * yr)}px Segoe UI, sans-serif`;
      for (const box of this._boxes) {
        const x1 = timeScale.timeToCoordinate(box.time1 as Time);
        const x2 = timeScale.timeToCoordinate(box.time2 as Time);
        const y1 = series.priceToCoordinate(box.priceHigh);
        const y2 = series.priceToCoordinate(box.priceLow);
        if (x1 == null || x2 == null || y1 == null || y2 == null) continue;
        const left = Math.round(Math.min(x1, x2) * xr);
        const right = Math.round(Math.max(x1, x2) * xr + barSpacing * xr);
        const top = Math.round(Math.min(y1, y2) * yr);
        const bottom = Math.round(Math.max(y1, y2) * yr);
        const width = Math.max(2, right - left);
        const height = Math.max(2, bottom - top);
        ctx.fillStyle = hexToRgba(box.color, 0.16);
        ctx.strokeStyle = hexToRgba(box.color, 0.85);
        ctx.lineWidth = Math.max(1, yr);
        ctx.fillRect(left, top, width, height);
        ctx.strokeRect(left + 0.5, top + 0.5, width, height);
        if (box.title && height > 12) {
          ctx.fillStyle = hexToRgba(box.color, 0.95);
          ctx.fillText(box.title, left + 4 * xr, top + 12 * yr);
        }
      }
      ctx.restore();
    });
  }

  private _drawRays(target: BitmapTarget): void {
    const chart = this._chart;
    const series = this._series;
    if (!chart || !series || this._rays.length === 0) return;
    const timeScale = chart.timeScale();
    const barSpacing = timeScale.options().barSpacing ?? 6;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const xr = scope.horizontalPixelRatio;
      const yr = scope.verticalPixelRatio;
      ctx.save();
      for (const ray of this._rays) {
        const x1 = timeScale.timeToCoordinate(ray.time1 as Time);
        const x2 = timeScale.timeToCoordinate(ray.time2 as Time);
        const y = series.priceToCoordinate(ray.price);
        if (x1 == null || x2 == null || y == null) continue;
        ctx.beginPath();
        ctx.strokeStyle = ray.color;
        ctx.lineWidth = Math.max(1, (ray.lineWidth || 2) * yr);
        if (ray.dashed) ctx.setLineDash([6 * xr, 5 * xr]);
        else ctx.setLineDash([]);
        ctx.moveTo(Math.round(Math.min(x1, x2) * xr), Math.round(y * yr));
        ctx.lineTo(Math.round(Math.max(x1, x2) * xr + barSpacing * xr), Math.round(y * yr));
        ctx.stroke();
      }
      ctx.restore();
    });
  }
}

class OverlayPaneView {
  constructor(private readonly _renderer: OverlayRenderer) {}
  zOrder() {
    return "bottom" as const;
  }
  renderer() {
    return this._renderer;
  }
}

export class SessionOverlayPrimitive implements ISeriesPrimitive<Time> {
  private _chart: IChartApi | null = null;
  private _series: ISeriesApi<"Candlestick"> | null = null;
  private _requestUpdate: (() => void) | null = null;
  private _boxes: OverlayBox[] = [];
  private _rays: OverlayRay[] = [];
  private _paneViews: OverlayPaneView[] = [];

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
    this._paneViews = [];
  }

  setData(boxes: OverlayBox[], rays: OverlayRay[]): void {
    this._boxes = boxes;
    this._rays = rays;
    this._rebuild();
    this._requestUpdate?.();
  }

  updateAllViews(): void {
    this._rebuild();
  }

  paneViews() {
    return this._paneViews;
  }

  private _rebuild(): void {
    this._paneViews = [new OverlayPaneView(new OverlayRenderer(this._boxes, this._rays, this._chart, this._series))];
  }
}

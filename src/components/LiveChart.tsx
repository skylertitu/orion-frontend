'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type MouseEventParams,
} from 'lightweight-charts';
import { parseKlines } from '@/components/MarketChart';
import { toast } from '@/lib/toast';
import { fetchMarketKlines } from '@/lib/binance';
import { MT_CANDLE_OPTIONS, MT_CHART_THEME, mtChartOptions } from '@/lib/chartTheme';
import {
  applyScriptIndicators,
  emptyIndicatorBag,
  extraPaneHeightFromResults,
  lastScriptReadouts,
  type ChartBar,
  type IndicatorSeriesBag,
} from '@/lib/chartIndicators';
import {
  extraScriptPaneHeight,
  loadIndicatorScripts,
  runIndicatorScriptsSandboxed,
  type IndicatorScript,
  type ScriptResult,
} from '@/lib/indicatorScript';
import { persistIndicatorScripts } from '@/lib/indicatorSync';
import { loadChartPrefs, saveChartPrefs, type ChartStyle } from '@/lib/chartPrefs';
import {
  DrawingPrimitive,
  hitTestDrawing,
  loadChartDrawings,
  saveChartDrawings,
  type ChartDrawing,
  type DrawingPoint,
  type DrawingTool,
} from '@/lib/chartDrawings';

interface LiveChartProps {
  symbol: string;
  interval?: string;
  height?: number;
  scripts?: IndicatorScript[];
  onScriptsChange?: (next: IndicatorScript[]) => void;
  onScriptResults?: (results: ScriptResult[]) => void;
  adminTools?: boolean;
  fill?: boolean;
}

export const CHART_INTERVALS = [
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1H' },
  { value: '4h', label: '4H' },
  { value: '1d', label: '1D' },
] as const;

const INTERVALS = CHART_INTERVALS;

const DRAW_TOOLS: { id: DrawingTool; label: string; hint: string }[] = [
  { id: 'cursor', label: 'Navegar', hint: 'Mover la gráfica, elegir un dibujo y borrarlo' },
  { id: 'hline', label: 'Nivel', hint: 'Soporte / resistencia' },
  { id: 'trend', label: 'Tendencia', hint: 'Línea de tendencia' },
  { id: 'fib', label: 'Fib', hint: 'Retroceso Fibonacci' },
  { id: 'rect', label: 'Zona', hint: 'Zona rectangular' },
];

const POLL_MS = 3000;
const HISTORY_LIMIT = 1000;
const VISIBLE_BARS = 180;

function toChartTime(ms: number): UTCTimestamp {
  const sec = ms > 1_000_000_000_000 ? Math.floor(ms / 1000) : ms;
  return sec as UTCTimestamp;
}

export default function LiveChart({
  symbol,
  interval: intervalProp = '15m',
  height = 480,
  fill = false,
  scripts: scriptsProp,
  onScriptsChange,
  onScriptResults,
  adminTools = false,
}: LiveChartProps) {
  const [interval, setChartInterval] = useState(intervalProp);
  const [localScripts, setLocalScripts] = useState<IndicatorScript[]>([]);
  const scripts = scriptsProp || localScripts;

  useEffect(() => {
    if (intervalProp) setChartInterval(intervalProp);
  }, [intervalProp]);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const bagRef = useRef<IndicatorSeriesBag>(emptyIndicatorBag());
  const drawingRef = useRef<DrawingPrimitive | null>(null);
  const lastBarTimeRef = useRef<number | null>(null);
  const scriptsRef = useRef(scripts);
  scriptsRef.current = scripts;
  const fillRef = useRef(fill);
  fillRef.current = fill;
  const onResultsRef = useRef(onScriptResults);
  onResultsRef.current = onScriptResults;
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;

  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [ohlc, setOhlc] = useState({ open: 0, high: 0, low: 0, close: 0 });
  const [changePct, setChangePct] = useState(0);
  const [extra, setExtra] = useState(0);
  const [readouts, setReadouts] = useState<{ title: string; value: number; up?: boolean }[]>([]);
  const [errorIds, setErrorIds] = useState<Record<string, string>>({});
  const [drawTool, setDrawTool] = useState<DrawingTool>('cursor');
  const [chartStyle, setChartStyle] = useState<ChartStyle>('candles');
  const [drawings, setDrawings] = useState<ChartDrawing[]>([]);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [atHistoryStart, setAtHistoryStart] = useState(false);
  const dismissedRef = useRef(new Set<string>());
  const errorSigRef = useRef('');
  const paintGenRef = useRef(0);
  const drawToolRef = useRef<DrawingTool>('cursor');
  const pendingPointRef = useRef<DrawingPoint | null>(null);
  const drawingsRef = useRef<ChartDrawing[]>([]);
  const adminToolsRef = useRef(adminTools);
  const chartStyleRef = useRef<ChartStyle>('candles');
  const selectedDrawingIdRef = useRef<string | null>(null);
  const intervalRef = useRef(interval);
  const loadOlderRef = useRef<() => Promise<void>>(async () => {});
  const loadingOlderRef = useRef(false);
  const noMoreHistoryRef = useRef(false);
  drawToolRef.current = drawTool;
  drawingsRef.current = drawings;
  adminToolsRef.current = adminTools;
  chartStyleRef.current = chartStyle;
  selectedDrawingIdRef.current = selectedDrawingId;
  intervalRef.current = interval;

  const candlesRef = useRef(new Map<number, ChartBar>());

  useEffect(() => {
    const prefs = loadChartPrefs();
    setChartInterval(prefs.interval);
    setChartStyle(prefs.chartStyle);
  }, []);

  useEffect(() => {
    if (scriptsProp) return;
    setLocalScripts(loadIndicatorScripts());
  }, [scriptsProp]);

  const paintIndicators = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const gen = ++paintGenRef.current;
    const sorted = [...candlesRef.current.values()].sort((a, b) => a.time - b.time);
    const scriptsNow = scriptsRef.current;
    void runIndicatorScriptsSandboxed(scriptsNow, sorted).then((all) => {
      if (gen !== paintGenRef.current) return;
      const liveChart = chartRef.current;
      if (!liveChart) return;
      const drawn = all.filter((r) => {
        const script = scriptsRef.current.find((s) => s.id === r.id);
        return Boolean(script?.enabled) && !r.error;
      });
      applyScriptIndicators(liveChart, sorted, drawn, bagRef.current, candleRef.current);
      const paneExtra = extraPaneHeightFromResults(drawn);
      setExtra(paneExtra);
      if (fillRef.current && containerRef.current) {
        liveChart.applyOptions({ height: Math.max(240, containerRef.current.clientHeight) });
      } else {
        liveChart.applyOptions({ height: height + paneExtra });
      }
      setReadouts(lastScriptReadouts(drawn));
      const failed = all.filter((r) => r.error);
      const nextIds = Object.fromEntries(failed.map((r) => [r.id, r.error as string]));
      setErrorIds(nextIds);

      const failedIds = new Set(failed.map((r) => r.id));
      for (const key of [...dismissedRef.current]) {
        const id = key.slice(0, key.indexOf('::'));
        if (!failedIds.has(id)) dismissedRef.current.delete(key);
      }

      const sig = failed.map((r) => `${r.id}::${r.error}`).sort().join('|');
      if (sig !== errorSigRef.current) {
        errorSigRef.current = sig;
        for (const r of failed) {
          const key = `${r.id}::${r.error}`;
          if (dismissedRef.current.has(key)) continue;
          toast.error(r.error as string, r.title || 'Indicador');
        }
      }
      onResultsRef.current?.(all);
    });
  }, [height]);

  const paintChart = useCallback(
    (fit = false) => {
      if (!candleRef.current || !volumeRef.current) return false;

      const sorted = [...candlesRef.current.values()].sort((a, b) => a.time - b.time);
      if (!sorted.length) return false;

      candleRef.current.setData(
        sorted.map((k) => ({
          time: toChartTime(k.time),
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
        }))
      );
      lineRef.current?.setData(
        sorted.map((k) => ({
          time: toChartTime(k.time),
          value: k.close,
        }))
      );
      volumeRef.current.setData(
        sorted.map((k) => ({
          time: toChartTime(k.time),
          value: k.volume,
          color: k.close >= k.open ? MT_CHART_THEME.volumeUp : MT_CHART_THEME.volumeDown,
        }))
      );

      const last = sorted[sorted.length - 1];
      const anchor = sorted[Math.max(0, sorted.length - VISIBLE_BARS)];
      lastBarTimeRef.current = toChartTime(last.time) as number;
      setOhlc({ open: last.open, high: last.high, low: last.low, close: last.close });
      setChangePct(anchor.open ? ((last.close - anchor.open) / anchor.open) * 100 : 0);
      paintIndicators();
      if (fit) chartRef.current?.timeScale().fitContent();
      return true;
    },
    [paintIndicators]
  );

  const ingestKlines = useCallback(
    (raw: number[][], fit: boolean) => {
      const parsed = parseKlines(raw);
      for (const k of parsed) {
        candlesRef.current.set(k.time, {
          time: k.time,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
          volume: k.volume ?? 0,
        });
      }
      return paintChart(fit);
    },
    [paintChart]
  );

  const refreshLatest = useCallback(async () => {
    try {
      const raw = await fetchMarketKlines(symbol, interval, 3);
      if (!raw.length) return;
      const parsed = parseKlines(raw);
      for (const k of parsed) {
        candlesRef.current.set(k.time, {
          time: k.time,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
          volume: k.volume ?? 0,
        });
      }
      paintChart(false);
      setLive(true);
    } catch {
      setLive(false);
    }
  }, [symbol, interval, paintChart]);

  useEffect(() => {
    if (!containerRef.current) return;
    const paneExtra = extraScriptPaneHeight(scriptsRef.current);
    const startH = fill
      ? Math.max(240, containerRef.current.clientHeight)
      : height + paneExtra;
    const chart = createChart(
      containerRef.current,
      mtChartOptions(containerRef.current.clientWidth, startH)
    );
    const candles = chart.addSeries(CandlestickSeries, {
      ...MT_CANDLE_OPTIONS,
      visible: chartStyleRef.current === 'candles',
    });
    const line = chart.addSeries(LineSeries, {
      color: '#d4a843',
      lineWidth: 2,
      lastValueVisible: true,
      priceLineVisible: true,
      visible: chartStyleRef.current === 'line',
    });
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
      visible: false,
    });

    chartRef.current = chart;
    candleRef.current = candles;
    lineRef.current = line;
    volumeRef.current = volume;
    bagRef.current = emptyIndicatorBag();

    const drawingsLayer = new DrawingPrimitive();
    candles.attachPrimitive(drawingsLayer);
    drawingsLayer.setDrawings(drawingsRef.current, null, selectedDrawingIdRef.current);
    drawingRef.current = drawingsLayer;

    const onResize = () => {
      if (!containerRef.current) return;
      const next: { width: number; height?: number } = {
        width: containerRef.current.clientWidth,
      };
      if (fillRef.current) {
        next.height = Math.max(240, containerRef.current.clientHeight);
      }
      chart.applyOptions(next);
    };
    window.addEventListener('resize', onResize);
    const ro = fill ? new ResizeObserver(onResize) : null;
    if (ro && containerRef.current) ro.observe(containerRef.current);

    const persistDrawings = (next: ChartDrawing[], selectedId: string | null = null) => {
      drawingsRef.current = next;
      setDrawings(next);
      setSelectedDrawingId(selectedId);
      selectedDrawingIdRef.current = selectedId;
      saveChartDrawings(symbolRef.current, next);
      drawingsLayer.setDrawings(next, null, selectedId);
    };

    const onClick = (param: MouseEventParams) => {
      if (!adminToolsRef.current) return;
      const tool = drawToolRef.current;
      if (!param.point) return;

      if (tool === 'cursor') {
        const hit = hitTestDrawing(chart, candles, drawingsRef.current, param.point.x, param.point.y);
        setSelectedDrawingId(hit?.id ?? null);
        selectedDrawingIdRef.current = hit?.id ?? null;
        drawingsLayer.setDrawings(drawingsRef.current, null, hit?.id ?? null);
        return;
      }

      const price = candles.coordinateToPrice(param.point.y);
      const time = (param.time ?? lastBarTimeRef.current) as UTCTimestamp | null;
      if (price == null || time == null) return;
      const point: DrawingPoint = { time, price };

      if (tool === 'hline') {
        const created: ChartDrawing = { id: `d_${Date.now()}`, type: 'hline', p1: point, color: '#f23645' };
        persistDrawings([...drawingsRef.current, created], created.id);
        setDrawTool('cursor');
        return;
      }

      if (!pendingPointRef.current) {
        pendingPointRef.current = point;
        return;
      }

      const created: ChartDrawing = {
        id: `d_${Date.now()}`,
        type: tool,
        p1: pendingPointRef.current,
        p2: point,
        color: tool === 'fib' ? '#d4a843' : tool === 'rect' ? '#818cf8' : '#38bdf8',
      };
      pendingPointRef.current = null;
      persistDrawings([...drawingsRef.current, created], created.id);
      setDrawTool('cursor');
    };

    const onMove = (param: MouseEventParams) => {
      const tool = drawToolRef.current;
      const start = pendingPointRef.current;
      if (!start || tool === 'cursor' || tool === 'hline' || !param.point) {
        drawingsLayer.setDrawings(drawingsRef.current, null, selectedDrawingIdRef.current);
        return;
      }
      const price = candles.coordinateToPrice(param.point.y);
      const time = (param.time ?? start.time) as UTCTimestamp | null;
      if (price == null || time == null) return;
      drawingsLayer.setDrawings(drawingsRef.current, {
        id: 'preview',
        type: tool,
        p1: start,
        p2: { time, price },
        color: '#d4a843',
      }, selectedDrawingIdRef.current);
    };

    const onVisibleRange = () => {
      const range = chart.timeScale().getVisibleLogicalRange();
      if (!range || range.from > 18) return;
      void loadOlderRef.current();
    };

    chart.subscribeClick(onClick);
    chart.subscribeCrosshairMove(onMove);
    chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleRange);

    return () => {
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
      chart.unsubscribeClick(onClick);
      chart.unsubscribeCrosshairMove(onMove);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleRange);
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      lineRef.current = null;
      volumeRef.current = null;
      drawingRef.current = null;
      bagRef.current = emptyIndicatorBag();
    };
  }, [height, fill]);

  useEffect(() => {
    let cancelled = false;
    candlesRef.current.clear();
    lastBarTimeRef.current = null;
    noMoreHistoryRef.current = false;
    setAtHistoryStart(false);
    setLoading(true);
    setLive(false);

    function oldestMs(): number | null {
      let min: number | null = null;
      for (const time of candlesRef.current.keys()) {
        if (min == null || time < min) min = time;
      }
      return min;
    }

    function showRecent() {
      const n = candlesRef.current.size;
      chartRef.current?.timeScale().setVisibleLogicalRange({
        from: Math.max(0, n - VISIBLE_BARS),
        to: n + 8,
      });
    }

    async function loadHistory() {
      const raw = await fetchMarketKlines(symbol, interval, HISTORY_LIMIT);
      if (cancelled || !raw.length) return;
      ingestKlines(raw, false);
      showRecent();
      setLive(true);
      setLoading(false);
      if (raw.length < HISTORY_LIMIT) {
        noMoreHistoryRef.current = true;
        setAtHistoryStart(true);
        return;
      }

      for (let i = 0; i < 4; i++) {
        if (cancelled || noMoreHistoryRef.current) return;
        const oldest = oldestMs();
        if (oldest == null) return;
        const older = await fetchMarketKlines(symbol, interval, HISTORY_LIMIT, { endTime: oldest - 1 });
        if (cancelled) return;
        if (!older.length) {
          noMoreHistoryRef.current = true;
          setAtHistoryStart(true);
          return;
        }
        const prevLen = candlesRef.current.size;
        const range = chartRef.current?.timeScale().getVisibleLogicalRange();
        ingestKlines(older, false);
        const added = candlesRef.current.size - prevLen;
        if (range && added > 0) {
          chartRef.current?.timeScale().setVisibleLogicalRange({
            from: range.from + added,
            to: range.to + added,
          });
        }
        if (older.length < HISTORY_LIMIT || added === 0) {
          noMoreHistoryRef.current = true;
          setAtHistoryStart(true);
          return;
        }
      }
    }

    loadOlderRef.current = async () => {
      if (cancelled || loadingOlderRef.current || noMoreHistoryRef.current) return;
      const oldest = oldestMs();
      if (oldest == null) return;
      loadingOlderRef.current = true;
      try {
        const raw = await fetchMarketKlines(symbolRef.current, intervalRef.current, HISTORY_LIMIT, {
          endTime: oldest - 1,
        });
        if (cancelled) return;
        if (!raw.length) {
          noMoreHistoryRef.current = true;
          setAtHistoryStart(true);
          return;
        }
        const prevLen = candlesRef.current.size;
        const range = chartRef.current?.timeScale().getVisibleLogicalRange();
        ingestKlines(raw, false);
        const added = candlesRef.current.size - prevLen;
        if (range && added > 0) {
          chartRef.current?.timeScale().setVisibleLogicalRange({
            from: range.from + added,
            to: range.to + added,
          });
        }
        if (raw.length < HISTORY_LIMIT || added === 0) {
          noMoreHistoryRef.current = true;
          setAtHistoryStart(true);
        }
      } catch {
        /* keep what we have */
      } finally {
        loadingOlderRef.current = false;
      }
    };

    loadHistory()
      .catch(() => setLive(false))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const pollId = setInterval(() => {
      if (!cancelled) refreshLatest();
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(pollId);
      loadOlderRef.current = async () => {};
    };
  }, [symbol, interval, ingestKlines, refreshLatest]);

  useEffect(() => {
    pendingPointRef.current = null;
    setSelectedDrawingId(null);
    selectedDrawingIdRef.current = null;
    const loaded = loadChartDrawings(symbol);
    setDrawings(loaded);
    drawingsRef.current = loaded;
    drawingRef.current?.setDrawings(loaded, null, null);
  }, [symbol]);

  useEffect(() => {
    candleRef.current?.applyOptions({ visible: chartStyle === 'candles' });
    lineRef.current?.applyOptions({ visible: chartStyle === 'line' });
  }, [chartStyle]);

  useEffect(() => {
    paintIndicators();
  }, [scripts, paintIndicators]);

  useEffect(() => {
    chartRef.current?.applyOptions({
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: drawTool === 'cursor',
        horzTouchDrag: drawTool === 'cursor',
        vertTouchDrag: drawTool === 'cursor',
      },
    });
  }, [drawTool]);

  function persistScripts(next: IndicatorScript[]) {
    if (onScriptsChange) onScriptsChange(next);
    else {
      setLocalScripts(next);
      persistIndicatorScripts(next);
    }
  }

  function toggleScript(id: string) {
    persistScripts(
      scripts.map((s) => {
        if (s.id !== id) return s;
        if (s.blocked) return s;
        return { ...s, enabled: !s.enabled };
      })
    );
  }

  function deleteScript(id: string) {
    const target = scripts.find((s) => s.id === id);
    if (!target) return;
    if (!window.confirm(`¿Eliminar el indicador “${target.name}”?`)) return;
    persistScripts(scripts.filter((s) => s.id !== id));
  }

  function changeChartStyle(next: ChartStyle) {
    setChartStyle(next);
    saveChartPrefs({ chartStyle: next });
  }

  function changeInterval(next: string) {
    setChartInterval(next);
    saveChartPrefs({ interval: next });
  }

  function syncDrawings(next: ChartDrawing[], selectedId: string | null = null) {
    drawingsRef.current = next;
    setDrawings(next);
    setSelectedDrawingId(selectedId);
    selectedDrawingIdRef.current = selectedId;
    saveChartDrawings(symbol, next);
    drawingRef.current?.setDrawings(next, null, selectedId);
  }

  function selectDrawTool(next: DrawingTool) {
    pendingPointRef.current = null;
    setDrawTool(next);
    drawingRef.current?.setDrawings(drawingsRef.current, null, selectedDrawingIdRef.current);
  }

  function deleteSelectedDrawing() {
    const id = selectedDrawingIdRef.current;
    if (!id) return;
    syncDrawings(drawingsRef.current.filter((d) => d.id !== id), null);
  }

  function clearDrawings() {
    pendingPointRef.current = null;
    if (selectedDrawingIdRef.current) {
      deleteSelectedDrawing();
      return;
    }
    if (drawingsRef.current.length === 0) return;
    if (!window.confirm('¿Borrar todas las marcas de esta gráfica?')) return;
    syncDrawings([], null);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement | null)?.isContentEditable) return;
      if (e.key === 'Escape') {
        setSelectedDrawingId(null);
        selectedDrawingIdRef.current = null;
        selectDrawTool('cursor');
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selectedDrawingIdRef.current) return;
        e.preventDefault();
        deleteSelectedDrawing();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isUp = changePct >= 0;
  const priceDecimals = ohlc.close >= 1000 ? 2 : ohlc.close >= 1 ? 4 : 6;

  const scriptChips = scripts.map((script) => {
    const failed = Boolean(errorIds[script.id]);
    const onChart = script.enabled && !failed;
    return (
      <span
        key={script.id}
        className={`inline-flex items-center rounded-full border text-[10px] font-bold ${
          failed
            ? "border-red-500/40 bg-red-500/15 text-red-300"
            : onChart
              ? "border-gold/40 bg-gold/15 text-gold"
              : "border-zinc-800 bg-zinc-900 text-zinc-500"
        }`}
      >
        <button type="button" onClick={() => toggleScript(script.id)} className="px-2 py-0.5">
          {script.name}
        </button>
        <button
          type="button"
          title="Quitar de la lista"
          onClick={() => deleteScript(script.id)}
          className="border-l border-current/20 px-1.5 py-0.5 text-zinc-500 hover:text-red-400"
        >
          ×
        </button>
      </span>
    );
  });

  const tools = (
    <>
      <IconBtn title="Velas" active={chartStyle === 'candles'} onClick={() => changeChartStyle('candles')}>
        <CandleIcon />
      </IconBtn>
      <IconBtn title="Tendencia (línea)" active={chartStyle === 'line'} onClick={() => changeChartStyle('line')}>
        <TrendLineIcon />
      </IconBtn>
      {adminTools && (
        <>
          <span className={fill ? "my-1 h-px w-6 bg-zinc-800" : "mx-0.5 h-5 w-px bg-zinc-800"} />
          {DRAW_TOOLS.map((tool) => (
            <IconBtn
              key={tool.id}
              title={tool.hint}
              active={drawTool === tool.id}
              onClick={() => selectDrawTool(tool.id)}
            >
              <ToolGlyph id={tool.id} />
            </IconBtn>
          ))}
          <IconBtn title="Borrar dibujo elegido (o todos)" onClick={clearDrawings}>
            <TrashIcon />
          </IconBtn>
        </>
      )}
    </>
  );

  const chartPane = (
      <div className={`relative ${fill ? "min-h-0 flex-1" : ""}`}>
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0d0d0d]/80 text-sm text-zinc-500">
            Cargando velas...
          </div>
        )}
        {!fill && (
        <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex items-start justify-between gap-2">
          <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-zinc-800/80 bg-zinc-950/85 p-1 shadow-lg backdrop-blur-md">
            {tools}
          </div>
          <div className="pointer-events-auto flex gap-0.5 rounded-xl border border-zinc-800/80 bg-zinc-950/85 p-1 shadow-lg backdrop-blur-md">
            {INTERVALS.map((tf) => (
              <button
                key={tf.value}
                type="button"
                onClick={() => changeInterval(tf.value)}
                className={`rounded-md px-2 py-1 text-[10px] font-bold tracking-wide ${
                  interval === tf.value ? 'bg-gold text-black' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
        )}
        {fill && scriptChips.length > 0 && (
          <div className="pointer-events-auto absolute right-3 top-2 z-20 flex max-w-[58%] flex-wrap justify-end gap-1">
            {scriptChips}
          </div>
        )}
        <div className={`pointer-events-none absolute z-20 font-mono text-[11px] text-zinc-500 ${fill ? "left-3 top-2" : "left-3 top-14"}`}>
          <span>
            O <span className="text-zinc-300">{ohlc.open > 0 ? ohlc.open.toFixed(priceDecimals) : '—'}</span>
          </span>
          <span className="ml-2">
            H <span className="text-[#089981]">{ohlc.high > 0 ? ohlc.high.toFixed(priceDecimals) : '—'}</span>
          </span>
          <span className="ml-2">
            L <span className="text-[#f23645]">{ohlc.low > 0 ? ohlc.low.toFixed(priceDecimals) : '—'}</span>
          </span>
          <span className="ml-2">
            C <span className="text-zinc-300">{ohlc.close > 0 ? ohlc.close.toFixed(priceDecimals) : '—'}</span>
          </span>
          {readouts.map((item) => (
            <span key={item.title} className="ml-2">
              {item.title}{' '}
              <span
                className={
                  item.up === true ? 'text-[#089981]' : item.up === false ? 'text-[#f23645]' : 'text-gold'
                }
              >
                {Math.abs(item.value) >= 1000 ? item.value.toFixed(2) : item.value.toFixed(4)}
              </span>
            </span>
          ))}
        </div>
        {drawTool !== 'cursor' && adminTools && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-gold/30 bg-zinc-950/90 px-3 py-1 text-[10px] font-semibold text-gold">
            Dibuja con clics · Esc o Navegar para mover y elegir
          </div>
        )}
        {drawTool === 'cursor' && selectedDrawingId && adminTools && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-950/90 px-3 py-1 text-[10px] font-semibold text-zinc-300">
            Dibujo elegido · Supr o el bote para borrarlo
          </div>
        )}
        {atHistoryStart && (
          <div className="pointer-events-none absolute bottom-3 right-3 z-20 rounded-lg border border-zinc-800 bg-zinc-950/80 px-2 py-1 text-[10px] text-zinc-500">
            Inicio del historial en este timeframe
          </div>
        )}
        <div ref={containerRef} className={fill ? "h-full w-full" : undefined} style={fill ? undefined : { height: height + extra }} />
      </div>
  );

  return (
    <div className={`overflow-hidden bg-[#0d0d0d] ${fill ? "flex h-full min-h-0" : "rounded-2xl border border-zinc-800/80 shadow-[0_0_40px_rgba(212,168,67,0.04)]"}`}>
      {fill && (
        <aside className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-zinc-800 bg-[#0a0d16] py-2">
          {tools}
        </aside>
      )}
      <div className={fill ? "flex min-h-0 min-w-0 flex-1 flex-col" : undefined}>
        {!fill && (
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 bg-zinc-950/80 px-4 py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-semibold tracking-wide text-white">{symbol}</span>
          <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${live ? 'bg-[#089981]' : 'bg-red-500'}`} />
            {live ? 'Live' : 'Sin datos'}
          </span>
          {scriptChips}
        </div>

        <div className="flex flex-wrap items-baseline gap-4">
          <span className="font-mono text-xl font-bold text-white">
            {ohlc.close > 0
              ? ohlc.close.toLocaleString(undefined, {
                  minimumFractionDigits: priceDecimals,
                  maximumFractionDigits: priceDecimals,
                })
              : '—'}
          </span>
          <span className={`font-mono text-sm font-medium ${isUp ? 'text-[#089981]' : 'text-[#f23645]'}`}>
            {ohlc.close > 0 ? `${isUp ? '+' : ''}${changePct.toFixed(2)}%` : ''}
          </span>
        </div>
      </div>
        )}
        {chartPane}
      </div>
    </div>
  );
}

function IconBtn({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
        active ? 'bg-gold text-black' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function ToolGlyph({ id }: { id: DrawingTool }) {
  if (id === 'cursor') return <CursorIcon />;
  if (id === 'hline') return <HLineIcon />;
  if (id === 'trend') return <TrendLineIcon />;
  if (id === 'fib') return <FibIcon />;
  return <RectIcon />;
}

function CursorIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 11V8a2 2 0 114 0v3m0 0V9a2 2 0 114 0v2m0 0V10a2 2 0 114 0v5.5a4.5 4.5 0 01-4.5 4.5H11a5 5 0 01-5-5V11a2 2 0 114 0"
      />
    </svg>
  );
}

function HLineIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16M7 8v8M17 8v8" />
    </svg>
  );
}

function TrendLineIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 17l6-6 4 3 6-8" />
    </svg>
  );
}

function FibIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 6h14M5 10h14M5 14h10M5 18h6" />
    </svg>
  );
}

function RectIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 7h14v10H5z" />
    </svg>
  );
}

function CandleIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4v16M16 7v10M6 8h4v8H6zM14 10h4v5h-4z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 7h14M9 7V5h6v2m-8 0l1 12h8l1-12" />
    </svg>
  );
}

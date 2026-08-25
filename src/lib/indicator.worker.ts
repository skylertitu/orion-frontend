/// <reference lib="webworker" />

import { runIndicatorScript, type IndicatorScript } from "./indicatorScript";

type Bar = { time?: number; open: number; high: number; low: number; close: number; volume: number };

function lockDown(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  for (const key of [
    "fetch",
    "XMLHttpRequest",
    "WebSocket",
    "indexedDB",
    "localStorage",
    "sessionStorage",
    "caches",
    "navigator",
  ]) {
    try {
      g[key] = undefined;
    } catch {
      /* ignore */
    }
  }
}

lockDown();

self.onmessage = (event: MessageEvent) => {
  const { id, scripts, bars } = event.data as {
    id: number;
    scripts: IndicatorScript[];
    bars: Bar[];
  };
  try {
    lockDown();
    const results = (scripts || []).map((script) => runIndicatorScript(script, bars || []));
    self.postMessage({ id, results });
  } catch (err) {
    self.postMessage({
      id,
      error: err instanceof Error ? err.message : "Error en indicadores",
    });
  }
};

import { api, type ServerIndicator } from "@/lib/api";
import {
  loadIndicatorScripts,
  saveIndicatorScripts,
  type IndicatorScript,
} from "@/lib/indicatorScript";

let syncTimer: ReturnType<typeof setTimeout> | undefined;

function fromServer(row: ServerIndicator): IndicatorScript {
  return {
    id: row.clientId,
    name: row.name,
    source: row.source,
    enabled: row.enabled && !row.blocked,
    blocked: row.blocked,
    sourceHash: row.sourceHash,
  };
}

export function persistIndicatorScripts(scripts: IndicatorScript[]): void {
  saveIndicatorScripts(scripts);
  if (typeof window === "undefined") return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    void api.indicators.saveMine(
      scripts.map((s) => ({
        clientId: s.id,
        name: s.name,
        source: s.source,
        enabled: s.enabled,
      }))
    );
  }, 350);
}

export async function hydrateIndicatorScripts(): Promise<IndicatorScript[]> {
  const local = loadIndicatorScripts();
  const res = await api.indicators.mine();
  if (res.success && Array.isArray(res.data) && res.data.length > 0) {
    const next = res.data.map(fromServer);
    saveIndicatorScripts(next);
    return next;
  }
  if (local.length) persistIndicatorScripts(local);
  return local;
}

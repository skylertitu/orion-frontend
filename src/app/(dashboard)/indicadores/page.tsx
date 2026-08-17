"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LiveChart from "@/components/LiveChart";
import { getUser } from "@/lib/auth";
import { api, type InUseIndicator, type PopularIndicator } from "@/lib/api";
import { loadChartPrefs } from "@/lib/chartPrefs";
import {
  BLANK_SCRIPT,
  DEFAULT_SCRIPTS,
  loadIndicatorScripts,
  newIndicatorScript,
  type IndicatorScript,
} from "@/lib/indicatorScript";
import { hydrateIndicatorScripts, persistIndicatorScripts } from "@/lib/indicatorSync";
import ModuleGate from "@/components/ModuleGate";

type DrawerTarget =
  | { kind: "mine"; id: string }
  | { kind: "popular"; hash: string }
  | { kind: "inuse"; key: string };

function fromServer(row: { clientId: string; name: string; source: string; enabled: boolean; blocked: boolean; sourceHash: string }): IndicatorScript {
  return {
    id: row.clientId,
    name: row.name,
    source: row.source,
    enabled: row.enabled && !row.blocked,
    blocked: row.blocked,
    sourceHash: row.sourceHash,
  };
}

export default function IndicadoresPage() {
  const router = useRouter();
  const user = getUser();
  const isAdmin = user?.role === "admin";
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [scripts, setScripts] = useState<IndicatorScript[]>([]);
  const [popular, setPopular] = useState<PopularIndicator[]>([]);
  const [inUse, setInUse] = useState<InUseIndicator[]>([]);
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftSource, setDraftSource] = useState("");

  useEffect(() => {
    if (!isAdmin) router.replace("/mercado");
  }, [isAdmin, router]);

  useEffect(() => {
    const prefs = loadChartPrefs();
    setSelectedSymbol(prefs.symbol);
    setScripts(loadIndicatorScripts());
    void hydrateFromServer();
  }, []);

  async function hydrateFromServer() {
    const [list, popularRes, inUseRes] = await Promise.all([
      hydrateIndicatorScripts(),
      api.indicators.popular(),
      api.indicators.inUse(),
    ]);
    setScripts(list);
    if (popularRes.success && Array.isArray(popularRes.data)) setPopular(popularRes.data);
    if (inUseRes.success && Array.isArray(inUseRes.data)) setInUse(inUseRes.data);
  }

  function persist(next: IndicatorScript[]) {
    setScripts(next);
    persistIndicatorScripts(next);
  }

  const inUseMine = useMemo(() => scripts.filter((s) => s.enabled && !s.blocked), [scripts]);
  const libraryPopular = useMemo<PopularIndicator[]>(
    () =>
      popular.length
        ? popular
        : DEFAULT_SCRIPTS.map((script) => ({
            sourceHash: script.id,
            name: script.name,
            source: script.source,
            users: 0,
            inUse: 0,
          })),
    [popular]
  );
  const selectedMine = drawer?.kind === "mine" ? scripts.find((s) => s.id === drawer.id) ?? null : null;
  const selectedPopular = drawer?.kind === "popular" ? libraryPopular.find((s) => s.sourceHash === drawer.hash) ?? null : null;
  const selectedInUse = drawer?.kind === "inuse" ? inUse.find((s) => `${s.userId}:${s.clientId}` === drawer.key) ?? null : null;

  useEffect(() => {
    if (selectedMine) {
      setDraftName(selectedMine.name);
      setDraftSource(selectedMine.source);
      return;
    }
    if (selectedPopular) {
      setDraftName(selectedPopular.name);
      setDraftSource(selectedPopular.source);
      return;
    }
    if (selectedInUse) {
      setDraftName(selectedInUse.name);
      setDraftSource(selectedInUse.source);
    }
  }, [selectedMine?.id, selectedPopular?.sourceHash, selectedInUse?.id]);

  function openMine(id: string) {
    const script = scripts.find((s) => s.id === id);
    if (!script) return;
    setDrawer({ kind: "mine", id });
    setDraftName(script.name);
    setDraftSource(script.source);
  }

  function createScript() {
    const created = newIndicatorScript();
    persist([...scripts, created]);
    openMine(created.id);
    setDraftName(created.name);
    setDraftSource(created.source);
  }

  function saveMineDraft() {
    if (!selectedMine) return;
    persist(
      scripts.map((s) =>
        s.id === selectedMine.id
          ? { ...s, name: draftName.trim() || s.name, source: draftSource }
          : s
      )
    );
  }

  function toggleMine(id: string) {
    persist(
      scripts.map((s) => {
        if (s.id !== id) return s;
        if (s.blocked) return s;
        return { ...s, enabled: !s.enabled };
      })
    );
  }

  function deleteMine(id: string) {
    const target = scripts.find((s) => s.id === id);
    if (!target) return;
    if (!window.confirm(`¿Eliminar “${target.name}”?`)) return;
    const next = scripts.filter((s) => s.id !== id);
    persist(next);
    if (drawer?.kind === "mine" && drawer.id === id) setDrawer(null);
  }

  async function addPopular(item: PopularIndicator) {
    const already = scripts.some((s) => s.sourceHash === item.sourceHash || s.source === item.source);
    if (already) {
      const existing = scripts.find((s) => s.sourceHash === item.sourceHash || s.source === item.source);
      if (existing) openMine(existing.id);
      return;
    }
    const created = newIndicatorScript({
      name: item.name,
      source: item.source,
      enabled: true,
      sourceHash: item.sourceHash.length === 64 ? item.sourceHash : undefined,
    });
    const next = [...scripts, created];
    persist(next);
    if (item.sourceHash.length === 64) {
      const cloned = await api.indicators.clone(item.sourceHash);
      if (cloned.success && cloned.data) {
        const fromApi = fromServer(cloned.data);
        persist([...next.filter((s) => s.id !== created.id), fromApi]);
        openMine(fromApi.id);
        return;
      }
    }
    openMine(created.id);
  }

  async function blockHash(sourceHash: string, name: string, blocked: boolean) {
    if (blocked) await api.indicators.block(sourceHash, name, draftSource);
    else {
      if (!sourceHash || sourceHash.length !== 64) return;
      await api.indicators.unblock(sourceHash);
    }
    persist(
      scripts.map((s) =>
        s.sourceHash === sourceHash || s.source === draftSource
          ? { ...s, blocked, enabled: blocked ? false : s.enabled, sourceHash }
          : s
      )
    );
    void hydrateFromServer();
  }

  if (!isAdmin) return null;

  const drawerOpen = drawer != null;
  const canEdit = drawer?.kind === "mine";
  const currentHash =
    selectedMine?.sourceHash || selectedPopular?.sourceHash || selectedInUse?.sourceHash || "";
  const currentBlocked = Boolean(selectedMine?.blocked || selectedInUse?.blocked);

  return (
    <ModuleGate moduleId="indicators">
    <div className="relative flex min-h-[calc(100vh-3.5rem)] w-full min-w-0 flex-col gap-5 overflow-hidden bg-zinc-950 p-4 text-white sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4">
        <div>
          <h1 className="text-xl font-black text-white">Indicadores</h1>
          <p className="text-xs text-zinc-400">
            Administra los que están en uso, mira el código y bloquea o copia los más usados por otros traders.
          </p>
        </div>
        <button
          type="button"
          onClick={createScript}
          className="rounded-xl bg-gold px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-black"
        >
          Nuevo indicador
        </button>
      </div>

      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">En uso ahora</h2>
        {inUseMine.length === 0 && inUse.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-800 px-3 py-4 text-xs text-zinc-500">
            Nadie tiene indicadores activos todavía.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {inUseMine.map((script) => (
              <button
                key={`mine-${script.id}`}
                type="button"
                onClick={() => openMine(script.id)}
                className="rounded-xl border border-gold/30 bg-gold/10 p-3 text-left hover:border-gold/60"
              >
                <div className="text-sm font-bold text-white">{script.name}</div>
                <div className="mt-1 text-[11px] text-gold">Tú · activo en gráfica</div>
              </button>
            ))}
            {inUse
              .filter((row) => row.userId !== user?.id)
              .map((row) => (
                <button
                  key={`use-${row.userId}-${row.clientId}`}
                  type="button"
                  onClick={() => {
                    setDrawer({ kind: "inuse", key: `${row.userId}:${row.clientId}` });
                    setDraftName(row.name);
                    setDraftSource(row.source);
                  }}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-left hover:border-zinc-600"
                >
                  <div className="text-sm font-bold text-white">{row.name}</div>
                  <div className="mt-1 text-[11px] text-zinc-500">@{row.username} · en uso</div>
                </button>
              ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Mis indicadores</h2>
          <div className="space-y-1 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-2">
            {scripts.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-zinc-500">No hay indicadores. Crea uno o copia de los más usados.</p>
            )}
            {scripts.map((script) => (
              <div
                key={script.id}
                className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${
                  drawer?.kind === "mine" && drawer.id === script.id
                    ? "border-gold/40 bg-gold/10"
                    : "border-transparent hover:bg-zinc-900"
                }`}
              >
                <button
                  type="button"
                  title={script.blocked ? "Bloqueado" : script.enabled ? "Ocultar" : "Mostrar"}
                  onClick={() => toggleMine(script.id)}
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    script.blocked ? "bg-red-500" : script.enabled ? "bg-emerald-400" : "bg-zinc-700"
                  }`}
                />
                <button type="button" onClick={() => openMine(script.id)} className="min-w-0 flex-1 truncate text-left text-sm font-semibold">
                  {script.name}
                </button>
                <button
                  type="button"
                  onClick={() => deleteMine(script.id)}
                  className="rounded px-1.5 text-[11px] font-bold text-zinc-500 hover:text-red-400"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Más usados por otros</h2>
          <div className="space-y-1 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-2">
            {libraryPopular.map((item) => (
              <div key={item.sourceHash} className="rounded-xl px-2 py-2 hover:bg-zinc-900">
                <div className="text-sm font-semibold text-white">{item.name}</div>
                <div className="text-[11px] text-zinc-500">
                  {item.users > 0
                    ? `${item.users} trader${item.users === 1 ? "" : "s"} · ${item.inUse} en uso`
                    : "Biblioteca Orion"}
                </div>
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDrawer({ kind: "popular", hash: item.sourceHash });
                      setDraftName(item.name);
                      setDraftSource(item.source);
                    }}
                    className="text-[11px] font-bold text-gold hover:underline"
                  >
                    Ver código
                  </button>
                  <button type="button" onClick={() => void addPopular(item)} className="text-[11px] font-bold text-zinc-400 hover:text-white">
                    Usar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <LiveChart
        symbol={selectedSymbol}
        height={360}
        scripts={scripts}
        onScriptsChange={persist}
        adminTools
      />

      {drawerOpen && (
        <>
          <button
            type="button"
            aria-label="Cerrar panel"
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setDrawer(null)}
          />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-zinc-800 bg-[#0b0e14] shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div>
                <div className="text-sm font-bold text-white">{canEdit ? "Editar indicador" : "Código del indicador"}</div>
                <div className="text-[11px] text-zinc-500">
                  {selectedInUse ? `@${selectedInUse.username}` : selectedPopular ? "Biblioteca / comunidad" : "Tu librería"}
                </div>
              </div>
              <button type="button" onClick={() => setDrawer(null)} className="rounded-lg px-2 py-1 text-zinc-400 hover:text-white">
                Cerrar
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                readOnly={!canEdit}
                className="rounded-xl border border-zinc-800 bg-black px-3 py-2 font-mono text-sm text-white outline-none focus:border-gold"
              />
              <textarea
                value={draftSource}
                onChange={(e) => setDraftSource(e.target.value)}
                readOnly={!canEdit}
                spellCheck={false}
                placeholder={BLANK_SCRIPT}
                className="min-h-[280px] flex-1 resize-y rounded-xl border border-zinc-800 bg-[#07090e] px-3 py-2 font-mono text-[11px] leading-5 text-zinc-200 outline-none focus:border-gold"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 p-4">
              <div className="flex flex-wrap gap-2">
                {canEdit && selectedMine && (
                  <button
                    type="button"
                    onClick={() => toggleMine(selectedMine.id)}
                    disabled={selectedMine.blocked}
                    className="rounded-lg border border-zinc-800 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-300 hover:text-white disabled:opacity-40"
                  >
                    {selectedMine.enabled ? "Quitar de gráfica" : "Poner en gráfica"}
                  </button>
                )}
                {(currentHash || draftSource) && (
                  <button
                    type="button"
                    onClick={() => void blockHash(currentHash, draftName || "Indicador", !currentBlocked)}
                    className="rounded-lg border border-red-500/30 px-3 py-1.5 text-[11px] font-bold uppercase text-red-400 hover:bg-red-500/10"
                  >
                    {currentBlocked ? "Desbloquear" : "Bloquear"}
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                {canEdit && selectedMine && (
                  <>
                    <button
                      type="button"
                      onClick={() => deleteMine(selectedMine.id)}
                      className="rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-500 hover:text-red-400"
                    >
                      Eliminar
                    </button>
                    <button
                      type="button"
                      onClick={saveMineDraft}
                      className="rounded-lg bg-gold px-3 py-1.5 text-[11px] font-bold uppercase text-black"
                    >
                      Guardar
                    </button>
                  </>
                )}
                {!canEdit && (selectedPopular || selectedInUse) && (
                  <button
                    type="button"
                    onClick={() =>
                      void addPopular({
                        sourceHash: currentHash || `local_${Date.now()}`,
                        name: draftName,
                        source: draftSource,
                        users: selectedPopular?.users || 1,
                        inUse: selectedPopular?.inUse || 1,
                      })
                    }
                    className="rounded-lg bg-gold px-3 py-1.5 text-[11px] font-bold uppercase text-black"
                  >
                    Usar en mi gráfica
                  </button>
                )}
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
    </ModuleGate>
  );
}

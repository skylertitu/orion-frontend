"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import { hasCapability } from "@/lib/plans";
import { isStaff } from "@/lib/roles";
import { api, type InUseIndicator, type PopularIndicator } from "@/lib/api";
import {
  BLANK_SCRIPT,
  DEFAULT_SCRIPTS,
  INDICATOR_CATEGORIES,
  indicatorCategoryLabel,
  newIndicatorScript,
  normalizeIndicatorCategory,
  type IndicatorCategory,
  type IndicatorScript,
} from "@/lib/indicatorScript";
import { hydrateIndicatorScripts, persistIndicatorScripts } from "@/lib/indicatorSync";
import ModuleGate from "@/components/ModuleGate";
import PlanGate from "@/components/PlanGate";

type DrawerTarget =
  | { kind: "mine"; id: string }
  | { kind: "popular"; hash: string }
  | { kind: "inuse"; key: string };

type Scope = "mine" | "library" | "inuse";

function fromServer(row: {
  clientId: string;
  name: string;
  source: string;
  enabled: boolean;
  blocked: boolean;
  sourceHash: string;
  category?: IndicatorCategory;
}): IndicatorScript {
  return {
    id: row.clientId,
    name: row.name,
    source: row.source,
    enabled: row.enabled && !row.blocked,
    blocked: row.blocked,
    sourceHash: row.sourceHash,
    category: normalizeIndicatorCategory(row.category, row.name, row.source),
  };
}

function categoryOf(name: string, source: string, category?: IndicatorCategory): IndicatorCategory {
  return normalizeIndicatorCategory(category, name, source);
}

export default function IndicadoresPage() {
  const router = useRouter();
  const user = getUser();
  const isAdmin = isStaff(user);
  const canEdit = hasCapability(user, "indicators_editor");
  const canLibrary = hasCapability(user, "indicators_library");
  const [scripts, setScripts] = useState<IndicatorScript[]>([]);
  const [popular, setPopular] = useState<PopularIndicator[]>([]);
  const [inUse, setInUse] = useState<InUseIndicator[]>([]);
  const [scope, setScope] = useState<Scope>("mine");
  const [filter, setFilter] = useState<IndicatorCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftSource, setDraftSource] = useState("");
  const [draftCategory, setDraftCategory] = useState<IndicatorCategory>("custom");

  useEffect(() => {
    if (!hasCapability(user, "indicators_library") && !hasCapability(user, "indicators_editor")) {
      router.replace("/mercado");
    }
  }, [user, router]);

  useEffect(() => {
    void hydrateFromServer();
  }, []);

  async function hydrateFromServer() {
    const [list, popularRes, inUseRes] = await Promise.all([
      hydrateIndicatorScripts(),
      api.indicators.popular(),
      isAdmin ? api.indicators.inUse() : Promise.resolve({ success: true, data: [] as InUseIndicator[] }),
    ]);
    setScripts(list);
    if (popularRes.success && Array.isArray(popularRes.data)) setPopular(popularRes.data);
    if (inUseRes.success && Array.isArray(inUseRes.data)) setInUse(inUseRes.data);
  }

  function persist(next: IndicatorScript[]) {
    setScripts(next);
    persistIndicatorScripts(next);
  }

  const libraryPopular = useMemo<PopularIndicator[]>(
    () =>
      popular.length
        ? popular
        : DEFAULT_SCRIPTS.map((script) => ({
            sourceHash: script.id,
            name: script.name,
            source: script.source,
            category: script.category,
            users: 0,
            inUse: 0,
          })),
    [popular]
  );

  const selectedMine = drawer?.kind === "mine" ? scripts.find((s) => s.id === drawer.id) ?? null : null;
  const selectedPopular =
    drawer?.kind === "popular" ? libraryPopular.find((s) => s.sourceHash === drawer.hash) ?? null : null;
  const selectedInUse =
    drawer?.kind === "inuse" ? inUse.find((s) => `${s.userId}:${s.clientId}` === drawer.key) ?? null : null;

  useEffect(() => {
    if (selectedMine) {
      setDraftName(selectedMine.name);
      setDraftSource(selectedMine.source);
      setDraftCategory(categoryOf(selectedMine.name, selectedMine.source, selectedMine.category));
      return;
    }
    if (selectedPopular) {
      setDraftName(selectedPopular.name);
      setDraftSource(selectedPopular.source);
      setDraftCategory(categoryOf(selectedPopular.name, selectedPopular.source, selectedPopular.category));
      return;
    }
    if (selectedInUse) {
      setDraftName(selectedInUse.name);
      setDraftSource(selectedInUse.source);
      setDraftCategory(categoryOf(selectedInUse.name, selectedInUse.source, selectedInUse.category));
    }
  }, [selectedMine?.id, selectedPopular?.sourceHash, selectedInUse?.id]);

  function openMine(id: string) {
    const script = scripts.find((s) => s.id === id);
    if (!script) return;
    setDrawer({ kind: "mine", id });
    setDraftName(script.name);
    setDraftSource(script.source);
    setDraftCategory(categoryOf(script.name, script.source, script.category));
  }

  function createScript() {
    const created = newIndicatorScript({ category: filter === "all" ? "custom" : filter });
    persist([...scripts, created]);
    setScope("mine");
    openMine(created.id);
  }

  function saveMineDraft() {
    if (!selectedMine) return;
    persist(
      scripts.map((s) =>
        s.id === selectedMine.id
          ? {
              ...s,
              name: draftName.trim() || s.name,
              source: draftSource,
              category: draftCategory,
            }
          : s
      )
    );
    setDrawer(null);
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
    persist(scripts.filter((s) => s.id !== id));
    if (drawer?.kind === "mine" && drawer.id === id) setDrawer(null);
  }

  async function addPopular(item: PopularIndicator) {
    const already = scripts.some((s) => s.sourceHash === item.sourceHash || s.source === item.source);
    if (already) {
      const existing = scripts.find((s) => s.sourceHash === item.sourceHash || s.source === item.source);
      if (existing) {
        setScope("mine");
        openMine(existing.id);
      }
      return;
    }
    const created = newIndicatorScript({
      name: item.name,
      source: item.source,
      enabled: true,
      category: categoryOf(item.name, item.source, item.category),
      sourceHash: item.sourceHash.length === 64 ? item.sourceHash : undefined,
    });
    const next = [...scripts, created];
    persist(next);
    setScope("mine");
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

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (name: string, source: string, category?: IndicatorCategory) => {
      const cat = categoryOf(name, source, category);
      if (filter !== "all" && cat !== filter) return false;
      if (!q) return true;
      return name.toLowerCase().includes(q) || indicatorCategoryLabel(cat).toLowerCase().includes(q);
    };

    if (scope === "library") {
      return libraryPopular
        .filter((item) => match(item.name, item.source, item.category))
        .map((item) => ({
          key: `lib-${item.sourceHash}`,
          kind: "popular" as const,
          name: item.name,
          category: categoryOf(item.name, item.source, item.category),
          meta: item.users > 0 ? `${item.users} traders · ${item.inUse} en uso` : "Biblioteca Orion",
          item,
        }));
    }

    if (scope === "inuse") {
      return inUse
        .filter((row) => match(row.name, row.source, row.category))
        .map((row) => ({
          key: `use-${row.userId}-${row.clientId}`,
          kind: "inuse" as const,
          name: row.name,
          category: categoryOf(row.name, row.source, row.category),
          meta: `@${row.username}${row.userId === user?.id ? " · tú" : ""}`,
          row,
        }));
    }

    return scripts
      .filter((script) => match(script.name, script.source, script.category))
      .map((script) => ({
        key: `mine-${script.id}`,
        kind: "mine" as const,
        name: script.name,
        category: categoryOf(script.name, script.source, script.category),
        meta: script.blocked ? "Bloqueado" : script.enabled ? "Activo en Mercado" : "Inactivo",
        script,
      }));
  }, [filter, inUse, libraryPopular, query, scope, scripts, user?.id]);

  const categoryCounts = useMemo(() => {
    const pool =
      scope === "library"
        ? libraryPopular.map((i) => categoryOf(i.name, i.source, i.category))
        : scope === "inuse"
          ? inUse.map((i) => categoryOf(i.name, i.source, i.category))
          : scripts.map((i) => categoryOf(i.name, i.source, i.category));
    const counts: Record<string, number> = { all: pool.length };
    for (const cat of INDICATOR_CATEGORIES) counts[cat.id] = pool.filter((c) => c === cat.id).length;
    return counts;
  }, [inUse, libraryPopular, scope, scripts]);

  if (!canLibrary && !canEdit) return null;

  const drawerOpen = drawer != null;
  const editingMine = drawer?.kind === "mine" && canEdit;
  const currentHash =
    selectedMine?.sourceHash || selectedPopular?.sourceHash || selectedInUse?.sourceHash || "";
  const currentBlocked = Boolean(selectedMine?.blocked || selectedInUse?.blocked);

  return (
    <ModuleGate moduleId="indicators">
      <PlanGate capability="indicators_library">
        <div className="relative flex min-h-[calc(100vh-3.5rem)] w-full min-w-0 flex-col gap-5 bg-zinc-950 p-4 text-white sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4">
            <div>
              <h1 className="text-xl font-black text-white">Indicadores</h1>
              <p className="text-xs text-zinc-400">
                {canEdit
                  ? "Lista, clasifica, crea y edita tus indicadores. La gráfica vive en Mercado."
                  : "Consulta la librería y copia indicadores a tu lista. Crear código nuevo es del plan Builder."}
              </p>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={createScript}
                className="rounded-xl bg-gold px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-black"
              >
                Nuevo indicador
              </button>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["mine", "Mis indicadores"],
                  ["library", "Biblioteca"],
                  ...(isAdmin ? ([["inuse", "En uso"]] as const) : []),
                ] as Array<[Scope, string]>
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setScope(id)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${
                    scope === id ? "bg-gold text-black" : "border border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o clase"
              className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-gold"
            />

            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Clasificador</div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                    filter === "all" ? "bg-white text-black" : "bg-zinc-900 text-zinc-400 hover:text-white"
                  }`}
                >
                  Todos ({categoryCounts.all || 0})
                </button>
                {INDICATOR_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFilter(cat.id)}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                      filter === cat.id ? "bg-gold text-black" : "bg-zinc-900 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {cat.label} ({categoryCounts[cat.id] || 0})
                  </button>
                ))}
              </div>
            </div>
          </div>

          <section className="min-h-0 flex-1 rounded-2xl border border-zinc-800 bg-zinc-950/80">
            {rows.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-zinc-500">
                {scope === "mine"
                  ? "No hay indicadores en esta clase. Crea uno o cópialo de la biblioteca."
                  : "No hay indicadores en esta clase."}
              </p>
            ) : (
              <ul className="divide-y divide-zinc-800/80">
                {rows.map((row) => (
                  <li key={row.key} className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-4">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">{row.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                        <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-zinc-300">
                          {indicatorCategoryLabel(row.category)}
                        </span>
                        <span>{row.meta}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {row.kind === "mine" && (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleMine(row.script.id)}
                            disabled={row.script.blocked}
                            className="rounded-lg border border-zinc-800 px-2.5 py-1 text-[11px] font-bold uppercase text-zinc-400 hover:text-white disabled:opacity-40"
                          >
                            {row.script.enabled ? "Desactivar" : "Activar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openMine(row.script.id)}
                            className="rounded-lg border border-gold/40 px-2.5 py-1 text-[11px] font-bold uppercase text-gold"
                          >
                            {canEdit ? "Editar" : "Ver"}
                          </button>
                        </>
                      )}
                      {row.kind === "popular" && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setDrawer({ kind: "popular", hash: row.item.sourceHash });
                              setDraftName(row.item.name);
                              setDraftSource(row.item.source);
                              setDraftCategory(row.category);
                            }}
                            className="rounded-lg border border-zinc-800 px-2.5 py-1 text-[11px] font-bold uppercase text-zinc-400 hover:text-white"
                          >
                            Ver
                          </button>
                          <button
                            type="button"
                            onClick={() => void addPopular(row.item)}
                            className="rounded-lg bg-gold px-2.5 py-1 text-[11px] font-bold uppercase text-black"
                          >
                            Usar
                          </button>
                        </>
                      )}
                      {row.kind === "inuse" && (
                        <button
                          type="button"
                          onClick={() => {
                            setDrawer({ kind: "inuse", key: `${row.row.userId}:${row.row.clientId}` });
                            setDraftName(row.row.name);
                            setDraftSource(row.row.source);
                            setDraftCategory(row.category);
                          }}
                          className="rounded-lg border border-zinc-800 px-2.5 py-1 text-[11px] font-bold uppercase text-zinc-400 hover:text-white"
                        >
                          Ver
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

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
                    <div className="text-sm font-bold text-white">
                      {editingMine ? "Editar indicador" : "Código del indicador"}
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      {selectedInUse
                        ? `@${selectedInUse.username}`
                        : selectedPopular
                          ? "Biblioteca / comunidad"
                          : "Tu librería"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrawer(null)}
                    className="rounded-lg px-2 py-1 text-zinc-400 hover:text-white"
                  >
                    Cerrar
                  </button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
                  <input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    readOnly={!editingMine}
                    placeholder="Nombre del indicador"
                    className="rounded-xl border border-zinc-800 bg-black px-3 py-2 font-mono text-sm text-white outline-none focus:border-gold"
                  />
                  <label className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Clase</span>
                    <select
                      value={draftCategory}
                      disabled={!editingMine}
                      onChange={(e) => setDraftCategory(e.target.value as IndicatorCategory)}
                      className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-gold disabled:opacity-60"
                    >
                      {INDICATOR_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <textarea
                    value={draftSource}
                    onChange={(e) => setDraftSource(e.target.value)}
                    readOnly={!editingMine}
                    spellCheck={false}
                    placeholder={BLANK_SCRIPT}
                    className="min-h-[280px] flex-1 resize-y rounded-xl border border-zinc-800 bg-[#07090e] px-3 py-2 font-mono text-[11px] leading-5 text-zinc-200 outline-none focus:border-gold"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 p-4">
                  <div className="flex flex-wrap gap-2">
                    {selectedMine && (
                      <button
                        type="button"
                        onClick={() => toggleMine(selectedMine.id)}
                        disabled={selectedMine.blocked}
                        className="rounded-lg border border-zinc-800 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-300 hover:text-white disabled:opacity-40"
                      >
                        {selectedMine.enabled ? "Desactivar en Mercado" : "Activar en Mercado"}
                      </button>
                    )}
                    {isAdmin && (currentHash || draftSource) && (
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
                    {editingMine && selectedMine && (
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
                    {!editingMine && (selectedPopular || selectedInUse) && (
                      <button
                        type="button"
                        onClick={() =>
                          void addPopular({
                            sourceHash: currentHash || `local_${Date.now()}`,
                            name: draftName,
                            source: draftSource,
                            category: draftCategory,
                            users: selectedPopular?.users || 1,
                            inUse: selectedPopular?.inUse || 1,
                          })
                        }
                        className="rounded-lg bg-gold px-3 py-1.5 text-[11px] font-bold uppercase text-black"
                      >
                        Añadir a mi lista
                      </button>
                    )}
                  </div>
                </div>
              </aside>
            </>
          )}
        </div>
      </PlanGate>
    </ModuleGate>
  );
}

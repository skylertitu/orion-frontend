"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BLANK_SCRIPT,
  DEFAULT_SCRIPTS,
  newIndicatorScript,
  type IndicatorScript,
} from "@/lib/indicatorScript";

interface IndicatorScriptEditorProps {
  scripts: IndicatorScript[];
  onChange: (next: IndicatorScript[]) => void;
  errors?: Record<string, string>;
  compact?: boolean;
}

export default function IndicatorScriptEditor({
  scripts,
  onChange,
  errors = {},
  compact = false,
}: IndicatorScriptEditorProps) {
  const scriptsRef = useRef(scripts);
  scriptsRef.current = scripts;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const pendingIdRef = useRef<string | null>(null);

  const [selectedId, setSelectedId] = useState(scripts[0]?.id || "");
  const [draft, setDraft] = useState(scripts[0]?.source || BLANK_SCRIPT);
  const [draftName, setDraftName] = useState(scripts[0]?.name || "Nuevo indicador");

  const selected = useMemo(
    () => scripts.find((s) => s.id === selectedId) ?? null,
    [scripts, selectedId]
  );

  useEffect(() => {
    if (pendingIdRef.current && scripts.some((s) => s.id === pendingIdRef.current)) {
      pendingIdRef.current = null;
    }
    if (scripts.length === 0) {
      if (selectedId) setSelectedId("");
      return;
    }
    if (pendingIdRef.current) return;
    if (!scripts.some((s) => s.id === selectedId)) {
      setSelectedId(scripts[0].id);
    }
  }, [scripts, selectedId]);

  useEffect(() => {
    if (!selected) {
      if (!pendingIdRef.current) {
        setDraft(BLANK_SCRIPT);
        setDraftName("Nuevo indicador");
      }
      return;
    }
    setDraft(selected.source);
    setDraftName(selected.name);
  }, [selected?.id]);

  useEffect(() => {
    if (!selected) return;
    const name = draftName.trim() || selected.name;
    if (draft === selected.source && name === selected.name) return;
    const timer = window.setTimeout(() => {
      const list = scriptsRef.current;
      const current = list.find((s) => s.id === selected.id);
      if (!current) return;
      onChangeRef.current(
        list.map((s) => (s.id === current.id ? { ...s, name, source: draft } : s))
      );
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draft, draftName, selected]);

  const dirty = selected
    ? draft !== selected.source || draftName.trim() !== selected.name
    : Boolean(draftName.trim() || draft.trim());

  function persist(next: IndicatorScript[]) {
    scriptsRef.current = next;
    onChangeRef.current(next);
  }

  function commitCurrent(list = scriptsRef.current): IndicatorScript[] {
    const current = list.find((s) => s.id === selectedId);
    if (!current) return list;
    const name = draftName.trim() || current.name;
    if (current.source === draft && current.name === name) return list;
    const next = list.map((s) => (s.id === current.id ? { ...s, name, source: draft } : s));
    persist(next);
    return next;
  }

  function selectScript(id: string) {
    if (id === selectedId) return;
    commitCurrent();
    const next = scriptsRef.current.find((s) => s.id === id);
    setSelectedId(id);
    if (next) {
      setDraft(next.source);
      setDraftName(next.name);
    }
  }

  function createScript() {
    const list = commitCurrent();
    const created = newIndicatorScript();
    pendingIdRef.current = created.id;
    persist([...list, created]);
    setSelectedId(created.id);
    setDraft(created.source);
    setDraftName(created.name);
  }

  function saveScript() {
    if (selected) {
      commitCurrent();
      return;
    }
    const created = newIndicatorScript({
      name: draftName.trim() || "Nuevo indicador",
      source: draft || BLANK_SCRIPT,
      enabled: true,
    });
    pendingIdRef.current = created.id;
    persist([...scriptsRef.current, created]);
    setSelectedId(created.id);
    setDraft(created.source);
    setDraftName(created.name);
  }

  function deleteScript(id: string) {
    const target = scriptsRef.current.find((s) => s.id === id);
    if (!target) return;
    if (!window.confirm(`¿Borrar el indicador “${target.name}”?`)) return;

    const remaining = scriptsRef.current.filter((s) => s.id !== id);
    persist(remaining);
    if (selectedId !== id) return;

    const next = remaining[0];
    setSelectedId(next?.id || "");
    setDraft(next?.source || BLANK_SCRIPT);
    setDraftName(next?.name || "Nuevo indicador");
  }

  function toggleEnabled(id: string) {
    persist(scriptsRef.current.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  }

  function restoreDefaults() {
    if (!window.confirm("¿Restaurar los indicadores por defecto? Se perderán los que creaste.")) return;
    const next = DEFAULT_SCRIPTS.map((s) => ({ ...s }));
    persist(next);
    setSelectedId(next[0].id);
    setDraft(next[0].source);
    setDraftName(next[0].name);
  }

  return (
    <div
      className={`flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-950/80 text-white shadow-xl ${
        compact ? "gap-2 p-2" : "gap-4 p-4"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className={`font-bold text-white ${compact ? "text-sm" : "text-base"}`}>Indicadores</h2>
          <p className="text-[11px] text-zinc-500">
            Crea, edita o borra scripts en JavaScript. No pegues Pine Script de TradingView.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          <button
            type="button"
            onClick={createScript}
            className="rounded-lg bg-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-black"
          >
            Crear
          </button>
          <button
            type="button"
            onClick={restoreDefaults}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] font-bold uppercase text-zinc-400 hover:text-white"
          >
            Defaults
          </button>
        </div>
      </div>

      <div className={`flex min-h-0 ${compact ? "flex-col gap-2" : "gap-3"}`}>
        <div className={`space-y-1 ${compact ? "" : "w-48 shrink-0"}`}>
          {scripts.length === 0 && (
            <p className="rounded-lg border border-dashed border-zinc-800 px-2 py-3 text-center text-[11px] text-zinc-500">
              No hay indicadores. Pulsa Crear.
            </p>
          )}
          {scripts.map((script) => {
            const active = script.id === selectedId;
            const hasErr = Boolean(errors[script.id]);
            const onChart = script.enabled && !hasErr;
            return (
              <div
                key={script.id}
                className={`flex w-full items-center gap-1 rounded-lg border px-1.5 py-1 ${
                  active ? "border-gold/40 bg-gold/10" : "border-transparent hover:bg-zinc-900"
                }`}
              >
                <button
                  type="button"
                  title={
                    hasErr
                      ? "Error: no se dibuja en la gráfica"
                      : script.enabled
                        ? "En gráfica (pulsa para ocultar)"
                        : "Oculto (pulsa para mostrar)"
                  }
                  onClick={() => toggleEnabled(script.id)}
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    hasErr ? "bg-red-500" : onChart ? "bg-emerald-400" : "bg-zinc-700"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => selectScript(script.id)}
                  className="min-w-0 flex-1 truncate px-1 text-left font-mono text-[11px] font-semibold text-white"
                >
                  {script.name}
                </button>
                <button
                  type="button"
                  title="Borrar"
                  onClick={() => deleteScript(script.id)}
                  className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-500 hover:bg-red-500/15 hover:text-red-400"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex gap-2">
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Nombre del indicador"
              className="w-full rounded-lg border border-zinc-800 bg-black px-2.5 py-1.5 font-mono text-xs text-white outline-none focus:border-gold"
            />
            <button
              type="button"
              onClick={() => selected && deleteScript(selected.id)}
              disabled={!selected}
              className="rounded-lg border border-zinc-800 px-2 py-1 text-[10px] font-bold uppercase text-zinc-500 hover:border-red-500/40 hover:text-red-400 disabled:opacity-40"
            >
              Borrar
            </button>
          </div>

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            placeholder={BLANK_SCRIPT}
            className={`w-full resize-y rounded-xl border border-zinc-800 bg-[#0b0b0b] px-3 py-2 font-mono text-[11px] leading-5 text-zinc-200 outline-none focus:border-gold ${
              compact ? "min-h-[220px]" : "min-h-[280px]"
            }`}
          />

          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-zinc-600">JS: plot / box / ray · ta.ema · ta.rsi · ta.sessionBoxes</p>
            <button
              type="button"
              onClick={saveScript}
              className="rounded-lg bg-gold px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-black disabled:opacity-40"
              disabled={!dirty}
            >
              {selected ? "Guardar" : "Crear"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

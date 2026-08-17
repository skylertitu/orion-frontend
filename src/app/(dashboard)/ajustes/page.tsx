"use client";

import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";

interface AjusteItem {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

const STORAGE_KEY = "orion_ui_ajustes";

const AJUSTES: AjusteItem[] = [
  { id: "alertas", label: "Alertas de precio", description: "Notificaciones cuando un par alcanza un precio objetivo", enabled: true },
  { id: "notificaciones", label: "Notificaciones del motor", description: "Avisos de órdenes ejecutadas y cambios de estado", enabled: true },
  { id: "sonido", label: "Sonido de señales", description: "Reproducir sonido cuando Lucy IA genera una señal", enabled: false },
  { id: "mantenimiento", label: "Modo mantenimiento", description: "Pausa temporal del motor de trading", enabled: false },
];

export default function AjustesPage() {
  const [items, setItems] = useState<AjusteItem[]>(AJUSTES);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as AjusteItem[];
      if (Array.isArray(parsed) && parsed.length) setItems(parsed);
    } catch {
      /* ignore */
    }
  }, []);

  function toggle(id: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, enabled: !it.enabled } : it)));
  }

  function save() {
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      toast.success("Preferencias guardadas en este navegador.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] min-w-0 flex-col gap-6 bg-[#07090e] p-4 text-white sm:p-6">
      {/* Header */}
      <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-5 shadow-xl">
        <h1 className="text-xl font-black text-white">Ajustes</h1>
        <p className="mt-0.5 text-xs text-zinc-400">
          Preferencias de esta sesión del navegador. Aún no hay API de ajustes en el backend.
        </p>
      </div>

      {/* Settings List */}
      <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-5 shadow-xl">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-400">
          Preferencias generales
        </h2>

        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4"
            >
              <div className="min-w-0 pr-2">
                <div className="text-sm font-semibold text-white">{item.label}</div>
                <div className="text-xs text-zinc-500">{item.description}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={item.enabled}
                onClick={() => toggle(item.id)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  item.enabled ? "bg-gold" : "bg-zinc-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    item.enabled ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-gold px-5 py-2 text-xs font-bold text-black transition-colors hover:bg-gold/90 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

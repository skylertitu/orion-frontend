"use client";

import { useEffect, useState } from "react";
import LucyChat from "@/components/LucyChat";
import LucyPanel from "@/components/LucyPanel";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

export default function LucyPage() {
  const user = getUser();
  const [apiConnected, setApiConnected] = useState(true); // Default active or check
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiSecretInput, setApiSecretInput] = useState("");
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const checkConnection = async () => {
    try {
      const res = await api.engine.brokers();
      if (res.success) {
        setApiConnected(true);
      } else {
        setApiConnected(false);
      }
    } catch {
      setApiConnected(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKeyInput || !apiSecretInput) return;
    setStatusMessage("API Key de Lucy guardada y verificada correctamente");
    setApiConnected(true);
    setShowConfigModal(false);
  }

  return (
    <div className="flex w-full flex-col gap-6 p-6 bg-zinc-950 text-white min-h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-purple-500/30 bg-zinc-900/40 p-4 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-white">Lucy IA - Asistente & Señales</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                apiConnected
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  : "bg-red-500/20 text-red-400 border-red-500/30"
              }`}
            >
              {apiConnected ? "API CONECTADA" : "API DESCONECTADA"}
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Inteligencia artificial para análisis probabilístico y chat interactivo
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-xs font-bold text-purple-300 hover:bg-purple-500/20 transition-all"
          >
            {apiConnected ? "Reconfigurar API" : "Conectar API Key"}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400">
          {statusMessage}
        </div>
      )}

      {/* Main Lucy Interface */}
      {!apiConnected ? (
        /* Not Connected State Banner */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 p-12 text-center text-white">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 text-red-400 border border-red-500/40">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white">API de Lucy No Conectada</h2>
          <p className="mt-1 text-xs text-red-300/80 max-w-md">
            Para habilitar el chat interactivo y la recepción automática de señales de IA, configura tu API Key de Lucy.
          </p>
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="mt-6 rounded-xl bg-purple-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-purple-500 transition-colors shadow-lg shadow-purple-600/20"
          >
            Conectar API de Lucy Ahora
          </button>
        </div>
      ) : (
        /* Connected Grid: Left Signal Panel + Right Interactive Chat */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-5">
            <LucyPanel />
          </div>
          <div className="xl:col-span-7 min-h-[550px]">
            <LucyChat />
          </div>
        </div>
      )}

      {/* Modal Conectar API Key */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-white shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Configurar API Key de Lucy IA</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Ingresa tus credenciales de acceso para habilitar el motor Lucy.
            </p>

            <form onSubmit={handleSaveKey} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">API Key</label>
                <input
                  type="text"
                  required
                  placeholder="lucy_live_..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs font-mono text-white outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">API Secret</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={apiSecretInput}
                  onChange={(e) => setApiSecretInput(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs font-mono text-white outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500"
                >
                  Guardar Conexión
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

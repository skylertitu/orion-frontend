"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { api, BrokerAccountPublic, BrokerStatus } from "@/lib/api";
import { getUser } from "@/lib/auth";

const STEPS: Record<string, string[]> = {
  binance: [
    "Conecta tu cuenta en Cuentas con API Key y Secret.",
    "Backend corriendo en puerto 3008.",
    "Verifica internet y acceso a api.binance.com.",
  ],
  bybit: [
    "Conecta tu cuenta en Cuentas con API Key y Secret.",
    "Permisos de lectura y trading en Bybit.",
    "Usa testnet si tu cuenta es de prueba.",
  ],
  mt5: [
    "MT_ENABLED=true en backend/.env",
    "MetaTrader abierto con EA OrionBridge.",
    "AutoTrading activo en MT.",
  ],
};

const BROKER_LABELS: Record<string, string> = {
  binance: "Binance Spot",
  bybit: "Bybit",
  mt5: "MetaTrader 5",
};

const BROKER_IDS = ["binance", "bybit", "mt5"] as const;

function BrokerCard({
  name,
  connected,
  enabled = true,
  error,
  message,
  steps,
  expanded,
  onToggle,
  checking,
}: {
  name: string;
  connected: boolean;
  enabled?: boolean;
  error?: string;
  message?: string;
  steps: string[];
  expanded: boolean;
  onToggle: () => void;
  checking: boolean;
}) {
  const showDetails = !connected || expanded;

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-900/50"
      >
        <div className="flex items-center gap-3">
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
              checking
                ? "animate-pulse bg-zinc-500"
                : !enabled
                  ? "bg-amber-500"
                  : connected
                    ? "bg-[#089981]"
                    : "bg-red-500"
            }`}
          />
          <div>
            <div className="text-sm font-semibold text-white">{name}</div>
            <div className="text-xs text-zinc-500">
              {checking ? "Verificando..." : connected ? "Conectado" : enabled ? "Desconectado" : "Deshabilitado"}
            </div>
          </div>
        </div>
        <span className="text-xs text-zinc-500">{showDetails && !connected ? "▾" : expanded ? "▴" : "▾"}</span>
      </button>

      {showDetails && (expanded || !connected) && (
        <div className="border-t border-zinc-800 bg-black/40 px-4 py-3">
          {message && <p className="mb-2 text-xs text-zinc-400">{message}</p>}
          {error && (
            <div className="mb-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}
          {!connected && (
            <>
              <ol className="mb-3 list-decimal space-y-1 pl-4 text-xs text-zinc-400">
                {steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              <Link href="/cuentas" className="text-xs text-gold hover:underline">
                Ir a Cuentas →
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface BrokerConnectionsProps {
  streamConnected: boolean;
  streamError?: string;
}

function BrokerConnectionsInner({ streamConnected, streamError }: BrokerConnectionsProps) {
  const userId = getUser()?.id;
  const [brokers, setBrokers] = useState<BrokerStatus[]>([]);
  const [accounts, setAccounts] = useState<BrokerAccountPublic[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [checking, setChecking] = useState(true);
  const [backendError, setBackendError] = useState<string>();
  const mountedRef = useRef(true);
  const autoExpandedRef = useRef(false);

  const checkStatus = useCallback(
    async (silent = false) => {
      if (!silent) setChecking(true);

      const [brokersRes, accountsRes] = await Promise.all([
        api.engine.brokers(),
        userId
          ? api.brokerAccounts.list(userId)
          : Promise.resolve({ success: true as const, data: [] as BrokerAccountPublic[] }),
      ]);

      if (!mountedRef.current) return;

      if (!brokersRes.success) {
        if (!silent) {
          setBackendError(brokersRes.error || "Backend no disponible");
          setChecking(false);
        }
        return;
      }

      setBackendError(undefined);
      setBrokers(brokersRes.data || []);
      if (accountsRes.success && accountsRes.data) {
        setAccounts(accountsRes.data);
      }

      if (!autoExpandedRef.current) {
        const mt5 = brokersRes.data?.find((b) => b.id === "mt5");
        if (mt5 && !mt5.connected) {
          setExpanded((e) => ({ ...e, mt5: true }));
        }
        autoExpandedRef.current = true;
      }

      setChecking(false);
    },
    [userId]
  );

  useEffect(() => {
    mountedRef.current = true;
    checkStatus(false);
    const id = setInterval(() => checkStatus(true), 60000);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [checkStatus]);

  function isConnected(brokerId: string, global?: BrokerStatus): boolean {
    const acc =
      accounts.find((a) => a.brokerId === brokerId && a.isPrimary) ||
      accounts.find((a) => a.brokerId === brokerId);

    if (acc) {
      if (brokerId === "binance") return acc.status === "connected" && streamConnected;
      return acc.status === "connected";
    }
    if (brokerId === "binance") return (global?.connected ?? false) && streamConnected;
    return global?.connected ?? false;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Conexión de brokers
        </h2>
        <div className="flex gap-3">
          <Link href="/cuentas" className="text-xs text-gold hover:underline">
            Cuentas
          </Link>
          <button
            type="button"
            onClick={() => checkStatus(false)}
            className="text-xs text-gold hover:underline"
          >
            Verificar
          </button>
        </div>
      </div>

      {backendError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {backendError}
        </div>
      )}

      {BROKER_IDS.map((id) => {
        const global = brokers.find((b) => b.id === id);
        const acc =
          accounts.find((a) => a.brokerId === id && a.isPrimary) ||
          accounts.find((a) => a.brokerId === id);
        const connected = !checking && isConnected(id, global);
        let error = acc?.lastError || global?.error;
        if (id === "binance" && !streamConnected) {
          error = streamError || error || "WebSocket de precios sin datos";
        }

        return (
          <BrokerCard
            key={id}
            name={BROKER_LABELS[id] || id}
            connected={connected}
            enabled={global?.enabled ?? true}
            error={connected ? undefined : error}
            message={acc ? `${acc.accountName}${acc.isPrimary ? " (principal)" : ""}` : global?.message}
            steps={STEPS[id] || []}
            expanded={!!expanded[id]}
            onToggle={() => setExpanded((e) => ({ ...e, [id]: !e[id] }))}
            checking={checking}
          />
        );
      })}
    </div>
  );
}

const BrokerConnections = memo(BrokerConnectionsInner);
export default BrokerConnections;

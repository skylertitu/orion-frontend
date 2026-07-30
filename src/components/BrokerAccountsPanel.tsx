"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, BrokerAccountPublic } from "@/lib/api";
import { getUser } from "@/lib/auth";

const BROKERS = [
  { id: "binance", label: "Binance" },
  { id: "bybit", label: "Bybit" },
  { id: "mt5", label: "MetaTrader 5" },
] as const;

const inputClass =
  "w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-gold";

function statusColor(status: string) {
  if (status === "connected") return "text-green-400";
  if (status === "disabled") return "text-amber-400";
  if (status === "error") return "text-red-400";
  return "text-zinc-400";
}

export default function BrokerAccountsPanel() {
  const user = getUser();
  const [accounts, setAccounts] = useState<BrokerAccountPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    brokerId: "binance",
    accountName: "",
    accountType: "spot",
    environment: "mainnet",
    apiKey: "",
    apiSecret: "",
    isPrimary: false,
  });

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const res = await api.brokerAccounts.list(user.id);
    if (res.success && res.data) setAccounts(res.data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleTest(accountId: number) {
    if (!user) return;
    setTestingId(accountId);
    const res = await api.brokerAccounts.test(user.id, accountId);
    if (res.success && res.data) {
      setAccounts((prev) =>
        prev.map((a) => (a.id === accountId ? res.data!.account : a))
      );
    }
    setTestingId(null);
  }

  async function handlePrimary(accountId: number) {
    if (!user) return;
    const res = await api.brokerAccounts.setPrimary(user.id, accountId);
    if (res.success) load();
  }

  async function handleDelete(accountId: number) {
    if (!user || !confirm("¿Eliminar esta cuenta?")) return;
    const res = await api.brokerAccounts.delete(user.id, accountId);
    if (res.success) load();
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    const res = await api.brokerAccounts.create({
      userId: user.id,
      brokerId: form.brokerId,
      accountName: form.accountName.trim(),
      accountType: form.accountType,
      environment: form.environment,
      isPrimary: form.isPrimary,
      credentials: {
        apiKey: form.apiKey || undefined,
        apiSecret: form.apiSecret || undefined,
      },
    });
    if (res.success) {
      setShowForm(false);
      setForm({
        brokerId: "binance",
        accountName: "",
        accountType: "spot",
        environment: "mainnet",
        apiKey: "",
        apiSecret: "",
        isPrimary: false,
      });
      load();
    } else {
      setError(res.error || "Error al crear cuenta");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Cuentas conectadas
        </h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="text-xs text-gold hover:underline"
        >
          {showForm ? "Cancelar" : "+ Conectar cuenta"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4"
        >
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Broker</label>
              <select
                value={form.brokerId}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    brokerId: e.target.value,
                    accountType: e.target.value === "mt5" ? "live" : "spot",
                  }))
                }
                className={inputClass}
              >
                {BROKERS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Nombre</label>
              <input
                value={form.accountName}
                onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
                required
                className={inputClass}
              />
            </div>
            {form.brokerId !== "mt5" && (
              <>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">API Key</label>
                  <input
                    value={form.apiKey}
                    onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                    className={inputClass}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">API Secret</label>
                  <input
                    type="password"
                    value={form.apiSecret}
                    onChange={(e) => setForm((f) => ({ ...f, apiSecret: e.target.value }))}
                    className={inputClass}
                    autoComplete="off"
                  />
                </div>
              </>
            )}
          </div>
          <button
            type="submit"
            className="rounded-lg bg-gold/20 px-4 py-2 text-sm font-medium text-gold"
          >
            Guardar
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Cargando...</p>
      ) : accounts.length === 0 ? (
        <p className="rounded-lg border border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">
          Sin cuentas
        </p>
      ) : (
        <div className="space-y-2">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3"
            >
              <div>
                <div className="text-sm font-medium text-white">
                  {acc.accountName}
                  {acc.isPrimary && <span className="ml-2 text-xs text-gold">principal</span>}
                </div>
                <div className="text-xs text-zinc-500">
                  {acc.brokerId.toUpperCase()} ·{" "}
                  <span className={statusColor(acc.status)}>{acc.status}</span>
                </div>
                {acc.lastError && (
                  <p className="mt-1 text-xs text-red-400">{acc.lastError}</p>
                )}
              </div>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleTest(acc.id)}
                  disabled={testingId === acc.id}
                  className="text-gold"
                >
                  Probar
                </button>
                {!acc.isPrimary && (
                  <button type="button" onClick={() => handlePrimary(acc.id)} className="text-zinc-400">
                    Principal
                  </button>
                )}
                <button type="button" onClick={() => handleDelete(acc.id)} className="text-red-400">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

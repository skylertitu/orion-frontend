"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api, BrokerAccountPublic, type BrokerStatus } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { toast } from "@/lib/toast";

const BROKERS = [
  { id: "binance", label: "Binance", hint: "Spot · API key" },
  { id: "bybit", label: "Bybit", hint: "Spot · API key" },
  { id: "mt5", label: "MetaTrader 5", hint: "Puente EA" },
] as const;

function brokerMeta(id: string) {
  return BROKERS.find((b) => b.id === id) || { id, label: id, hint: "" };
}

function isWorking(status?: BrokerStatus) {
  return Boolean(status?.enabled && status?.connected);
}

const inputClass =
  "w-full rounded-xl border border-zinc-800 bg-black/60 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-gold";

function statusMeta(status: string) {
  if (status === "connected") return { className: "bg-emerald-500/15 text-emerald-300", label: "Conectado" };
  if (status === "disabled") return { className: "bg-amber-500/15 text-amber-300", label: "Deshabilitado" };
  if (status === "error") return { className: "bg-red-500/15 text-red-300", label: "Error" };
  return { className: "bg-zinc-800 text-zinc-400", label: status || "Pendiente" };
}

const emptyForm = {
  brokerId: "binance",
  accountName: "",
  accountType: "spot",
  environment: "mainnet",
  apiKey: "",
  apiSecret: "",
  isPrimary: false,
};

export default function BrokerAccountsPanel() {
  const [accounts, setAccounts] = useState<BrokerAccountPublic[]>([]);
  const [statuses, setStatuses] = useState<BrokerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [modeId, setModeId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    const current = getUser();
    if (!current?.id) {
      setLoading(false);
      toast.error("Sesión no encontrada. Vuelve a iniciar sesión.");
      return;
    }
    setLoading(true);
    const [accountsRes, brokersRes] = await Promise.all([
      api.brokerAccounts.list(),
      api.engine.brokers(),
    ]);
    if (accountsRes.success && accountsRes.data) {
      setAccounts(accountsRes.data);
    } else {
      toast.error(accountsRes.error || "No se pudieron cargar las cuentas");
    }
    if (brokersRes.success && Array.isArray(brokersRes.data)) {
      setStatuses(brokersRes.data);
    } else {
      setStatuses([
        { id: "binance", label: "Binance", connected: true, enabled: true },
        { id: "bybit", label: "Bybit", connected: true, enabled: true },
        { id: "mt5", label: "MetaTrader 5", connected: false, enabled: false },
      ]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const availableBrokers = useMemo(
    () => BROKERS.filter((b) => isWorking(statuses.find((s) => s.id === b.id))),
    [statuses]
  );

  function openForm(brokerId?: string) {
    const id =
      brokerId && availableBrokers.some((b) => b.id === brokerId)
        ? brokerId
        : availableBrokers[0]?.id;
    if (!id) {
      toast.error("Ningún broker está activo ahora.");
      return;
    }
    setForm({
      ...emptyForm,
      brokerId: id,
      accountType: id === "mt5" ? "live" : "spot",
    });
    setShowForm(true);
  }

  function selectBroker(brokerId: string) {
    setForm((f) => ({
      ...f,
      brokerId,
      accountType: brokerId === "mt5" ? "live" : "spot",
    }));
  }

  async function handleTest(accountId: number) {
    const current = getUser();
    if (!current) return;
    setTestingId(accountId);
    const res = await api.brokerAccounts.test(current.id, accountId);
    if (res.success && res.data) {
      setAccounts((prev) => prev.map((a) => (a.id === accountId ? res.data!.account : a)));
      toast.success("Conexión verificada");
    } else {
      toast.error(res.error || "No se pudo probar la conexión");
    }
    setTestingId(null);
  }

  async function handleMode(accountId: number, mode: "demo" | "live") {
    const current = getUser();
    if (!current) return;
    if (
      mode === "live" &&
      !window.confirm(
        "¿Pasar esta cuenta a LIVE?\nLas siguientes órdenes se enviarán de verdad al broker. Empieza en DEMO si aún estás probando."
      )
    ) {
      return;
    }
    setModeId(accountId);
    const res = await api.brokerAccounts.setMode(current.id, accountId, mode);
    if (res.success && res.data) {
      setAccounts((prev) => prev.map((a) => (a.id === accountId ? res.data! : a)));
      toast.success(res.message || (mode === "live" ? "Cuenta en LIVE" : "Cuenta en DEMO"));
    } else {
      toast.error(res.error || "No se pudo cambiar el modo");
    }
    setModeId(null);
  }

  async function handlePrimary(accountId: number) {
    const current = getUser();
    if (!current) return;
    const res = await api.brokerAccounts.setPrimary(current.id, accountId);
    if (res.success) load();
    else toast.error(res.error || "No se pudo marcar como principal");
  }

  async function handleDelete(accountId: number) {
    const current = getUser();
    if (!current || !confirm("¿Eliminar esta cuenta?")) return;
    const res = await api.brokerAccounts.delete(current.id, accountId);
    if (res.success) load();
    else toast.error(res.error || "No se pudo eliminar la cuenta");
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const current = getUser();
    if (!current) return;
    if (!availableBrokers.some((b) => b.id === form.brokerId)) {
      toast.error("Ese broker no está activo. Elige uno que funcione.");
      return;
    }

    const res = await api.brokerAccounts.create({
      userId: current.id,
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
      setForm(emptyForm);
      toast.success("Cuenta conectada");
      load();
    } else {
      toast.error(res.error || "Error al crear cuenta");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-white">Brokers</h2>
          <p className="text-xs text-zinc-500">Pruebas manuales de compra/venta. Nacen en DEMO.</p>
        </div>
        {availableBrokers.length > 0 && (
          <button
            type="button"
            onClick={() => (showForm ? setShowForm(false) : openForm())}
            className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wide ${
              showForm ? "border border-zinc-700 text-zinc-300" : "bg-gold text-black"
            }`}
          >
            {showForm ? "Cerrar" : "+ Conectar broker"}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-4 rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-5">
          <div className={`grid gap-2 ${availableBrokers.length >= 3 ? "sm:grid-cols-3" : availableBrokers.length === 2 ? "sm:grid-cols-2" : ""}`}>
            {availableBrokers.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => selectBroker(b.id)}
                className={`rounded-2xl border px-4 py-3 text-left ${
                  form.brokerId === b.id
                    ? "border-gold/50 bg-gold/10"
                    : "border-zinc-800 bg-black/30 hover:border-zinc-700"
                }`}
              >
                <div className={`text-sm font-black ${form.brokerId === b.id ? "text-gold" : "text-white"}`}>{b.label}</div>
                <div className="text-[11px] text-zinc-500">{b.hint}</div>
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-zinc-500">
              Nombre
              <input
                value={form.accountName}
                onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
                required
                placeholder="Ej. Binance desk"
                className={`${inputClass} mt-1.5`}
              />
            </label>
            {form.brokerId !== "mt5" && (
              <>
                <label className="block text-xs text-zinc-500">
                  API Key
                  <input
                    value={form.apiKey}
                    onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                    className={`${inputClass} mt-1.5`}
                    autoComplete="off"
                  />
                </label>
                <label className="block text-xs text-zinc-500 sm:col-span-2">
                  API Secret
                  <input
                    type="password"
                    value={form.apiSecret}
                    onChange={(e) => setForm((f) => ({ ...f, apiSecret: e.target.value }))}
                    className={`${inputClass} mt-1.5`}
                    autoComplete="off"
                  />
                </label>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-zinc-500">
              {form.brokerId === "mt5"
                ? "MT5 usa el puente del EA. No pega API keys aquí."
                : "Pega las API keys reales. La cuenta nace en DEMO."}
            </p>
            <button type="submit" className="rounded-xl bg-gold px-4 py-2 text-xs font-black uppercase tracking-wide text-black">
              Guardar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] px-4 py-10 text-center text-sm text-zinc-500">
          Cargando brokers…
        </div>
      ) : accounts.length === 0 && !showForm ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-[#0a0d16] p-6">
          <p className="text-center text-sm font-semibold text-white">Ningún broker conectado</p>
          <p className="mx-auto mt-1 max-w-md text-center text-xs text-zinc-500">
            {availableBrokers.length === 0
              ? "Ningún broker está activo en el servidor ahora. Cuando Binance, Bybit o MT5 respondan, aparecerán aquí."
              : "Elige uno para pruebas manuales. Lucy no opera con estas cuentas."}
          </p>
          {availableBrokers.length > 0 && (
          <div className={`mt-5 grid gap-3 ${availableBrokers.length >= 3 ? "sm:grid-cols-3" : availableBrokers.length === 2 ? "sm:grid-cols-2" : ""}`}>
            {availableBrokers.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => openForm(b.id)}
                className="rounded-2xl border border-zinc-800 bg-black/40 px-4 py-4 text-left hover:border-gold/40"
              >
                <div className="text-sm font-black text-white">{b.label}</div>
                <div className="mt-1 text-[11px] text-zinc-500">{b.hint}</div>
                <div className="mt-3 text-[10px] font-bold uppercase tracking-wide text-gold">Conectar</div>
              </button>
            ))}
          </div>
          )}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {accounts.map((acc) => {
            const live = (acc.executionMode || "demo") === "live";
            const status = statusMeta(acc.status);
            return (
              <article
                key={`broker-${acc.id}`}
                className={`rounded-2xl border p-4 ${
                  acc.isPrimary
                    ? "border-gold/40 bg-gradient-to-br from-gold/10 via-[#0a0d16] to-[#0a0d16]"
                    : "border-zinc-800/80 bg-[#0a0d16]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-black text-white">{acc.accountName}</h3>
                      {acc.isPrimary && (
                        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase text-gold">
                          Principal
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          live ? "bg-red-500/15 text-red-300" : "bg-amber-500/10 text-amber-300"
                        }`}
                      >
                        {live ? "Live" : "Demo"}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
                      {brokerMeta(acc.brokerId).label}
                    </div>
                    {acc.lastError && <p className="mt-2 break-words text-xs text-red-400">{acc.lastError}</p>}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleTest(acc.id)}
                    disabled={testingId === acc.id}
                    className="rounded-lg border border-zinc-800 px-3 py-1.5 text-[11px] font-bold uppercase text-gold hover:border-gold/40 disabled:opacity-40"
                  >
                    {testingId === acc.id ? "Probando…" : "Probar"}
                  </button>
                  {!acc.isPrimary && (
                    <button
                      type="button"
                      onClick={() => handlePrimary(acc.id)}
                      className="rounded-lg border border-zinc-800 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-300 hover:text-white"
                    >
                      Principal
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={modeId === acc.id}
                    onClick={() => void handleMode(acc.id, live ? "demo" : "live")}
                    className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase ${
                      live
                        ? "border-amber-500/20 text-amber-300"
                        : "border-red-500/20 text-red-300"
                    }`}
                  >
                    {modeId === acc.id ? "…" : live ? "Volver a demo" : "Pasar a live"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(acc.id)}
                    className="rounded-lg border border-red-500/20 px-3 py-1.5 text-[11px] font-bold uppercase text-red-400 hover:bg-red-500/10"
                  >
                    Eliminar
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

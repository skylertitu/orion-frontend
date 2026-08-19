"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, BrokerAccountPublic, WalletPublic } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { toast } from "@/lib/toast";
import {
  connectPhantom,
  disconnectPhantom,
  isPhantomInstalled,
  signPhantomMessage,
} from "@/lib/solanaWallet";

const BROKERS = [
  { id: "binance", label: "Binance" },
  { id: "bybit", label: "Bybit" },
  { id: "mt5", label: "MetaTrader 5" },
  { id: "phantom", label: "Phantom" },
] as const;

const inputClass =
  "w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-gold";

function statusColor(status: string) {
  if (status === "connected") return "text-green-400";
  if (status === "disabled") return "text-amber-400";
  if (status === "error") return "text-red-400";
  return "text-zinc-400";
}

function shortAddr(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

const emptyForm = {
  brokerId: "binance",
  accountName: "",
  accountType: "spot",
  environment: "mainnet",
  apiKey: "",
  apiSecret: "",
  isPrimary: false,
  phantomUsername: "",
  phantomAccount: "",
};

export default function BrokerAccountsPanel() {
  const [accounts, setAccounts] = useState<BrokerAccountPublic[]>([]);
  const [wallets, setWallets] = useState<WalletPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [modeId, setModeId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [connectingPhantom, setConnectingPhantom] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const isPhantom = form.brokerId === "phantom";

  const load = useCallback(async () => {
    const current = getUser();
    if (!current?.id) {
      setLoading(false);
      toast.error("Sesión no encontrada. Vuelve a iniciar sesión.");
      return;
    }
    setLoading(true);
    const [accountsRes, walletsRes] = await Promise.all([
      api.brokerAccounts.list(),
      api.wallets.list(),
    ]);
    if (accountsRes.success && accountsRes.data) {
      setAccounts(accountsRes.data);
    } else {
      toast.error(accountsRes.error || "No se pudieron cargar las cuentas");
    }
    if (walletsRes.success && Array.isArray(walletsRes.data)) {
      setWallets(walletsRes.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function selectBroker(brokerId: string) {
    const current = getUser();
    setForm((f) => ({
      ...f,
      brokerId,
      accountType: brokerId === "mt5" ? "live" : "spot",
      phantomUsername:
        brokerId === "phantom" ? f.phantomUsername || current?.username || "" : f.phantomUsername,
    }));
  }

  async function handleTest(accountId: number) {
    const current = getUser();
    if (!current) return;
    setTestingId(accountId);
    const res = await api.brokerAccounts.test(current.id, accountId);
    if (res.success && res.data) {
      setAccounts((prev) =>
        prev.map((a) => (a.id === accountId ? res.data!.account : a))
      );
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

  async function handleWalletPrimary(id: number) {
    const res = await api.wallets.setPrimary(id);
    if (res.success) load();
    else toast.error(res.error || "No se pudo marcar como principal");
  }

  async function handleWalletUnlink(id: number) {
    if (!confirm("¿Desvincular esta billetera?")) return;
    const res = await api.wallets.unlink(id);
    if (res.success) {
      await disconnectPhantom();
      load();
    } else {
      toast.error(res.error || "No se pudo desvincular");
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const current = getUser();
    if (!current) return;

    if (isPhantom) {
      const username = form.phantomUsername.trim();
      if (!username) {
        toast.error("Escribe el nombre de usuario");
        return;
      }
      if (!isPhantomInstalled()) {
        window.open("https://phantom.app/download", "_blank", "noreferrer");
        toast.info("Instala Phantom y recarga esta pestaña");
        return;
      }
      setConnectingPhantom(true);
      try {
        const address = await connectPhantom();
        setForm((f) => ({ ...f, phantomAccount: address }));
        const nonceRes = await api.wallets.nonce(address);
        if (!nonceRes.success || !nonceRes.data?.message) {
          throw new Error(nonceRes.error || "No se pudo crear el nonce");
        }
        toast.info("Firma el mensaje en Phantom");
        const signature = await signPhantomMessage(nonceRes.data.message);
        const linkRes = await api.wallets.link({
          address,
          signature,
          nonce: nonceRes.data.nonce,
          issuedAt: nonceRes.data.issuedAt,
          label: username,
        });
        if (!linkRes.success) {
          throw new Error(linkRes.error || "No se pudo vincular Phantom");
        }
        setShowForm(false);
        setForm(emptyForm);
        toast.success("Phantom conectada");
        load();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo conectar Phantom");
      }
      setConnectingPhantom(false);
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

  const empty = accounts.length === 0 && wallets.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Cuentas conectadas
        </h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="shrink-0 text-xs text-gold hover:underline"
        >
          {showForm ? "Cancelar" : "+ Conectar cuenta"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Broker</label>
              <select
                value={form.brokerId}
                onChange={(e) => selectBroker(e.target.value)}
                className={inputClass}
              >
                {BROKERS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
            {!isPhantom && (
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Nombre</label>
                <input
                  value={form.accountName}
                  onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
                  required
                  className={inputClass}
                />
              </div>
            )}
            {isPhantom && (
              <>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Nombre de usuario</label>
                  <input
                    value={form.phantomUsername}
                    onChange={(e) => setForm((f) => ({ ...f, phantomUsername: e.target.value }))}
                    required
                    placeholder="Tu usuario en Orion"
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-zinc-500">Cuenta</label>
                  <input
                    value={form.phantomAccount}
                    readOnly
                    placeholder="Se completa al conectar Phantom"
                    className={inputClass}
                  />
                </div>
              </>
            )}
            {form.brokerId !== "mt5" && !isPhantom && (
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
            disabled={connectingPhantom}
            className="w-full rounded-lg bg-gold/20 px-4 py-2 text-sm font-medium text-gold disabled:opacity-40 sm:w-auto"
          >
            {isPhantom
              ? connectingPhantom
                ? "Abriendo Phantom..."
                : "Conectar Phantom"
              : "Guardar"}
          </button>
          <p className="text-[11px] text-zinc-500">
            {isPhantom
              ? "Phantom pedirá permiso y una firma. El campo cuenta se llena con tu dirección pública."
              : "Pega las API keys reales. La cuenta nace en DEMO: prueba de conexión al broker, órdenes simuladas."}
          </p>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Cargando...</p>
      ) : empty ? (
        <p className="rounded-lg border border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">
          Sin cuentas. Conecta Binance, Bybit, MT5 o Phantom; empieza en DEMO.
        </p>
      ) : (
        <div className="space-y-2">
          {accounts.map((acc) => (
            <div
              key={`broker-${acc.id}`}
              className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-white">
                  {acc.accountName}
                  {acc.isPrimary && <span className="ml-2 text-xs text-gold">principal</span>}
                  <span
                    className={`ml-2 text-[10px] font-bold uppercase ${
                      (acc.executionMode || "demo") === "live" ? "text-red-300" : "text-amber-300"
                    }`}
                  >
                    {(acc.executionMode || "demo") === "live" ? "LIVE" : "DEMO"}
                  </span>
                </div>
                <div className="text-xs text-zinc-500">
                  {acc.brokerId.toUpperCase()} ·{" "}
                  <span className={statusColor(acc.status)}>{acc.status}</span>
                </div>
                {acc.lastError && (
                  <p className="mt-1 break-words text-xs text-red-400">{acc.lastError}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-3 text-xs sm:justify-end">
                <button
                  type="button"
                  onClick={() => handleTest(acc.id)}
                  disabled={testingId === acc.id}
                  className="text-gold"
                >
                  {testingId === acc.id ? "Probando..." : "Probar"}
                </button>
                {!acc.isPrimary && (
                  <button type="button" onClick={() => handlePrimary(acc.id)} className="text-zinc-400">
                    Principal
                  </button>
                )}
                {(acc.executionMode || "demo") === "live" ? (
                  <button
                    type="button"
                    disabled={modeId === acc.id}
                    onClick={() => void handleMode(acc.id, "demo")}
                    className="text-amber-300"
                  >
                    {modeId === acc.id ? "..." : "Volver a demo"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={modeId === acc.id}
                    onClick={() => void handleMode(acc.id, "live")}
                    className="text-red-300"
                  >
                    {modeId === acc.id ? "..." : "Pasar a live"}
                  </button>
                )}
                <button type="button" onClick={() => handleDelete(acc.id)} className="text-red-400">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
          {wallets.map((wallet) => (
            <div
              key={`wallet-${wallet.id}`}
              className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-white">
                  {wallet.label || "Phantom"}
                  {wallet.isPrimary && <span className="ml-2 text-xs text-gold">principal</span>}
                  <span className="ml-2 text-[10px] font-bold uppercase text-amber-300">DEMO</span>
                </div>
                <div className="font-mono text-xs text-zinc-500" title={wallet.address}>
                  PHANTOM · {shortAddr(wallet.address)}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-xs sm:justify-end">
                {!wallet.isPrimary && (
                  <button type="button" onClick={() => void handleWalletPrimary(wallet.id)} className="text-zinc-400">
                    Principal
                  </button>
                )}
                <button type="button" onClick={() => void handleWalletUnlink(wallet.id)} className="text-red-400">
                  Desvincular
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

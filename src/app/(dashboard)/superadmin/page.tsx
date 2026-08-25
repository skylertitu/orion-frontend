"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { api, AdminUser } from "@/lib/api";
import { PLAN_LABELS } from "@/lib/plans";
import { isStaff, isSuperAdmin, roleLabel } from "@/lib/roles";

const fieldClass =
  "w-full rounded-xl border border-zinc-800 bg-[#111726] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-gold";

function initials(u: AdminUser) {
  const a = (u.firstName?.[0] || u.username?.[0] || "?").toUpperCase();
  const b = (u.lastName?.[0] || u.username?.[1] || "").toUpperCase();
  return `${a}${b}`;
}

export default function SuperadminPage() {
  const router = useRouter();
  const me = getUser();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [blockId, setBlockId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!isSuperAdmin(me)) router.replace("/mercado");
  }, [me, router]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const res = await api.superadmin.users({ page: 1, limit: 100, search: search.trim() || undefined });
    if (res.success && res.data) {
      setUsers(res.data.users);
    } else {
      setUsers([]);
      setLoadError(res.error || "No se pudieron cargar los usuarios");
    }
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(loadUsers, search ? 280 : 0);
    return () => clearTimeout(t);
  }, [loadUsers, search]);

  const stats = useMemo(() => {
    const blocked = users.filter((u) => u.blocked).length;
    const admins = users.filter((u) => u.role === "admin").length;
    const supers = users.filter((u) => u.role === "superadmin").length;
    return { total: users.length, blocked, admins, supers };
  }, [users]);

  async function handleRole(u: AdminUser, role: AdminUser["role"]) {
    setBusyId(u.id);
    const res = await api.superadmin.setRole(u.id, role);
    toast[res.success ? "success" : "error"](res.success ? `${u.username} → ${roleLabel(role)}` : res.error || "Error");
    setBusyId(null);
    void loadUsers();
  }

  async function confirmBlock(u: AdminUser) {
    setBusyId(u.id);
    const text = reason.trim() || `Bloqueado por ${me?.username || "superadmin"}`;
    const res = await api.superadmin.block(u.id, text);
    toast[res.success ? "success" : "error"](res.success ? `${u.username} bloqueado` : res.error || "Error");
    setBusyId(null);
    setBlockId(null);
    setReason("");
    void loadUsers();
  }

  async function handleUnblock(u: AdminUser) {
    setBusyId(u.id);
    const res = await api.superadmin.unblock(u.id);
    toast[res.success ? "success" : "error"](res.success ? `${u.username} desbloqueado` : res.error || "Error");
    setBusyId(null);
    void loadUsers();
  }

  async function handleDelete(u: AdminUser) {
    if (!confirm(`Eliminar a ${u.username} de la base de datos. Esta acción no se deshace.`)) return;
    setBusyId(u.id);
    const res = await api.superadmin.deleteUser(u.id);
    toast[res.success ? "success" : "error"](res.success ? "Usuario eliminado" : res.error || "Error");
    setBusyId(null);
    void loadUsers();
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusyId(editing.id);
    const res = await api.superadmin.updateUser(editing.id, {
      username: editing.username,
      email: editing.email,
      firstName: editing.firstName || "",
      lastName: editing.lastName || "",
      phone: editing.phone || "",
      country: editing.country || "Global",
      balance: Number(editing.balance) || 0,
      emailVerified: Boolean(editing.emailVerified),
      role: editing.role,
      plan: editing.plan,
    });
    toast[res.success ? "success" : "error"](res.success ? "Cambios guardados" : res.error || "Error");
    setBusyId(null);
    if (res.success) {
      setEditing(null);
      void loadUsers();
    }
  }

  if (!isSuperAdmin(me)) return null;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] min-w-0 flex-col gap-6 bg-[#07090e] p-4 text-white sm:p-6">
      <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-black text-white">Superadmin</h1>
          <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
            Base de datos
          </span>
        </div>
        <p className="mt-1 max-w-2xl text-xs text-zinc-400">
          Bloquea cuentas, cambia roles y edita usuarios. El admin de desk sigue con Lucy y el motor.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Usuarios", stats.total],
          ["Bloqueados", stats.blocked],
          ["Admins", stats.admins],
          ["Superadmin", stats.supers],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-4">
            <div className="text-2xl font-black text-white">{loading ? "—" : value}</div>
            <div className="mt-0.5 text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16]">
        <div className="flex flex-col gap-3 border-b border-zinc-800/80 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-sm font-bold text-white">Usuarios</h2>
            <p className="text-[11px] text-zinc-500">Busca por nombre o correo. El bloqueo pide un motivo.</p>
          </div>
          <input
            type="search"
            name="orion-user-filter"
            autoComplete="off"
            placeholder="Buscar nombre o correo"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${fieldClass} sm:max-w-xs`}
          />
        </div>

        <div className="p-4 sm:p-5">
          {loading ? (
            <div className="grid gap-3 md:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-2xl border border-zinc-800/60 bg-zinc-900/40" />
              ))}
            </div>
          ) : loadError ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-10 text-center">
              <p className="text-sm text-red-300">{loadError}</p>
              <button
                type="button"
                onClick={() => void loadUsers()}
                className="mt-4 rounded-xl border border-gold/40 px-4 py-2 text-xs font-bold uppercase text-gold"
              >
                Reintentar
              </button>
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 px-5 py-14 text-center">
              <p className="text-sm font-semibold text-white">No hay usuarios para mostrar</p>
              <p className="mt-1 text-xs text-zinc-500">
                {search ? "Prueba otra búsqueda." : "Cuando alguien se registre, aparece aquí."}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {users.map((u) => {
                const mine = u.id === me?.id;
                return (
                  <article
                    key={u.id}
                    className={`rounded-2xl border p-4 ${
                      u.blocked
                        ? "border-red-500/25 bg-red-500/[0.04]"
                        : "border-zinc-800/80 bg-zinc-950/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gold/30 bg-gold/15 text-xs font-black text-gold">
                        {initials(u)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-bold text-white">{u.username}</h3>
                          <span className="font-mono text-[10px] text-zinc-600">#{u.id}</span>
                          {mine && (
                            <span className="rounded-full border border-gold/30 px-2 py-0.5 text-[9px] font-bold uppercase text-gold">
                              tú
                            </span>
                          )}
                          {u.blocked && (
                            <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[9px] font-bold uppercase text-red-400">
                              bloqueado
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-zinc-400">{u.email}</p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          {u.blocked
                            ? u.blockedReason || "Bloqueado"
                            : isStaff(u)
                              ? "Desk operativo"
                              : PLAN_LABELS[u.plan || "builder"]}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <select
                        value={u.role}
                        disabled={mine || busyId === u.id}
                        onChange={(e) => void handleRole(u, e.target.value as AdminUser["role"])}
                        className="rounded-xl border border-zinc-800 bg-[#111726] px-3 py-2 text-xs font-semibold text-white outline-none focus:border-gold disabled:opacity-50"
                      >
                        <option value="user">Usuario</option>
                        <option value="admin">Admin</option>
                        <option value="superadmin">Superadmin</option>
                      </select>
                      {!mine && (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditing(u)}
                            className="rounded-xl border border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-gold/40 hover:text-gold"
                          >
                            Editar
                          </button>
                          {u.blocked ? (
                            <button
                              type="button"
                              onClick={() => void handleUnblock(u)}
                              className="rounded-xl border border-emerald-500/30 px-3 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10"
                            >
                              Desbloquear
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setBlockId(u.id);
                                setReason("");
                              }}
                              className="rounded-xl border border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-amber-400/40 hover:text-amber-300"
                            >
                              Bloquear
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleDelete(u)}
                            className="rounded-xl border border-red-500/20 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10"
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </div>

                    {blockId === u.id && (
                      <div className="mt-3 space-y-2 rounded-xl border border-zinc-800 bg-black/40 p-3">
                        <input
                          type="text"
                          autoComplete="off"
                          placeholder="Motivo del bloqueo"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          className={fieldClass}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void confirmBlock(u)}
                            className="rounded-xl bg-gold px-3 py-2 text-xs font-bold text-black"
                          >
                            Confirmar bloqueo
                          </button>
                          <button
                            type="button"
                            onClick={() => setBlockId(null)}
                            className="rounded-xl px-3 py-2 text-xs text-zinc-400 hover:text-white"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <form
            onSubmit={(e) => void saveEdit(e)}
            className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#0a0d16] p-5 shadow-2xl"
          >
            <h2 className="text-sm font-black text-white">Editar {editing.username}</h2>
            <p className="mb-4 text-[11px] text-zinc-500">Los cambios se guardan en la base de datos.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-[11px] font-medium text-zinc-500">
                Usuario
                <input className={`${fieldClass} mt-1`} value={editing.username} onChange={(e) => setEditing({ ...editing, username: e.target.value })} />
              </label>
              <label className="text-[11px] font-medium text-zinc-500">
                Email
                <input className={`${fieldClass} mt-1`} value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </label>
              <label className="text-[11px] font-medium text-zinc-500">
                Nombre
                <input className={`${fieldClass} mt-1`} value={editing.firstName || ""} onChange={(e) => setEditing({ ...editing, firstName: e.target.value })} />
              </label>
              <label className="text-[11px] font-medium text-zinc-500">
                Apellido
                <input className={`${fieldClass} mt-1`} value={editing.lastName || ""} onChange={(e) => setEditing({ ...editing, lastName: e.target.value })} />
              </label>
              <label className="text-[11px] font-medium text-zinc-500">
                Teléfono
                <input className={`${fieldClass} mt-1`} value={editing.phone || ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </label>
              <label className="text-[11px] font-medium text-zinc-500">
                Balance
                <input className={`${fieldClass} mt-1`} value={String(editing.balance ?? 0)} onChange={(e) => setEditing({ ...editing, balance: Number(e.target.value) })} />
              </label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={Boolean(editing.emailVerified)}
                onChange={(e) => setEditing({ ...editing, emailVerified: e.target.checked })}
              />
              Email verificado
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-xl px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white">
                Cancelar
              </button>
              <button type="submit" className="rounded-xl bg-gold px-4 py-2 text-xs font-bold text-black">
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

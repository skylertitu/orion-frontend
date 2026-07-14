"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import { api, AdminUser, AdminStats } from "@/lib/api";

// ─── Stat Card ─────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon,
  color = "text-gold",
}: {
  label: string;
  value: number | string;
  icon: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <span className={`text-3xl font-bold ${color}`}>{value}</span>
      </div>
      <p className="mt-2 text-sm text-zinc-500">{label}</p>
    </div>
  );
}

// ─── Role Badge ─────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: "user" | "admin" }) {
  return role === "admin" ? (
    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400">
      ADMIN
    </span>
  ) : (
    <span className="rounded-full bg-zinc-700/60 px-2 py-0.5 text-xs font-semibold text-zinc-400">
      USER
    </span>
  );
}

// ─── Main Admin Page ────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter();
  const user = getUser();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Guard: redirect if not admin
  useEffect(() => {
    if (!user || user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [user, router]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const loadStats = useCallback(async () => {
    const res = await api.admin.stats();
    if (res.success && res.data) setStats(res.data);
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const res = await api.admin.users({
      page: currentPage,
      limit: 15,
      search: search || undefined,
    });
    if (res.success && res.data) {
      setUsers(res.data.users);
      setTotalPages(res.data.pagination.pages);
    }
    setLoading(false);
  }, [currentPage, search]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    const t = setTimeout(loadUsers, 300);
    return () => clearTimeout(t);
  }, [loadUsers]);

  async function handlePromote(u: AdminUser) {
    setActionLoading(u.id);
    const res = await api.admin.promote(u.id);
    if (res.success) {
      showToast(`${u.username} ascendido a Admin ✓`);
      loadUsers();
      loadStats();
    } else {
      showToast(res.error || "Error", false);
    }
    setActionLoading(null);
  }

  async function handleDemote(u: AdminUser) {
    setActionLoading(u.id);
    const res = await api.admin.demote(u.id);
    if (res.success) {
      showToast(`${u.username} degradado a User ✓`);
      loadUsers();
      loadStats();
    } else {
      showToast(res.error || "Error", false);
    }
    setActionLoading(null);
  }

  async function handleDelete(u: AdminUser) {
    if (
      !confirm(
        `¿Eliminar permanentemente al usuario "${u.username}"? Esta acción no se puede deshacer.`
      )
    )
      return;
    setActionLoading(u.id);
    const res = await api.admin.deleteUser(u.id);
    if (res.success) {
      showToast(`Usuario "${u.username}" eliminado ✓`);
      loadUsers();
      loadStats();
    } else {
      showToast(res.error || "Error", false);
    }
    setActionLoading(null);
  }

  if (!user || user.role !== "admin") return null;

  return (
    <div className="min-h-screen w-full bg-black p-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed right-6 top-20 z-50 rounded-xl border px-5 py-3 text-sm font-medium shadow-2xl transition-all ${
            toast.ok
              ? "border-green-500/30 bg-green-900/80 text-green-300"
              : "border-red-500/30 bg-red-900/80 text-red-300"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Panel de Administración
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Gestión de usuarios y estadísticas del sistema · Orion AutoTrading
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
          <StatCard
            label="Total usuarios"
            value={stats.totalUsers}
            icon="👥"
          />
          <StatCard
            label="Usuarios regulares"
            value={stats.activeUsers}
            icon="🧑‍💼"
            color="text-blue-400"
          />
          <StatCard
            label="Administradores"
            value={stats.adminUsers}
            icon="🛡"
            color="text-amber-400"
          />
          <StatCard
            label="Total trades"
            value={stats.totalTrades}
            icon="📊"
            color="text-green-400"
          />
          <StatCard
            label="Estrategias"
            value={stats.totalStrategies}
            icon="🤖"
            color="text-purple-400"
          />
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h2 className="text-base font-semibold text-white">Usuarios</h2>
          <input
            type="text"
            placeholder="Buscar por usuario o email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-64 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/20"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs uppercase text-zinc-500">
                <th className="px-6 py-3">ID</th>
                <th className="px-6 py-3">Usuario</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Rol</th>
                <th className="px-6 py-3 text-right">Balance</th>
                <th className="px-6 py-3">Creado</th>
                <th className="px-6 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-zinc-500">
                    Cargando…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-zinc-500">
                    No se encontraron usuarios
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30"
                  >
                    <td className="px-6 py-3 font-mono text-xs text-zinc-500">
                      #{u.id}
                    </td>
                    <td className="px-6 py-3 font-medium text-white">
                      {u.username}
                      {u.id === user.id && (
                        <span className="ml-2 text-xs text-zinc-500">(tú)</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-zinc-400">{u.email}</td>
                    <td className="px-6 py-3">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-green-400">
                      ${Number(u.balance).toFixed(2)}
                    </td>
                    <td className="px-6 py-3 text-zinc-500">
                      {new Date(u.createdAt).toLocaleDateString("es-MX")}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {actionLoading === u.id ? (
                          <span className="text-xs text-zinc-500">
                            Procesando…
                          </span>
                        ) : (
                          <>
                            {u.role === "user" ? (
                              <button
                                onClick={() => handlePromote(u)}
                                disabled={u.id === user.id}
                                title="Promover a Admin"
                                className="rounded-lg bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                ↑ Admin
                              </button>
                            ) : (
                              <button
                                onClick={() => handleDemote(u)}
                                disabled={u.id === user.id}
                                title="Degradar a User"
                                className="rounded-lg bg-zinc-700/60 px-3 py-1 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                ↓ User
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(u)}
                              disabled={u.id === user.id}
                              title="Eliminar usuario"
                              className="rounded-lg bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 border-t border-zinc-800 px-6 py-4">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-white disabled:opacity-30"
            >
              ← Anterior
            </button>
            <span className="text-sm text-zinc-500">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
              disabled={currentPage === totalPages}
              className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-white disabled:opacity-30"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-4 text-xs text-zinc-500">
        <p>
          <strong className="text-zinc-400">🔐 Seguridad:</strong> Solo usuarios
          con rol <span className="text-amber-400">admin</span> pueden acceder a
          esta página. Todas las rutas{" "}
          <code className="text-zinc-300">/api/admin/*</code> requieren token JWT
          válido + verificación de rol en el backend.
        </p>
      </div>
    </div>
  );
}

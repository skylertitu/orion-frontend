"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import { api, AdminUser, AdminStats } from "@/lib/api";

export default function AdminPage() {
  const router = useRouter();
  const user = getUser();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user || user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [user, router]);

  const loadStats = useCallback(async () => {
    const res = await api.admin.stats();
    if (res.success && res.data) setStats(res.data);
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const res = await api.admin.users({ page: 1, limit: 50, search: search || undefined });
    if (res.success && res.data) setUsers(res.data.users);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    const t = setTimeout(loadUsers, 300);
    return () => clearTimeout(t);
  }, [loadUsers]);

  async function handlePromote(u: AdminUser) {
    const res = await api.admin.promote(u.id);
    setMessage(res.success ? `${u.username} es admin` : res.error || "Error");
    loadUsers();
    loadStats();
  }

  async function handleDemote(u: AdminUser) {
    const res = await api.admin.demote(u.id);
    setMessage(res.success ? `${u.username} es usuario` : res.error || "Error");
    loadUsers();
    loadStats();
  }

  async function handleDelete(u: AdminUser) {
    if (!confirm(`¿Eliminar a "${u.username}"?`)) return;
    const res = await api.admin.deleteUser(u.id);
    setMessage(res.success ? "Usuario eliminado" : res.error || "Error");
    loadUsers();
    loadStats();
  }

  if (!user || user.role !== "admin") return null;

  return (
    <div className="w-full p-6">
      <h1 className="mb-1 text-xl font-bold text-white">Administración</h1>
      <p className="mb-6 text-sm text-zinc-500">Usuarios del sistema</p>

      {message && (
        <div className="mb-4 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300">
          {message}
        </div>
      )}

      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
            <div className="text-2xl font-bold text-white">{stats.totalUsers}</div>
            <div className="text-xs text-zinc-500">Usuarios</div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
            <div className="text-2xl font-bold text-white">{stats.totalTrades}</div>
            <div className="text-xs text-zinc-500">Trades</div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
            <div className="text-2xl font-bold text-white">{stats.adminUsers}</div>
            <div className="text-xs text-zinc-500">Admins</div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
            <div className="text-2xl font-bold text-white">{stats.totalStrategies}</div>
            <div className="text-xs text-zinc-500">Estrategias</div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <h2 className="font-semibold text-white">Usuarios</h2>
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 rounded border border-zinc-700 bg-black px-3 py-1.5 text-sm text-white outline-none focus:border-gold"
          />
        </div>

        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-zinc-500">Cargando...</p>
        ) : users.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-zinc-500">Sin usuarios</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                <th className="px-5 py-2">Usuario</th>
                <th className="px-5 py-2">Email</th>
                <th className="px-5 py-2">Rol</th>
                <th className="px-5 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-zinc-800/50">
                  <td className="px-5 py-2 text-white">{u.username}</td>
                  <td className="px-5 py-2 text-zinc-400">{u.email}</td>
                  <td className="px-5 py-2">
                    <span
                      className={
                        u.role === "admin" ? "text-amber-400" : "text-zinc-400"
                      }
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-2 text-right">
                    {u.id !== user.id && (
                      <div className="flex justify-end gap-2">
                        {u.role === "user" ? (
                          <button
                            onClick={() => handlePromote(u)}
                            className="text-xs text-amber-400 hover:underline"
                          >
                            Hacer admin
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDemote(u)}
                            className="text-xs text-zinc-400 hover:underline"
                          >
                            Quitar admin
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(u)}
                          className="text-xs text-red-400 hover:underline"
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

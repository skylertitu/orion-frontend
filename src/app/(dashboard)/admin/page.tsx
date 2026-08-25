"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { api, AdminUser, AdminStats } from "@/lib/api";
import { PLAN_LABELS, USER_PLANS, userPlan } from "@/lib/plans";
import { isStaff, roleLabel } from "@/lib/roles";

export default function AdminPage() {
  const router = useRouter();
  const user = getUser();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isStaff(user)) router.replace("/mercado");
  }, [user, router]);

  const loadStats = useCallback(async () => {
    const res = await api.admin.stats();
    if (res.success && res.data) setStats(res.data);
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const res = await api.admin.users({ page: 1, limit: 50, search: search.trim() || undefined });
    if (res.success && res.data) setUsers(res.data.users);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    const t = setTimeout(loadUsers, search ? 280 : 0);
    return () => clearTimeout(t);
  }, [loadUsers, search]);

  async function handlePlan(u: AdminUser, plan: "analyst" | "signals" | "builder") {
    const res = await api.admin.setPlan(u.id, plan);
    toast[res.success ? "success" : "error"](
      res.success ? `${u.username} → ${PLAN_LABELS[plan]}` : res.error || "Error"
    );
    void loadUsers();
  }

  if (!isStaff(user)) return null;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] min-w-0 flex-col gap-6 bg-[#07090e] p-4 text-white sm:p-6">
      <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-5">
        <h1 className="text-xl font-black text-white">Administración</h1>
        <p className="mt-1 text-xs text-zinc-400">
          Planes de usuario para el desk. Bloquear cuentas y cambiar roles está en Superadmin.
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            [stats.totalUsers, "Usuarios"],
            [stats.totalTrades, "Trades"],
            [stats.adminUsers, "Staff"],
            [stats.totalStrategies, "Estrategias"],
          ].map(([value, label]) => (
            <div key={String(label)} className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-4">
              <div className="text-2xl font-black text-white">{value}</div>
              <div className="mt-0.5 text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16]">
        <div className="flex flex-col gap-3 border-b border-zinc-800/80 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <h2 className="text-sm font-bold text-white">Usuarios y planes</h2>
          <input
            type="search"
            name="orion-admin-filter"
            autoComplete="off"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-[#111726] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-gold sm:max-w-xs"
          />
        </div>

        {loading ? (
          <p className="px-5 py-12 text-center text-sm text-zinc-500">Cargando...</p>
        ) : users.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-zinc-500">Sin usuarios</p>
        ) : (
          <div className="divide-y divide-zinc-800/70">
            {users.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-[11px] font-black text-gold">
                  {u.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">
                    {u.username}
                    {u.blocked ? <span className="ml-2 text-[10px] uppercase text-red-400">bloqueado</span> : null}
                  </div>
                  <div className="truncate text-xs text-zinc-500">{u.email}</div>
                </div>
                <span className="rounded-full border border-zinc-800 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  {roleLabel(u.role)}
                </span>
                {isStaff(u) ? (
                  <span className="text-xs text-zinc-500">desk</span>
                ) : (
                  <select
                    value={userPlan(u) || "builder"}
                    onChange={(e) => void handlePlan(u, e.target.value as "analyst" | "signals" | "builder")}
                    className="rounded-xl border border-zinc-800 bg-[#111726] px-3 py-2 text-xs text-white outline-none focus:border-gold"
                  >
                    {USER_PLANS.map((plan) => (
                      <option key={plan} value={plan}>
                        {PLAN_LABELS[plan]}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

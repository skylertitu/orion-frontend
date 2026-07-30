"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { clearSession, getUser, getSession, setSession } from "@/lib/auth";
import { api } from "@/lib/api";

const navLinks = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    href: "/mercado",
    label: "Mercado",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    href: "/lucy",
    label: "Lucy IA",
    badge: "IA",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    href: "/indicadores",
    label: "Indicadores",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    ),
  },
  {
    href: "/trading",
    label: "Motor Trading",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    href: "/cuentas",
    label: "Cuentas Broker",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    href: "/perfil",
    label: "Perfil",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(getUser());
  const isAdmin = user?.role === "admin";

  // Validate JWT session automatically with backend /api/auth/me on mount
  useEffect(() => {
    async function validateMe() {
      const session = getSession();
      if (session?.token) {
        const res = await api.auth.getMe();
        if (res.success && res.data) {
          setUser(res.data);
          setSession({ token: session.token, user: res.data }, session.rememberMe ?? true);
        }
      }
    }
    validateMe();
  }, []);

  function handleLogout() {
    clearSession();
    router.replace("/");
  }

  const usernameDisplay = user?.username || "siomeyromero";
  const userInitials = usernameDisplay.substring(0, 2).toUpperCase();

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-[#07090e] text-white font-sans overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-60 border-r border-zinc-800/60 bg-[#0a0d16] flex flex-col justify-between p-4 shrink-0">
          <div>
            {/* Top Brand Logo */}
            <div className="flex items-center gap-3 px-2 py-2 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold text-black font-black text-xs shadow-md shadow-gold/20">
                AT
              </div>
              <div>
                <div className="text-sm font-bold text-white leading-tight">AutoTrade</div>
                <div className="text-[10px] text-zinc-500 font-mono">v2.4.1</div>
              </div>
            </div>

            {/* Motor Status Pill */}
            <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Motor activo</span>
            </div>

            {/* Nav Menu */}
            <nav className="space-y-1">
              {navLinks.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                      active
                        ? "border border-gold/50 bg-gold/10 text-gold shadow-sm"
                        : "text-zinc-400 hover:bg-zinc-900/60 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={active ? "text-gold" : "text-zinc-500"}>
                        {link.icon}
                      </span>
                      <span>{link.label}</span>
                    </div>

                    {link.badge && (
                      <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold text-blue-300 border border-blue-500/30">
                        {link.badge}
                      </span>
                    )}
                  </Link>
                );
              })}

              {isAdmin && (
                <Link
                  href="/admin"
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                    pathname === "/admin"
                      ? "border border-amber-500/50 bg-amber-500/10 text-amber-400"
                      : "text-amber-400/70 hover:bg-amber-500/10 hover:text-amber-300"
                  }`}
                >
                  <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  </svg>
                  <span>Configuración</span>
                </Link>
              )}
            </nav>
          </div>

          {/* Bottom User Info & Logout */}
          <div className="border-t border-zinc-800/60 pt-4 space-y-3">
            <Link href="/perfil" className="flex items-center gap-3 px-2 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/20 font-bold text-xs text-gold border border-gold/40 group-hover:scale-105 transition-transform">
                {userInitials}
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-white truncate group-hover:text-gold transition-colors">{usernameDisplay}</div>
                <div className="text-[10px] text-zinc-500 uppercase">{user?.role || "Trader"}</div>
              </div>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full text-left rounded-xl px-3.5 py-2 text-xs font-semibold text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col min-w-0 overflow-y-auto bg-[#07090e]">
          {children}
        </div>
      </div>
    </AuthGuard>
  );
}

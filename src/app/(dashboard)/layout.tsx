"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { clearSession, getUser, getSession, setSession } from "@/lib/auth";
import { api, type SystemOverview } from "@/lib/api";

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [system, setSystem] = useState<SystemOverview | null>(null);
  const isAdmin = user?.role === "admin";
  const showLabels = !isDesktop || sidebarOpen;

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

  useEffect(() => {
    let cancelled = false;
    async function loadSystem() {
      const res = await api.system.status();
      if (!cancelled && res.success && res.data) setSystem(res.data);
    }
    void loadSystem();
    const id = setInterval(() => void loadSystem(), 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      setIsDesktop(mq.matches);
      if (mq.matches) setMobileOpen(false);
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  function handleLogout() {
    clearSession();
    router.replace("/");
  }

  function confirmLogout() {
    if (window.confirm("¿Seguro que deseas salir de la sesión?")) {
      handleLogout();
    }
  }

  const usernameDisplay = user?.username || "siomeyromero";
  const userInitials = usernameDisplay.substring(0, 2).toUpperCase();
  const downCount = system?.modules.filter((m) => m.enabled && m.health === "down").length ?? 0;
  const pausedCount = system?.modules.filter((m) => !m.enabled).length ?? 0;
  const motorOk = downCount === 0 && pausedCount === 0;
  const motorLabel = !system
    ? "Motor"
    : downCount
      ? `${downCount} con error`
      : pausedCount
        ? `${pausedCount} apagados`
        : "Motor activo";

  const desktopExpanded = sidebarOpen;

  return (
    <AuthGuard>
      <div className="flex min-h-dvh bg-[#07090e] text-white font-sans overflow-hidden">
        <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-zinc-800/60 bg-[#0a0d16] px-3 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold text-black text-xs font-black">
              AT
            </div>
            <span className="truncate text-sm font-bold">AutoTrade</span>
          </div>
        </header>

        {mobileOpen && (
          <button
            type="button"
            aria-label="Cerrar menú"
            className="fixed inset-0 z-40 bg-black/70 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <aside
          className={`fixed z-50 flex flex-col justify-between overflow-y-auto border-zinc-800/60 bg-[#0a0d16] p-4 shadow-2xl shadow-black/60 transition-all duration-200
            max-md:inset-y-0 max-md:left-0 max-md:w-[min(16.5rem,88vw)] max-md:rounded-none max-md:border-r
            ${mobileOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full"}
            md:top-3 md:bottom-3 md:left-3 md:rounded-2xl md:border
            ${desktopExpanded ? "md:w-60" : "md:w-16 md:items-center"}`}
        >
          <div className={showLabels ? "" : "w-full flex flex-col items-center"}>
            <div className={`mb-4 flex items-center ${showLabels ? "w-full justify-between" : "justify-center"}`}>
              <button
                type="button"
                onClick={() => {
                  if (isDesktop) setSidebarOpen((o) => !o);
                  else setMobileOpen(false);
                }}
                aria-label="Abrir o cerrar menú"
                className={`flex items-center gap-3 px-2 py-2 transition-colors ${
                  showLabels ? "" : "justify-center"
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold text-black font-black text-xs shadow-md shadow-gold/20">
                  AT
                </div>
                {showLabels && (
                  <div className="text-left">
                    <div className="text-sm font-bold text-white leading-tight">AutoTrade</div>
                    <div className="text-[10px] text-zinc-500 font-mono">v2.4.1</div>
                  </div>
                )}
              </button>
              {mobileOpen && (
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Cerrar menú"
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 md:hidden"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {showLabels && (
              <>
                {/* Motor Status Pill */}
                <Link
                  href="/trading?tab=control"
                  className={`mb-6 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                    motorOk
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : downCount
                        ? "border-red-500/30 bg-red-500/10 text-red-300"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      motorOk ? "animate-pulse bg-emerald-400" : downCount ? "bg-red-400" : "bg-amber-400"
                    }`}
                  />
                  <span>{motorLabel}</span>
                </Link>
              </>
            )}

            {/* Nav Menu */}
            <nav className={`${showLabels ? "space-y-1" : "w-full flex flex-col items-center space-y-1"}`}>
              {navLinks
                .filter((link) => isAdmin || link.href !== "/indicadores")
                .map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    title={link.label}
                    className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                      showLabels ? "" : "justify-center"
                    } ${
                      active
                          ? "border border-gold/50 bg-gold/10 text-gold shadow-sm"
                          : "text-zinc-400 hover:bg-zinc-900/60 hover:text-white"
                    }`}
                  >
                    <div className={`flex items-center gap-3 ${showLabels ? "" : "justify-center"}`}>
                      <span className={active ? "text-gold" : "text-zinc-500"}>
                        {link.icon}
                      </span>
                      {showLabels && <span>{link.label}</span>}
                    </div>

                    {showLabels && link.badge && (
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
                  title="Configuración"
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                    showLabels ? "" : "justify-center"
                  } ${
                    pathname === "/admin"
                      ? "border border-amber-500/50 bg-amber-500/10 text-amber-400"
                      : "text-amber-400/70 hover:bg-amber-500/10 hover:text-amber-300"
                  }`}
                >
                  <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  </svg>
                  {showLabels && <span>Configuración</span>}
                </Link>
              )}
            </nav>
          </div>

          {/* Bottom User Info & Logout */}
          {showLabels ? (
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

              <Link
                href="/ajustes"
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                  pathname === "/ajustes"
                    ? "text-amber-400 bg-amber-500/10"
                    : "text-zinc-400 hover:bg-zinc-900/60 hover:text-white"
                }`}
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                </svg>
                <span>Ajustes</span>
              </Link>

              <button
                type="button"
                onClick={confirmLogout}
                className="w-full text-left flex items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Salida</span>
              </button>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center space-y-3 pt-4">
              <Link
                href="/ajustes"
                title="Ajustes"
                className={`flex items-center justify-center rounded-xl px-3.5 py-2.5 transition-colors ${
                  pathname === "/ajustes"
                    ? "text-amber-400 bg-amber-500/10"
                    : "text-zinc-400 hover:bg-zinc-900/60 hover:text-white"
                }`}
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                </svg>
              </Link>

              <button
                type="button"
                onClick={confirmLogout}
                title="Salida"
                className="flex items-center justify-center rounded-xl px-3.5 py-2.5 text-red-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <div
          className={`flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto bg-[#07090e] pt-14 transition-all duration-200 md:pt-0 ${
            sidebarOpen ? "md:ml-[15.75rem]" : "md:ml-[4.75rem]"
          }`}
        >
          {children}
        </div>
      </div>
    </AuthGuard>
  );
}

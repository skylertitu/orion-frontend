"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearSession, displayName, getUser } from "@/lib/auth";
import { canAccessPath, deskNavHrefs, PLAN_LABELS, userPlan } from "@/lib/plans";
import { isStaff, isSuperAdmin } from "@/lib/roles";
import { getLocale, setLocale, subscribeLocale, t, type AppLocale, type LocaleKey } from "@/lib/locale";

const NAV: Array<{ href: string; label: string; i18n?: LocaleKey }> = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/mercado", label: "Mercados", i18n: "navMercado" },
  { href: "/lucy", label: "Lucy IA" },
  { href: "/indicadores", label: "Indicadores", i18n: "navIndicadores" },
  { href: "/senales", label: "Señales", i18n: "navSenales" },
  { href: "/estrategias", label: "Estrategias" },
  { href: "/trading", label: "Operar" },
  { href: "/cuentas", label: "Cuentas", i18n: "navCuentas" },
];

export default function DeskTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = getUser();
  const [locale, setLocaleState] = useState<AppLocale>("es");
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [query, setQuery] = useState("");
  const userRef = useRef<HTMLDivElement>(null);
  const isAdmin = isStaff(user);
  const isSuper = isSuperAdmin(user);
  const plan = userPlan(user);
  const name = displayName(user);
  const initials = name.slice(0, 2).toUpperCase();
  const operateHref = canAccessPath(user, "/trading") ? "/trading" : "/mercado";

  useEffect(() => {
    setLocaleState(setLocale(getLocale()));
    return subscribeLocale(() => setLocaleState(getLocale()));
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setUserOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!userOpen) return;
    function onDoc(e: MouseEvent) {
      if (!userRef.current?.contains(e.target as Node)) setUserOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [userOpen]);

  const links = NAV.filter((link) => deskNavHrefs(user).includes(link.href) && canAccessPath(user, link.href));

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/mercado?q=${encodeURIComponent(q)}` : "/mercado");
  }

  async function logout() {
    if (!window.confirm("¿Seguro que deseas salir de la sesión?")) return;
    await api.auth.logout();
    clearSession();
    router.replace("/");
  }

  return (
    <header className="relative z-50 flex h-12 shrink-0 items-center gap-3 border-b border-zinc-800/80 bg-[#0a0a0a] px-3 sm:px-4">
      <Link href="/mercado" className="flex shrink-0 items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gold text-[11px] font-black text-black">
          AT
        </span>
        <span className="hidden text-sm font-black tracking-[0.18em] text-gold sm:block">AUTOTRADE</span>
      </Link>

      <nav className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:flex">
        {links.map((link) => {
          const active = pathname === link.href || (link.href === "/mercado" && pathname.startsWith("/mercado"));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 rounded-md px-2.5 py-1.5 text-[12px] font-medium ${
                active ? "bg-white/[0.06] text-white" : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              {link.i18n ? t(link.i18n, locale) : link.label}
            </Link>
          );
        })}
        {isAdmin && (
          <Link
            href="/admin"
            className={`shrink-0 rounded-md px-2.5 py-1.5 text-[12px] font-medium ${
              pathname === "/admin" ? "text-gold" : "text-zinc-400 hover:text-white"
            }`}
          >
            Admin
          </Link>
        )}
        {isSuper && (
          <Link
            href="/superadmin"
            className={`shrink-0 rounded-md px-2.5 py-1.5 text-[12px] font-medium ${
              pathname === "/superadmin" ? "text-gold" : "text-zinc-400 hover:text-white"
            }`}
          >
            Superadmin
          </Link>
        )}
      </nav>

      <form onSubmit={onSearch} className="ml-auto hidden min-w-[12rem] max-w-xs flex-1 md:block">
        <input
          type="search"
          name="orion-symbol-search"
          autoComplete="off"
          placeholder="Buscar símbolo..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 w-full rounded-md border border-zinc-800 bg-[#111111] px-3 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-gold/50"
        />
      </form>

      <Link
        href={operateHref}
        className="hidden h-8 items-center rounded-md bg-gold px-3.5 text-[11px] font-black uppercase tracking-wider text-black hover:bg-gold-light sm:inline-flex"
      >
        Operar
      </Link>

      <div ref={userRef} className="relative">
        <button
          type="button"
          onClick={() => setUserOpen((v) => !v)}
          className="flex h-8 items-center gap-2 rounded-md border border-zinc-800 bg-[#111111] px-2"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gold/15 text-[10px] font-black text-gold">
            {initials}
          </span>
          <span className="hidden max-w-[7rem] truncate text-[11px] font-semibold text-zinc-300 sm:block">{name}</span>
        </button>
        {userOpen && (
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-52 overflow-hidden rounded-xl border border-zinc-800 bg-[#0f0f0f] py-1 shadow-2xl">
            <div className="border-b border-zinc-800 px-3 py-2">
              <div className="truncate text-xs font-semibold text-white">{name}</div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                {isSuper ? "Superadmin" : isAdmin ? "Admin" : plan ? PLAN_LABELS[plan] : "Trader"}
              </div>
            </div>
            <Link href="/perfil" className="block px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.04] hover:text-white">
              {t("navPerfil", locale)}
            </Link>
            <Link href="/ajustes" className="block px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.04] hover:text-white">
              {t("navPreferencias", locale)}
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="block w-full px-3 py-2 text-left text-xs font-semibold text-red-400 hover:bg-red-500/10"
            >
              {t("navSalida", locale)}
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        aria-label="Menú"
        onClick={() => setMenuOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 text-white lg:hidden"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {menuOpen && (
        <div className="absolute inset-x-0 top-12 z-50 border-b border-zinc-800 bg-[#0a0a0a] p-2 lg:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`block rounded-md px-3 py-2 text-sm ${
                pathname === link.href ? "bg-gold/10 text-gold" : "text-zinc-300"
              }`}
            >
              {link.i18n ? t(link.i18n, locale) : link.label}
            </Link>
          ))}
          {isAdmin && (
            <Link href="/admin" className="block rounded-md px-3 py-2 text-sm text-zinc-300">
              Admin
            </Link>
          )}
          {isSuper && (
            <Link href="/superadmin" className="block rounded-md px-3 py-2 text-sm text-zinc-300">
              Superadmin
            </Link>
          )}
        </div>
      )}
    </header>
  );
}

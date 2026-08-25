"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, displayName, getUser } from "@/lib/auth";
import { api } from "@/lib/api";
import { canAccessPath, deskMenuHrefs } from "@/lib/plans";

const LINKS: Array<{ href: string; label: string }> = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/mercado", label: "Mercado" },
  { href: "/lucy", label: "Lucy IA" },
  { href: "/indicadores", label: "Indicadores" },
  { href: "/senales", label: "Señales" },
  { href: "/estrategias", label: "Estrategias" },
  { href: "/trading", label: "Motor Trading" },
  { href: "/cuentas", label: "Cuentas" },
  { href: "/admin", label: "Administración" },
  { href: "/superadmin", label: "Superadmin" },
  { href: "/ajustes", label: "Ajustes" },
  { href: "/perfil", label: "Perfil" },
];

export default function DeskNavDropdown() {
  const pathname = usePathname();
  const router = useRouter();
  const user = getUser();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    if (!window.confirm("¿Seguro que deseas salir de la sesión?")) return;
    await api.auth.logout();
    clearSession();
    router.replace("/");
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs font-semibold text-white hover:border-gold/50 hover:text-gold"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        Menú
        <svg className={`h-3 w-3 text-zinc-500 transition ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+8px)] z-[80] w-64 overflow-hidden rounded-2xl border border-zinc-800 bg-[#0b0f18] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        >
          <div className="mb-2 border-b border-zinc-800/80 px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">AutoTrade</div>
            <div className="truncate text-xs font-semibold text-white">{displayName(user)}</div>
          </div>
          <nav className="max-h-[min(70vh,28rem)] space-y-0.5 overflow-y-auto">
            {LINKS.filter((link) => deskMenuHrefs(user).includes(link.href) && canAccessPath(user, link.href)).map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  role="menuitem"
                  className={`block rounded-xl px-3 py-2 text-[13px] font-medium ${
                    active
                      ? "bg-gold/12 text-gold"
                      : "text-zinc-300 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <button
              type="button"
              role="menuitem"
              onClick={logout}
              className="mt-1 w-full rounded-xl px-3 py-2 text-left text-[13px] font-semibold text-red-400 hover:bg-red-500/10"
            >
              Salida
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}

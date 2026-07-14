"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { clearSession, getUser } from "@/lib/auth";

const userNavLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/mercado", label: "Mercado" },
  { href: "/trading", label: "Trading" },
  { href: "/lucy", label: "Lucy AI" },
];

const adminNavLinks = [
  { href: "/admin", label: "⚙ Admin" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const user = getUser();
  const isAdmin = user?.role === "admin";

  function handleLogout() {
    clearSession();
    router.replace("/");
  }

  const navLinks = isAdmin ? [...userNavLinks, ...adminNavLinks] : userNavLinks;

  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col bg-black text-white">
        <nav className="flex items-center justify-between border-b border-zinc-800 px-8 py-4">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold text-gold">AutoTrading</span>
            <div className="flex gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    pathname === link.href || pathname.startsWith(link.href + "/")
                      ? link.href === "/admin"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-gold/10 text-gold"
                      : link.href === "/admin"
                      ? "text-amber-500/70 hover:text-amber-400"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-500">{user.username}</span>
                {isAdmin && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400">
                    ADMIN
                  </span>
                )}
              </div>
            )}
            <button
              onClick={handleLogout}
              className="text-sm text-zinc-400 transition-colors hover:text-red-400"
            >
              Cerrar sesión
            </button>
          </div>
        </nav>
        <main className="flex flex-1">{children}</main>
      </div>
    </AuthGuard>
  );
}

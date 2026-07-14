"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { clearSession, getUser } from "@/lib/auth";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/mercado", label: "Mercado" },
  { href: "/trading", label: "Trading" },
  { href: "/lucy", label: "Lucy AI" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const user = getUser();

  function handleLogout() {
    clearSession();
    router.replace("/");
  }

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
                    pathname === link.href
                      ? "bg-gold/10 text-gold"
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
              <span className="text-sm text-zinc-500">{user.username}</span>
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

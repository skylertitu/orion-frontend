"use client";

import { usePathname } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import DeskTopbar from "@/components/DeskTopbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <DashboardShell>{children}</DashboardShell>
    </AuthGuard>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const terminal = pathname === "/mercado";

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#0a0a0a] font-sans text-white">
      <DeskTopbar />
      <div className={`min-h-0 min-w-0 flex-1 ${terminal ? "overflow-hidden" : "overflow-y-auto"}`}>
        {children}
      </div>
    </div>
  );
}

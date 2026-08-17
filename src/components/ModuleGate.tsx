"use client";

import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

export default function ModuleGate({
  moduleId,
  children,
}: {
  moduleId: string;
  children: ReactNode;
}) {
  const user = getUser();
  const isAdmin = user?.role === "admin";
  const [blocked, setBlocked] = useState(false);
  const [name, setName] = useState(moduleId);

  useEffect(() => {
    if (isAdmin) return;
    void api.system.status().then((res) => {
      const mod = res.data?.modules.find((m) => m.id === moduleId);
      if (mod && !mod.enabled) {
        setBlocked(true);
        setName(mod.name);
      }
    });
  }, [isAdmin, moduleId]);

  if (blocked) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-center">
          <h1 className="text-lg font-black text-white">{name} no está disponible</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Administración lo apagó temporalmente. Vuelve más tarde o avisa a tu operador.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

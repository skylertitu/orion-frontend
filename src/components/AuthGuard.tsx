"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearSession, getSession, setSession } from "@/lib/auth";
import { setLocale } from "@/lib/locale";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function check() {
      const session = getSession();
      if (!session?.token) {
        router.replace("/");
        return;
      }
      const res = await api.auth.getMe();
      if (res.success && res.data) {
        setSession({ token: session.token, user: res.data }, session.rememberMe ?? false);
        if (res.data.language) setLocale(res.data.language);
        setReady(true);
        return;
      }
      clearSession();
      router.replace("/");
    }
    void check();
  }, [router]);

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#0a0a0a] p-8 text-zinc-500">
        Cargando escritorio...
      </div>
    );
  }

  return <>{children}</>;
}

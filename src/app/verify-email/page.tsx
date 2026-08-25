"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getUser, updateUserInSession } from "@/lib/auth";

function VerifyEmailInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState("Validando tu correo...");

  useEffect(() => {
    const token = params.get("token") || "";
    if (!token) {
      setStatus("error");
      setMessage("Falta el enlace de validación.");
      return;
    }
    void api.auth.confirmEmailVerification(token).then((res) => {
      if (res.success) {
        if (res.data && getUser()) updateUserInSession(res.data);
        setStatus("ok");
        setMessage(res.message || "Cuenta validada.");
        window.setTimeout(() => router.replace("/perfil"), 1600);
        return;
      }
      setStatus("error");
      setMessage(res.error || "No se pudo validar el correo.");
    });
  }, [params, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#07090e] p-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#0a0d16] p-6 text-center">
        <h1 className="text-xl font-black">Validación de cuenta</h1>
        <p className={`mt-3 text-sm ${status === "error" ? "text-red-400" : "text-zinc-400"}`}>{message}</p>
        {status === "ok" && <p className="mt-2 text-xs text-gold">Te llevamos a Perfil...</p>}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#07090e] text-zinc-500">Validando...</div>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}

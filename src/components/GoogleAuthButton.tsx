"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { setSession } from "@/lib/auth";
import { getFirebaseAuth, getGoogleProvider, isFirebaseConfigured } from "@/lib/firebase";
import { toast } from "@/lib/toast";

export default function GoogleAuthButton({
  rememberMe = true,
  onSuccess,
}: {
  rememberMe?: boolean;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    if (!isFirebaseConfigured()) {
      toast.error("Falta configurar Firebase en el frontend (variables NEXT_PUBLIC_FIREBASE_*).");
      return;
    }

    setLoading(true);
    try {
      const { signInWithPopup } = await import("firebase/auth");
      const cred = await signInWithPopup(getFirebaseAuth(), getGoogleProvider());
      const idToken = await cred.user.getIdToken();
      const res = await api.auth.google(idToken, rememberMe);

      if (res.success && res.data) {
        const { token, ...user } = res.data;
        setSession({ user, token }, rememberMe);
        toast.success("Inicio de sesión con Google");
        onSuccess();
      } else {
        toast.error(res.error || "No se pudo iniciar sesión con Google");
      }
    } catch (err: unknown) {
      const code = typeof err === "object" && err && "code" in err ? String((err as { code: string }).code) : "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        return;
      }
      if (code === "auth/unauthorized-domain") {
        toast.error("Este dominio no está autorizado en Firebase. Agrega localhost en Authentication > Settings.");
        return;
      }
      const detail = err instanceof Error ? err.message : "";
      toast.error(detail || "No se pudo conectar con Google. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleGoogle}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-[#111726] py-3 text-xs font-semibold text-white transition-colors hover:border-zinc-600 hover:bg-[#161d2e] disabled:opacity-50"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      {loading ? "Conectando con Google..." : "Continuar con Google"}
    </button>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import {
  confirmPasswordReset,
  signInWithEmailAndPassword,
  verifyPasswordResetCode,
} from "firebase/auth";
import { api } from "@/lib/api";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { isPasswordStrong, PASSWORD_POLICY_MESSAGE } from "@/lib/passwordPolicy";
import PasswordStrengthHints from "@/components/PasswordStrengthHints";
import { toast } from "@/lib/toast";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode");
  const mode = searchParams.get("mode");

  const [token, setToken] = useState("");
  const [emailHint, setEmailHint] = useState("");
  const [oobError, setOobError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingCode, setCheckingCode] = useState(Boolean(oobCode));
  const isPasswordValid = useMemo(() => isPasswordStrong(newPassword), [newPassword]);
  const passwordsMatch = Boolean(newPassword && confirmPassword && newPassword === confirmPassword);

  const isFirebaseReset = Boolean(oobCode && (mode === "resetPassword" || !mode));

  useEffect(() => {
    const queryToken = searchParams.get("token");
    if (queryToken) setToken(queryToken);
  }, [searchParams]);

  useEffect(() => {
    if (!oobCode) {
      setCheckingCode(false);
      return;
    }
    if (!isFirebaseConfigured()) {
      toast.error("Firebase no está configurado. Usa el enlace de AutoTrade.");
      setCheckingCode(false);
      return;
    }

    let cancelled = false;
    setCheckingCode(true);
    verifyPasswordResetCode(getFirebaseAuth(), oobCode)
      .then((email) => {
        if (!cancelled) {
          setEmailHint(email);
          setOobError("");
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error(
            "Este enlace de Firebase ya expiró o Gmail lo usó al escanearlo. Vuelve a Recuperar contraseña y usa el botón de AutoTrade."
          );
          setOobError(
            "Este enlace de Firebase ya expiró o Gmail lo usó al escanearlo. Vuelve a Recuperar contraseña y usa el botón de AutoTrade."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingCode(false);
      });

    return () => {
      cancelled = true;
    };
  }, [oobCode]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!isPasswordStrong(newPassword)) {
      toast.error(PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);

    if (isFirebaseReset && oobCode) {
      try {
        const auth = getFirebaseAuth();
        await confirmPasswordReset(auth, oobCode, newPassword);
        if (!emailHint) {
          toast.error("No se pudo identificar el correo. Usa el enlace de AutoTrade.");
          setLoading(false);
          return;
        }
        const cred = await signInWithEmailAndPassword(auth, emailHint, newPassword);
        const idToken = await cred.user.getIdToken();
        const res = await api.auth.resetPasswordFromFirebase(idToken, newPassword);
        if (!res.success) {
          toast.error(res.error || "La clave de Firebase cambió, pero AutoTrade no se actualizó.");
          setLoading(false);
          return;
        }
        toast.success("Contraseña restablecida con éxito.");
        setTimeout(() => router.push("/"), 2000);
      } catch {
        toast.error(
          "No se pudo usar este enlace de Firebase. Vuelve a Recuperar contraseña y abre el botón de AutoTrade."
        );
      }
      setLoading(false);
      return;
    }

    if (!token.trim()) {
      toast.error("Ingresa un token de recuperación válido");
      setLoading(false);
      return;
    }

    const res = await api.auth.resetPassword(token.trim(), newPassword);
    if (res.success) {
      toast.success(res.message || "Contraseña restablecida con éxito.");
      setTimeout(() => router.push("/"), 2000);
    } else {
      toast.error(res.error || "Error al restablecer contraseña");
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#07090e] p-6 text-white font-sans">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold text-black font-black text-lg shadow-xl shadow-gold/20">
              AT
            </div>
            <span className="text-xl font-bold tracking-wide text-white">AutoTrade</span>
          </Link>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-[#0a0d16] p-8 shadow-2xl space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Establecer Nueva Contraseña</h1>
            <p className="text-xs text-zinc-400 mt-1">
              {isFirebaseReset
                ? "Define tu nueva clave. El enlace se confirma al guardar, no al abrir la página."
                : "Debe tener 8+ caracteres, mayúsculas, minúsculas, un número y un símbolo."}
            </p>
          </div>

          {oobError && (
            <Link href="/forgot-password" className="inline-block text-xs font-bold text-gold hover:underline">
              Generar enlace de AutoTrade →
            </Link>
          )}

          {checkingCode && (
            <p className="text-xs text-zinc-400">Comprobando el enlace...</p>
          )}

          {!oobError && !checkingCode && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isFirebaseReset && !token && (
                <div>
                  <label className="mb-1.5 block text-xs text-zinc-400 font-medium">
                    Token de Recuperación
                  </label>
                  <input
                    type="text"
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Pegar token de recuperación aquí..."
                    className="w-full rounded-xl border border-zinc-800 bg-[#111726] px-4 py-3 font-mono text-xs text-white placeholder-zinc-500 outline-none focus:border-gold transition-all"
                  />
                </div>
              )}

              {emailHint && (
                <p className="text-[11px] text-zinc-400">
                  Cuenta: <span className="text-white">{emailHint}</span>
                </p>
              )}

              <div>
                <label className="mb-1.5 block text-xs text-zinc-400 font-medium">Nueva Contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Ej: AutoTrade#2026"
                    className="w-full rounded-xl border border-zinc-800 bg-[#111726] px-4 py-3 pr-10 text-xs text-white placeholder-zinc-500 outline-none focus:border-gold transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors p-1"
                  >
                    {showPassword ? "👁️" : "🙈"}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs text-zinc-400 font-medium">
                  Confirmar Nueva Contraseña
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ej: AutoTrade#2026"
                  className={`w-full rounded-xl border bg-[#111726] px-4 py-3 text-xs text-white placeholder-zinc-500 outline-none transition-all ${
                    confirmPassword && !passwordsMatch
                      ? "border-red-500 focus:border-red-500"
                      : "border-zinc-800 focus:border-gold"
                  }`}
                />
              </div>

              {confirmPassword && !passwordsMatch && (
                <span className="text-[10px] text-red-400 -mt-2 block">Las contraseñas no coinciden</span>
              )}

              <PasswordStrengthHints password={newPassword} />

              <button
                type="submit"
                disabled={loading || !isPasswordValid || !passwordsMatch}
                className="w-full rounded-xl bg-gold hover:bg-gold-light py-3 text-xs font-bold text-black transition-all shadow-lg shadow-gold/20 disabled:opacity-50"
              >
                {loading ? "Actualizando..." : "Restablecer Contraseña"}
              </button>
            </form>
          )}

          <div className="text-center pt-2">
            <Link href="/" className="text-xs text-zinc-400 hover:text-white transition-colors">
              ← Volver al Inicio de Sesión
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#07090e] text-xs text-zinc-400">
          Cargando...
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

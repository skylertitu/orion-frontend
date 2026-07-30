"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const queryToken = searchParams.get("token");
    if (queryToken) {
      setToken(queryToken);
    }
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!token.trim()) {
      setError("Ingresa un token de recuperación válido");
      return;
    }

    if (newPassword.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);

    const res = await api.auth.resetPassword(token.trim(), newPassword);

    if (res.success) {
      setSuccess(res.message || "Contraseña restablecida con éxito.");
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } else {
      setError(res.error || "Error al restablecer contraseña");
    }

    setLoading(false);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#07090e] p-6 text-white font-sans">
      <div className="w-full max-w-md space-y-6">
        {/* Top Logo */}
        <div className="flex justify-center">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold text-black font-black text-lg shadow-xl shadow-gold/20">
              AT
            </div>
            <span className="text-xl font-bold tracking-wide text-white">AutoTrade</span>
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-zinc-800 bg-[#0a0d16] p-8 shadow-2xl space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Establecer Nueva Contraseña</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Ingresa el token de recuperación y define tu nueva clave de acceso.
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-gold/30 bg-gold/10 p-3.5 text-xs text-gold">
              {success} Redirigiendo al inicio de sesión...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs text-zinc-400 font-medium">Token de Recuperación</label>
              <input
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Pegar token de recuperación aquí..."
                className="w-full rounded-xl border border-zinc-800 bg-[#111726] px-4 py-3 font-mono text-xs text-white placeholder-zinc-500 outline-none focus:border-gold transition-all"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-zinc-400 font-medium">Nueva Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
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
              <label className="mb-1.5 block text-xs text-zinc-400 font-medium">Confirmar Nueva Contraseña</label>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-zinc-800 bg-[#111726] px-4 py-3 text-xs text-white placeholder-zinc-500 outline-none focus:border-gold transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gold hover:bg-gold-light py-3 text-xs font-bold text-black transition-all shadow-lg shadow-gold/20 disabled:opacity-50"
            >
              {loading ? "Actualizando..." : "Restablecer Contraseña"}
            </button>
          </form>

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

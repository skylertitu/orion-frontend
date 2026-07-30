"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setResetToken(null);
    setLoading(true);

    const res = await api.auth.forgotPassword(email);

    if (res.success) {
      setMessage(res.message || "Instrucciones enviadas correctamente");
      if (res.data?.resetToken) {
        setResetToken(res.data.resetToken);
      }
    } else {
      setError(res.error || "Error al solicitar recuperación");
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
            <h1 className="text-2xl font-bold text-white tracking-tight">Recuperar Contraseña</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Ingresa tu correo registrado y te enviaremos las instrucciones para restablecer tu acceso.
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-400">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-xl border border-gold/30 bg-gold/10 p-3.5 text-xs text-gold space-y-2">
              <p className="font-semibold">{message}</p>
              {resetToken && (
                <div className="pt-2 border-t border-gold/20">
                  <p className="text-[11px] text-zinc-300 mb-1 font-mono">Token de recuperación (Demo/Testing):</p>
                  <code className="block break-all rounded bg-black/60 p-2 text-[10px] text-gold font-mono">
                    {resetToken}
                  </code>
                  <Link
                    href={`/reset-password?token=${resetToken}`}
                    className="inline-block mt-2 rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-black hover:bg-gold-light"
                  >
                    Restablecer clave con este Token →
                  </Link>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs text-zinc-400 font-medium">Correo electrónico</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full rounded-xl border border-zinc-800 bg-[#111726] px-4 py-3 text-xs text-white placeholder-zinc-500 outline-none focus:border-gold transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gold hover:bg-gold-light py-3 text-xs font-bold text-black transition-all shadow-lg shadow-gold/20 disabled:opacity-50"
            >
              {loading ? "Enviando..." : "Enviar enlace de recuperación"}
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

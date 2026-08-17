"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [googleAccount, setGoogleAccount] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setResetUrl(null);
    setGoogleAccount(false);
    setLoading(true);

    const res = await api.auth.forgotPassword(email.trim());

    if (res.success) {
      toast.success("Pide un enlace nuevo aquí y ábrelo en AutoTrade. No uses la página blanca de Firebase.");
      setGoogleAccount(Boolean(res.data?.googleAccount));
      if (res.data?.resetUrl) {
        setResetUrl(res.data.resetUrl);
      } else if (res.data?.resetToken) {
        setResetUrl(`/reset-password?token=${res.data.resetToken}`);
      }
    } else {
      toast.error(res.error || "Error al solicitar recuperación");
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
            <h1 className="text-2xl font-bold text-white tracking-tight">Recuperar Contraseña</h1>
            <p className="text-xs text-zinc-400 mt-1">
              El correo de Gmail abre Firebase, no AutoTrade. Gmail suele invalidar ese enlace al
              escanearlo. Usa el botón de esta pantalla.
            </p>
          </div>

          {(resetUrl || googleAccount) && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3.5 text-xs text-zinc-300 space-y-2">
              {googleAccount && (
                <p>
                  Esta cuenta también puede entrar con <strong>Continuar con Google</strong>.
                </p>
              )}
              {resetUrl && (
                <Link
                  href={resetUrl}
                  className="inline-block rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-black hover:bg-gold-light"
                >
                  Restablecer contraseña en AutoTrade →
                </Link>
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
              {loading ? "Generando enlace..." : "Generar enlace de AutoTrade"}
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

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { getUser, setSession } from "@/lib/auth";
import { homePath } from "@/lib/plans";
import AuthHero from "@/components/AuthHero";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import { toast } from "@/lib/toast";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await api.auth.login(email, password, rememberMe);

    if (res.success && res.data) {
      const { token, ...user } = res.data;
      setSession({ user, token }, rememberMe);
      toast.success(res.message || "Inicio de sesión exitoso");
      router.push(homePath(user));
    } else {
      toast.error(res.error || "Error al iniciar sesión");
    }

    setLoading(false);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 min-h-screen bg-[#07090e] text-white">
      <AuthHero />

      {/* Right Column: Form Container (5 Cols) */}
      <div className="lg:col-span-5 flex flex-col justify-between p-8 sm:p-12 bg-[#07090e] min-h-screen">
        {/* Mobile Logo View */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold text-black font-black text-sm">
            AT
          </div>
          <span className="text-lg font-black tracking-[0.18em] text-gold">AUTOTRADE</span>
        </div>

        {/* Form Main Area */}
        <div className="w-full max-w-md mx-auto my-auto space-y-6">
          {/* Top Tab Switcher */}
          <div className="flex rounded-xl border border-zinc-800 bg-[#111726] p-1">
            <button
              type="button"
              className="flex-1 rounded-lg bg-[#1a2336] py-2 text-xs font-bold text-white shadow-sm transition-all"
            >
              Iniciar sesión
            </button>
            <Link
              href="/register"
              className="flex-1 text-center rounded-lg py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-all"
            >
              Registrarse
            </Link>
          </div>

          {/* Titles */}
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Bienvenido de vuelta</h2>
            <p className="text-xs text-zinc-400 mt-1">Ingresa tus credenciales para continuar</p>
          </div>

          {/* Form Fields */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1.5 block text-xs text-zinc-400 font-medium">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="w-full rounded-xl border border-zinc-800 bg-[#111726] px-4 py-3 text-xs text-white placeholder-zinc-500 outline-none focus:border-gold transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-zinc-400 font-medium">Contraseña</label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] text-gold hover:underline font-medium"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-xl border border-zinc-800 bg-[#111726] px-4 py-3 pr-10 text-xs text-white placeholder-zinc-500 outline-none focus:border-gold transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors p-1"
                  title={showPassword ? "Ocultar clave" : "Mostrar clave"}
                >
                  {showPassword ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-800 bg-[#111726] text-gold focus:ring-gold"
              />
              <label htmlFor="rememberMe" className="text-xs text-zinc-400 cursor-pointer">
                Recordarme en este dispositivo
              </label>
            </div>

            {/* Bright Orion Gold Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gold hover:bg-gold-light py-3 text-xs font-bold text-black transition-all shadow-lg shadow-gold/20 disabled:opacity-50 mt-2"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">o</span>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          <GoogleAuthButton
            rememberMe={rememberMe}
            onSuccess={() => router.push(homePath(getUser()))}
          />
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] text-zinc-600">
          &copy; {new Date().getFullYear()} AutoTrade. Todos los derechos reservados.
        </div>
      </div>
    </div>
  );
}

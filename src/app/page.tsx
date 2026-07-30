"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { setSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const res = await api.auth.login(email, password, rememberMe);

    if (res.success && res.data) {
      const { token, ...user } = res.data;
      setSession({ user, token }, rememberMe);
      setSuccess(res.message || "Inicio de sesión exitoso");
      router.push("/dashboard");
    } else {
      setError(res.error || "Error al iniciar sesión");
    }

    setLoading(false);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 min-h-screen bg-[#07090e] text-white">
      {/* Left Column: Hero & Branding Banner (7 Cols) */}
      <div className="relative hidden lg:flex lg:col-span-7 flex-col justify-between p-12 bg-[#0a0d16] border-r border-zinc-800/60 overflow-hidden">
        {/* Background Grid Pattern Overlay */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#334155 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />

        {/* Top Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold text-black font-black text-sm shadow-lg shadow-gold/20">
            AT
          </div>
          <span className="text-lg font-bold tracking-wide text-white">AutoTrade</span>
        </div>

        {/* Center Hero Heading */}
        <div className="relative z-10 max-w-lg space-y-4 my-auto">
          <h1 className="text-5xl font-black leading-tight tracking-tight text-white">
            Operaciones <br />
            <span className="text-gold">automatizadas</span> <br />
            por IA.
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed pt-2">
            Conecta tus cuentas de Binance, Bybit y MetaTrader. Lucy IA analiza el mercado y ejecuta operaciones con precisión milimétrica.
          </p>
        </div>

        {/* Bottom 3 Metric Cards */}
        <div className="relative z-10 grid grid-cols-3 gap-4 pt-8">
          <div className="rounded-2xl border border-zinc-800/80 bg-[#111726]/80 p-4 backdrop-blur-md">
            <div className="text-xl font-black text-gold">73.4%</div>
            <div className="text-xs text-zinc-500 font-medium mt-0.5">Win Rate</div>
          </div>
          <div className="rounded-2xl border border-zinc-800/80 bg-[#111726]/80 p-4 backdrop-blur-md">
            <div className="text-xl font-black text-white">142</div>
            <div className="text-xs text-zinc-500 font-medium mt-0.5">Señales / día</div>
          </div>
          <div className="rounded-2xl border border-zinc-800/80 bg-[#111726]/80 p-4 backdrop-blur-md">
            <div className="text-xl font-black text-gold-light">3</div>
            <div className="text-xs text-zinc-500 font-medium mt-0.5">Brokers</div>
          </div>
        </div>
      </div>

      {/* Right Column: Form Container (5 Cols) */}
      <div className="lg:col-span-5 flex flex-col justify-between p-8 sm:p-12 bg-[#07090e] min-h-screen">
        {/* Mobile Logo View */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold text-black font-black text-sm">
            AT
          </div>
          <span className="text-lg font-bold text-white">AutoTrade</span>
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

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-400 flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-gold/30 bg-gold/10 p-3.5 text-xs text-gold flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{success}</span>
            </div>
          )}

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

          {/* Bottom Demo Card */}
          <div className="rounded-xl border border-zinc-800/80 bg-[#111726]/60 p-4 text-[11px] text-zinc-400">
            <span className="font-bold text-white">Demo:</span> usa cualquier email para acceder. Incluye "admin" para rol admin.
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] text-zinc-600">
          &copy; {new Date().getFullYear()} AutoTrade. Todos los derechos reservados.
        </div>
      </div>
    </div>
  );
}

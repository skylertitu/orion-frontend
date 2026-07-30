"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { setSession } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Password rules validation
  const rules = useMemo(() => {
    return {
      minLength: password.length >= 8,
      hasUpperLower: /[a-z]/.test(password) && /[A-Z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSymbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };
  }, [password]);

  const passedRulesCount = useMemo(() => {
    return Object.values(rules).filter(Boolean).length;
  }, [rules]);

  const isPasswordValid = passedRulesCount === 4;
  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  let strengthLabel = "Débil";
  let strengthColor = "bg-red-500";
  if (passedRulesCount === 2) {
    strengthLabel = "Regular";
    strengthColor = "bg-amber-500";
  } else if (passedRulesCount === 3) {
    strengthLabel = "Buena";
    strengthColor = "bg-blue-500";
  } else if (passedRulesCount === 4) {
    strengthLabel = "Excelente";
    strengthColor = "bg-gold";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!isPasswordValid) {
      setError("La contraseña debe cumplir las 4 reglas de seguridad.");
      return;
    }

    if (!passwordsMatch) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    if (!termsAccepted) {
      setError("Debes aceptar los Términos y Condiciones.");
      return;
    }

    setLoading(true);

    const res = await api.auth.register({
      username: username.trim() || undefined,
      email: email.trim(),
      password,
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      termsAccepted,
    });

    if (res.success && res.data) {
      const { token, ...user } = res.data;
      setSession({ user, token }, true);
      setSuccess(res.message || "Cuenta creada correctamente");
      router.push("/dashboard");
    } else {
      setError(res.error || "Error al registrar usuario");
    }

    setLoading(false);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 min-h-screen bg-[#07090e] text-white">
      {/* Left Column: Hero Banner (7 Cols) */}
      <div className="relative hidden lg:flex lg:col-span-7 flex-col justify-between p-12 bg-[#0a0d16] border-r border-zinc-800/60 overflow-hidden">
        {/* Grid Overlay */}
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
      <div className="lg:col-span-5 flex flex-col justify-between p-8 sm:p-12 bg-[#07090e] min-h-screen overflow-y-auto">
        {/* Mobile Logo View */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold text-black font-black text-sm">
            AT
          </div>
          <span className="text-lg font-bold text-white">AutoTrade</span>
        </div>

        {/* Form Main Area */}
        <div className="w-full max-w-md mx-auto my-auto space-y-5">
          {/* Top Tab Switcher */}
          <div className="flex rounded-xl border border-zinc-800 bg-[#111726] p-1">
            <Link
              href="/"
              className="flex-1 text-center rounded-lg py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-all"
            >
              Iniciar sesión
            </Link>
            <button
              type="button"
              className="flex-1 rounded-lg bg-[#1a2336] py-2 text-xs font-bold text-white shadow-sm transition-all"
            >
              Registrarse
            </button>
          </div>

          {/* Titles */}
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Crear cuenta</h2>
            <p className="text-xs text-zinc-400 mt-1">Completa el formulario para comenzar</p>
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
          <form className="space-y-3.5" onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-400 font-medium">Nombre</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Carlos"
                  className="w-full rounded-xl border border-zinc-800 bg-[#111726] px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-gold transition-all"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400 font-medium">Apellidos (opcional)</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Romero"
                  className="w-full rounded-xl border border-zinc-800 bg-[#111726] px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-gold transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-400 font-medium">Usuario (opcional)</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="trader_pro"
                  className="w-full rounded-xl border border-zinc-800 bg-[#111726] px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-gold transition-all"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400 font-medium">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  className="w-full rounded-xl border border-zinc-800 bg-[#111726] px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-gold transition-all"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-400 font-medium">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-xl border border-zinc-800 bg-[#111726] px-3.5 py-2.5 pr-10 text-xs text-white placeholder-zinc-500 outline-none focus:border-gold transition-all"
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

            <div>
              <label className="mb-1 block text-xs text-zinc-400 font-medium">Confirmar contraseña</label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className={`w-full rounded-xl border bg-[#111726] px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 outline-none transition-all ${
                  confirmPassword && !passwordsMatch
                    ? "border-red-500 focus:border-red-500"
                    : "border-zinc-800 focus:border-gold"
                }`}
              />
              {confirmPassword && !passwordsMatch && (
                <span className="text-[10px] text-red-400 mt-1 block">Las contraseñas no coinciden</span>
              )}
            </div>

            {/* Strength Bar */}
            {password.length > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-medium text-zinc-400">
                  <span>Fuerza de la contraseña:</span>
                  <span className="font-bold text-white">{strengthLabel}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={`h-full rounded-full ${strengthColor} transition-all duration-300`}
                    style={{ width: `${(passedRulesCount / 4) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Rules Checklist */}
            <div className="rounded-xl border border-zinc-800 bg-[#111726]/60 p-2.5 space-y-1 text-[11px]">
              <div className={`flex items-center gap-2 ${rules.minLength ? "text-gold font-bold" : "text-zinc-500"}`}>
                <span>{rules.minLength ? "✓" : "•"}</span> Mínimo 8 caracteres
              </div>
              <div className={`flex items-center gap-2 ${rules.hasUpperLower ? "text-gold font-bold" : "text-zinc-500"}`}>
                <span>{rules.hasUpperLower ? "✓" : "•"}</span> Mayúsculas y minúsculas (a-Z)
              </div>
              <div className={`flex items-center gap-2 ${rules.hasNumber ? "text-gold font-bold" : "text-zinc-500"}`}>
                <span>{rules.hasNumber ? "✓" : "•"}</span> Al menos un número (0-9)
              </div>
              <div className={`flex items-center gap-2 ${rules.hasSymbol ? "text-gold font-bold" : "text-zinc-500"}`}>
                <span>{rules.hasSymbol ? "✓" : "•"}</span> Al menos un símbolo (!@#$%^&*)
              </div>
            </div>

            {/* Terms Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="terms"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-800 bg-[#111726] text-gold focus:ring-gold"
              />
              <label htmlFor="terms" className="text-xs text-zinc-400 cursor-pointer">
                Acepto los <span className="text-gold font-medium">Términos y Condiciones</span>
              </label>
            </div>

            {/* Bright Orion Gold Button */}
            <button
              type="submit"
              disabled={loading || !isPasswordValid || !passwordsMatch || !termsAccepted}
              className="w-full rounded-xl bg-gold hover:bg-gold-light py-3 text-xs font-bold text-black transition-all shadow-lg shadow-gold/20 disabled:opacity-50 mt-2"
            >
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </button>
          </form>

          {/* Bottom Demo Card */}
          <div className="rounded-xl border border-zinc-800/80 bg-[#111726]/60 p-4 text-[11px] text-zinc-400">
            <span className="font-bold text-white">Demo:</span> usa cualquier email para acceder. Incluye "admin" para rol admin.
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] text-zinc-600 mt-4">
          &copy; {new Date().getFullYear()} AutoTrade. Todos los derechos reservados.
        </div>
      </div>
    </div>
  );
}

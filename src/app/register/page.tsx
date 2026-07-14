"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { setSession } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const res = await api.auth.register(username, email, password);

    if (res.success && res.data) {
      const { token, ...user } = res.data;
      setSession({ user, token });
      setSuccess(res.message || "Cuenta creada correctamente");
      router.push("/dashboard");
    } else {
      setError(res.error || "Error al registrar usuario");
    }

    setLoading(false);
  }

  return (
    <div className="flex min-h-screen flex-col bg-black">
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-8 shadow-2xl shadow-gold/5 backdrop-blur-xl">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gold/10">
                <span className="text-2xl font-bold text-gold">A</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Crear Cuenta
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Regístrate para comenzar a operar
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
                {success}
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Usuario
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="usuario"
                  required
                  className="w-full rounded-lg border border-zinc-800 bg-black px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  className="w-full rounded-lg border border-zinc-800 bg-black px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full rounded-lg border border-zinc-800 bg-black px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-black transition-all hover:bg-gold-light active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? "Creando cuenta..." : "Crear Cuenta"}
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-zinc-600">
              ¿Ya tienes cuenta?{" "}
              <Link
                href="/"
                className="font-medium text-gold hover:text-gold-light transition-colors"
              >
                Inicia sesión
              </Link>
            </div>
          </div>
        </div>
      </div>
      <footer className="py-4 text-center text-xs text-zinc-700">
        &copy; {new Date().getFullYear()} AutoTrading. Todos los derechos reservados.
      </footer>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getUser, updateUserInSession, User } from "@/lib/auth";

export default function PerfilPage() {
  const currentUser = getUser();
  const [profile, setProfile] = useState<User | null>(currentUser);

  // Profile Form States
  const [firstName, setFirstName] = useState(currentUser?.firstName || "");
  const [lastName, setLastName] = useState(currentUser?.lastName || "");
  const [phone, setPhone] = useState(currentUser?.phone || "");
  const [country, setCountry] = useState(currentUser?.country || "Global");
  const [language, setLanguage] = useState(currentUser?.language || "es");
  const [timezone, setTimezone] = useState(currentUser?.timezone || "UTC-5");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password Change Form States
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passMessage, setPassMessage] = useState("");
  const [passError, setPassError] = useState("");
  const [changingPass, setChangingPass] = useState(false);

  // Load fresh profile from backend on mount
  useEffect(() => {
    async function loadMe() {
      const res = await api.auth.getMe();
      if (res.success && res.data) {
        setProfile(res.data);
        updateUserInSession(res.data);
        setFirstName(res.data.firstName || "");
        setLastName(res.data.lastName || "");
        setPhone(res.data.phone || "");
        setCountry(res.data.country || "Global");
        setLanguage(res.data.language || "es");
        setTimezone(res.data.timezone || "UTC-5");
      }
    }
    loadMe();
  }, []);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileMessage("");
    setProfileError("");
    setSavingProfile(true);

    const res = await api.auth.updateProfile({
      firstName,
      lastName,
      phone,
      country,
      language,
      timezone,
    });

    if (res.success && res.data) {
      setProfile(res.data);
      updateUserInSession(res.data);
      setProfileMessage("Perfil actualizado correctamente");
    } else {
      setProfileError(res.error || "Error al actualizar perfil");
    }

    setSavingProfile(false);
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPassMessage("");
    setPassError("");

    if (newPassword.length < 8) {
      setPassError("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassError("Las contraseñas no coinciden");
      return;
    }

    setChangingPass(true);

    const res = await api.auth.changePassword(currentPassword, newPassword);

    if (res.success) {
      setPassMessage("Contraseña modificada con éxito");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setPassError(res.error || "Error al modificar la contraseña");
    }

    setChangingPass(false);
  }

  return (
    <div className="flex w-full flex-col gap-6 p-6 bg-[#07090e] text-white min-h-screen font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-4 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-white">Perfil del Usuario</h1>
            <span className="rounded-full bg-gold/10 px-2.5 py-0.5 text-xs font-bold text-gold border border-gold/20">
              {profile?.role?.toUpperCase() || "TRADER"}
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Administra tus datos personales, preferencias regionales y seguridad de tu cuenta
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Summary Card (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-6 shadow-xl text-center space-y-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gold/20 border border-gold/40 text-gold text-2xl font-black shadow-xl shadow-gold/10">
              {(profile?.username || "U").substring(0, 2).toUpperCase()}
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">
                {profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : profile?.username}
              </h2>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">{profile?.email}</p>
            </div>

            <div className="border-t border-zinc-800/60 pt-4 space-y-2 text-left text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-zinc-800/40">
                <span className="text-zinc-500">ID de Usuario:</span>
                <span className="text-white font-bold">#{profile?.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/40">
                <span className="text-zinc-500">Rol de Sistema:</span>
                <span className="text-gold font-bold">{profile?.role}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/40">
                <span className="text-zinc-500">Último Acceso:</span>
                <span className="text-zinc-300">
                  {profile?.lastLoginAt
                    ? new Date(profile.lastLoginAt).toLocaleString("es")
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-500">Registrado el:</span>
                <span className="text-zinc-300">
                  {profile?.createdAt
                    ? new Date(profile.createdAt).toLocaleDateString("es")
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Edit Forms (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Edit Profile Info Card */}
          <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-zinc-800/60 pb-3">
              Información Personal & Regional
            </h3>

            {profileMessage && (
              <div className="rounded-xl border border-gold/30 bg-gold/10 p-3 text-xs text-gold font-semibold">
                {profileMessage}
              </div>
            )}
            {profileError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 font-semibold">
                {profileError}
              </div>
            )}

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs text-zinc-400 font-medium">Nombre</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Carlos"
                    className="w-full rounded-xl border border-zinc-800 bg-[#111726] px-4 py-2.5 text-xs text-white outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-zinc-400 font-medium">Apellidos</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Romero"
                    className="w-full rounded-xl border border-zinc-800 bg-[#111726] px-4 py-2.5 text-xs text-white outline-none focus:border-gold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs text-zinc-400 font-medium">
                    Teléfono (Alertas SMS / 2FA futuro)
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+57 300 123 4567"
                    className="w-full rounded-xl border border-zinc-800 bg-[#111726] px-4 py-2.5 text-xs text-white outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-zinc-400 font-medium">País</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Colombia"
                    className="w-full rounded-xl border border-zinc-800 bg-[#111726] px-4 py-2.5 text-xs text-white outline-none focus:border-gold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs text-zinc-400 font-medium">Idioma</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-[#111726] px-4 py-2.5 text-xs text-white outline-none focus:border-gold"
                  >
                    <option value="es">Español (es)</option>
                    <option value="en">English (en)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-zinc-400 font-medium">Zona Horaria</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-[#111726] px-4 py-2.5 text-xs text-white outline-none focus:border-gold"
                  >
                    <option value="UTC-5">UTC-5 (Bogotá, Lima, Quito)</option>
                    <option value="UTC-6">UTC-6 (México)</option>
                    <option value="UTC-3">UTC-3 (Buenos Aires, Santiago)</option>
                    <option value="UTC+0">UTC+0 (Londres)</option>
                    <option value="UTC+1">UTC+1 (Madrid, Berlín)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="rounded-xl bg-gold px-5 py-2.5 text-xs font-bold text-black hover:bg-gold-light transition-all shadow-md shadow-gold/10 disabled:opacity-50"
                >
                  {savingProfile ? "Guardando..." : "Guardar Cambios de Perfil"}
                </button>
              </div>
            </form>
          </div>

          {/* Change Password Card */}
          <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-zinc-800/60 pb-3">
              Seguridad & Cambio de Contraseña
            </h3>

            {passMessage && (
              <div className="rounded-xl border border-gold/30 bg-gold/10 p-3 text-xs text-gold font-semibold">
                {passMessage}
              </div>
            )}
            {passError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 font-semibold">
                {passError}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-zinc-400 font-medium">Contraseña Actual</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-zinc-800 bg-[#111726] px-4 py-2.5 text-xs text-white outline-none focus:border-gold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs text-zinc-400 font-medium">Nueva Contraseña</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-zinc-800 bg-[#111726] px-4 py-2.5 text-xs text-white outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-zinc-400 font-medium">Confirmar Nueva Contraseña</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-zinc-800 bg-[#111726] px-4 py-2.5 text-xs text-white outline-none focus:border-gold"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={changingPass}
                  className="rounded-xl bg-gold px-5 py-2.5 text-xs font-bold text-black hover:bg-gold-light transition-all shadow-md shadow-gold/10 disabled:opacity-50"
                >
                  {changingPass ? "Actualizando..." : "Cambiar Contraseña"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearSession, getUser, updateUserInSession, User } from "@/lib/auth";
import { PLAN_LABELS, userPlan } from "@/lib/plans";
import { isStaff } from "@/lib/roles";
import { isPasswordStrong, PASSWORD_POLICY_MESSAGE } from "@/lib/passwordPolicy";
import PasswordStrengthHints from "@/components/PasswordStrengthHints";
import { toast } from "@/lib/toast";
import { getLocale, LOCALES, normalizeLocale, setLocale, subscribeLocale, t, type AppLocale } from "@/lib/locale";
import { detectLocation } from "@/lib/location";

export default function PerfilPage() {
  const router = useRouter();
  const currentUser = getUser();
  const [profile, setProfile] = useState<User | null>(currentUser);

  // Profile Form States
  const [firstName, setFirstName] = useState(currentUser?.firstName || "");
  const [lastName, setLastName] = useState(currentUser?.lastName || "");
  const [phone, setPhone] = useState(currentUser?.phone || "");
  const [country, setCountry] = useState(currentUser?.country || "Global");
  const [language, setLanguage] = useState(currentUser?.language || "es");
  const [timezone, setTimezone] = useState(currentUser?.timezone || "UTC-5");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password Change Form States
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPass, setChangingPass] = useState(false);
  const [locale, setLocaleState] = useState<AppLocale>(getLocale);
  const [verifying, setVerifying] = useState(false);
  const [locBusy, setLocBusy] = useState(false);

  useEffect(() => subscribeLocale(() => setLocaleState(getLocale())), []);

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
        setLanguage(normalizeLocale(res.data.language));
        setTimezone(res.data.timezone || "UTC-5");
        if (res.data.language) setLocaleState(setLocale(res.data.language));
      }
    }
    loadMe();
  }, []);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      toast.success("Perfil actualizado correctamente");
      if (language) setLocaleState(setLocale(language));
    } else {
      toast.error(res.error || "Error al actualizar perfil");
    }

    setSavingProfile(false);
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isPasswordStrong(newPassword)) {
      toast.error(PASSWORD_POLICY_MESSAGE);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setChangingPass(true);

    const res = await api.auth.changePassword(currentPassword, newPassword);

    if (res.success) {
      toast.success("Contraseña modificada. Vuelve a iniciar sesión.");
      clearSession();
      router.replace("/");
      return;
    } else {
      toast.error(res.error || "Error al modificar la contraseña");
    }

    setChangingPass(false);
  }

  async function requestVerification() {
    setVerifying(true);
    const res = await api.auth.requestEmailVerification();
    if (res.success) {
      toast.success(res.message || t("verifySend", locale));
      if (res.data?.verifyUrl) {
        toast.info(res.data.verifyUrl);
      }
    } else {
      toast.error(res.error || "No se pudo enviar la validación");
    }
    setVerifying(false);
  }

  async function fillFromLocation() {
    setLocBusy(true);
    try {
      const detected = await detectLocation(locale);
      setCountry(detected.country);
      setTimezone(detected.timezone);
      const res = await api.auth.updateProfile({
        country: detected.country,
        timezone: detected.timezone,
      });
      if (res.success && res.data) {
        setProfile(res.data);
        updateUserInSession(res.data);
      }
      toast.success(detected.label);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("prefsLocationDenied", locale));
    }
    setLocBusy(false);
  }

  return (
    <div className="flex min-h-screen w-full min-w-0 flex-col gap-6 bg-[#07090e] p-4 text-white font-sans sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-4 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-white">{t("profileTitle", locale)}</h1>
            <span className="rounded-full bg-gold/10 px-2.5 py-0.5 text-xs font-bold text-gold border border-gold/20">
              {profile?.role?.toUpperCase() || "TRADER"}
            </span>
          </div>
          <p className="text-xs text-zinc-400">{t("profileHint", locale)}</p>
          <div className="mt-3 flex gap-2">
            <span className="rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold">
              Perfil
            </span>
            <Link
              href="/ajustes"
              className="rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-gold/40 hover:text-gold"
            >
              {t("navPreferencias", locale)}
            </Link>
          </div>
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
                <span className="text-zinc-500">Plan:</span>
                <span className="text-white font-bold">
                  {profile?.role === "superadmin"
                    ? "Superadmin (base de datos)"
                    : isStaff(profile)
                      ? "Administrador (Lucy / desk)"
                      : userPlan(profile)
                        ? PLAN_LABELS[userPlan(profile)!]
                        : "Builder"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/40">
                <span className="text-zinc-500">Último Acceso:</span>
                <span className="text-zinc-300">
                  {profile?.lastLoginAt
                    ? new Date(profile.lastLoginAt).toLocaleString(locale)
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-500">Registrado el:</span>
                <span className="text-zinc-300">
                  {profile?.createdAt
                    ? new Date(profile.createdAt).toLocaleDateString(locale)
                    : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-5 text-left">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">{t("verifyTitle", locale)}</h3>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-zinc-400">{profile?.email}</span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                  profile?.emailVerified
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-400"
                }`}
              >
                {profile?.emailVerified ? t("verifyOk", locale) : t("verifyPending", locale)}
              </span>
            </div>
            {profile?.emailVerified ? null : (
              <button
                type="button"
                onClick={() => void requestVerification()}
                disabled={verifying}
                className="mt-4 w-full rounded-xl bg-gold px-3 py-2 text-xs font-bold text-black disabled:opacity-50"
              >
                {verifying ? t("verifySending", locale) : t("verifySend", locale)}
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Edit Forms (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Edit Profile Info Card */}
          <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-zinc-800/60 pb-3">
              {t("personalTitle", locale)}
            </h3>

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

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void fillFromLocation()}
                  disabled={locBusy}
                  className="rounded-xl border border-gold/40 px-3 py-2 text-[11px] font-bold uppercase text-gold disabled:opacity-50"
                >
                  {locBusy ? t("saving", locale) : t("locationFill", locale)}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs text-zinc-400 font-medium">Idioma</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-[#111726] px-4 py-2.5 text-xs text-white outline-none focus:border-gold"
                  >
                    {LOCALES.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.native} ({item.id})
                      </option>
                    ))}
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
                    {!["UTC-5", "UTC-6", "UTC-3", "UTC+0", "UTC+1"].includes(timezone) && (
                      <option value={timezone}>{timezone}</option>
                    )}
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
              {t("securityTitle", locale)}
            </h3>

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

              <PasswordStrengthHints password={newPassword} />

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={changingPass || !isPasswordStrong(newPassword) || newPassword !== confirmPassword}
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

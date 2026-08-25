"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "@/lib/toast";
import { api } from "@/lib/api";
import { updateUserInSession } from "@/lib/auth";
import { loadUiPrefs, saveUiPrefs, type UiPrefs } from "@/lib/uiPrefs";
import {
  getLocale,
  LOCALES,
  setLocale,
  subscribeLocale,
  t,
  type AppLocale,
} from "@/lib/locale";
import {
  detectLocation,
  loadDetectedLocation,
  locationPermissionLabel,
  readLocationPermission,
  type LocationPermission,
} from "@/lib/location";

export default function AjustesPage() {
  const [locale, setLocaleState] = useState<AppLocale>(getLocale);
  const [prefs, setPrefs] = useState<UiPrefs>(loadUiPrefs);
  const [saving, setSaving] = useState(false);
  const [locState, setLocState] = useState<LocationPermission>("prompt");
  const [locBusy, setLocBusy] = useState(false);
  const [locLabel, setLocLabel] = useState(loadDetectedLocation()?.label || "");

  useEffect(() => subscribeLocale(() => setLocaleState(getLocale())), []);

  useEffect(() => {
    setPrefs(loadUiPrefs());
    void readLocationPermission().then(setLocState);
  }, []);

  function toggle(id: keyof UiPrefs) {
    setPrefs((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function changeLanguage(next: AppLocale) {
    setLocaleState(setLocale(next));
    const res = await api.auth.updateProfile({ language: next });
    if (res.success && res.data) updateUserInSession(res.data);
  }

  async function useLocation() {
    setLocBusy(true);
    try {
      const detected = await detectLocation(locale);
      setLocLabel(detected.label);
      setLocState("granted");
      const res = await api.auth.updateProfile({
        country: detected.country,
        timezone: detected.timezone,
      });
      if (res.success && res.data) updateUserInSession(res.data);
      toast.success(detected.label);
    } catch (err) {
      setLocState(await readLocationPermission());
      toast.error(err instanceof Error ? err.message : t("prefsLocationDenied", locale));
    }
    setLocBusy(false);
  }

  function save() {
    setSaving(true);
    saveUiPrefs(prefs);
    toast.success(t("prefsSaved", locale));
    setSaving(false);
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] min-w-0 flex-col gap-6 bg-[#07090e] p-4 text-white sm:p-6">
      <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-5">
        <h1 className="text-xl font-black text-white">{t("prefsTitle", locale)}</h1>
        <p className="mt-0.5 text-xs text-zinc-400">{t("prefsHint", locale)}</p>
        <div className="mt-4 flex gap-2">
          <Link
            href="/perfil"
            className="rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-gold/40 hover:text-gold"
          >
            {t("navPerfil", locale)}
          </Link>
          <span className="rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold">
            {t("navPreferencias", locale)}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-5">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-400">
          {t("prefsLanguage", locale)}
        </h2>
        <p className="mb-3 text-xs text-zinc-500">{t("prefsLanguageHint", locale)}</p>
        <div className="flex flex-wrap gap-2">
          {LOCALES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void changeLanguage(item.id)}
              className={`rounded-xl px-3 py-2 text-xs font-bold ${
                locale === item.id ? "bg-gold text-black" : "border border-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              {item.native}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-5">
        <h2 className="mb-1 text-xs font-bold uppercase tracking-wider text-zinc-400">
          {t("prefsLocation", locale)}
        </h2>
        <p className="mb-3 text-xs text-zinc-500">{t("prefsLocationHint", locale)}</p>
        <p className="mb-3 text-xs text-zinc-400">{locationPermissionLabel(locState, locale)}</p>
        {locLabel && <p className="mb-3 text-sm text-white">{locLabel}</p>}
        <button
          type="button"
          onClick={() => void useLocation()}
          disabled={locBusy}
          className="rounded-xl border border-gold/40 px-4 py-2 text-xs font-bold uppercase text-gold disabled:opacity-50"
        >
          {locBusy ? t("saving", locale) : t("prefsUseLocation", locale)}
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-800/80 bg-[#0a0d16] p-5">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-400">
          {t("prefsDesktop", locale)}
        </h2>
        <div className="space-y-3">
          {(
            [
              ["confirmOrders", "confirmDemo", "confirmDemoHint"],
              ["toastSound", "toastSound", "toastSoundHint"],
            ] as const
          ).map(([id, label, hint]) => (
            <div
              key={id}
              className="flex items-start justify-between gap-3 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4"
            >
              <div className="min-w-0 pr-2">
                <div className="text-sm font-semibold text-white">{t(label, locale)}</div>
                <div className="text-xs text-zinc-500">{t(hint, locale)}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[id]}
                onClick={() => toggle(id)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  prefs[id] ? "bg-gold" : "bg-zinc-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                    prefs[id] ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-gold px-5 py-2 text-xs font-bold text-black hover:bg-gold/90 disabled:opacity-50"
          >
            {saving ? t("saving", locale) : t("save", locale)}
          </button>
        </div>
      </div>
    </div>
  );
}

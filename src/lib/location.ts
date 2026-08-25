import { t, type AppLocale } from "@/lib/locale";

export type LocationPermission = "prompt" | "granted" | "denied" | "unsupported";

export type DetectedLocation = {
  country: string;
  timezone: string;
  latitude: number;
  longitude: number;
  label: string;
};

const STORAGE_KEY = "orion_location_v1";

export function locationPermissionLabel(state: LocationPermission, locale: AppLocale): string {
  if (state === "granted") return t("prefsLocationGranted", locale);
  if (state === "denied") return t("prefsLocationDenied", locale);
  if (state === "unsupported") return t("prefsLocationUnsupported", locale);
  return t("prefsLocationPrompt", locale);
}

export async function readLocationPermission(): Promise<LocationPermission> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return "unsupported";
  const permissions = navigator.permissions;
  if (!permissions?.query) return "prompt";
  try {
    const status = await permissions.query({ name: "geolocation" as PermissionName });
    if (status.state === "granted" || status.state === "denied") return status.state;
    return "prompt";
  } catch {
    return "prompt";
  }
}

function saveDetected(row: DetectedLocation) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(row));
  } catch {
    /* ignore */
  }
}

export function loadDetectedLocation(): DetectedLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DetectedLocation;
  } catch {
    return null;
  }
}

async function reverseGeocode(lat: number, lon: number, locale: AppLocale): Promise<{ country: string; label: string }> {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${locale}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("geocode");
  const data = (await res.json()) as {
    countryName?: string;
    city?: string;
    principalSubdivision?: string;
  };
  const country = data.countryName?.trim() || "Global";
  const parts = [data.city, data.principalSubdivision, country].filter(Boolean);
  return { country, label: parts.join(", ") };
}

export function detectLocation(locale: AppLocale = "es"): Promise<DetectedLocation> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error(t("locationUnavailable", locale)));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC-5";
        try {
          const geo = await reverseGeocode(latitude, longitude, locale);
          const row = { country: geo.country, timezone, latitude, longitude, label: geo.label };
          saveDetected(row);
          resolve(row);
        } catch {
          const row = {
            country: "Global",
            timezone,
            latitude,
            longitude,
            label: `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`,
          };
          saveDetected(row);
          resolve(row);
        }
      },
      (err) => {
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED ? t("locationDenied", locale) : t("locationReadFail", locale)
          )
        );
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
    );
  });
}

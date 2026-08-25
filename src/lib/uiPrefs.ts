const STORAGE_KEY = "orion_ui_ajustes_v2";

export type UiPrefs = {
  confirmOrders: boolean;
  toastSound: boolean;
};

export const DEFAULT_UI_PREFS: UiPrefs = {
  confirmOrders: true,
  toastSound: false,
};

function normalize(raw: Partial<UiPrefs> | null | undefined): UiPrefs {
  return {
    confirmOrders: raw?.confirmOrders !== false,
    toastSound: Boolean(raw?.toastSound),
  };
}

export function loadUiPrefs(): UiPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_UI_PREFS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_UI_PREFS };
    return normalize(JSON.parse(raw) as Partial<UiPrefs>);
  } catch {
    return { ...DEFAULT_UI_PREFS };
  }
}

export function saveUiPrefs(patch: Partial<UiPrefs>): UiPrefs {
  const next = normalize({ ...loadUiPrefs(), ...patch });
  if (typeof window === "undefined") return next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
  return next;
}

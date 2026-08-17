export type ToastTone = "error" | "success" | "info" | "warning";

export type ToastItem = {
  id: string;
  title: string;
  message: string;
  tone: ToastTone;
};

type AddListener = (toast: ToastItem) => void;
type DismissListener = (id: string) => void;

const addListeners = new Set<AddListener>();
const dismissListeners = new Set<DismissListener>();
let seq = 0;

export function subscribeToasts(onAdd: AddListener, onDismiss: DismissListener) {
  addListeners.add(onAdd);
  dismissListeners.add(onDismiss);
  return () => {
    addListeners.delete(onAdd);
    dismissListeners.delete(onDismiss);
  };
}

export function dismissToast(id: string) {
  dismissListeners.forEach((fn) => fn(id));
}

export function pushToast(input: { message: string; tone?: ToastTone; title?: string; id?: string }) {
  const message = input.message.trim();
  if (!message) return "";
  const tone = input.tone || "info";
  const item: ToastItem = {
    id: input.id || `toast-${++seq}`,
    title: input.title || defaultTitle(tone),
    message,
    tone,
  };
  addListeners.forEach((fn) => fn(item));
  return item.id;
}

function defaultTitle(tone: ToastTone): string {
  if (tone === "error") return "Error";
  if (tone === "success") return "Listo";
  if (tone === "warning") return "Atención";
  return "Aviso";
}

export const toast = {
  error: (message: string, title = "Error") => pushToast({ message, tone: "error", title }),
  success: (message: string, title = "Listo") => pushToast({ message, tone: "success", title }),
  info: (message: string, title = "Aviso") => pushToast({ message, tone: "info", title }),
  warning: (message: string, title = "Atención") => pushToast({ message, tone: "warning", title }),
};

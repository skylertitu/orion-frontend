"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { dismissToast, subscribeToasts, type ToastItem, type ToastTone } from "@/lib/toast";

const TONE: Record<ToastTone, { border: string; title: string; dot: string }> = {
  error: { border: "border-red-500/40", title: "text-red-400", dot: "bg-red-500" },
  success: { border: "border-emerald-500/40", title: "text-emerald-400", dot: "bg-emerald-400" },
  warning: { border: "border-amber-500/40", title: "text-amber-300", dot: "bg-amber-400" },
  info: { border: "border-gold/40", title: "text-gold", dot: "bg-gold" },
};

function ttl(tone: ToastTone): number {
  if (tone === "error" || tone === "warning") return 7000;
  return 4500;
}

export default function ToastHost() {
  const [mounted, setMounted] = useState(false);
  const [alerts, setAlerts] = useState<ToastItem[]>([]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const unsub = subscribeToasts(
      (item) => {
        setAlerts((prev) => {
          const without = prev.filter((a) => a.id !== item.id);
          return [...without, item].slice(-5);
        });
        const existing = timers.get(item.id);
        if (existing) clearTimeout(existing);
        timers.set(
          item.id,
          setTimeout(() => dismissToast(item.id), ttl(item.tone))
        );
      },
      (id) => {
        const t = timers.get(id);
        if (t) clearTimeout(t);
        timers.delete(id);
        setAlerts((prev) => prev.filter((a) => a.id !== id));
      }
    );

    return () => {
      unsub();
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  if (!mounted || alerts.length === 0) return null;

  return createPortal(
    <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-[min(calc(100%-2rem),380px)] flex-col gap-2 md:top-5">
      {alerts.map((alert) => {
        const tone = TONE[alert.tone];
        return (
          <div
            key={alert.id}
            className={`pointer-events-auto rounded-xl border bg-zinc-950/95 p-3 backdrop-blur-md ${tone.border}`}
            role="status"
          >
            <div className="flex items-start gap-2">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
              <div className="min-w-0 flex-1">
                <div className={`text-[11px] font-bold uppercase tracking-wide ${tone.title}`}>{alert.title}</div>
                <p className="mt-1 text-xs leading-5 text-zinc-200">{alert.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(alert.id)}
                className="rounded px-1.5 text-sm leading-none text-zinc-500 hover:text-white"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>,
    document.body
  );
}

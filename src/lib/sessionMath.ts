export type SessionBox = {
  time1: number;
  time2: number;
  high: number;
  low: number;
  open: number;
};

function parseHHMM(value: string): number {
  const raw = value.replace(/\D/g, "").padStart(4, "0").slice(0, 4);
  const hh = Number(raw.slice(0, 2));
  const mm = Number(raw.slice(2, 4));
  return hh * 60 + mm;
}

export function parseSessionSpec(sess: string): { start: number; end: number } {
  const core = String(sess || "").split(":")[0];
  const [a, b] = core.split("-");
  return { start: parseHHMM(a || "0000"), end: parseHHMM(b || "0000") };
}

function barMs(time: number): number {
  return time > 1_000_000_000_000 ? time : time * 1000;
}

export function minutesInOffset(time: number, offsetHours: number): number {
  const shifted = new Date(barMs(time) + offsetHours * 3_600_000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

export function isInSession(time: number, sess: string, offsetHours: number): boolean {
  const { start, end } = parseSessionSpec(sess);
  const minutes = minutesInOffset(time, offsetHours);
  if (start === end) return minutes === start;
  if (start < end) return minutes >= start && minutes <= end;
  return minutes >= start || minutes <= end;
}

type Bar = { time: number; open: number; high: number; low: number; close?: number };

export function sessionBoxes(bars: Bar[], sess: string, offsetHours = -3): SessionBox[] {
  const out: SessionBox[] = [];
  let current: SessionBox | null = null;

  for (const bar of bars) {
    if (isInSession(bar.time, sess, offsetHours)) {
      if (!current) {
        current = { time1: bar.time, time2: bar.time, high: bar.high, low: bar.low, open: bar.open };
      } else {
        current.time2 = bar.time;
        current.high = Math.max(current.high, bar.high);
        current.low = Math.min(current.low, bar.low);
      }
    } else if (current) {
      out.push(current);
      current = null;
    }
  }
  if (current) out.push(current);
  return out;
}

export function sessionLevels(
  bars: Bar[],
  sess: string,
  offsetHours = -3,
  extendSess?: string
): SessionBox[] {
  const out: SessionBox[] = [];
  let current: SessionBox | null = null;
  let phase: "none" | "session" | "extend" = "none";

  for (const bar of bars) {
    const inMain = isInSession(bar.time, sess, offsetHours);
    const inExtend = Boolean(extendSess) && isInSession(bar.time, extendSess as string, offsetHours);

    if (inMain) {
      if (phase !== "session") {
        if (current) out.push(current);
        current = { time1: bar.time, time2: bar.time, high: bar.high, low: bar.low, open: bar.open };
        phase = "session";
      } else if (current) {
        current.time2 = bar.time;
        current.high = Math.max(current.high, bar.high);
        current.low = Math.min(current.low, bar.low);
      }
      continue;
    }

    if (current && (phase === "session" || phase === "extend") && inExtend) {
      phase = "extend";
      current.time2 = bar.time;
      continue;
    }

    if (current) {
      out.push(current);
      current = null;
      phase = "none";
    }
  }
  if (current) out.push(current);
  return out;
}

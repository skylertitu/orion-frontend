"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { formatPair } from "@/lib/binance";

interface SignalRow {
  id: number;
  symbol: string;
  action: string;
  confidence: number;
  reason: string;
  price: number;
  executed: boolean;
  source: string;
  createdAt: string;
}

export default function LucySignalsPanel() {
  const [signals, setSignals] = useState<SignalRow[]>([]);

  const load = useCallback(async () => {
    const userId = getUser()?.id;
    if (!userId) return;
    const res = await api.signals.list(userId, { source: "lucy", limit: 15 });
    if (res.success && res.data) setSignals(res.data as SignalRow[]);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  if (!signals.length) return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-5 py-3">
        <h2 className="font-semibold text-white">Señales Lucy</h2>
      </div>
      <div className="divide-y divide-zinc-800">
        {signals.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
            <div>
              <span className="text-white">{formatPair(s.symbol)}</span>
              <span className="ml-2 text-xs text-purple-400">{s.action}</span>
              {s.executed && <span className="ml-2 text-xs text-green-500">ejecutada</span>}
            </div>
            <div className="text-right text-xs text-zinc-500">
              <div>{(s.confidence * 100).toFixed(0)}% · ${Number(s.price).toFixed(2)}</div>
              <div>{new Date(s.createdAt).toLocaleString("es")}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

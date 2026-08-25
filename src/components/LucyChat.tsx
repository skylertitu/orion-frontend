"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { displayName, getUser } from "@/lib/auth";

interface ChatMessage {
  id: string;
  sender: "user" | "lucy";
  text: string;
  time: string;
}

function nowTime() {
  return new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

function extractSymbol(text: string): string {
  const upper = text.toUpperCase();
  const match = upper.match(/\b[A-Z]{2,10}USDT\b/);
  if (match) return match[0];
  if (upper.includes("ETH")) return "ETHUSDT";
  if (upper.includes("SOL")) return "SOLUSDT";
  if (upper.includes("BTC")) return "BTCUSDT";
  return "BTCUSDT";
}

export default function LucyChat() {
  const user = getUser();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "lucy",
      text: `Hola ${displayName(user)}. Lucy todavía no está conectada. Este chat llama a /api/lucy/analyze y muestra la respuesta real del backend; no inventa precios ni señales.`,
      time: nowTime(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const quickPrompts = ["Analiza BTCUSDT", "¿Lucy está conectada?", "Señales de ETHUSDT"];

  async function handleSend(textToSend?: string) {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `${Date.now()}-u`,
      sender: "user",
      text,
      time: nowTime(),
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setLoading(true);

    const symbol = extractSymbol(text);
    const res = await api.lucy.analyze({
      symbol,
      interval: "15m",
      data: [],
    });

    const pendingReason =
      (res.data as { reason?: string } | undefined)?.reason ||
      res.error ||
      "Lucy SDK/API aún no está implementada.";

    let responseText = pendingReason;
    if (res.success && res.data && "signals" in res.data && Array.isArray(res.data.signals)) {
      const trend = res.data.trend || "neutral";
      const n = res.data.signals.length;
      responseText = `Análisis ${symbol}: tendencia ${trend}. ${n} señal${n === 1 ? "" : "es"}.`;
    } else {
      responseText = `${pendingReason} Pedido: ${symbol} 15m.`;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-l`,
        sender: "lucy",
        text: responseText,
        time: nowTime(),
      },
    ]);
    setLoading(false);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void handleSend();
  }

  return (
    <div className="flex flex-col h-full rounded-2xl border border-purple-500/30 bg-zinc-950/90 backdrop-blur-md shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-purple-500/20 bg-purple-950/30 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/40">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-amber-500 border-2 border-zinc-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">Chat Lucy</h2>
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30">
                PENDIENTE
              </span>
            </div>
            <p className="text-xs text-purple-300/70">Contrato de API — sin análisis inventado</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[460px]">
        {messages.map((m) => {
          const isUser = m.sender === "user";
          return (
            <div key={m.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                  isUser
                    ? "bg-gold text-black font-medium rounded-br-none"
                    : "bg-purple-950/40 border border-purple-500/30 text-zinc-100 rounded-bl-none"
                }`}
              >
                {!isUser && (
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-purple-400">
                    Lucy
                  </div>
                )}
                <p>{m.text}</p>
                <div className={`mt-1.5 text-[9px] font-mono ${isUser ? "text-black/70 text-right" : "text-purple-300/60"}`}>
                  {m.time}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start">
            <div className="rounded-2xl bg-purple-950/30 border border-purple-500/30 p-3 text-xs text-purple-300 rounded-bl-none">
              Consultando /api/lucy/analyze…
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto border-t border-zinc-800/80 bg-zinc-900/40 px-4 py-2 text-xs">
        <span className="text-[10px] uppercase font-bold text-zinc-500 shrink-0">Sugerencias:</span>
        {quickPrompts.map((qp) => (
          <button
            key={qp}
            type="button"
            onClick={() => void handleSend(qp)}
            className="shrink-0 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-[11px] text-purple-300 hover:bg-purple-500/20"
          >
            {qp}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-zinc-800 bg-zinc-950 p-3">
        <input
          type="text"
          placeholder="Pregunta o pide un símbolo (BTCUSDT)…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-purple-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-purple-500 disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}

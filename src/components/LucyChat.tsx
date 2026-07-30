"use client";

import { FormEvent, useState } from "react";
import { getUser } from "@/lib/auth";

interface ChatMessage {
  id: string;
  sender: "user" | "lucy";
  text: string;
  time: string;
}

export default function LucyChat() {
  const user = getUser();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "lucy",
      text: `Hola ${user?.username || "Trader"}, soy Lucy, tu asistente IA de trading. ¿En qué puedo ayudarte hoy? Puedes pedirme análisis de mercado, recomendaciones de pares o estado del RSI.`,
      time: new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const quickPrompts = [
    "¿Cuál es la tendencia de BTCUSDT?",
    "Revisar señales de mayor probabilidad",
    "¿Qué par recomiendas operar hoy?",
    "Explicar configuración del RSI",
  ];

  function handleSend(textToSend?: string) {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: text.trim(),
      time: new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setLoading(true);

    // Simulated Intelligent Response generator based on trading context
    setTimeout(() => {
      let responseText = "Entendido. Estoy analizando los flujos del libro de órdenes y los indicadores en tiempo real...";
      const lower = text.toLowerCase();

      if (lower.includes("btc") || lower.includes("tendencia")) {
        responseText = "BTCUSDT muestra una estructura de consolidación en el nivel de $64,200. El RSI(14) está en 54.2 (neutral) con EMA(20) superando levemente a la EMA(50), lo que sugiere un sesgo alcista moderado a corto plazo.";
      } else if (lower.includes("señal") || lower.includes("probabilidad")) {
        responseText = "Actualmente Lucy IA ha detectado 2 señales activas de alta probabilidad: COMPRA en ETHUSDT ($3,450, 89% confianza) y COMPRA en SOLUSDT ($142.50, 84% confianza).";
      } else if (lower.includes("recomiendas") || lower.includes("operar")) {
        responseText = "Basado en el volumen de negociación de las últimas 4 horas, ETHUSDT y SOLUSDT muestran mayor volatilidad limpia con bajo spread. Se recomienda operar con stop loss ajustado.";
      } else if (lower.includes("rsi")) {
        responseText = "El RSI actual se calcula sobre los últimos 14 períodos. Recuerda que valores por encima de 70 indican sobrecompra (posible corrección a la baja) y por debajo de 30 indican sobreventa (posible rebote).";
      } else {
        responseText = `He procesado tu consulta sobre "${text}". Mis algoritmos sugieren mantener un control estricto de riesgo con un ratio R:R de mínimo 1:2 en todas las posiciones abiertas.`;
      }

      const lucyMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "lucy",
        text: responseText,
        time: new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, lucyMsg]);
      setLoading(false);
    }, 1200);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    handleSend();
  }

  return (
    <div className="flex flex-col h-full rounded-2xl border border-purple-500/30 bg-zinc-950/90 backdrop-blur-md shadow-2xl overflow-hidden">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-purple-500/20 bg-purple-950/30 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/40">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-zinc-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">Chat interactivo Lucy IA</h2>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                ONLINE
              </span>
            </div>
            <p className="text-xs text-purple-300/70">Asistente Virtual de Análisis & Estrategias</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[460px]">
        {messages.map((m) => {
          const isUser = m.sender === "user";
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                  isUser
                    ? "bg-gold text-black font-medium rounded-br-none shadow-md shadow-gold/10"
                    : "bg-purple-950/40 border border-purple-500/30 text-zinc-100 rounded-bl-none shadow-md shadow-purple-950/20"
                }`}
              >
                {!isUser && (
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-purple-400">
                    Lucy IA
                  </div>
                )}
                <p>{m.text}</p>
                <div
                  className={`mt-1.5 text-[9px] font-mono ${
                    isUser ? "text-black/70 text-right" : "text-purple-300/60"
                  }`}
                >
                  {m.time}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start">
            <div className="rounded-2xl bg-purple-950/30 border border-purple-500/30 p-3 text-xs text-purple-300 rounded-bl-none flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-purple-400 animate-ping" />
              <span>Lucy está pensando la mejor recomendación...</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Suggestions */}
      <div className="flex items-center gap-2 overflow-x-auto border-t border-zinc-800/80 bg-zinc-900/40 px-4 py-2 text-xs">
        <span className="text-[10px] uppercase font-bold text-zinc-500 shrink-0">Sugerencias:</span>
        {quickPrompts.map((qp, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleSend(qp)}
            className="shrink-0 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-[11px] text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/40 transition-colors"
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-zinc-800 bg-zinc-950 p-3">
        <input
          type="text"
          placeholder="Escribe tu consulta a Lucy IA..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-purple-500 disabled:opacity-50 transition-colors shadow-md shadow-purple-600/20"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}

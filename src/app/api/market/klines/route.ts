import { NextRequest, NextResponse } from "next/server";
import {
  binancePublicGet,
  isValidBinanceSymbol,
  normalizeSymbol,
  DEFAULT_SYMBOL,
} from "@/lib/binance";

const INTERVALS = new Set(["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"]);

export async function GET(req: NextRequest) {
  const rawSymbol = req.nextUrl.searchParams.get("symbol") || DEFAULT_SYMBOL;
  const symbol = normalizeSymbol(rawSymbol);
  const interval = req.nextUrl.searchParams.get("interval") || "1h";
  const limit = Math.min(1000, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || "1000") || 1000));
  const endTimeRaw = req.nextUrl.searchParams.get("endTime");

  if (!isValidBinanceSymbol(symbol)) {
    return NextResponse.json({ error: "Par no disponible en Binance" }, { status: 400 });
  }
  if (!INTERVALS.has(interval)) {
    return NextResponse.json({ error: "Intervalo no válido" }, { status: 400 });
  }

  const qs = new URLSearchParams({
    symbol,
    interval,
    limit: String(limit),
  });
  if (endTimeRaw) {
    const endTime = Number(endTimeRaw);
    if (!Number.isFinite(endTime) || endTime <= 0) {
      return NextResponse.json({ error: "endTime no válido" }, { status: 400 });
    }
    qs.set("endTime", String(Math.floor(endTime)));
  }

  try {
    const res = await binancePublicGet(`/klines?${qs.toString()}`);
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "No se pudo conectar con Binance" }, { status: 502 });
  }
}

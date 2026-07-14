import { NextRequest, NextResponse } from "next/server";
import {
  binanceKlinesUrl,
  isValidBinanceSymbol,
  normalizeSymbol,
  DEFAULT_SYMBOL,
} from "@/lib/binance";

export async function GET(req: NextRequest) {
  const rawSymbol = req.nextUrl.searchParams.get("symbol") || DEFAULT_SYMBOL;
  const symbol = normalizeSymbol(rawSymbol);
  const interval = req.nextUrl.searchParams.get("interval") || "1h";
  const limit = req.nextUrl.searchParams.get("limit") || "100";

  if (!isValidBinanceSymbol(symbol)) {
    return NextResponse.json({ error: "Par no disponible en Binance" }, { status: 400 });
  }

  try {
    const res = await fetch(binanceKlinesUrl(symbol, interval, Number(limit)), {
      next: { revalidate: 30 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Error al obtener datos de Binance" }, { status: 502 });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "No se pudo conectar con Binance" }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { binancePriceUrl, isValidBinanceSymbol, normalizeSymbol, DEFAULT_SYMBOL } from "@/lib/binance";

export async function GET(req: NextRequest) {
  const symbol = normalizeSymbol(req.nextUrl.searchParams.get("symbol") || DEFAULT_SYMBOL);

  if (!isValidBinanceSymbol(symbol)) {
    return NextResponse.json({ error: "Par no disponible en Binance" }, { status: 400 });
  }

  try {
    const res = await fetch(binancePriceUrl(symbol), { next: { revalidate: 15 } });
    if (!res.ok) {
      return NextResponse.json({ error: "Error al obtener precio de Binance" }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json({ symbol: data.symbol, price: parseFloat(data.price) });
  } catch {
    return NextResponse.json({ error: "No se pudo conectar con Binance" }, { status: 502 });
  }
}

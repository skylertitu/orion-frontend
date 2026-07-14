import { NextResponse } from "next/server";
import { BINANCE_SYMBOLS, binanceTickerUrl } from "@/lib/binance";

export async function GET() {
  try {
    const results = await Promise.all(
      BINANCE_SYMBOLS.map(async (symbol) => {
        const res = await fetch(binanceTickerUrl(symbol), { next: { revalidate: 30 } });
        if (!res.ok) return null;
        const d = await res.json();
        return {
          symbol: d.symbol.replace("USDT", ""),
          pair: d.symbol,
          price: parseFloat(d.lastPrice),
          change: parseFloat(d.priceChangePercent),
          volume: parseFloat(d.volume),
        };
      })
    );
    return NextResponse.json(results.filter(Boolean));
  } catch {
    return NextResponse.json({ error: "No se pudo conectar con Binance" }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { BINANCE_SYMBOLS, binancePublicGet } from "@/lib/binance";

export async function GET() {
  try {
    const symbols = encodeURIComponent(JSON.stringify(BINANCE_SYMBOLS));
    const res = await binancePublicGet(`/ticker/24hr?symbols=${symbols}`);
    const rows = (await res.json()) as Array<{
      symbol: string;
      lastPrice: string;
      priceChangePercent: string;
      volume: string;
      quoteVolume?: string;
      highPrice?: string;
      lowPrice?: string;
    }>;
    return NextResponse.json(
      rows.map((d) => ({
        symbol: d.symbol.replace(/USDT$/, ""),
        pair: d.symbol,
        price: parseFloat(d.lastPrice),
        change: parseFloat(d.priceChangePercent),
        volume: parseFloat(d.volume),
        quoteVolume: parseFloat(d.quoteVolume || "0"),
        high: parseFloat(d.highPrice || "0"),
        low: parseFloat(d.lowPrice || "0"),
      }))
    );
  } catch {
    return NextResponse.json({ error: "No se pudo conectar con Binance" }, { status: 502 });
  }
}

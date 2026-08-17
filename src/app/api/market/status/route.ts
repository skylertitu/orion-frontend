import { NextResponse } from "next/server";
import { BINANCE_SYMBOLS, binancePublicGet } from "@/lib/binance";

type ExchangeSymbol = {
  symbol: string;
  status?: string;
  isSpotTradingAllowed?: boolean;
};

export async function GET() {
  try {
    const wanted = encodeURIComponent(JSON.stringify(BINANCE_SYMBOLS));
    let res = await binancePublicGet(`/exchangeInfo?symbols=${wanted}`);
    if (!res.ok) {
      res = await binancePublicGet("/exchangeInfo");
    }
    const json = (await res.json()) as { symbols?: ExchangeSymbol[] };
    const listed = new Map(
      (json.symbols || [])
        .filter((s) => BINANCE_SYMBOLS.includes(s.symbol))
        .map((s) => [s.symbol, s])
    );

    const rows = BINANCE_SYMBOLS.map((symbol) => {
      const info = listed.get(symbol);
      if (!info) {
        return { symbol, status: "NOT_LISTED", trading: false, reason: "No listado en Binance" };
      }
      const trading = info.status === "TRADING" && info.isSpotTradingAllowed !== false;
      return {
        symbol,
        status: info.status || "UNKNOWN",
        trading,
        reason: trading ? "Operable" : `Binance ${info.status || "bloqueado"}`,
      };
    });

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "No se pudo verificar el estado de los pares" }, { status: 502 });
  }
}

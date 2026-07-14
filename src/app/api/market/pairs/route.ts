import { NextResponse } from "next/server";
import { BINANCE_PAIRS } from "@/lib/binance";

export async function GET() {
  return NextResponse.json(BINANCE_PAIRS);
}

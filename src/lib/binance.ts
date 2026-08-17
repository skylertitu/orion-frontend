export const BINANCE_REST_HOSTS = [
  "https://data-api.binance.vision",
  "https://api.binance.com",
  "https://api1.binance.com",
] as const;

export const BINANCE_API_BASE = `${BINANCE_REST_HOSTS[0]}/api/v3`;

export const BINANCE_WS_URLS = [
  "wss://data-stream.binance.vision/stream",
  "wss://stream.binance.com:9443/stream",
] as const;

export const BINANCE_INTERVALS = [
  { value: "15m", label: "15m" },
  { value: "1h", label: "1H" },
  { value: "4h", label: "4H" },
  { value: "1d", label: "1D" },
] as const;

export type BinanceInterval = (typeof BINANCE_INTERVALS)[number]["value"];

export type BinanceNetwork = "bitcoin" | "ethereum" | "solana" | "bnb" | "other";

export interface BinancePair {
  symbol: string;
  base: string;
  name: string;
  network: BinanceNetwork;
}

/** Pares spot USDT en Binance. SOL y tokens del ecosistema Solana incluidos. */
export const BINANCE_PAIRS: BinancePair[] = [
  { symbol: "BTCUSDT", base: "BTC", name: "Bitcoin", network: "bitcoin" },
  { symbol: "ETHUSDT", base: "ETH", name: "Ethereum", network: "ethereum" },
  { symbol: "BNBUSDT", base: "BNB", name: "BNB", network: "bnb" },
  { symbol: "XRPUSDT", base: "XRP", name: "XRP", network: "other" },
  { symbol: "SOLUSDT", base: "SOL", name: "Solana", network: "solana" },
  { symbol: "JUPUSDT", base: "JUP", name: "Jupiter", network: "solana" },
  { symbol: "RAYUSDT", base: "RAY", name: "Raydium", network: "solana" },
  { symbol: "WIFUSDT", base: "WIF", name: "dogwifhat", network: "solana" },
  { symbol: "BONKUSDT", base: "BONK", name: "Bonk", network: "solana" },
  { symbol: "DOGEUSDT", base: "DOGE", name: "Dogecoin", network: "other" },
  { symbol: "ADAUSDT", base: "ADA", name: "Cardano", network: "other" },
  { symbol: "LINKUSDT", base: "LINK", name: "Chainlink", network: "other" },
  { symbol: "LTCUSDT", base: "LTC", name: "Litecoin", network: "other" },
  { symbol: "DOTUSDT", base: "DOT", name: "Polkadot", network: "other" },
  { symbol: "TRXUSDT", base: "TRX", name: "TRON", network: "other" },
  { symbol: "PEPEUSDT", base: "PEPE", name: "Pepe", network: "ethereum" },
  { symbol: "SUIUSDT", base: "SUI", name: "Sui", network: "other" },
  { symbol: "TONUSDT", base: "TON", name: "Toncoin", network: "other" },
];

export const BINANCE_SYMBOLS = BINANCE_PAIRS.map((p) => p.symbol);
export const DEFAULT_SYMBOL = "BTCUSDT";
export const SOLANA_PAIRS = BINANCE_PAIRS.filter((p) => p.network === "solana");

export function normalizeSymbol(input: string): string {
  const upper = input.toUpperCase().trim();
  if (BINANCE_SYMBOLS.includes(upper)) return upper;
  return upper.endsWith("USDT") ? upper : `${upper}USDT`;
}

export function isValidBinanceSymbol(symbol: string): boolean {
  const normalized = normalizeSymbol(symbol);
  return BINANCE_SYMBOLS.includes(normalized) || (normalized.endsWith("USDT") && normalized.length >= 5);
}

export function formatPair(symbol: string): string {
  const pair = BINANCE_PAIRS.find((p) => p.symbol === symbol);
  return pair ? `${pair.base}/USDT` : symbol.replace("USDT", "/USDT");
}

export function getPairInfo(symbol: string): BinancePair | undefined {
  return BINANCE_PAIRS.find((p) => p.symbol === normalizeSymbol(symbol));
}

export async function binancePublicGet(pathAndQuery: string): Promise<Response> {
  const path = pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`;
  let lastStatus = 0;
  for (const host of BINANCE_REST_HOSTS) {
    try {
      const res = await fetch(`${host}/api/v3${path}`, { cache: "no-store" });
      if (res.ok) return res;
      lastStatus = res.status;
    } catch {
      /* try next host */
    }
  }
  throw new Error(lastStatus ? `Binance ${lastStatus}` : "No se pudo conectar con Binance");
}

export function unwrapMarketPayload<T>(json: unknown): T {
  if (json && typeof json === "object" && "data" in json) {
    const wrapped = json as { success?: boolean; data?: T; error?: string };
    if (wrapped.data !== undefined) return wrapped.data;
  }
  return json as T;
}

export async function fetchMarketTickers(): Promise<Array<{
  symbol: string;
  pair: string;
  price: number;
  change: number;
  volume: number;
  quoteVolume?: number;
  high?: number;
  low?: number;
}>> {
  const res = await fetch("/api/market/tickers", { cache: "no-store" });
  const json = await res.json();
  const rows = unwrapMarketPayload<typeof json>(json);
  if (!Array.isArray(rows)) {
    throw new Error((json as { error?: string }).error || "No se pudieron cargar los mercados");
  }
  return rows;
}

export type PairMarketStatus = {
  symbol: string;
  status: string;
  trading: boolean;
  reason: string;
};

export async function fetchMarketStatus(): Promise<PairMarketStatus[]> {
  const res = await fetch("/api/market/status", { cache: "no-store" });
  const json = await res.json();
  const rows = unwrapMarketPayload<PairMarketStatus[]>(json);
  if (!Array.isArray(rows)) {
    throw new Error((json as { error?: string }).error || "No se pudo verificar el estado de los pares");
  }
  return rows;
}

export async function fetchMarketKlines(
  symbol: string,
  interval: string,
  limit: number,
  opts?: { endTime?: number }
): Promise<number[][]> {
  const qs = new URLSearchParams({
    symbol,
    interval,
    limit: String(Math.min(1000, Math.max(1, limit))),
  });
  if (opts?.endTime && Number.isFinite(opts.endTime)) {
    qs.set("endTime", String(Math.floor(opts.endTime)));
  }
  const res = await fetch(`/api/market/klines?${qs}`, { cache: "no-store" });
  const json = await res.json();
  const rows = unwrapMarketPayload<number[][]>(json);
  if (!Array.isArray(rows)) {
    throw new Error((json as { error?: string }).error || "No se pudieron cargar las velas");
  }
  return rows;
}

export function binanceKlinesUrl(symbol: string, interval: string, limit: number): string {
  return `${BINANCE_API_BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
}

export function binanceTickerUrl(symbol: string): string {
  return `${BINANCE_API_BASE}/ticker/24hr?symbol=${symbol}`;
}

export function binancePriceUrl(symbol: string): string {
  return `${BINANCE_API_BASE}/ticker/price?symbol=${symbol}`;
}

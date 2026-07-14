export const BINANCE_API_BASE = "https://api.binance.com/api/v3";

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
];

export const BINANCE_SYMBOLS = BINANCE_PAIRS.map((p) => p.symbol);
export const DEFAULT_SYMBOL = "BTCUSDT";
export const SOLANA_PAIRS = BINANCE_PAIRS.filter((p) => p.network === "solana");

export function normalizeSymbol(input: string): string {
  const upper = input.toUpperCase().trim();
  if (BINANCE_SYMBOLS.includes(upper)) return upper;
  const withQuote = upper.endsWith("USDT") ? upper : `${upper}USDT`;
  return withQuote;
}

export function isValidBinanceSymbol(symbol: string): boolean {
  return BINANCE_SYMBOLS.includes(normalizeSymbol(symbol));
}

export function formatPair(symbol: string): string {
  const pair = BINANCE_PAIRS.find((p) => p.symbol === symbol);
  return pair ? `${pair.base}/USDT` : symbol.replace("USDT", "/USDT");
}

export function getPairInfo(symbol: string): BinancePair | undefined {
  return BINANCE_PAIRS.find((p) => p.symbol === normalizeSymbol(symbol));
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

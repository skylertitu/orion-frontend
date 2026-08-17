export interface IndicatorValues {
  rsi?: { period: number; overbought: number; oversold: number };
  ema?: { fast: number; slow: number };
  sma?: { period: number };
  macd?: { fast: number; slow: number; signal: number };
  levels?: { label: string; price: number; type: "support" | "resistance" }[];
}

export const DEFAULT_INDICATOR_VALUES: IndicatorValues = {
  rsi: { period: 14, overbought: 70, oversold: 30 },
  ema: { fast: 20, slow: 50 },
  sma: { period: 20 },
  macd: { fast: 12, slow: 26, signal: 9 },
};

export interface ComputedIndicators {
  rsi: number | null;
  emaFast: number | null;
  emaSlow: number | null;
  sma: number | null;
  macd: { macd: number; signal: number; histogram: number } | null;
}

export function calculateSMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const slice = closes.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

export function calculateEMA(closes: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const result: (number | null)[] = [];
  let ema: number | null = null;

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    if (ema === null) {
      const slice = closes.slice(0, period);
      ema = slice.reduce((a, b) => a + b, 0) / period;
    } else {
      ema = closes[i] * k + ema * (1 - k);
    }
    result.push(ema);
  }
  return result;
}

export function calculateRSI(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [null];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (i < period) {
      avgGain += gain;
      avgLoss += loss;
      result.push(null);
      continue;
    }

    if (i === period) {
      avgGain = (avgGain + gain) / period;
      avgLoss = (avgLoss + loss) / period;
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) {
      result.push(100);
    } else {
      const rs = avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
  }
  return result;
}

export function calculateMACD(
  closes: number[],
  fast: number,
  slow: number,
  signalPeriod: number
): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const emaFast = calculateEMA(closes, fast);
  const emaSlow = calculateEMA(closes, slow);
  const macdLine = emaFast.map((f, i) => (f !== null && emaSlow[i] !== null ? f - emaSlow[i]! : null));
  const validMacd = macdLine.filter((v): v is number => v !== null);
  const signalEma = calculateEMA(validMacd, signalPeriod);

  let signalIdx = 0;
  const signal: (number | null)[] = macdLine.map((m) => {
    if (m === null) return null;
    const val = signalEma[signalIdx] ?? null;
    signalIdx++;
    return val;
  });

  const histogram = macdLine.map((m, i) =>
    m !== null && signal[i] !== null ? m - signal[i]! : null
  );

  return { macd: macdLine, signal, histogram };
}

export function computeLatestIndicators(
  closes: number[],
  config: IndicatorValues
): ComputedIndicators {
  const result: ComputedIndicators = {
    rsi: null,
    emaFast: null,
    emaSlow: null,
    sma: null,
    macd: null,
  };

  if (config.rsi) {
    const rsi = calculateRSI(closes, config.rsi.period);
    result.rsi = rsi[rsi.length - 1] ?? null;
  }
  if (config.ema) {
    const fast = calculateEMA(closes, config.ema.fast);
    const slow = calculateEMA(closes, config.ema.slow);
    result.emaFast = fast[fast.length - 1] ?? null;
    result.emaSlow = slow[slow.length - 1] ?? null;
  }
  if (config.sma) {
    const sma = calculateSMA(closes, config.sma.period);
    result.sma = sma[sma.length - 1] ?? null;
  }
  if (config.macd) {
    const { macd, signal, histogram } = calculateMACD(
      closes,
      config.macd.fast,
      config.macd.slow,
      config.macd.signal
    );
    const m = macd[macd.length - 1];
    const s = signal[signal.length - 1];
    const h = histogram[histogram.length - 1];
    if (m != null && s != null && h != null) {
      result.macd = { macd: m, signal: s, histogram: h };
    }
  }

  return result;
}

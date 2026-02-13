import { getCachedMarket, putCachedMarket } from './storage/r2.js';

const TF_MAP = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };
const ALLOWED = ['XAUUSD', 'BTCUSDT', 'ETHUSDT', 'EURUSD', 'GBPUSD', 'US30'];

export function normalizeSymbol(s) { return String(s || '').trim().toUpperCase(); }
export function normalizeTimeframe(tf) { return TF_MAP[tf] ? tf : '1h'; }
export function isAllowedSymbol(s) { return ALLOWED.includes(normalizeSymbol(s)); }

export function downsampleCandles(candles, target = 120) {
  if (candles.length <= target) return candles;
  const step = Math.ceil(candles.length / target);
  const out = [];
  for (let i = 0; i < candles.length; i += step) {
    const chunk = candles.slice(i, i + step);
    out.push({
      t: chunk[0].t,
      o: chunk[0].o,
      h: Math.max(...chunk.map((x) => x.h)),
      l: Math.min(...chunk.map((x) => x.l)),
      c: chunk[chunk.length - 1].c,
    });
  }
  return out;
}

export async function getMarketCandlesWithFallback(symbol, tf, env) {
  const key = `${symbol}:${tf}`;
  const cached = await getCachedMarket(env.MARKET_R2, key);
  if (cached) return cached;
  const now = Date.now();
  const candles = Array.from({ length: 180 }, (_, i) => {
    const base = 100 + Math.sin(i / 5) * 2;
    return { t: now - (180 - i) * 60_000, o: base, h: base + 1, l: base - 1, c: base + Math.cos(i / 3) };
  });
  await putCachedMarket(env.MARKET_R2, key, candles);
  return candles;
}

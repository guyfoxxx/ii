import { getMarketCandlesWithFallback, normalizeSymbol, normalizeTimeframe } from '../services/market.js';

export async function handleChart(url, env) {
  const symbol = normalizeSymbol(url.searchParams.get('symbol') || 'XAUUSD');
  const tf = normalizeTimeframe(url.searchParams.get('tf') || '1h');
  const candles = await getMarketCandlesWithFallback(symbol, tf, env);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='320'><rect width='100%' height='100%' fill='#101820'/><text x='20' y='30' fill='#fff'>${symbol} ${tf}</text><text x='20' y='60' fill='#7dd'>candles: ${candles.length}</text></svg>`;
  return new Response(svg, { headers: { 'content-type': 'image/svg+xml' } });
}

import { describe, it, expect } from 'vitest';
import { downsampleCandles } from '../src/services/market.js';

describe('downsampleCandles', () => {
  it('keeps ohlc shape', () => {
    const candles = Array.from({ length: 200 }, (_, i) => ({ t: i, o: i, h: i + 1, l: i - 1, c: i + 0.5 }));
    const out = downsampleCandles(candles, 100);
    expect(out.length).toBeLessThanOrEqual(100);
    expect(out[0]).toHaveProperty('o');
  });
});

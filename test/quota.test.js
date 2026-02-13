import { describe, it, expect } from 'vitest';
import { canAnalyze, dailyLimit } from '../src/services/quota.js';

describe('quota', () => {
  it('uses free limit', () => {
    const u = { dailyDate: 'x', dailyUsed: 0, subscription: { active: false } };
    expect(dailyLimit({ FREE_DAILY_LIMIT: 3 }, u)).toBe(3);
  });
  it('blocks when used reaches limit', () => {
    const u = { dailyDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date()), dailyUsed: 3, subscription: { active: false } };
    expect(canAnalyze({ FREE_DAILY_LIMIT: 3 }, u, false)).toBe(false);
  });
});

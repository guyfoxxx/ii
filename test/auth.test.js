import { describe, it, expect } from 'vitest';
import { verifyTelegramInitData } from '../src/services/auth.js';

const enc = new TextEncoder();
async function hmac(key, data) {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data)));
}
function hex(bytes) { return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(''); }

async function buildInitData(botToken) {
  const auth_date = Math.floor(Date.now() / 1000);
  const user = JSON.stringify({ id: 123, username: 'u' });
  const p = new URLSearchParams({ auth_date: String(auth_date), user });
  const check = [...p.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join('\n');
  const secret = await crypto.subtle.digest('SHA-256', enc.encode(botToken));
  const hash = hex(await hmac(new Uint8Array(secret), check));
  p.set('hash', hash);
  return p.toString();
}

describe('verifyTelegramInitData', () => {
  it('validates signature', async () => {
    const token = 'abc:123';
    const initData = await buildInitData(token);
    const res = await verifyTelegramInitData(initData, token, 300, '0');
    expect(res.ok).toBe(true);
    expect(res.userId).toBe(123);
  });
});

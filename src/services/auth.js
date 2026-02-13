const enc = new TextEncoder();

async function hmac(key, data) {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data)));
}

function toHex(bytes) { return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(''); }

export async function verifyTelegramInitData(initData, botToken, maxAgeSecRaw = 300, lenientRaw = '0', replayStore) {
  if (!initData || !botToken) return { ok: false, reason: 'missing_init_data' };
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'missing_hash' };

  const check = [];
  for (const [k, v] of [...params.entries()].sort(([a], [b]) => a.localeCompare(b))) if (k !== 'hash') check.push(`${k}=${v}`);
  const dataCheckString = check.join('\n');

  const secret = await crypto.subtle.digest('SHA-256', enc.encode(botToken));
  const calculated = toHex(await hmac(new Uint8Array(secret), dataCheckString));
  if (calculated !== hash) return { ok: false, reason: 'bad_hash' };

  const maxAgeSec = Number(maxAgeSecRaw || 300);
  const lenient = String(lenientRaw || '0') === '1';
  const authDate = Number(params.get('auth_date') || 0);
  if (!lenient) {
    if (!authDate) return { ok: false, reason: 'missing_auth_date' };
    if (Math.floor(Date.now() / 1000) - authDate > maxAgeSec) return { ok: false, reason: 'expired' };
  }

  const userRaw = params.get('user');
  const fromLike = userRaw ? JSON.parse(userRaw) : null;
  const userId = Number(fromLike?.id || params.get('user_id') || 0);
  if (!userId) return { ok: false, reason: 'missing_user' };

  const replayKey = `replay:${hash}`;
  if (replayStore) {
    const old = await replayStore.get(replayKey);
    if (old) return { ok: false, reason: 'replay' };
    await replayStore.put(replayKey, '1', { expirationTtl: Math.max(60, maxAgeSec) });
  }

  return { ok: true, userId, fromLike };
}

export function normalizeHandle(v) { return String(v || '').trim().replace(/^@+/, '').toLowerCase(); }
export function isOwner(user, env) { return (env.OWNER_HANDLES || '').split(',').map(normalizeHandle).includes(normalizeHandle(user?.username)); }
export function isAdmin(user, env) { return (env.ADMIN_HANDLES || '').split(',').map(normalizeHandle).includes(normalizeHandle(user?.username)); }
export function isStaff(user, env) { return isOwner(user, env) || isAdmin(user, env); }

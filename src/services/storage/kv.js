export async function kvGetJson(kv, key, fallback = null) {
  if (!kv) return fallback;
  const raw = await kv.get(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

export async function kvPutJson(kv, key, value) {
  if (!kv) return;
  await kv.put(key, JSON.stringify(value));
}

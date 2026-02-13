export async function getCachedMarket(r2, key) {
  if (!r2) return null;
  const obj = await r2.get(key);
  if (!obj) return null;
  return JSON.parse(await obj.text());
}

export async function putCachedMarket(r2, key, value) {
  if (!r2) return;
  await r2.put(key, JSON.stringify(value));
}

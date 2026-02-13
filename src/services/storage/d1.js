export async function ensureSchema(db) {
  if (!db) return;
  await db.exec(`
CREATE TABLE IF NOT EXISTS users (userId TEXT PRIMARY KEY, json TEXT NOT NULL, updatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS withdrawals (id TEXT PRIMARY KEY, userId TEXT, createdAt TEXT, amount REAL, address TEXT, status TEXT);
`);
}

export async function putUser(db, user) {
  if (!db) return;
  await db.prepare('INSERT OR REPLACE INTO users (userId, json, updatedAt) VALUES (?, ?, ?)').bind(String(user.userId), JSON.stringify(user), new Date().toISOString()).run();
}

export async function getUser(db, userId) {
  if (!db) return null;
  const row = await db.prepare('SELECT json FROM users WHERE userId = ?').bind(String(userId)).first();
  return row?.json ? JSON.parse(row.json) : null;
}

export async function listUsers(db, limit = 200) {
  if (!db) return [];
  const { results } = await db.prepare('SELECT json FROM users ORDER BY updatedAt DESC LIMIT ?').bind(limit).all();
  return results.map((r) => JSON.parse(r.json));
}

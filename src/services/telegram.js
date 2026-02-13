export async function tgCall(env, method, payload) {
  if (!env.TELEGRAM_BOT_TOKEN) return { ok: false, skipped: true };
  const u = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
  const res = await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  return res.json();
}

export const tgSendMessage = (env, chat_id, text) => tgCall(env, 'sendMessage', { chat_id, text });

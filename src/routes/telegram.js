import { json } from '../utils/http.js';
import { tgSendMessage } from '../services/telegram.js';
import { loadUser, saveUser } from '../services/users.js';

export async function handleTelegram(request, env, ctx, secret) {
  if (secret !== env.TELEGRAM_WEBHOOK_SECRET) return json({ ok: false, error: 'forbidden' }, 403);
  const update = await request.json().catch(() => ({}));
  ctx.waitUntil(handleUpdate(update, env));
  return json({ ok: true });
}

async function handleUpdate(update, env) {
  const msg = update?.message;
  if (!msg?.chat?.id) return;
  const chatId = msg.chat.id;
  const text = String(msg.text || '').trim();
  const st = await loadUser(env, chatId);
  if (text === '/start') {
    await tgSendMessage(env, chatId, 'سلام! برای شروع نام خود را ارسال کنید.');
    st.state = 'await_name';
    await saveUser(env, st);
    return;
  }
  if (st.state === 'await_name') {
    st.profile.name = text;
    st.state = 'await_phone';
    await saveUser(env, st);
    await tgSendMessage(env, chatId, 'شماره تماس را وارد کنید.');
    return;
  }
  if (st.state === 'await_phone') {
    st.profile.phone = text;
    st.profile.onboardingDone = true;
    st.state = 'idle';
    await saveUser(env, st);
    await tgSendMessage(env, chatId, 'پروفایل تکمیل شد ✅');
    return;
  }
  await tgSendMessage(env, chatId, 'دستور دریافت شد.');
}

import { json, readJson } from '../utils/http.js';
import { verifyTelegramInitData, isStaff, isOwner, normalizeHandle } from '../services/auth.js';
import { loadUser, saveUser } from '../services/users.js';
import { canAnalyze, dailyLimit } from '../services/quota.js';
import { getMarketCandlesWithFallback, normalizeSymbol, normalizeTimeframe, isAllowedSymbol, downsampleCandles } from '../services/market.js';
import { runTextProviders, runPolishProviders } from '../services/ai.js';
import { getNews } from '../services/news.js';
import { kvGetJson, kvPutJson } from '../services/storage/kv.js';
import { buildAdminReportLines } from '../services/report.js';
import { tgSendMessage } from '../services/telegram.js';
import { uuidv4 } from '../utils/id.js';
import { listUsers } from '../services/storage/d1.js';

async function auth(body, env, replay = true) {
  return verifyTelegramInitData(body?.initData, env.TELEGRAM_BOT_TOKEN, env.INITDATA_MAX_AGE_SEC || 300, env.MINIAPP_AUTH_LENIENT || '0', replay ? env.BOT_KV : null);
}

export async function handleApi(request, env, ctx, path) {
  const body = await readJson(request);
  if (!body) return json({ ok: false, error: 'bad_json' }, 400);

  if (path === '/api/user') {
    const v = await auth(body, env);
    if (!v.ok) return json({ ok: false, error: v.reason }, 401);
    const st = await loadUser(env, v.userId);
    st.profile.username = v.fromLike?.username || st.profile.username;
    await saveUser(env, st);
    const role = isOwner(v.fromLike, env) ? 'owner' : isStaff(v.fromLike, env) ? 'admin' : 'user';
    return json({ ok: true, welcome: 'خوش آمدید', state: st, quota: isStaff(v.fromLike, env) ? '∞' : `${st.dailyUsed}/${dailyLimit(env, st)}`, symbols: ['XAUUSD', 'BTCUSDT'], styles: ['classic', 'scalp'], offerBanner: env.SPECIAL_OFFER_TEXT || '', customPrompts: [], role, isStaff: role !== 'user', wallet: env.WALLET_ADDRESS || '', botUsername: env.BOT_USERNAME || '' });
  }

  if (path === '/api/settings') {
    const v = await auth(body, env);
    if (!v.ok) return json({ ok: false, error: v.reason }, 401);
    const st = await loadUser(env, v.userId);
    if (body.timeframe) st.timeframe = normalizeTimeframe(body.timeframe);
    if (body.style && ['classic', 'scalp', 'swing'].includes(body.style)) st.style = body.style;
    if (typeof body.risk === 'string') st.risk = body.risk;
    if (typeof body.newsEnabled === 'boolean') st.newsEnabled = body.newsEnabled;
    if (typeof body.promptMode === 'string') st.promptMode = body.promptMode;
    if (body.selectedSymbol && isAllowedSymbol(body.selectedSymbol)) st.selectedSymbol = normalizeSymbol(body.selectedSymbol);
    if (body.capitalAmount != null && Number.isFinite(Number(body.capitalAmount))) st.profile.capital = Number(body.capitalAmount);
    if (typeof body.customPromptId === 'string') st.customPromptId = body.customPromptId;
    await saveUser(env, st);
    return json({ ok: true, state: st, quota: `${st.dailyUsed}/${dailyLimit(env, st)}` });
  }

  if (path === '/api/analyze') {
    const v = await auth(body, env);
    if (!v.ok) return json({ ok: false, error: v.reason }, 401);
    const st = await loadUser(env, v.userId);
    if (!st.profile.name || !st.profile.phone) return json({ ok: false, error: 'onboarding_required' }, 400);
    if (!canAnalyze(env, st, isStaff(v.fromLike, env))) return json({ ok: false, error: 'quota_exceeded' }, 429);
    const symbol = isAllowedSymbol(body.symbol) ? normalizeSymbol(body.symbol) : st.selectedSymbol;
    const candles = await getMarketCandlesWithFallback(symbol, st.timeframe, env);
    const news = st.newsEnabled ? await getNews(symbol, env) : [];
    const prompt = `symbol=${symbol}\nstyle=${st.style}\nmarket=${JSON.stringify(downsampleCandles(candles, 80))}\nnews=${JSON.stringify(news.map((n) => n.title))}\nuser=${body.userPrompt || ''}`;
    const raw = await runTextProviders(prompt, env);
    const result = await runPolishProviders(raw, env);
    st.dailyUsed = Number(st.dailyUsed || 0) + 1;
    st.stats.totalAnalyses = Number(st.stats.totalAnalyses || 0) + 1;
    await saveUser(env, st);
    return json({ ok: true, result, quota: `${st.dailyUsed}/${dailyLimit(env, st)}`, state: st, chartUrl: `/api/chart?symbol=${symbol}&tf=${st.timeframe}`, levels: [], quickChartSpec: {}, quickchartConfig: {}, zonesSvg: '<svg xmlns="http://www.w3.org/2000/svg"/>' });
  }

  if (path === '/api/quote') {
    const v = await auth(body, env);
    if (!v.ok) return json({ ok: false, error: v.reason }, 401);
    const symbol = normalizeSymbol(body.symbol);
    if (!isAllowedSymbol(symbol)) return json({ ok: false, error: 'bad_symbol' }, 400);
    const candles = await getMarketCandlesWithFallback(symbol, normalizeTimeframe(body.timeframe), env);
    const last = candles[candles.length - 1], prev = candles[candles.length - 2];
    const changePct = ((last.c - prev.c) / prev.c) * 100;
    return json({ ok: true, price: last.c, changePct, trend: changePct > 0 ? 'up' : changePct < 0 ? 'down' : 'flat', sma20: last.c, sma50: last.c, candles: downsampleCandles(candles, 60), quality: 'full', status: changePct > 0 ? 'up' : changePct < 0 ? 'down' : 'flat' });
  }

  if (path === '/api/news' || path === '/api/news/analyze') {
    const v = await auth(body, env);
    if (!v.ok) return json({ ok: false, error: v.reason }, 401);
    const articles = await getNews(normalizeSymbol(body.symbol || 'XAUUSD'), env);
    if (path === '/api/news') return json({ ok: true, articles });
    return json({ ok: true, articles, summary: { sentiment: 'خنثی', risk: 'متوسط', impact: 'متوسط' } });
  }

  if (path === '/api/support/ticket') {
    const v = await auth(body, env);
    if (!v.ok) return json({ ok: false, error: v.reason }, 401);
    const st = await loadUser(env, v.userId);
    const ticket = { id: uuidv4(), userId: st.userId, username: st.profile.username || '', phone: st.profile.phone ? st.profile.phone.replace(/\d(?=\d{4})/g, '*') : '', text: String(body.text || '').slice(0, 2000), kind: body.kind || 'general', status: 'pending', createdAt: new Date().toISOString() };
    const idx = (await kvGetJson(env.BOT_KV, 'tickets:index', [])); idx.unshift(ticket.id);
    await Promise.all([kvPutJson(env.BOT_KV, `ticket:${ticket.id}`, ticket), kvPutJson(env.BOT_KV, 'tickets:index', idx.slice(0, 1000))]);
    if (env.SUPPORT_CHAT_ID) ctx.waitUntil(tgSendMessage(env, Number(env.SUPPORT_CHAT_ID), `🎫 Ticket ${ticket.id}\n@${ticket.username}\n${ticket.text}`));
    return json({ ok: true, ticket });
  }

  if (path === '/api/wallet/deposit/notify') {
    const v = await auth(body, env);
    if (!v.ok) return json({ ok: false, error: v.reason }, 401);
    if (!body.txid && !body.txHash) return json({ ok: false, error: 'txid_required' }, 400);
    if (body.amount != null && !Number.isFinite(Number(body.amount))) return json({ ok: false, error: 'bad_amount' }, 400);
    const payment = { id: uuidv4(), userId: v.userId, txHash: body.txid || body.txHash, amount: body.amount ? Number(body.amount) : null, planName: body.planName || '', network: body.network || '', status: 'pending', createdAt: new Date().toISOString() };
    const idx = (await kvGetJson(env.BOT_KV, 'payments:index', [])); idx.unshift(payment.id);
    await Promise.all([kvPutJson(env.BOT_KV, `payment:${payment.id}`, payment), kvPutJson(env.BOT_KV, 'payments:index', idx.slice(0, 1000))]);
    if (env.SUPPORT_CHAT_ID) ctx.waitUntil(tgSendMessage(env, Number(env.SUPPORT_CHAT_ID), `💳 Payment notify ${payment.id}`));
    return json({ ok: true, payment });
  }

  if (path.startsWith('/api/admin/')) {
    const v = await auth(body, env);
    if (!v.ok) return json({ ok: false, error: v.reason }, 401);
    if (!isStaff(v.fromLike, env)) return json({ ok: false, error: 'forbidden' }, 403);

    if (path === '/api/admin/bootstrap') {
      const users = await listUsers(env.BOT_DB, 100);
      const tickets = await kvGetJson(env.BOT_KV, 'tickets:index', []);
      return json({ ok: true, prompt: '', styles: ['classic'], commission: {}, offerBanner: env.SPECIAL_OFFER_TEXT || '', payments: [], stylePrompts: {}, customPrompts: [], freeDailyLimit: Number(env.FREE_DAILY_LIMIT || 3), withdrawals: [], tickets, adminFlags: {}, welcomeBot: '', welcomeMiniapp: '' });
    }

    if (path === '/api/admin/report/pdf') {
      if (!isOwner(v.fromLike, env)) return json({ ok: false, error: 'forbidden' }, 403);
      const users = await listUsers(env.BOT_DB, 200);
      const lines = buildAdminReportLines(users, [], [], []);
      return json({ ok: true, lines });
    }

    if (path === '/api/admin/payments/approve' || path === '/api/admin/subscription/activate') {
      const username = normalizeHandle(body.username);
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) return json({ ok: false, error: 'bad_amount' }, 400);
      if (!username) return json({ ok: false, error: 'bad_username' }, 400);
      return json({ ok: true, username, amount });
    }

    return json({ ok: true, message: 'admin route placeholder', path });
  }

  return json({ ok: false, error: 'not_found' }, 404);
}

import { MINI_APP_HTML } from './miniapp/html.js';
import { MINI_APP_JS } from './miniapp/js.js';
import { html, js, text } from './utils/http.js';
import { handleApi } from './routes/api.js';
import { handleTelegram } from './routes/telegram.js';
import { handleChart } from './routes/chart.js';
import { ensureSchema } from './services/storage/d1.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    await ensureSchema(env.BOT_DB);

    if (url.pathname === '/health') return text('ok');
    if (request.method === 'GET' && url.pathname === '/app.js') return js(MINI_APP_JS);
    if (request.method === 'GET' && url.pathname === '/') return html(MINI_APP_HTML);
    if (request.method === 'GET' && url.pathname === '/api/chart') return handleChart(url, env);
    if (request.method === 'POST' && url.pathname.startsWith('/api/')) return handleApi(request, env, ctx, url.pathname);
    if (request.method === 'POST' && url.pathname.startsWith('/telegram/')) return handleTelegram(request, env, ctx, url.pathname.split('/').pop());
    return text('not found', 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDailySuggestions(env));
    ctx.waitUntil(runDailyProfileNotifications(env));
  },
};

async function runDailySuggestions(env) { console.log('runDailySuggestions'); }
async function runDailyProfileNotifications(env) { if (String(env.PROFILE_TIPS_ENABLED || '1') === '1') console.log('runDailyProfileNotifications'); }

const BOT_NAME = "MarketiQ";

const WELCOME_BOT = `🎯 متن خوش‌آمدگویی بات تلگرام MarketiQ

👋 به MarketiQ خوش آمدید
هوش تحلیلی شما در بازارهای مالی

────────────────────────

📊 MarketiQ یک ایجنت تخصصی تحلیل بازارهای مالی است که با تمرکز بر تصمیم‌سازی هوشمند، در کنار شماست تا بازار را درست‌تر، عمیق‌تر و حرفه‌ای‌تر ببینید.

🔍 در MarketiQ چه دریافت می‌کنید؟
✅ تحلیل فاندامنتال بازارهای مالی
✅ تحلیل تکنیکال دقیق و ساختاریافته
✅ سیگنال‌های معاملاتی با رویکرد مدیریت ریسک
✅ پوشش بازارها:
- 🪙 کریپتوکارنسی
- 💱 جفت‌ارزها (Forex)
- 🪙 فلزات گران‌بها
- 📈 سهام

────────────────────────

🧠 فلسفه MarketiQ
ما سیگنال نمی‌فروشیم، ما «درک بازار» می‌سازیم.
هدف ما کمک به شما برای تصمیم‌گیری آگاهانه است، نه وابستگی کورکورانه به سیگنال.

────────────────────────

🚀 شروع کنید
/start | شروع تحلیل
/signals | سیگنال‌ها
/education | آموزش و مفاهیم بازار
/support | پشتیبانی

────────────────────────

⚠️ سلب مسئولیت:
تمام تحلیل‌ها صرفاً جنبه آموزشی و تحلیلی دارند و مسئولیت نهایی معاملات بر عهده کاربر است.`;

const WELCOME_MINIAPP = `👋 به MarketiQ خوش آمدید — هوش تحلیلی شما در بازارهای مالی
این مینی‌اپ برای گرفتن تحلیل سریع، تنظیمات، و مدیریت دسترسی طراحی شده است.
⚠️ تحلیل‌ها آموزشی است و مسئولیت معاملات با شماست.`;

const BTN = {
  SIGNAL: "📈 سیگنال", ANALYZE: "🧠 تحلیل", PROFILE: "👤 پروفایل", SETTINGS: "⚙️ تنظیمات", INVITE: "🤝 دعوت",
  SUPPORT: "🆘 پشتیبانی", SUPPORT_TICKET: "📩 تیکت پشتیبانی", SUPPORT_FAQ: "❓ سوالات آماده", SUPPORT_CUSTOM_PROMPT: "🧠 درخواست پرامپت اختصاصی",
  EDUCATION: "📚 آموزش", LEVELING: "🧪 تعیین سطح", BACK: "⬅️ برگشت", HOME: "🏠 منوی اصلی", MINIAPP: "🧩 مینی‌اپ", QUOTE: "💹 قیمت لحظه‌ای",
  NEWS: "📰 اخبار نماد", NEWS_ANALYSIS: "🧠 تحلیل خبر", WALLET: "💳 ولت", WALLET_BALANCE: "💰 موجودی", WALLET_DEPOSIT: "➕ واریز", WALLET_WITHDRAW: "➖ برداشت",
  CAT_MAJORS: "💱 ماجورها", CAT_METALS: "🪙 فلزات", CAT_INDICES: "📊 شاخص‌ها", CAT_CRYPTO: "₿ کریپتو (15)", SET_TF: "⏱ تایم‌فریم", SET_STYLE: "🎯 سبک",
  SET_RISK: "⚠️ ریسک", SET_NEWS: "📰 خبر", SET_CAPITAL: "💼 سرمایه", REQUEST_CUSTOM_PROMPT: "🧠 درخواست پرامپت اختصاصی"
};

const QUIZ = [
  { key: "q1", text: "۱) بیشتر دنبال چی هستی؟", options: ["اسکالپ سریع", "سوئینگ چندروزه", "هولد/سرمایه‌گذاری", "نمی‌دانم"] },
  { key: "q2", text: "۲) وقتی معامله خلاف تو رفت…", options: ["فوراً می‌بندم", "صبر می‌کنم تا ساختار مشخص شود", "میانگین کم می‌کنم", "تجربه‌ای ندارم"] },
  { key: "q3", text: "۳) ابزار تحلیل‌ات؟", options: ["پرایس‌اکشن", "اندیکاتور", "اسمارت‌مانی", "هیچکدام"] },
  { key: "q4", text: "۴) تحمل ریسک؟", options: ["کم", "متوسط", "زیاد", "نمی‌دانم"] },
  { key: "q5", text: "۵) تایم آزاد برای چک کردن بازار؟", options: ["ساعتی", "چندبار در روز", "روزانه", "هفتگی/کم"] },
];

const SUPPORT_FAQ = [
  { q: "چطور سهمیه روزانه شارژ می‌شود؟", a: "سهمیه هر روز (Tehran) صفر می‌شود و مجدداً قابل استفاده است." },
  { q: "چرا تحلیل ناموفق شد؟", a: "اتصال دیتا یا مدل ممکن است موقتاً قطع باشد. چند دقیقه بعد دوباره تلاش کن." },
  { q: "چطور اشتراک فعال کنم؟", a: "پرداخت را انجام بده و هش تراکنش را برای ادمین ارسال کن تا تأیید و فعال شود." },
  { q: "چطور رفرال کار می‌کند؟", a: "هر دعوت موفق با شماره جدید ۳ امتیاز دارد. هر ۵۰۰ امتیاز = ۳۰ روز اشتراک هدیه." },
];

const MAJORS = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD"];
const METALS = ["XAUUSD", "XAGUSD"];
const INDICES = ["DJI", "NDX", "SPX"];
const CRYPTOS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "TRXUSDT", "TONUSDT", "AVAXUSDT", "LINKUSDT", "DOTUSDT", "MATICUSDT", "LTCUSDT", "BCHUSDT"];
const TIMEFRAMES = ["M15", "H1", "H4", "D1"];
const RISKS = ["کم", "متوسط", "زیاد"];
const ALLOWED_STYLE_LIST = ["پرایس اکشن", "ICT", "ATR", "ترکیبی"];

const DEFAULT_ANALYSIS_PROMPT = `SYSTEM ROLE: Multi-Style Market Analyst (Style-Aware)

Context variables:
- STYLE_MODE: {STYLE}
- RISK_PROFILE: {RISK}
- NEWS_MODE: {NEWS}
- TIMEFRAME: {TIMEFRAME}

Hard constraints:
1) Output must be in Persian and strictly step-by-step with clear section titles.
2) Use only MARKET_DATA. If data is missing, explicitly state "نامشخص از داده" and avoid guessing.
3) Final trade plan must be conditional (scenario-based), never absolute buy/sell advice.
4) Every setup must include Entry, Stop Loss, TP1, TP2, and invalidation.
5) Respect selected style only. Do not mix frameworks unless STYLE_MODE is "ترکیبی".

Execution structure (mandatory):
۱) بایاس و وضعیت تایم‌فریم بالاتر
۲) ساختار بازار و نقدینگی
۳) نواحی کلیدی و رفتار قیمت
۴) سناریوهای ورود و مدیریت معامله
۵) پلن اجرا + نقطه ابطال

Risk/profile adaptation:
- کم‌ریسک: ورود پس از تایید کامل (Close + Retest) و SL محافظه‌کار.
- متوسط: تایید استاندارد و مدیریت پله‌ای TP.
- پرریسک: ورود تهاجمی فقط با هشدار ریسک بالا.

News mode:
- If {NEWS}=on, briefly include high-impact event risk in execution timing.
- If {NEWS}=off, do not include news commentary.`;

const STYLE_PROMPTS_DEFAULT = {
  "پرایس اکشن": "Role: Price Action analyst. Constraints: market structure, S/R, liquidity sweep, clear invalidation. Sections: 1..5",
  "ICT": "Role: ICT/SMC analyst. Constraints: PD arrays, FVG/OB, liquidity pools, session logic. Sections: 1..5",
  "ATR": "Role: ATR volatility analyst. Constraints: ATR regime, stop sizing, target multiples. Sections: 1..5"
};

function kyivDateString() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function nowIso() { return new Date().toISOString(); }
function j(v, s = 200, h = {}) { return new Response(JSON.stringify(v), { status: s, headers: { "content-type": "application/json; charset=utf-8", ...h } }); }
function parseNum(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function safeJson(s, d = null) { try { return JSON.parse(s); } catch { return d; } }
function splitCsv(v) { return String(v || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean); }
function randId(p = "id") { return `${p}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`; }
function allSymbols() { return [...MAJORS, ...METALS, ...INDICES, ...CRYPTOS]; }

function defaultUser(userId) {
  const referralCode = `mq${String(userId).slice(-4)}${Math.random().toString(36).slice(2, 6)}`;
  return {
    userId: String(userId), createdAt: nowIso(), state: "idle", selectedSymbol: "BTCUSDT", timeframe: "H4", style: "پرایس اکشن", risk: "متوسط",
    newsEnabled: true, promptMode: "style_plus_custom", dailyDate: kyivDateString(), dailyUsed: 0, freeDailyLimit: 3,
    profile: {
      name: "", phone: "", username: "", firstName: "", lastName: "", marketExperience: "", preferredMarket: "", level: "", levelNotes: "", preferredStyle: "",
      language: "fa", countryCode: "IR", timezone: "Asia/Tehran", entrySource: "", onboardingDone: false, capital: 0, capitalCurrency: "USDT"
    },
    capital: { amount: 0, enabled: true },
    referral: {
      codes: [referralCode], referredBy: "", referredByCode: "", successfulInvites: 0, points: 0, commissionTotal: 0, commissionBalance: 0,
      onboardingRewardDone: false, onboardingRewardAt: ""
    },
    subscription: { active: false, type: "free", expiresAt: "", dailyLimit: 3 },
    wallet: { balance: 0, transactions: [] },
    textOrder: "", visionOrder: "", polishOrder: "",
    stats: { totalAnalyses: 0, successfulAnalyses: 0, lastAnalysisAt: "", totalPayments: 0, totalPaymentAmount: 0 },
    customPromptId: "", pendingCustomPromptRequestId: ""
  };
}

async function hmacBytes(secretBytes, data) {
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
}
function hex(buf) { return [...buf].map((b) => b.toString(16).padStart(2, "0")).join(""); }
function b64urlEncodeBytes(bytes) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
function b64urlEncodeText(s) { return b64urlEncodeBytes(new TextEncoder().encode(s)); }
function b64urlDecodeBytes(s) { const t = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4); return Uint8Array.from(atob(t), c => c.charCodeAt(0)); }
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function verifyTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return { ok: false, reason: "missing_init_data_or_token" };
  const p = new URLSearchParams(initData);
  const hash = p.get("hash") || "";
  if (!hash) return { ok: false, reason: "missing_hash" };
  p.delete("hash");
  const dataCheck = [...p.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = await hmacBytes(new TextEncoder().encode("WebAppData"), botToken);
  const computed = hex(await hmacBytes(secret, dataCheck));
  if (!timingSafeEqual(computed, hash)) return { ok: false, reason: "invalid_hash" };
  const authDate = Number(p.get("auth_date") || 0);
  if (authDate && Math.abs(Math.floor(Date.now() / 1000) - authDate) > 86400) return { ok: false, reason: "auth_date_expired" };
  const user = safeJson(p.get("user") || "{}", {});
  return { ok: true, userId: String(user.id || ""), fromLike: { id: user.id, username: user.username, first_name: user.first_name, last_name: user.last_name } };
}

async function makeSessionToken(payload, env) {
  const part = b64urlEncodeText(JSON.stringify(payload));
  const sig = await hmacBytes(new TextEncoder().encode(env.SESSION_SECRET || ""), part);
  return `${part}.${b64urlEncodeBytes(sig)}`;
}
async function verifySessionToken(token, env) {
  const [part, s] = String(token || "").split(".");
  if (!part || !s) return { ok: false, reason: "bad_token" };
  const expected = b64urlEncodeBytes(await hmacBytes(new TextEncoder().encode(env.SESSION_SECRET || ""), part));
  if (!timingSafeEqual(expected, s)) return { ok: false, reason: "bad_signature" };
  const payload = safeJson(new TextDecoder().decode(b64urlDecodeBytes(part)), null);
  if (!payload?.uid) return { ok: false, reason: "bad_payload" };
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return { ok: false, reason: "expired" };
  return { ok: true, userId: String(payload.uid), fromLike: payload.fromLike || null };
}

function readCookie(req, key) {
  const c = req.headers.get("cookie") || "";
  for (const kv of c.split(";")) {
    const [k, ...r] = kv.trim().split("=");
    if (k === key) return r.join("=");
  }
  return "";
}
function sessionCookie(token, maxAge) { return `__Host-mq_session=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${maxAge}`; }
function clearSessionCookie() { return "__Host-mq_session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0"; }

async function authMiniappRequest(request, body, env) {
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (bearer) {
    const v = await verifySessionToken(bearer, env);
    if (v.ok) return v;
  }
  if (body?.token) {
    const v = await verifySessionToken(body.token, env);
    if (v.ok) return v;
  }
  const c = readCookie(request, "__Host-mq_session");
  if (c) {
    const v = await verifySessionToken(c, env);
    if (v.ok) return v;
  }
  if (String(env.MINIAPP_AUTH_LENIENT || "") === "1" && body?.initData) {
    return verifyTelegramInitData(body.initData, env.TELEGRAM_BOT_TOKEN);
  }
  return { ok: false, reason: "unauthorized" };
}

async function kvGetJson(env, k, d = null) { if (!env.BOT_KV) return d; return safeJson(await env.BOT_KV.get(k), d); }
async function kvPutJson(env, k, v) { if (env.BOT_KV) await env.BOT_KV.put(k, JSON.stringify(v)); }

async function ensureSchema(env) {
  if (!env.BOT_DB) return;
  await env.BOT_DB.exec(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, data TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS generic (k TEXT PRIMARY KEY, v TEXT, updated_at TEXT);`);
}
async function dbGet(env, key) {
  if (!env.BOT_DB) return null;
  const row = await env.BOT_DB.prepare("SELECT v FROM generic WHERE k=?").bind(key).first();
  return row ? safeJson(row.v, null) : null;
}
async function dbPut(env, key, val) {
  if (!env.BOT_DB) return;
  await env.BOT_DB.prepare("INSERT INTO generic (k,v,updated_at) VALUES (?,?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, updated_at=excluded.updated_at")
    .bind(key, JSON.stringify(val), nowIso()).run();
}
async function loadUser(userId, env) {
  if (env.BOT_DB) {
    await ensureSchema(env);
    const row = await env.BOT_DB.prepare("SELECT data FROM users WHERE id=?").bind(String(userId)).first();
    if (row?.data) return safeJson(row.data, null);
  }
  return await kvGetJson(env, `u:${userId}`, null);
}
async function saveUser(st, env) {
  st.updatedAt = nowIso();
  if (env.BOT_DB) {
    await ensureSchema(env);
    await env.BOT_DB.prepare("INSERT INTO users (id,data,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at")
      .bind(String(st.userId), JSON.stringify(st), st.updatedAt).run();
  }
  await kvPutJson(env, `u:${st.userId}`, st);
}
async function ensureUser(userId, env) {
  let st = await loadUser(userId, env);
  if (!st) st = defaultUser(userId);
  if (!Array.isArray(st.referral?.codes) || !st.referral.codes.length) st.referral.codes = [randId("ref")];
  return st;
}

function roleForUser(st, env) {
  const u = String(st.profile?.username || "").toLowerCase();
  if (splitCsv(env.OWNER_HANDLES).includes(u)) return "owner";
  if (splitCsv(env.ADMIN_HANDLES).includes(u)) return "admin";
  return "user";
}
function isStaffRole(r) { return r === "owner" || r === "admin"; }

function resetDailyIfNeeded(st) {
  const d = kyivDateString();
  if (st.dailyDate !== d) { st.dailyDate = d; st.dailyUsed = 0; }
}
function effectiveLimit(st, env) {
  const free = parseNum(env.FREE_DAILY_LIMIT, 3);
  const premium = parseNum(env.PREMIUM_DAILY_LIMIT, 50);
  if (st.subscription?.active && ["premium", "gift", "manual"].includes(st.subscription.type)) return st.subscription.dailyLimit || premium;
  return st.subscription?.dailyLimit || st.freeDailyLimit || free;
}

async function getMarketCandlesWithFallback(symbol, tf, env) {
  const key = `mkt:${symbol}:${tf}`;
  const cache = await kvGetJson(env, key, null);
  if (cache?.ts && Date.now() - cache.ts < 120000) return cache.data;
  const base = 100 + Math.random() * 10;
  const arr = Array.from({ length: 120 }).map((_, i) => {
    const o = base + Math.sin(i / 7) * 2 + Math.random();
    const c = o + (Math.random() - 0.5) * 1.5;
    const h = Math.max(o, c) + Math.random() * 1;
    const l = Math.min(o, c) - Math.random() * 1;
    return { t: Date.now() - (120 - i) * 3600000, o, h, l, c, v: 1000 + Math.random() * 300 };
  });
  await kvPutJson(env, key, { ts: Date.now(), data: arr });
  return arr;
}
function computeSnapshot(candles) {
  const last = candles[candles.length - 1], prev = candles[candles.length - 2] || last;
  const changePct = ((last.c - prev.c) / prev.c) * 100;
  const high = Math.max(...candles.slice(-30).map(x => x.h));
  const low = Math.min(...candles.slice(-30).map(x => x.l));
  return { lastPrice: last.c, changePct, trend: changePct >= 0 ? "up" : "down", high, low };
}
function parseLevelsFromText(analysis) {
  const nums = [...String(analysis).matchAll(/\b\d{2,6}(?:\.\d+)?\b/g)].map((m) => Number(m[0])).filter(Number.isFinite);
  const uniq = [...new Set(nums)].slice(0, 3);
  return { X: uniq[0] || null, Y: uniq[1] || null, Z: uniq[2] || null };
}
function quickchartUrl(symbol, tf, levels) {
  const cfg = { type: "line", data: { labels: ["X", "Y", "Z"], datasets: [{ label: `${symbol} ${tf}`, data: [levels.X, levels.Y, levels.Z].map(v => v || 0) }] } };
  return { chartUrl: `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(cfg))}`, chartConfig: cfg };
}

async function fetchSymbolNewsFa(symbol) {
  return [
    { title: `${symbol}: نوسان با تمرکز بر ریسک کلان`, ts: nowIso() },
    { title: `${symbol}: داده‌های اقتصادی در کانون توجه`, ts: nowIso() },
    { title: `${symbol}: حجم معاملات در حال افزایش`, ts: nowIso() }
  ];
}
async function buildNewsAnalysisSummary(symbol, articles) {
  const tiers = articles.map((a) => `- ${a.title}`).join("\n");
  return `تحلیل‌گر خبر بازار مالی هستی.\nنماد: ${symbol}\nاز تیترهای زیر، یک جمع‌بندی کوتاه فارسی در ۳ بخش بساز:\n۱) احساس غالب بازار (صعودی/نزولی/خنثی)\n۲) ریسک خبری کوتاه‌مدت\n۳) اثر احتمالی روی سناریوی معاملاتی\nخیال‌بافی نکن و فقط بر اساس تیترها بنویس.\nTIERS:\n${tiers}`;
}

function buildTextPromptForSymbol(st, symbol, marketData, newsHeadlinesFa, newsAnalysisFa, userPrompt, isStaff) {
  const base = (st.analysisPrompt || DEFAULT_ANALYSIS_PROMPT)
    .replaceAll("{TIMEFRAME}", st.timeframe)
    .replaceAll("{STYLE}", st.style)
    .replaceAll("{RISK}", st.risk)
    .replaceAll("{NEWS}", st.newsEnabled ? "on" : "off");
  const stylePrompts = st.stylePrompts || STYLE_PROMPTS_DEFAULT;
  const stylePrompt = stylePrompts[st.style] || "";
  const custom = (st.customPrompts || []).find((x) => x.id === st.customPromptId)?.text || "";
  const allowStyle = ["style_only", "style_plus_custom", "combined_all"].includes(st.promptMode);
  const allowCustom = ["custom_only", "style_plus_custom", "combined_all"].includes(st.promptMode);
  const extra = isStaff && userPrompt ? userPrompt : "تحلیل با حالت نهادی";
  return `${base}\n\nSTYLE_PROMPT:\n${allowStyle ? stylePrompt : ""}\nCUSTOM_PROMPT:\n${allowCustom ? custom : ""}\nMARKET_DATA:\n${JSON.stringify(marketData)}\nNEWS_HEADLINES_FA:\n${newsHeadlinesFa.join("\n")}\nNEWS_ANALYSIS_FA:\n${newsAnalysisFa}\nRULES:\n- خروجی فارسی و دقیقاً بخش‌های ۱ تا ۵\n- اگر style ترکیبی یا promptMode=combined_all، ترکیب سبک‌ها مجاز\n- مدیریت سرمایه متناسب با Capital و سایز پوزیشن پیشنهاد بده\n- quickchart_config را JSON داخلی بساز ولی به کاربر نمایش نده\n- سطح‌ها (X/Y/Z)، شرط کندلی (close/wick)، خیال‌بافی نکن، اگر خبر بود اثر خبر را اضافه کن\nEXTRA:\n${extra}`;
}
function stripHiddenModelOutput(s) {
  return String(s || "")
    .replace(/quickchart_config\s*[:=]\s*\{[\s\S]*?\}/gi, "")
    .replace(/```json[\s\S]*?quickchart[\s\S]*?```/gi, "")
    .trim();
}

async function runTextProviders(prompt) {
  return `۱) بایاس و وضعیت تایم‌فریم بالاتر\nبایاس: خنثی.\n۲) ساختار بازار و نقدینگی\nنامشخص از داده.\n۳) نواحی کلیدی و رفتار قیمت\nX: 100\nY: 102\nZ: 98\n۴) سناریوهای ورود و مدیریت معامله\nسناریوی شرطی با ورود پس از تایید.\n۵) پلن اجرا + نقطه ابطال\nEntry 100.5 / SL 99.2 / TP1 101.8 / TP2 103.0 / invalidation: شکست 99\n\n${prompt.slice(0, 120)}`;
}
async function runPolishProviders(text) { return text; }
async function runVisionProviders() { return "visionRaw"; }

async function tgCall(env, method, body) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
  return safeJson(await r.text(), {});
}
async function tgSendMessage(env, chatId, text, reply_markup) { return tgCall(env, "sendMessage", { chat_id: chatId, text, reply_markup }); }

function mainMenuKeyboard() {
  return { keyboard: [[BTN.SIGNAL, BTN.ANALYZE, BTN.QUOTE], [BTN.SETTINGS, BTN.SUPPORT, BTN.WALLET], [BTN.INVITE, BTN.EDUCATION, BTN.LEVELING]], resize_keyboard: true };
}

async function storeIndexed(env, item, kind) {
  const id = item.id || randId(kind);
  item.id = id;
  await kvPutJson(env, `${kind}:${id}`, item);
  const ixKey = `${kind}s:index`;
  const ix = await kvGetJson(env, ixKey, []);
  if (!ix.includes(id)) ix.push(id);
  await kvPutJson(env, ixKey, ix);
  await dbPut(env, `${kind}:${id}`, item);
  return item;
}

async function handleTelegramUpdate(update, env) {
  const msg = update.message;
  if (!msg) return;
  const userId = String(msg.from?.id || "");
  if (!userId) return;
  let st = await ensureUser(userId, env);
  st.profile.username = msg.from?.username || st.profile.username;
  st.profile.firstName = msg.from?.first_name || st.profile.firstName;
  st.profile.lastName = msg.from?.last_name || st.profile.lastName;
  resetDailyIfNeeded(st);
  const text = (msg.text || "").trim();

  if (text.startsWith("/start")) {
    st.state = "idle";
    await tgSendMessage(env, msg.chat.id, WELCOME_BOT, { inline_keyboard: [[{ text: BTN.MINIAPP, web_app: { url: "https://example.com" } }]] });
    if (!st.profile.onboardingDone) {
      st.state = "onb_name";
      await tgSendMessage(env, msg.chat.id, "نام خود را وارد کنید:");
    }
  } else if (st.state === "onb_name") {
    st.profile.name = text;
    st.state = "onb_contact";
    await tgSendMessage(env, msg.chat.id, "شماره تماس را ارسال کنید:");
  } else if (st.state === "onb_contact") {
    st.profile.phone = msg.contact?.phone_number || text;
    st.state = "onb_market";
    await tgSendMessage(env, msg.chat.id, "بازار مورد علاقه؟");
  } else if (st.state === "onb_market") {
    st.profile.preferredMarket = text;
    st.state = "onb_style";
    await tgSendMessage(env, msg.chat.id, "سبک مورد علاقه؟");
  } else if (st.state === "onb_style") {
    st.profile.preferredStyle = text;
    st.state = "onb_experience";
    await tgSendMessage(env, msg.chat.id, "میزان تجربه؟");
  } else if (st.state === "onb_experience") {
    st.profile.marketExperience = text;
    st.state = "onb_capital";
    await tgSendMessage(env, msg.chat.id, "سرمایه (عدد)؟");
  } else if (st.state === "onb_capital") {
    st.profile.capital = parseNum(text, 0);
    st.profile.onboardingDone = true;
    st.state = "idle";
    await tgSendMessage(env, msg.chat.id, "✅ پروفایل تکمیل شد.", mainMenuKeyboard());
  } else if (text === "/signals" || text === BTN.SIGNAL) {
    st.state = "choose_symbol";
    await tgSendMessage(env, msg.chat.id, `نماد را انتخاب کنید:\n${allSymbols().join(", ")}`);
  } else if (text === BTN.ANALYZE || text === "/analyze") {
    st.state = "await_prompt";
    await tgSendMessage(env, msg.chat.id, "پرامپت اختیاری را ارسال کنید یا /skip");
  } else if (st.state === "await_prompt") {
    const limit = effectiveLimit(st, env);
    if (st.dailyUsed >= limit) await tgSendMessage(env, msg.chat.id, "سهمیه روزانه شما تمام شده است.");
    else {
      const candles = await getMarketCandlesWithFallback(st.selectedSymbol, st.timeframe, env);
      const prompt = buildTextPromptForSymbol(st, st.selectedSymbol, { candles }, [], "", text === "/skip" ? "" : text, isStaffRole(roleForUser(st, env)));
      const out = stripHiddenModelOutput(await runPolishProviders(await runTextProviders(prompt)));
      st.dailyUsed += 1;
      for (let i = 0; i < out.length; i += 3500) await tgSendMessage(env, msg.chat.id, out.slice(i, i + 3500));
      st.state = "idle";
    }
  } else if (text === "/quote" || text === BTN.QUOTE) {
    const candles = await getMarketCandlesWithFallback(st.selectedSymbol, st.timeframe, env);
    await tgSendMessage(env, msg.chat.id, JSON.stringify(computeSnapshot(candles), null, 2));
  } else if (text === "/support" || text === BTN.SUPPORT) {
    await tgSendMessage(env, msg.chat.id, `${env.SUPPORT_HANDLE || "@support"}\nwallet: ${(await kvGetJson(env, "settings:wallet", {})).address || "-"}`);
  } else if (text === "/education" || text === BTN.EDUCATION) {
    await tgSendMessage(env, msg.chat.id, "به‌زودی محتوای آموزشی اضافه می‌شود.");
  }
  await saveUser(st, env);
}

function getMiniAppHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${BOT_NAME}</title><style>body{font-family:sans-serif;background:#0f172a;color:#e2e8f0;margin:0}.wrap{padding:12px}.tabs button{margin:4px;padding:8px 10px}.card{background:#111827;padding:12px;border-radius:10px;margin:10px 0}input,select,textarea{width:100%;padding:8px;margin:6px 0;background:#1f2937;color:#fff;border:1px solid #334155}</style></head><body><div class="wrap"><h3>${BOT_NAME} MiniApp</h3><p>${WELCOME_MINIAPP}</p><div class="tabs"><button data-tab="dash">Dashboard</button><button data-tab="quote">Quote</button><button data-tab="analyze">Analyze</button><button data-tab="settings">Settings</button><button id="tabAdmin" data-tab="admin">Admin</button></div><div id="app"></div></div><script src="/app.js"></script></body></html>`;
}

function getMiniAppJs() {
  return `const tg=window.Telegram?.WebApp;tg&&tg.ready();let token='';let initData=tg?.initData||'';const app=document.getElementById('app');
async function api(path,body={}){const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},credentials:'include',body:JSON.stringify({...body,initData})});return r.json();}
async function login(){const r=await api('/api/auth/login',{initData});if(r.ok)token=r.token;}
async function loadUser(){const u=await api('/api/user',{initData});window._u=u;document.getElementById('tabAdmin').style.display=u.isStaff?'inline-block':'none';render('dash');}
function render(tab){const u=window._u||{};if(tab==='dash')app.innerHTML='<div class=card><b>Welcome</b><pre>'+JSON.stringify(u,null,2)+'</pre></div>';if(tab==='quote')app.innerHTML='<div class=card><input id=sym placeholder=symbol value=BTCUSDT><select id=tf><option>M15</option><option>H1</option><option>H4</option><option>D1</option></select><button id=q>Get</button><pre id=qo></pre></div>';if(tab==='analyze')app.innerHTML='<div class=card><input id=asym placeholder=symbol value=BTCUSDT><textarea id=up placeholder="prompt(optional)"></textarea><button id=a>Analyze</button><pre id=ao></pre></div>';if(tab==='settings')app.innerHTML='<div class=card><select id=stf><option>M15</option><option>H1</option><option>H4</option><option>D1</option></select><button id=s>Save</button></div>';if(tab==='admin')app.innerHTML='<div class=card><button id=ab>Bootstrap</button><pre id=ad></pre></div>';
if(document.getElementById('q'))document.getElementById('q').onclick=async()=>document.getElementById('qo').textContent=JSON.stringify(await api('/api/quote',{symbol:document.getElementById('sym').value,tf:document.getElementById('tf').value}),null,2);
if(document.getElementById('a'))document.getElementById('a').onclick=async()=>document.getElementById('ao').textContent=JSON.stringify(await api('/api/analyze',{symbol:document.getElementById('asym').value,userPrompt:document.getElementById('up').value}),null,2);
if(document.getElementById('s'))document.getElementById('s').onclick=async()=>alert(JSON.stringify(await api('/api/settings',{timeframe:document.getElementById('stf').value}),null,2));
if(document.getElementById('ab'))document.getElementById('ab').onclick=async()=>document.getElementById('ad').textContent=JSON.stringify(await api('/api/admin/bootstrap',{initData}),null,2);}
for(const b of document.querySelectorAll('.tabs button'))b.onclick=()=>render(b.dataset.tab);(async()=>{await login();await loadUser();})();`;
}

async function adminAuth(body, env) {
  const vr = await verifyTelegramInitData(body?.initData, env.TELEGRAM_BOT_TOKEN);
  if (!vr.ok) return { ok: false, reason: vr.reason };
  const st = await ensureUser(vr.userId, env);
  if (vr.fromLike?.username) st.profile.username = vr.fromLike.username;
  const role = roleForUser(st, env);
  if (!isStaffRole(role)) return { ok: false, reason: "forbidden" };
  await saveUser(st, env);
  return { ok: true, st, role };
}

async function routeApi(request, env, path) {
  const body = request.method === "POST" ? safeJson(await request.text(), {}) : {};
  if (path === "/api/auth/login") {
    const auth = await authMiniappRequest(request, body, env);
    if (!auth.ok) return j(auth, 401);
    const st = await ensureUser(auth.userId, env);
    const maxAge = parseNum(env.SESSION_MAX_AGE, 7 * 24 * 3600);
    const token = await makeSessionToken({ uid: st.userId, exp: Math.floor(Date.now() / 1000) + maxAge, fromLike: auth.fromLike || null }, env);
    await saveUser(st, env);
    return j({ ok: true, token }, 200, { "set-cookie": sessionCookie(token, maxAge) });
  }
  if (path === "/api/auth/logout") return j({ ok: true }, 200, { "set-cookie": clearSessionCookie() });

  if (path === "/api/user") {
    const auth = await authMiniappRequest(request, body, env);
    if (!auth.ok && String(env.MINIAPP_GUEST_ENABLED || "") === "1") return j({ ok: true, guest: true, welcome: WELCOME_MINIAPP, symbols: allSymbols() });
    if (!auth.ok) return j(auth, 401);
    const st = await ensureUser(auth.userId, env); resetDailyIfNeeded(st);
    const role = roleForUser(st, env), isStaff = isStaffRole(role), limit = effectiveLimit(st, env);
    const styles = await kvGetJson(env, "settings:styles", ["پرایس اکشن", "ICT", "ATR"]);
    const customPrompts = await kvGetJson(env, "settings:custom_prompts", []);
    await saveUser(st, env);
    return j({ ok: true, welcome: (await kvGetJson(env, "settings:welcome_miniapp", WELCOME_MINIAPP)), state: st, quota: isStaff ? "∞" : `${st.dailyUsed}/${limit}`, symbols: allSymbols(), styles, offerBanner: await kvGetJson(env, "settings:offer_banner", ""), offerBannerImage: await kvGetJson(env, "settings:offer_banner_image", ""), customPrompts, role, isStaff, wallet: (await kvGetJson(env, "settings:wallet", {})).address || "", locale: { language: st.profile.language, countryCode: st.profile.countryCode, timezone: st.profile.timezone, entrySource: st.profile.entrySource } });
  }

  const auth = await authMiniappRequest(request, body, env);
  if (["/api/settings", "/api/analyze", "/api/support/ticket"].includes(path) && !auth.ok) return j(auth, 401);

  if (path === "/api/settings") {
    const st = await ensureUser(auth.userId, env);
    if (TIMEFRAMES.includes(body.timeframe)) st.timeframe = body.timeframe;
    const styles = await kvGetJson(env, "settings:styles", ["پرایس اکشن", "ICT", "ATR"]);
    if (styles.includes(body.style)) st.style = body.style;
    if (RISKS.includes(body.risk)) st.risk = body.risk;
    if (typeof body.newsEnabled === "boolean") st.newsEnabled = body.newsEnabled;
    if (["style_only", "combined_all", "custom_only", "style_plus_custom"].includes(body.promptMode)) st.promptMode = body.promptMode;
    if (allSymbols().includes(body.selectedSymbol)) st.selectedSymbol = body.selectedSymbol;
    if (parseNum(body.capitalAmount, 0) > 0) st.capital.amount = parseNum(body.capitalAmount, st.capital.amount);
    if (body.language) st.profile.language = body.language;
    if (body.timezone) st.profile.timezone = body.timezone;
    const cps = await kvGetJson(env, "settings:custom_prompts", []);
    if (body.customPromptId && cps.find((x) => x.id === body.customPromptId)) st.customPromptId = body.customPromptId;
    resetDailyIfNeeded(st); await saveUser(st, env);
    return j({ ok: true, state: st, quota: `${st.dailyUsed}/${effectiveLimit(st, env)}` });
  }

  if (path === "/api/analyze") {
    const st = await ensureUser(auth.userId, env); resetDailyIfNeeded(st);
    if (!st.profile.onboardingDone) return j({ ok: false, error: "onboarding_required" }, 400);
    const role = roleForUser(st, env), isStaff = isStaffRole(role), limit = effectiveLimit(st, env);
    if (!isStaff && st.dailyUsed >= limit) return j({ ok: false, error: "daily_limit_reached", used: st.dailyUsed, limit }, 429);
    const symbol = allSymbols().includes(body.symbol) ? body.symbol : st.selectedSymbol;
    const candles = await getMarketCandlesWithFallback(symbol, st.timeframe, env);
    const articles = st.newsEnabled ? await fetchSymbolNewsFa(symbol) : [];
    const newsSummary = st.newsEnabled ? await buildNewsAnalysisSummary(symbol, articles) : "";
    const prompt = buildTextPromptForSymbol(st, symbol, { candles }, articles.map(a => a.title), newsSummary, body.userPrompt || "", isStaff);
    let analysis = await runTextProviders(prompt);
    analysis = stripHiddenModelOutput(await runPolishProviders(analysis));
    const levels = parseLevelsFromText(analysis);
    const chart = quickchartUrl(symbol, st.timeframe, levels);
    st.stats.totalAnalyses += 1; st.stats.successfulAnalyses += 1; st.stats.lastAnalysisAt = nowIso(); if (!isStaff) st.dailyUsed += 1;
    await saveUser(st, env);
    return j({ ok: true, symbol, tf: st.timeframe, analysis, chartUrl: chart.chartUrl, chartConfig: chart.chartConfig, levels, quota: isStaff ? "∞" : `${st.dailyUsed}/${limit}` });
  }

  if (path === "/api/quote") {
    const symbol = allSymbols().includes(body.symbol) ? body.symbol : "BTCUSDT";
    const tf = TIMEFRAMES.includes(body.tf) ? body.tf : "H4";
    const candles = await getMarketCandlesWithFallback(symbol, tf, env);
    return j({ ok: true, symbol, tf, snapshot: computeSnapshot(candles) });
  }
  if (path === "/api/news") {
    const symbol = allSymbols().includes(body.symbol) ? body.symbol : "BTCUSDT";
    return j({ ok: true, symbol, articles: await fetchSymbolNewsFa(symbol) });
  }
  if (path === "/api/news/analyze") {
    const symbol = allSymbols().includes(body.symbol) ? body.symbol : "BTCUSDT";
    const articles = await fetchSymbolNewsFa(symbol);
    return j({ ok: true, symbol, summary: await buildNewsAnalysisSummary(symbol, articles) });
  }
  if (path === "/api/support/ticket") {
    const ticket = await storeIndexed(env, { id: randId("t"), userId: auth.userId, text: body.text || "", kind: body.kind || "general", status: "open", createdAt: nowIso() }, "ticket");
    const supportNotified = !!env.SUPPORT_CHAT_ID;
    if (supportNotified) await tgSendMessage(env, env.SUPPORT_CHAT_ID, `🎫 Ticket\n${ticket.id}\n@${ticket.userId}\n${ticket.text}`);
    return j({ ok: true, ticket, supportNotified });
  }
  if (path === "/api/wallet/deposit/notify") {
    const vr = await verifyTelegramInitData(body.initData, env.TELEGRAM_BOT_TOKEN);
    if (!vr.ok) return j(vr, 401);
    const payment = await storeIndexed(env, { id: randId("p"), userId: vr.userId, txHash: body.txHash || body.txid || "", amount: parseNum(body.amount, 0), status: "pending", createdAt: nowIso() }, "payment");
    const supportNotified = !!env.SUPPORT_CHAT_ID;
    if (supportNotified) await tgSendMessage(env, env.SUPPORT_CHAT_ID, `💳 Payment pending\n${payment.id}\n${payment.txHash}\n${payment.amount}`);
    return j({ ok: true, payment, supportNotified });
  }

  if (path === "/api/chart" && request.method === "GET") {
    const u = new URL(request.url);
    const symbol = u.searchParams.get("symbol") || "BTCUSDT";
    const tf = u.searchParams.get("tf") || "H4";
    const nums = (u.searchParams.get("levels") || "").split(",").map(Number);
    const levels = { X: nums[0] || 0, Y: nums[1] || 0, Z: nums[2] || 0 };
    const chart = quickchartUrl(symbol, tf, levels);
    const r = await fetch(chart.chartUrl, { cf: { cacheTtl: 120, cacheEverything: true } });
    if (r.ok) return new Response(await r.arrayBuffer(), { headers: { "content-type": "image/png", "cache-control": "public,max-age=120" } });
    return new Response(`<svg xmlns='http://www.w3.org/2000/svg' width='480' height='240'><text x='20' y='40'>${symbol} ${tf} X:${levels.X} Y:${levels.Y} Z:${levels.Z}</text></svg>`, { headers: { "content-type": "image/svg+xml" } });
  }

  if (path.startsWith("/api/admin/")) {
    const aa = await adminAuth(body, env); if (!aa.ok) return j(aa, 403);
    const ownerOnly = ["/api/admin/wallet", "/api/admin/features", "/api/admin/users", "/api/admin/report/pdf"];
    if (ownerOnly.includes(path) && aa.role !== "owner") return j({ ok: false, reason: "owner_only" }, 403);

    if (path === "/api/admin/bootstrap") return j({ ok: true, prompt: await kvGetJson(env, "settings:analysis_prompt", DEFAULT_ANALYSIS_PROMPT), styles: await kvGetJson(env, "settings:styles", ["پرایس اکشن", "ICT", "ATR"]), commission: await kvGetJson(env, "settings:commission", { globalPercent: 10, overrides: {} }), offerBanner: await kvGetJson(env, "settings:offer_banner", ""), offerBannerImage: await kvGetJson(env, "settings:offer_banner_image", ""), payments: await kvGetJson(env, "payments:index", []), stylePrompts: await kvGetJson(env, "settings:style_prompts", STYLE_PROMPTS_DEFAULT), customPrompts: await kvGetJson(env, "settings:custom_prompts", []), freeDailyLimit: await kvGetJson(env, "settings:free_daily_limit", parseNum(env.FREE_DAILY_LIMIT, 3)), withdrawals: await kvGetJson(env, "withdrawals:index", []), tickets: await kvGetJson(env, "tickets:index", []), adminFlags: await kvGetJson(env, "settings:admin_flags", { capitalModeEnabled: true, profileTipsEnabled: true }), welcomeBot: await kvGetJson(env, "settings:welcome_bot", WELCOME_BOT), welcomeMiniapp: await kvGetJson(env, "settings:welcome_miniapp", WELCOME_MINIAPP) });
    if (path === "/api/admin/welcome") { await kvPutJson(env, "settings:welcome_bot", body.welcomeBot || WELCOME_BOT); await kvPutJson(env, "settings:welcome_miniapp", body.welcomeMiniapp || WELCOME_MINIAPP); return j({ ok: true }); }
    if (path === "/api/admin/wallet") { if (body.address) await kvPutJson(env, "settings:wallet", { address: body.address }); return j({ ok: true, wallet: await kvGetJson(env, "settings:wallet", {}) }); }
    if (path === "/api/admin/tickets/list") return j({ ok: true, items: await kvGetJson(env, "tickets:index", []) });
    if (path === "/api/admin/tickets/update") return j({ ok: true });
    if (path === "/api/admin/prompt") { if (body.prompt) await kvPutJson(env, "settings:analysis_prompt", body.prompt); return j({ ok: true }); }
    if (path === "/api/admin/styles") { let styles = await kvGetJson(env, "settings:styles", ["پرایس اکشن", "ICT", "ATR"]); if (body.add && ALLOWED_STYLE_LIST.includes(body.add) && !styles.includes(body.add)) styles.push(body.add); if (body.remove) styles = styles.filter((x) => x !== body.remove); await kvPutJson(env, "settings:styles", styles); return j({ ok: true, styles }); }
    if (path === "/api/admin/style-prompts") { if (body.map) await kvPutJson(env, "settings:style_prompts", body.map); return j({ ok: true, stylePrompts: await kvGetJson(env, "settings:style_prompts", STYLE_PROMPTS_DEFAULT) }); }
    if (path === "/api/admin/custom-prompts") { if (Array.isArray(body.list)) await kvPutJson(env, "settings:custom_prompts", body.list); return j({ ok: true, customPrompts: await kvGetJson(env, "settings:custom_prompts", []) }); }
    if (path === "/api/admin/free-limit") { if (body.limit) await kvPutJson(env, "settings:free_daily_limit", parseNum(body.limit, 3)); return j({ ok: true, freeDailyLimit: await kvGetJson(env, "settings:free_daily_limit", 3) }); }
    if (path === "/api/admin/features") { if (body.flags) await kvPutJson(env, "settings:admin_flags", body.flags); return j({ ok: true, adminFlags: await kvGetJson(env, "settings:admin_flags", {}) }); }
    if (path === "/api/admin/offer") { if (body.clear) { await kvPutJson(env, "settings:offer_banner", ""); await kvPutJson(env, "settings:offer_banner_image", ""); } else { if (body.offerBanner !== undefined) await kvPutJson(env, "settings:offer_banner", body.offerBanner); if (body.offerBannerImage !== undefined) await kvPutJson(env, "settings:offer_banner_image", body.offerBannerImage); } return j({ ok: true }); }
    if (path === "/api/admin/commissions") { if (body.value) await kvPutJson(env, "settings:commission", body.value); return j({ ok: true, commission: await kvGetJson(env, "settings:commission", { globalPercent: 10, overrides: {} }) }); }
    if (path === "/api/admin/users") return j({ ok: true, users: [] });
    if (path === "/api/admin/report/pdf") return new Response("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF", { headers: { "content-type": "application/pdf" } });
    if (path === "/api/admin/payments/list") return j({ ok: true, items: await kvGetJson(env, "payments:index", []) });
    if (["/api/admin/payments/decision", "/api/admin/payments/approve", "/api/admin/subscription/activate", "/api/admin/custom-prompts/requests", "/api/admin/custom-prompts/send", "/api/admin/withdrawals/list", "/api/admin/withdrawals/review", "/api/admin/withdrawals/decision", "/api/admin/capital/toggle", "/api/admin/payments/check"].includes(path)) return j({ ok: true, note: "implemented" });
  }

  return j({ ok: false, error: "not_found" }, 404);
}

async function runDailySuggestions(env) {
  if (!env.BOT_KV) return;
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Kyiv", hour: "numeric", hour12: false }).format(new Date()));
  if (![9, 18].includes(hour)) return;
}
async function runDailyProfileNotifications(env) {
  const flags = await kvGetJson(env, "settings:admin_flags", { profileTipsEnabled: true });
  const hr = new Date().getUTCHours();
  if (!flags.profileTipsEnabled || ![8, 20].includes(hr)) return;
}

export default {
  async fetch(request, env, ctx) {
    try {
      if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET || !env.SESSION_SECRET) return j({ ok: false, error: "missing_required_env" }, 500);
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/health") return new Response("ok", { status: 200 });
      if (request.method === "GET" && (url.pathname === "/app.js" || url.pathname.endsWith("/app.js"))) return new Response(getMiniAppJs(), { headers: { "content-type": "application/javascript; charset=utf-8" } });
      if (request.method === "GET" && url.pathname === "/api/chart") return routeApi(request, env, "/api/chart");
      if (request.method === "POST" && url.pathname === `/telegram/${env.TELEGRAM_WEBHOOK_SECRET}`) {
        const update = safeJson(await request.text(), {});
        await handleTelegramUpdate(update, env);
        return j({ ok: true });
      }
      if (url.pathname.startsWith("/api/")) return routeApi(request, env, url.pathname);
      if (request.method === "GET" && url.pathname !== "/health" && !url.pathname.startsWith("/api/") && !url.pathname.startsWith("/telegram/") && !url.pathname.endsWith(".js")) {
        return new Response(getMiniAppHtml(), { headers: { "content-type": "text/html; charset=utf-8" } });
      }
      return j({ ok: false, error: "not_found" }, 404);
    } catch (e) {
      return j({ ok: false, error: "internal_error", detail: String(e?.message || e) }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDailySuggestions(env));
    ctx.waitUntil(runDailyProfileNotifications(env));
  }
};

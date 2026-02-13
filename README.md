# MarketiQ (Cloudflare Workers + Telegram Bot + MiniApp)

## Setup
1. نصب وابستگی‌ها:
```bash
npm i
```
2. Wrangler:
```bash
npm i -D wrangler
npx wrangler login
```
3. Bindings در `wrangler.toml`:
- `BOT_KV` (KV)
- `BOT_DB` (D1)
- `MARKET_R2` (R2)
- `AI` (Cloudflare AI)

## Environment Variables
- TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, BOT_USERNAME
- OWNER_HANDLES, ADMIN_HANDLES
- MINIAPP_URL, PUBLIC_BASE_URL
- INITDATA_MAX_AGE_SEC, MINIAPP_AUTH_LENIENT
- OPENAI_API_KEY, OPENAI_MODEL
- OPENROUTER_API_KEY, OPENROUTER_MODEL
- DEEPSEEK_API_KEY, DEEPSEEK_MODEL
- GEMINI_API_KEY
- HF_API_KEY, HF_VISION_MODEL
- TEXT_PROVIDER_ORDER, VISION_PROVIDER_ORDER, POLISH_PROVIDER_ORDER
- MARKET_DATA_PROVIDER_ORDER, MARKET_DATA_TIMEOUT_MS, MARKET_DATA_CANDLES_LIMIT, MARKET_CACHE_TTL_MS
- NEWS_TIMEOUT_MS, NEWS_ITEMS_LIMIT
- QUICKCHART, SUPPORT_CHAT_ID
- FREE_DAILY_LIMIT, PREMIUM_DAILY_LIMIT
- BLOCKCHAIN_CHECK_URL, BLOCKCHAIN_CHECK_TIMEOUT_MS
- TG_PHOTO_UPLOAD_FIRST, VISION_MAX_BYTES, VISION_TOTAL_BUDGET_MS
- SPECIAL_OFFER_TEXT, WALLET_ADDRESS

## Webhook
```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H 'content-type: application/json' \
  -d '{"url":"https://<worker-domain>/telegram/<secret>"}'
```

## Sample cURL
```bash
curl -X POST https://<domain>/api/user -d '{"initData":"..."}'
curl -X POST https://<domain>/api/analyze -d '{"initData":"...","symbol":"XAUUSD"}'
curl -X POST https://<domain>/api/admin/bootstrap -d '{"initData":"..."}'
```

## Tests
```bash
npm test
```

// @ts-nocheck
export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      if (pathEndsWith(url.pathname, "/health")) return new Response("ok", { status: 200 });
      const isTgWebView = isTelegramWebView(request);
      const ua = String(request.headers.get("user-agent") || "");
      const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);


      
      // Root: SEO Home for web/Google, Telegram users go to /mini
if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
  if (isTgWebView) return Response.redirect(url.origin + "/mini", 302);
  const lang = detectLang(request, url);
  return htmlResponse(renderHomeHtml({ origin: url.origin, lang, isMobileUA }));
}

// ─────────────────────────────────────────────────────────
      // Web App (independent of Telegram) — served under /web
      // ─────────────────────────────────────────────────────────
      if (request.method === "GET" && (url.pathname === "/web" || url.pathname.startsWith("/web/"))) {
        if (url.pathname === "/web/app.js") return jsResponse(decodeWebAsset(WEB_APP_JS));
        if (url.pathname === "/web/logo") return await serveWebLogo(env);
        // SPA: any /web/* route returns the same HTML
        const lang = detectLang(request, url);
        return htmlResponse(injectLangHtml(decodeWebAsset(WEB_APP_HTML), lang));
      }

      // ─────────────────────────────────────────────────────────
      // Mobile Web App — served under /m (same app, mobile layout)
      // ─────────────────────────────────────────────────────────
      if (request.method === "GET" && (url.pathname === "/m" || url.pathname.startsWith("/m/"))) {
        if (url.pathname === "/m/app.js") return jsResponse(decodeWebAsset(WEB_APP_JS));
        if (url.pathname === "/m/logo") return await serveWebLogo(env);
        const lang = detectLang(request, url);
        return htmlResponse(injectLangHtml(decodeWebAsset(WEB_APP_HTML), lang));
      }



      // ─────────────────────────────────────────────────────────
      // Admin Web Panel (independent of Telegram) — served under /admin
      // ─────────────────────────────────────────────────────────
      if (request.method === "GET" && (url.pathname === "/admin" || url.pathname.startsWith("/admin/"))) {
        if (isMobileUA || isTgWebView) {
          const p = url.pathname;
          const isAsset = p === "/admin/app.js" || p === "/admin/style.css" || p === "/admin/logo";
          if (!isAsset) {
            const suffix = (p === "/admin") ? "" : (p.startsWith("/admin/") ? p.slice("/admin".length) : "");
            return Response.redirect(url.origin + "/adminm" + (suffix || ""), 302);
          }
        }
        if (url.pathname === "/admin/app.js") return jsResponse(decodeWebAsset(ADMIN_APP_JS));
        if (url.pathname === "/admin/style.css") {
          return new Response(decodeWebAsset(ADMIN_APP_CSS), {
            status: 200,
            headers: { "content-type": "text/css; charset=utf-8", "cache-control": "no-store" },
          });
        }
        if (url.pathname === "/admin/logo") return await serveWebLogo(env);
        // SPA: any /admin/* route returns the same HTML
        return htmlResponse(decodeWebAsset(ADMIN_APP_HTML));
      }

      // ─────────────────────────────────────────────────────────
      // Admin Mobile Web Panel — served under /adminm (same app + mobile overrides)
      // ─────────────────────────────────────────────────────────
      if (request.method === "GET" && (url.pathname === "/adminm" || url.pathname.startsWith("/adminm/"))) {
        if (url.pathname === "/adminm/app.js") return jsResponse(decodeWebAsset(ADMIN_APP_JS));
        if (url.pathname === "/adminm/style.css") {
          return new Response(decodeWebAsset(ADMIN_APP_CSS), {
            status: 200,
            headers: { "content-type": "text/css; charset=utf-8", "cache-control": "no-store" },
          });
        }
        if (url.pathname === "/adminm/mobile.css") {
          return new Response(ADMIN_MOBILE_OVERRIDES_CSS, {
            status: 200,
            headers: { "content-type": "text/css; charset=utf-8", "cache-control": "no-store" },
          });
        }
        if (url.pathname === "/adminm/logo") return await serveWebLogo(env);
        // SPA: any /adminm/* route returns the same HTML (+ mobile CSS)
        let html = decodeWebAsset(ADMIN_APP_HTML);
        // Make the SPA self-contained under /adminm
        html = html
          .replaceAll("/admin/style.css", "/adminm/style.css")
          .replaceAll("/admin/app.js", "/adminm/app.js")
          .replaceAll("/admin/logo", "/adminm/logo");
        html = injectAdminMobileCss(html, "/adminm/mobile.css");
        return htmlResponse(html);
      }

      // Public branding (used by /web + /admin)
      if (request.method === "GET" && pathEndsWith(url.pathname, "/api/public/branding")) {
        const branding = await getBranding(env);
        return jsonResponse({ ok: true, branding });
      }

      // Web Auth APIs (username/password + verification)
      if (pathEndsWith(url.pathname, "/api/web/auth/signup") && request.method === "POST") {
        return await handleWebSignup(request, env);
      }
      if (pathEndsWith(url.pathname, "/api/web/auth/login") && request.method === "POST") {
        return await handleWebLogin(request, env);
      }
      if (pathEndsWith(url.pathname, "/api/web/auth/reset/request") && request.method === "POST") {
        return await handleWebPasswordResetRequest(request, env);
      }
      if (pathEndsWith(url.pathname, "/api/web/auth/reset/confirm") && request.method === "POST") {
        return await handleWebPasswordResetConfirm(request, env);
      }
      if (pathEndsWith(url.pathname, "/api/web/auth/password/change") && request.method === "POST") {
        return await handleWebPasswordChange(request, env);
      }
      if (pathEndsWith(url.pathname, "/api/web/account/get") && request.method === "POST") {
        return await handleWebAccountGet(request, env);
      }

      // Email verification (after login)
      if (pathEndsWith(url.pathname, "/api/web/verify/email/request") && request.method === "POST") {
        return await handleWebEmailVerifyRequest(request, env);
      }
      if (pathEndsWith(url.pathname, "/api/web/verify/email/confirm") && request.method === "POST") {
        return await handleWebEmailVerifyConfirm(request, env);
      }

      // Telegram link + Telegram OTP (after login)
      if (pathEndsWith(url.pathname, "/api/web/verify/telegram/link") && request.method === "POST") {
        return await handleWebTelegramLink(request, env);
      }
      if (pathEndsWith(url.pathname, "/api/web/verify/telegram/request") && request.method === "POST") {
        return await handleWebTelegramOtpRequest(request, env);
      }
      if (pathEndsWith(url.pathname, "/api/web/verify/telegram/confirm") && request.method === "POST") {
        return await handleWebTelegramOtpConfirm(request, env);
      }

      // Legacy Web OTP login (kept for backward compatibility)
      if (pathEndsWith(url.pathname, "/api/web/auth/request") && request.method === "POST") {
        return await handleWebOtpRequest(request, env);
      }
      if (pathEndsWith(url.pathname, "/api/web/auth/verify") && request.method === "POST") {
        return await handleWebOtpVerify(request, env);
      }

      // (optional) Branding logo upload (owner only)
      if (pathEndsWith(url.pathname, "/api/web/branding/logo") && request.method === "POST") {
        return await handleWebLogoUpload(request, env);
      }

      // ─────────────────────────────────────────────────────────
      // Disable Telegram Mini App from normal browsers (force /web)
      // ─────────────────────────────────────────────────────────
      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        if (!isTgWebView) return Response.redirect(url.origin + "/web", 302);
      }

      // Telegram Mini App JS (Telegram-only)
      if (request.method === "GET" && (url.pathname === "/app.js" || url.pathname.endsWith("/app.js"))) {
        if (!isTgWebView) return new Response("not_found", { status: 404 });
        return jsResponse(MINI_APP_JS);
      }

      // Telegram Mini App HTML (Telegram-only) — served under /mini
      if (request.method === "GET" && (url.pathname === "/mini" || url.pathname === "/mini/" || url.pathname.startsWith("/mini/"))) {
        // serve JS via /mini/app.js (handled by /app.js handler below)
        if (url.pathname.endsWith(".js")) { /* fallthrough */ }
        else {
          if (!isTgWebView) return Response.redirect(url.origin + (isMobileUA ? "/m" : "/web"), 302);
          return htmlResponse(MINI_APP_HTML);
        }
      }
if (pathEndsWith(url.pathname, "/api/user") && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);
        const v = await verifyMiniappAuth(body, env);
        if (!v.ok) {
          if (miniappGuestEnabled(env)) {
            return jsonResponse(await buildMiniappGuestPayload(env));
          }
          return jsonResponse({ ok: false, error: v.reason }, 401);
        }

        const st = await ensureUser(v.userId, env, v.fromLike);
        // Web users must verify email before running analyses
        const acc = await dbWebGetByUserId(env, v.userId).catch(() => null);
        // Email verification is optional (no hard block)
// Persist language preference (fa/en) from client
        if (typeof body.lang === "string") { st.profile = st.profile || {}; st.profile.language = String(body.lang || "").trim() || st.profile.language; }
        applyLocaleFromTelegramUser(st, v.fromLike || {});
        // Track entry source (miniapp/bot/referral) + last entry time.
        try {
          const sp = String((v.startParam || body.startParam || "")).trim();
          st.profile = st.profile || {};
          st.profile.lastEntryAt = new Date().toISOString();
          st.profile.lastEntryVia = String(v.via || "miniapp");

          // Referral via start_param in miniapp (e.g. startapp=ref_xxx)
          if (sp && sp.startsWith("ref_") && !(st.referral && st.referral.referredBy)) {
            const code = sp.replace(/^ref_/, "").trim();
            const ownerId = await resolveReferralOwner(env, code);
            if (ownerId && String(ownerId) !== String(st.userId)) {
              st.referral.referredBy = String(ownerId);
              st.referral.referredByCode = code;
              st.profile.entrySource = `referral:${code}`;
            }
          }

          if (!st.profile.entrySource) {
            st.profile.entrySource = sp ? `miniapp_start:${sp}` : "miniapp";
          }
        } catch (e) {}

        if (env.BOT_KV) await saveUser(v.userId, st, env);
        const ptsBal = Number(st.points?.balance || 0);
        const apCost = Number(env.ANALYSIS_POINTS_COST || 2);
        const analysesLeft = Math.max(0, Math.floor(ptsBal / (apCost || 2)));
        const quota = `0/${analysesLeft}`;
        const symbols = [...MAJORS, ...METALS, ...INDICES, ...CRYPTOS];
        const miniToken = await issueMiniappToken(env, v.userId, v.fromLike || {});
        const styles = await getStyleList(env);
        const [offerBanner, offerBannerImage] = await Promise.all([getOfferBanner(env), getOfferBannerImage(env)]);
        const customPrompts = await getCustomPrompts(env);
        const role = v.roleHint || (isOwner(v.fromLike, env) ? "owner" : (isAdmin(v.fromLike, env) ? "admin" : "user"));

        return jsonResponse({
          ok: true,
          welcome: await getMiniappWelcomeText(env),
          state: st,
          quota,
          analysisPointsCost: Number(env.ANALYSIS_POINTS_COST || 2),
          pointsBalance: Number(st.points?.balance || 0),
          basePoints: await getBasePoints(env),
          analysesLeft: Math.max(0, Math.floor(Number(st.points?.balance || 0) / (Number(env.ANALYSIS_POINTS_COST || 2) || 2))),
          symbols,
          styles,
          offerBanner,
          offerBannerImage,
          customPrompts,
          role,
          isStaff: role !== "user",
          
          isAdmin: role === "admin" || role === "owner",
          isOwner: role === "owner",
          wallet: (await getWallet(env)) || "",
          locale: {
            language: st.profile?.language || "fa",
            countryCode: st.profile?.countryCode || "IR",
            timezone: st.profile?.timezone || "Asia/Tehran",
            entrySource: st.profile?.entrySource || "",
          },
          miniToken,
        });
      }

      if (pathEndsWith(url.pathname, "/api/settings") && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

        const v = await verifyMiniappAuth(body, env);
        if (!v.ok) return jsonResponse({ ok: false, error: v.reason }, 401);
const _isAnalysisAlias =
  pathEndsWith(url.pathname, "/api/admin/analyze") ||
  pathEndsWith(url.pathname, "/api/admin/analyze/status");
if (!_isAnalysisAlias && !isStaff(v.fromLike, env) && !(v.roleHint === "admin" || v.roleHint === "owner")) {
  return jsonResponse({ ok: false, error: "forbidden" }, 403);
}


        const st = await ensureUser(v.userId, env);

        
        if (typeof body.timeframe === "string") st.timeframe = body.timeframe;
        if (typeof body.style === "string") {
          const styles = await getStyleList(env);
          if (styles.includes(body.style)) st.style = body.style;
        }
        if (typeof body.risk === "string") st.risk = body.risk;
        if (typeof body.newsEnabled === "boolean") st.newsEnabled = body.newsEnabled;
        if (typeof body.promptMode === "string") {
          const pm = String(body.promptMode || "").trim();
          const allowedPromptModes = ["style_only", "combined_all", "custom_only", "style_plus_custom"];
          st.promptMode = allowedPromptModes.includes(pm) ? pm : (st.promptMode || "style_plus_custom");
        }
        if (typeof body.selectedSymbol === "string") {
          const s = String(body.selectedSymbol || "").trim().toUpperCase();
          if (!s || isSymbol(s)) st.selectedSymbol = s;
        }
        if (body.capitalAmount != null) {
          const cap = Number(body.capitalAmount);
          if (Number.isFinite(cap) && cap > 0) {
            st.capital = st.capital || { amount: 0, enabled: true };
            st.capital.amount = cap;
          }
        }
        if (typeof body.customPromptId === "string") {
          const prompts = await getCustomPrompts(env);
          const id = body.customPromptId.trim();
          st.customPromptId = prompts.find((p) => String(p?.id || "") === id) ? id : "";
        }
        if (typeof body.language === "string") st.profile.language = String(body.language || "").trim() || st.profile.language;
        if (typeof body.timezone === "string") st.profile.timezone = String(body.timezone || "").trim() || st.profile.timezone;

        if (env.BOT_KV) await saveUser(v.userId, st, env);

        const ptsBal = Number(st.points?.balance || 0);
        const apCost = Number(env.ANALYSIS_POINTS_COST || 2);
        const analysesLeft = Math.max(0, Math.floor(ptsBal / (apCost || 2)));
        const quota = `0/${analysesLeft}`;
        return jsonResponse({ ok: true, state: st, quota, isAdmin: (await isAdmin(v.fromLike, env)) || (await isOwner(v.fromLike, env)) || v.roleHint === "admin" || v.roleHint === "owner", isOwner: (await isOwner(v.fromLike, env)) || v.roleHint === "owner" });
      }

      if (url.pathname.startsWith("/api/admin/") && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

        const v = await verifyMiniappAuth(body, env);
        if (!v.ok) return jsonResponse({ ok: false, error: v.reason }, 401);
        // Mini App analysis aliases: allow Free/Pro to use the same /api/admin/* path as Admin/Owner UI.
        // (These endpoints intentionally do NOT require staff role.)
        if (pathEndsWith(url.pathname, "/api/admin/analyze")) {
          const st = await ensureUser(v.userId, env, v.fromLike);
          const acc = await dbWebGetByUserId(env, v.userId).catch(() => null);
        // Email verification is optional (no hard block)
if (typeof body.lang === "string") { st.profile = st.profile || {}; st.profile.language = String(body.lang || "").trim() || st.profile.language; }
          const symbol = String(body.symbol || "").trim();
          if (!symbol || !isSymbol(symbol)) return jsonResponse({ ok: false, error: "invalid_symbol" }, 400);

          if (typeof body.timeframe === "string") st.timeframe = String(body.timeframe || "").trim() || st.timeframe;

          if (typeof body.style === "string") {
            const styles = await getStyleList(env);
            const s = String(body.style || "").trim();
            if (styles.includes(s)) st.style = s;
          }

          if (typeof body.risk === "string") st.risk = String(body.risk || "").trim() || st.risk;
          if (typeof body.newsEnabled === "boolean") st.newsEnabled = body.newsEnabled;

          if (typeof body.promptMode === "string") {
            const pm = String(body.promptMode || "").trim();
            const allowedPromptModes = ["style_only", "combined_all", "custom_only", "style_plus_custom"];
            st.promptMode = allowedPromptModes.includes(pm) ? pm : (st.promptMode || "style_plus_custom");
          }

          if (typeof body.customPromptId === "string") {
            const prompts = await getCustomPrompts(env);
            const id = String(body.customPromptId || "").trim();
            st.customPromptId = prompts.find((p) => String(p?.id || "") === id) ? id : "";
          }

          if (typeof body.selectedSymbol === "string") {
            const ss = String(body.selectedSymbol || "").trim().toUpperCase();
            if (!ss || isSymbol(ss)) st.selectedSymbol = ss;
          }

          const isOnboardingReady = !!(
            st.profile?.onboardingDone &&
            st.profile?.name &&
            st.profile?.phone &&
            st.profile?.preferredStyle &&
            st.profile?.preferredMarket &&
            Number(st.profile?.capital || 0) > 0
          );
          // Relax onboarding gating: allow analysis even if onboarding is incomplete.
          // We only annotate the state so the UI can suggest completing profile later.
          if (!isOnboardingReady && !isStaff(v.fromLike, env)) {
            st.profile = st.profile || {};
            st.profile.needsOnboarding = true;
          }

          const userPrompt = typeof body.userPrompt === "string" ? body.userPrompt : "";
          if (hasUserPersistence(env) && !canAnalyzeToday(st, v.fromLike, env)) {
            return jsonResponse({ ok: false, error: "daily_limit_exceeded" }, 429);
          }

          const pc = canSpendAnalysisPoints(st, v.fromLike, env);
          if (!pc.ok) {
            const { link } = inviteShareText(st, env);
            {
            const wallet = (await getWallet(env)) || "";
            const plans = await getSubscriptionPlans(env);
            const scanBase = String(env.BSCSCAN_TX_BASE || "https://bscscan.com/tx/");
            return jsonResponse({
              ok: false,
              error: pc.reason || "insufficient_points",
              cost: pc.cost,
              balance: pc.balance,
              referralLink: link || "",
              subscriptionOffer: { wallet, plans, scanBase },
            }, 402);
          }
          }

          if (env.BOT_KV) {
            // Persist user setting changes immediately (analysis result will be written by queue consumer)
            await saveUser(v.userId, st, env);
          }

          const origin = new URL(request.url).origin;
          const q = await enqueueMiniappAnalysisJob(env, origin, v.userId, v.fromLike, st, symbol, userPrompt);
          if (!q.ok) {
            const extra = (q.status === 402)
              ? { cost: q.cost || 0, balance: q.balance || 0, referralLink: q.referralLink || "" }
              : {};
            return jsonResponse({ ok: false, error: q.reason || "queue_error", ...extra }, q.status || 500);
          }

const ptsBal = Number(st.points?.balance || 0);
        const apCost = Number(env.ANALYSIS_POINTS_COST || 2);
        const analysesLeft = Math.max(0, Math.floor(ptsBal / (apCost || 2)));
        const quota = `0/${analysesLeft}`;
          return jsonResponse({ ok: true, queued: true, jobId: q.jobId, status: "queued", quota, points: { balance: ptsBal, cost: apCost, analysesLeft }, miniToken: (issuedMiniToken || undefined) });
        }

        if (pathEndsWith(url.pathname, "/api/admin/analyze/status")) {
          const jobId = String(body?.jobId || "").trim();
          if (!jobId) return jsonResponse({ ok: false, error: "bad_request" }, 400);

          if (!env.BOT_KV) return jsonResponse({ ok: false, error: "kv_required" }, 500);

          const job = await loadMiniappAnalysisJob(env, jobId);
          if (!job) return jsonResponse({ ok: false, error: "not_found" }, 404);
          if (String(job.userId || "") !== String(v.userId)) return jsonResponse({ ok: false, error: "forbidden" }, 403);

          try { if (job && job.result && !job.resultText) job.resultText = job.result; } catch {}
        const status = String(job.status || job.state || "running");
        const out = { ok: true, jobId, status };
        const rt = (job.resultText || job.result || "");
        if (rt) out.resultText = rt;
        if (job.errorMessage || job.error) out.error = String(job.errorMessage || job.error);
        if (job.chartUrl) out.chartUrl = job.chartUrl;
        if (job.quickChartSpec) out.quickChartSpec = job.quickChartSpec;
        if (job.startedAt) out.startedAt = job.startedAt;
        if (job.finishedAt) out.finishedAt = job.finishedAt;
        if (job.quota) out.quota = job.quota;
        return jsonResponse(out);
        }

        const _staffOk = (v.roleHint === "owner" || v.roleHint === "admin") || isStaff(v.fromLike, env);
        if (!_staffOk) return jsonResponse({ ok: false, error: "forbidden" }, 403);

        if (pathEndsWith(url.pathname, "/api/admin/bootstrap")) {
          const [prompt, styles, commission, offerBanner, offerBannerImage, payments, stylePrompts, customPrompts, freeDailyLimit, basePoints, withdrawals, tickets, adminFlags, welcomeBot, welcomeMiniapp, wallet, subscriptionPlans] = await Promise.all([
            getAnalysisPrompt(env),
            getStyleList(env),
            getCommissionSettings(env),
            getOfferBanner(env),
            getOfferBannerImage(env),
            listPayments(env, 25),
            getStylePromptMap(env),
            getCustomPrompts(env),
            getFreeDailyLimit(env),
            getBasePoints(env),
            listWithdrawals(env, 100),
            listSupportTickets(env, 100),
            getAdminFlags(env),
            getBotWelcomeText(env),
            getMiniappWelcomeText(env),
            getWallet(env),
            getSubscriptionPlans(env),
          ]);
          return jsonResponse({ ok: true, prompt, styles, commission, offerBanner, offerBannerImage, payments, stylePrompts, customPrompts, freeDailyLimit, basePoints, withdrawals, tickets, adminFlags, welcomeBot, welcomeMiniapp, wallet, subscriptionPlans });
        }

        if (pathEndsWith(url.pathname, "/api/admin/welcome")) {
          if (typeof body.welcomeBot === "string") await setBotWelcomeText(env, body.welcomeBot);
          if (typeof body.welcomeMiniapp === "string") await setMiniappWelcomeText(env, body.welcomeMiniapp);
          return jsonResponse({ ok: true, welcomeBot: await getBotWelcomeText(env), welcomeMiniapp: await getMiniappWelcomeText(env) });
        }

        if (pathEndsWith(url.pathname, "/api/admin/wallet")) {
          if (!isStaff(v.fromLike, env) && !(v.roleHint === "admin" || v.roleHint === "owner")) return jsonResponse({ ok: false, error: "forbidden" }, 403);
          if (!env.BOT_KV) return jsonResponse({ ok: false, error: "bot_kv_missing" }, 500);
          const wallet = typeof body.wallet === "string" ? body.wallet.trim() : null;
          if (wallet !== null) {
            await setWallet(env, wallet);
          }
          return jsonResponse({ ok: true, wallet: await getWallet(env) });
        }


        if (pathEndsWith(url.pathname, "/api/admin/subscription/plans")) {
          const action = String(body.action || "").trim();
          if (action === "set") {
            // Owner-only (because plans affect billing)
            if (!(v.roleHint === "owner") && !isOwner(v.fromLike, env)) return jsonResponse({ ok: false, error: "forbidden" }, 403);
            const plans = body.plans || body.subscriptionPlans || body.items || [];
            const res = await setSubscriptionPlans(env, plans);
            if (!res.ok) return jsonResponse({ ok: false, error: res.error || "save_failed" }, 500);
          }
          const plans = await getSubscriptionPlans(env);
          const wallet = await getWallet(env);
          return jsonResponse({ ok: true, wallet, plans });
        }

        if (pathEndsWith(url.pathname, "/api/admin/tickets/list")) {
          const limit = Math.min(300, Math.max(1, Number(body.limit || 100)));
          const tickets = await listSupportTickets(env, limit);
          return jsonResponse({ ok: true, tickets });
        }

        if (pathEndsWith(url.pathname, "/api/admin/tickets/update")) {
          const id = String(body.id || "").trim();
          const status = String(body.status || "").trim();
          const reply = String(body.reply || "").trim();
          if (!id) return jsonResponse({ ok: false, error: "ticket_id_required" }, 400);
          const allowed = ["pending", "answered", "closed"];
          if (!allowed.includes(status)) return jsonResponse({ ok: false, error: "bad_status" }, 400);

          const nextStatus = reply ? (status === "pending" ? "answered" : status) : status;

          let updated = null;
          try {
            updated = await updateSupportTicket(env, id, {
              status: nextStatus,
              reply: reply || undefined,
              updatedBy: normHandle(v.fromLike?.username),
            });
          } catch (e) {
            const msg = String(e?.message || e || "update_failed");
            const http = msg.includes("not_found") ? 404 : 500;
            return jsonResponse({ ok: false, error: msg }, http);
          }

          if (reply && updated?.userId) {
            const chat = Number(updated.userId);
            if (chat) {
              const who = updated.username ? ("@" + String(updated.username).replace(/^@/, "")) : updated.userId;
              const msg = `📩 پاسخ پشتیبانی

شناسه تیکت: ${updated.id}
کاربر: ${who}

${reply}`;
              await tgSendMessage(env, chat, msg);
            }
          }

          return jsonResponse({ ok: true, ticket: updated });
        }

        if (pathEndsWith(url.pathname, "/api/admin/prompt")) {
          // Disabled in this build: prompt editing is not allowed from the admin panel.
          return jsonResponse({ ok: false, error: "prompt_edit_disabled" }, 403);
        }

        if (pathEndsWith(url.pathname, "/api/admin/styles")) {
          const list = await getStyleList(env);
          const action = String(body.action || "");
          const style = String(body.style || "").trim();
          let next = list.slice();
          if (action === "add" && style) {
            if (ALLOWED_STYLE_LIST.includes(style) && !next.includes(style)) next.push(style);
          } else if (action === "remove" && style) {
            next = next.filter((s) => s !== style);
          }
          if (env.BOT_KV) await setStyleList(env, next);
          return jsonResponse({ ok: true, styles: await getStyleList(env) });
        }

        if (pathEndsWith(url.pathname, "/api/admin/style-prompts")) {
          // Disabled in this build: prompt editing is not allowed from the admin panel.
          return jsonResponse({ ok: false, error: "style_prompt_edit_disabled" }, 403);
        }

        if (pathEndsWith(url.pathname, "/api/admin/custom-prompts")) {
          // Disabled in this build: prompt editing is not allowed from the admin panel.
          return jsonResponse({ ok: false, error: "custom_prompt_edit_disabled" }, 403);
        }

        if (pathEndsWith(url.pathname, "/api/admin/free-limit")) {
          const limit = toInt(body.limit, 3);
          await setFreeDailyLimit(env, limit);
          return jsonResponse({ ok: true, freeDailyLimit: await getFreeDailyLimit(env) });
        }

        if (pathEndsWith(url.pathname, "/api/admin/points/base")) {
          const points = toInt(body.basePoints, 0);
          await setBasePoints(env, points);
          return jsonResponse({ ok: true, basePoints: await getBasePoints(env) });
        }

        if (pathEndsWith(url.pathname, "/api/admin/points/credit")) {
          const delta = Number(normalizeDigits(body.amount).trim());
          const note = String(body.note || "").slice(0, 200);

          let targetId = String(body.userId || body.targetUserId || "").trim();
          const uname = String(body.username || body.handle || "").trim();

          if (!targetId && uname) {
            targetId = await getUserIdByUsername(env, uname);
          }

          if (!targetId) return jsonResponse({ ok: false, error: "target_required" }, 400);
          if (!/^\d+$/.test(String(targetId))) return jsonResponse({ ok: false, error: "invalid_target" }, 400);
          if (!Number.isFinite(delta) || delta === 0) return jsonResponse({ ok: false, error: "invalid_amount" }, 400);

          const st = await ensureUser(String(targetId), env);
          ensurePoints(st);

          st.points.balance = Math.max(0, Number(st.points.balance || 0) + delta);
          st.points.adminTopups = Number(st.points.adminTopups || 0) + (delta > 0 ? delta : 0);
          st.points.adminDebits = Number(st.points.adminDebits || 0) + (delta < 0 ? Math.abs(delta) : 0);
          st.points.lastAdminAdjustAt = new Date().toISOString();
          st.points.lastAdminAdjustBy = String(v.userId);

          st.points.adjustHistory = Array.isArray(st.points.adjustHistory) ? st.points.adjustHistory : [];
          st.points.adjustHistory.push({ at: st.points.lastAdminAdjustAt, by: st.points.lastAdminAdjustBy, delta, note });
          if (st.points.adjustHistory.length > 100) st.points.adjustHistory = st.points.adjustHistory.slice(-100);

          await saveUser(String(targetId), st, env);

          // Try to notify user (best-effort)
          try {
            const sign = delta > 0 ? "+" : "";
            await tgSendMessage(env, Number(targetId), `💳 شارژ حساب\n${sign}${delta} امتیاز\n\nامتیاز فعلی: ${st.points.balance}`, mainMenuKeyboard(env));
          } catch (e) {}

          return jsonResponse({ ok: true, userId: Number(targetId), balance: st.points.balance });
        }



        if (pathEndsWith(url.pathname, "/api/admin/features")) {
          if (!isOwner(v.fromLike, env)) return jsonResponse({ ok: false, error: "forbidden" }, 403);
          const flags = await getAdminFlags(env);
          if (typeof body.capitalModeEnabled === "boolean") flags.capitalModeEnabled = body.capitalModeEnabled;
          if (typeof body.profileTipsEnabled === "boolean") flags.profileTipsEnabled = body.profileTipsEnabled;
          await setAdminFlags(env, flags);
          return jsonResponse({ ok: true, adminFlags: await getAdminFlags(env) });
        }


        if (pathEndsWith(url.pathname, "/api/admin/branding/get")) {
          // Admin + Owner can view branding
          if (!isStaff(v.fromLike, env) && !(v.roleHint === "admin" || v.roleHint === "owner")) {
            return jsonResponse({ ok: false, error: "forbidden" }, 403);
          }
          return jsonResponse({ ok: true, branding: await getBranding(env) });
        }

        if (pathEndsWith(url.pathname, "/api/admin/branding/set")) {
          // Owner only
          if (!(v.roleHint === "owner") && !isOwner(v.fromLike, env)) return jsonResponse({ ok: false, error: "forbidden" }, 403);
          const patch = {
            title: typeof body.title === "string" ? body.title : undefined,
            tagline: typeof body.tagline === "string" ? body.tagline : undefined,
            presentation: typeof body.presentation === "string" ? body.presentation : undefined,
            logoSvg: typeof body.logoSvg === "string" ? body.logoSvg : undefined,
          };
          const branding = await setBranding(env, patch);
          return jsonResponse({ ok: true, branding });
        }


        if (pathEndsWith(url.pathname, "/api/admin/offer")) {
          if (typeof body.offerBanner === "string" && env.BOT_KV) {
            await setOfferBanner(env, body.offerBanner);
          }
          if (body.clearOfferBannerImage) {
            await setOfferBannerImage(env, "");
          } else if (typeof body.offerBannerImage === "string") {
            try {
              await setOfferBannerImage(env, body.offerBannerImage);
            } catch (e) {
              return jsonResponse({ ok: false, error: String(e?.message || e || "offer_image_failed") }, 400);
            }
          }
          return jsonResponse({ ok: true, offerBanner: await getOfferBanner(env), offerBannerImage: await getOfferBannerImage(env) });
        }

        if (pathEndsWith(url.pathname, "/api/admin/commissions")) {
          const settings = await getCommissionSettings(env);
          const action = String(body.action || "");
          if (action === "setGlobal" && Number.isFinite(Number(body.percent))) {
            settings.globalPercent = Number(body.percent);
          }
          if (action === "setOverride") {
            const handle = normHandle(body.username);
            const pct = Number(body.percent);
            if (handle && Number.isFinite(pct)) settings.overrides[handle] = pct;
          }
          if (action === "removeOverride") {
            const handle = normHandle(body.username);
            if (handle) delete settings.overrides[handle];
          }
          await setCommissionSettings(env, settings);
          return jsonResponse({ ok: true, commission: await getCommissionSettings(env) });
        }

        if (pathEndsWith(url.pathname, "/api/admin/users/search")) {
  const q = String(body.q || body.query || "").trim();
  const limit = Math.max(1, Math.min(50, toInt(body.limit, 25)));
  const users = await dbSearchUsers(env, q, limit);
  return jsonResponse({ ok: true, users });
}

if (pathEndsWith(url.pathname, "/api/admin/users")) {
          // Admin + Owner can access user list for operations (credits, subscription management, etc.)
          if (!isStaff(v.fromLike, env) && !(v.roleHint === "admin" || v.roleHint === "owner")) {
            return jsonResponse({ ok: false, error: "forbidden" }, 403);
          }

          const limit = Math.max(1, Math.min(100, toInt(body.limit, 50)));
          const page = Math.max(0, toInt(body.page, 0));
          const sort = String(body.sort || "recent").trim();
          const dir = String(body.dir || "desc").trim(); // kept for future
          const result = await listUsersPaged(env, { limit, page, sort, dir });

          const now = Date.now();
          const report = result.users.map((u) => {
            const createdAt = u.createdAt || "";
            const usageDays = createdAt ? Math.max(1, Math.ceil((now - Date.parse(createdAt)) / (24 * 3600 * 1000))) : 0;
            const lastTx = Array.isArray(u.wallet?.transactions) ? u.wallet.transactions[u.wallet.transactions.length - 1] : null;
            const pts = Number(u.points?.balance || 0);
            return {
              userId: u.userId,
              username: u.profile?.username || "",
              phone: u.profile?.phone || "",
              createdAt,
              usageDays,
              totalAnalyses: u.stats?.successfulAnalyses || 0,
              lastAnalysisAt: u.stats?.lastAnalysisAt || "",
              paymentCount: u.stats?.totalPayments || 0,
              paymentTotal: u.stats?.totalPaymentAmount || 0,
              lastTxHash: lastTx?.txHash || "",
              referralBy: u.referral?.referredBy || "",
              referralInvites: u.referral?.successfulInvites || 0,
              subscriptionActive: !!u.subscription?.active,
              subscriptionType: u.subscription?.type || "free",
              subscriptionExpiresAt: u.subscription?.expiresAt || "",
              dailyLimit: dailyLimit(env, u),
              dailyUsed: u.dailyUsed || 0,
              customPromptId: u.customPromptId || "",
              points: pts,
              proActive: !!u.subscription?.active && (u.subscription?.type === "pro" || u.subscription?.plan === "pro"),
              isStaff: isStaffUser(u, env),
              plan: u.subscription?.plan || u.subscription?.type || "",
            };
          });

          return jsonResponse({
            ok: true,
            users: report,
            meta: {
              total: result.total,
              page: result.page,
              pages: result.pages,
              limit: result.limit,
              sort: result.sort,
              truncated: !!result.truncated,
            },
          });
        }
        if (pathEndsWith(url.pathname, "/api/admin/users/report")) {
          // Admin + Owner can fetch a full report for one user (state + payments + withdrawals + tickets)
          if (!isStaff(v.fromLike, env) && !(v.roleHint === "admin" || v.roleHint === "owner")) {
            return jsonResponse({ ok: false, error: "forbidden" }, 403);
          }

          let uid = String(body.userId || body.id || "").trim();
          const uname = normHandle(body.username || body.handle || "");
          if (!uid && uname) uid = await getUserIdByUsername(env, uname);
          if (!uid) return jsonResponse({ ok: false, error: "user_not_found" }, 404);

          const st = await ensureUser(String(uid), env);

          const paymentsAll = await listPayments(env, 250);
          const withdrawalsAll = await listWithdrawals(env, 250);
          const cwithdrawalsAll = await listCommissionWithdrawals(env, 250);
          const ticketsAll = await listSupportTickets(env, 250);

          const payments = paymentsAll.filter((p) => String(p?.userId || "") === String(uid)).slice(0, 80);
          const withdrawals = withdrawalsAll.filter((w) => String(w?.userId || "") === String(uid)).slice(0, 80);
          const commissionWithdrawals = cwithdrawalsAll.filter((w) => String(w?.userId || "") === String(uid)).slice(0, 80);

          const uUsername = normHandle(st?.profile?.username || "");
          const tickets = ticketsAll.filter((t) => String(t?.userId || "") === String(uid) || (uUsername && normHandle(t?.username || "") === uUsername)).slice(0, 80);

          const summary = buildUserFullReportSummary(st, payments, withdrawals, commissionWithdrawals, tickets, env);

          return jsonResponse({
            ok: true,
            userId: Number(uid),
            summary,
            state: st,
            payments,
            withdrawals,
            commissionWithdrawals,
            tickets,
          });
        }



        if (pathEndsWith(url.pathname, "/api/admin/report/pdf")) {
          if (!(v.roleHint === "owner") && !isOwner(v.fromLike, env)) return jsonResponse({ ok: false, error: "forbidden" }, 403);
          const users = await listUsers(env, Math.min(300, Math.max(1, Number(body.limit || 200))));
          const payments = await listPayments(env, 120);
          const withdrawals = await listWithdrawals(env, 120);
          const tickets = await listSupportTickets(env, 120);
          const lines = buildAdminReportLines(users, payments, withdrawals, tickets);
          const pdfBytes = buildSimplePdfFromText(lines.join(String.fromCharCode(10)));
          return new Response(pdfBytes, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename=admin-report-${Date.now()}.pdf`,
              "Cache-Control": "no-store",
            },
          });
        }

        if (pathEndsWith(url.pathname, "/api/admin/payments/list")) {
          return jsonResponse({ ok: true, payments: await listPayments(env, 100) });
        }
        if (pathEndsWith(url.pathname, "/api/admin/capital/toggle")) {
          const username = String(body.username || "").trim();
          const enabled = !!body.enabled;
          const userId = await getUserIdByUsername(env, username);
          if (!userId) return jsonResponse({ ok: false, error: "user_not_found" }, 404);
          const st = await ensureUser(userId, env);
          st.capital = st.capital || { amount: 0, enabled: true };
          st.capital.enabled = enabled;
          await saveUser(userId, st, env);
          return jsonResponse({ ok: true, capital: st.capital });
        }


        if (pathEndsWith(url.pathname, "/api/admin/withdrawals/list")) {
          const withdrawals = await listWithdrawals(env, 200);
          return jsonResponse({ ok: true, withdrawals });
        }


        if (pathEndsWith(url.pathname, "/api/admin/commission-withdrawals/list")) {
          const withdrawals = await listCommissionWithdrawals(env, 200);
          return jsonResponse({ ok: true, withdrawals });
        }

        if (pathEndsWith(url.pathname, "/api/admin/commission-withdrawals/decision")) {
          const id = String(body.withdrawalId || body.id || "").trim();
          const decisionRaw = String(body.status || body.decision || "").trim();
          const decision = decisionRaw === "approved" ? "approved" : (decisionRaw === "rejected" ? "rejected" : "");
          const txHash = String(body.txHash || "").trim();
          if (!id || !decision) return jsonResponse({ ok: false, error: "bad_request" }, 400);

          let updated = null;
          try {
            updated = await reviewCommissionWithdrawal(env, id, decision, txHash, v.fromLike);
          } catch (e) {
            return jsonResponse({ ok: false, error: e?.message || "review_failed" }, 400);
          }

          try {
            const _supportChatId = env.SUPPORT_CHAT_ID ? Number(env.SUPPORT_CHAT_ID) : 0;
            if (_supportChatId) {
              const _u = updated.username ? ("@" + String(updated.username).replace(/^@/, "")) : String(updated.userId);
              await tgSendMessage(env, _supportChatId, `🏧 نتیجه برداشت کمیسیون\nشناسه: ${updated.id}\nکاربر: ${_u}\nمبلغ: ${updated.amount}\nوضعیت: ${decision}\nTxHash: ${txHash || "-"}`);
            }
          } catch (e) {}

          // Notify user (if Telegram chat id)
          const chat = Number(updated.userId);
          if (chat) {
            const msg = decision === "approved"
              ? `✅ برداشت کمیسیون شما تایید شد.
مبلغ: ${updated.amount}
TxHash: ${txHash || "-"}`
              : `❌ برداشت کمیسیون شما رد شد.
مبلغ: ${updated.amount}

موجودی کمیسیون شما به حالت قبل برگشت.`;
            try { await tgSendMessage(env, chat, msg); } catch {}
          }

          return jsonResponse({ ok: true, withdrawal: updated });
        }


        if (pathEndsWith(url.pathname, "/api/admin/withdrawals/review")) {
          const id = String(body.id || "").trim();
          const decision = String(body.decision || "").trim();
          const txHash = String(body.txHash || "").trim();
          if (!id || !["approved","rejected"].includes(decision)) return jsonResponse({ ok: false, error: "bad_request" }, 400);
          const updated = await reviewWithdrawal(env, id, decision, txHash, v.fromLike);
          try {
            const _supportChatId = env.SUPPORT_CHAT_ID ? Number(env.SUPPORT_CHAT_ID) : 0;
            if (_supportChatId) {
              const _u = String(updated.userId || "-");
              await tgSendMessage(env, _supportChatId, `🏧 نتیجه برداشت\nشناسه: ${updated.id}\nکاربر: ${_u}\nمبلغ: ${updated.amount || "-"}\nوضعیت: ${decision}\nTxHash: ${txHash || "-"}`);
            }
          } catch (e) {}
          return jsonResponse({ ok: true, withdrawal: updated });
        }

        if (pathEndsWith(url.pathname, "/api/admin/payments/decision")) {
          const paymentId = String(body.paymentId || body.id || "").trim();
          const decisionRaw = String(body.status || body.decision || "").trim();
          const status = decisionRaw === "approved" ? "approved" : (decisionRaw === "rejected" ? "rejected" : "");
          const force = !!body.force;

          if (!paymentId || !status) return jsonResponse({ ok: false, error: "bad_request" }, 400);
          if (!env.BOT_KV) return jsonResponse({ ok: false, error: "bot_kv_missing" }, 500);

          const raw = await env.BOT_KV.get(`payment:${paymentId}`);
          if (!raw) return jsonResponse({ ok: false, error: "payment_not_found" }, 404);

          let payment = null;
          try { payment = JSON.parse(raw); } catch {}
          if (!payment) return jsonResponse({ ok: false, error: "payment_bad_json" }, 500);

          const prevStatus = String(payment.status || "pending");
          const nowIso = new Date().toISOString();

          payment.status = status;
          payment.reviewedAt = nowIso;
          payment.reviewedBy = normHandle(v.fromLike?.username);

          let verifyResult = null;
          let subscription = null;

          // If approving a pending payment: activate the user's subscription + mark tx used
          if (status === "approved" && prevStatus !== "approved") {
            const userId = String(payment.userId || "").trim();
            if (!userId) return jsonResponse({ ok: false, error: "payment_user_missing" }, 400);

            const plans = await getSubscriptionPlans(env);
            const planId = String(payment.planId || "").trim();
            const plan = planId ? (plans.find((p) => p && p.id === planId) || null) : null;

            const amount = Number(payment.amount || (plan ? plan.amount : 0) || 0);
            const days = toInt(plan ? plan.days : payment.days, 30);
            const dailyLimit = toInt(plan ? plan.dailyLimit : payment.dailyLimit, toInt(env.PREMIUM_DAILY_LIMIT, 50));

            const txHash = normalizeTxHash(payment.txHash || "");
            if (txHash) {
              if (await isTxUsed(env, txHash)) return jsonResponse({ ok: false, error: "tx_used" }, 409);

              const address = (await getWallet(env)) || "";
              if (!force) {
                if (!address) return jsonResponse({ ok: false, error: "wallet_missing" }, 500);
                verifyResult = await verifyBlockchainPayment({ txHash, address, amount }, env);
                if (!verifyResult || !verifyResult.ok) {
                  return jsonResponse({ ok: false, error: "blockchain_check_failed", result: verifyResult }, 400);
                }
              } else {
                verifyResult = { ok: true, forced: true };
              }
            }

            const st = await ensureUser(userId, env);
            st.subscription = st.subscription || { active: false, type: "free", expiresAt: "", dailyLimit: 3 };

            st.subscription.active = true;
            st.subscription.type = plan ? plan.id : (planId || "manual");
            st.subscription.dailyLimit = dailyLimit;
            st.subscription.expiresAt = extendISO(st.subscription.expiresAt || "", days);

            // Count payment only once
            if (!payment.applied) {
              st.stats = st.stats || {};
              st.stats.totalPayments = (st.stats.totalPayments || 0) + 1;
              st.stats.totalPaymentAmount = (st.stats.totalPaymentAmount || 0) + amount;
            }

            // store tx history (for admin reports)
            st.wallet = st.wallet || { address: "", transactions: [] };
            st.wallet.transactions = Array.isArray(st.wallet.transactions) ? st.wallet.transactions : [];
            if (txHash) {
              st.wallet.transactions.push({ txHash, amount, createdAt: nowIso });
              st.wallet.transactions = st.wallet.transactions.slice(-10);
            }

            await saveUser(userId, st, env);
            await applyReferralCommissionForPayment(env, st, payment, amount, nowIso);
            if (txHash) {
              await markTxUsed(env, txHash);
              await releaseTxReservation(env, txHash, paymentId);
            }

            payment.approvedAt = nowIso;
            payment.approvedBy = normHandle(v.fromLike?.username);
            if (verifyResult) payment.verifyResult = verifyResult;
            payment.days = days;
            payment.dailyLimit = dailyLimit;
            payment.applied = true;

            subscription = st.subscription;
          }

          if (status === "rejected" && prevStatus !== "rejected") {
            payment.rejectedAt = nowIso;
            payment.rejectedBy = normHandle(v.fromLike?.username);
            const _tx = normalizeTxHash(payment.txHash || "");
            if (_tx) await releaseTxReservation(env, _tx, paymentId);
          }

          await env.BOT_KV.put(`payment:${paymentId}`, JSON.stringify(payment));
          if (String(status || "") !== String(prevStatus || "")) {
            try { await notifyAdminPayment(env, payment, status); } catch (e) {}
          }
          return jsonResponse({ ok: true, payment, subscription, verifyResult });
        }

        
        if (pathEndsWith(url.pathname, "/api/admin/withdrawals/decision")) {
          const id = String(body.withdrawalId || body.id || "").trim();
          const decisionRaw = String(body.status || body.decision || "").trim();
          const decision = decisionRaw === "approved" ? "approved" : (decisionRaw === "rejected" ? "rejected" : "");
          const txHash = String(body.txHash || "").trim();
          if (!id || !decision) return jsonResponse({ ok: false, error: "bad_request" }, 400);
          const updated = await reviewWithdrawal(env, id, decision, txHash, v.fromLike);
          try {
            const _supportChatId = env.SUPPORT_CHAT_ID ? Number(env.SUPPORT_CHAT_ID) : 0;
            if (_supportChatId) {
              const _u = String(updated.userId || "-");
              await tgSendMessage(env, _supportChatId, `🏧 نتیجه برداشت\nشناسه: ${updated.id}\nکاربر: ${_u}\nمبلغ: ${updated.amount || "-"}\nوضعیت: ${decision}\nTxHash: ${txHash || "-"}`);
            }
          } catch (e) {}
          return jsonResponse({ ok: true, withdrawal: updated });
        }



        if (pathEndsWith(url.pathname, "/api/admin/payments/approve")) {
          const username = String(body.username || "").trim();
          const userId = await getUserIdByUsername(env, username);
          if (!userId) return jsonResponse({ ok: false, error: "user_not_found" }, 404);

          const st = await ensureUser(userId, env);
          const amount = Number(body.amount || 0);
          const days = toInt(body.days, 30);
          const txHash = String(body.txHash || "").trim();
          const premiumLimit = toInt(env.PREMIUM_DAILY_LIMIT, 50);
          const now = new Date().toISOString();
          const payment = {
            id: `pay_${Date.now()}_${userId}`,
            userId,
            username,
            amount,
            txHash,
            status: "approved",
            createdAt: now,
            approvedAt: now,
            approvedBy: normHandle(v.fromLike?.username),
          };

          st.subscription.active = true;
          st.subscription.type = "premium";
          st.subscription.dailyLimit = premiumLimit;
          st.subscription.expiresAt = futureISO(days);
          st.stats.totalPayments = (st.stats.totalPayments || 0) + 1;
          st.stats.totalPaymentAmount = (st.stats.totalPaymentAmount || 0) + amount;
          st.wallet.transactions = Array.isArray(st.wallet.transactions) ? st.wallet.transactions : [];
          if (txHash) {
            st.wallet.transactions.push({ txHash, amount, createdAt: now });
            st.wallet.transactions = st.wallet.transactions.slice(-10);
          }

          await applyReferralCommissionForPayment(env, st, payment, amount, now);

          await saveUser(userId, st, env);
          await storePayment(env, payment);
          return jsonResponse({ ok: true, payment, subscription: st.subscription });
        }

        if (pathEndsWith(url.pathname, "/api/admin/subscription/activate")) {
          const username = String(body.username || "").trim();
          const userId = await getUserIdByUsername(env, username);
          if (!userId) return jsonResponse({ ok: false, error: "user_not_found" }, 404);
          const st = await ensureUser(userId, env);
          const days = toInt(body.days, 30);
          const premiumLimit = toInt(body.dailyLimit, toInt(env.PREMIUM_DAILY_LIMIT, 50));
          st.subscription.active = true;
          st.subscription.type = "manual";
          st.subscription.dailyLimit = premiumLimit;
          st.subscription.expiresAt = futureISO(days);
          await saveUser(userId, st, env);
          return jsonResponse({ ok: true, subscription: st.subscription });
        }

        if (pathEndsWith(url.pathname, "/api/admin/custom-prompts/requests")) {
          if (String(body.action || "") === "decide") {
            const requestId = String(body.requestId || "").trim();
            const statusRaw = String(body.status || "").trim();
            const status = statusRaw === "approved" ? "approved" : "rejected";
            const promptId = String(body.promptId || "").trim();

            const requests = await listCustomPromptRequests(env, 200);
            const req = requests.find((x) => x.id === requestId);
            if (!req) return jsonResponse({ ok: false, error: "request_not_found" }, 404);

            req.status = status;
            if (status === "approved") {
              req.promptId = promptId || req.promptId || "";
              if (!req.promptId) return jsonResponse({ ok: false, error: "prompt_id_required" }, 400);
            } else {
              req.promptId = "";
            }

            req.decidedAt = new Date().toISOString();
            req.decidedBy = normHandle(v.fromLike?.username);

            await storeCustomPromptRequest(env, req);

            if (req.status === "approved") {
              const st = await ensureUser(req.userId, env);
              st.customPromptId = String(req.promptId);
              await saveUser(req.userId, st, env);
            }

            
            const chat = Number(req.userId);
            if (chat) {
              const msg = req.status === "approved"
                ? `✅ درخواست پرامپت اختصاصی شما تایید شد.

شناسه پرامپت: ${req.promptId}

از منوی تنظیمات می‌تونی پرامپت اختصاصی رو انتخاب کنی.`
                : `❌ درخواست پرامپت اختصاصی شما رد شد.

اگر سوالی داری، از بخش پشتیبانی تیکت بزن.`;
              await tgSendMessage(env, chat, msg);
            }

            return jsonResponse({ ok: true, request: req });
          }
          return jsonResponse({ ok: true, requests: await listCustomPromptRequests(env, 200) });
        }

        if (pathEndsWith(url.pathname, "/api/admin/custom-prompts/send")) {
          // Disabled in this build: prompt editing is not allowed from the admin panel.
          return jsonResponse({ ok: false, error: "custom_prompt_send_disabled" }, 403);
        }

        if (pathEndsWith(url.pathname, "/api/admin/payments/check")) {
          const payload = {
            txHash: String(body.txHash || "").trim(),
            address: (String(body.address || "").trim() || (await getWallet(env)) || ""),
            amount: Number(body.amount || 0),
          };
          const result = await verifyBlockchainPayment(payload, env);
          return jsonResponse({ ok: true, check: result });
        }
      }

      
      if (pathEndsWith(url.pathname, "/api/subscription/plans") && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

        const v = await verifyMiniappAuth(body, env);
        if (!v.ok) return jsonResponse({ ok: false, error: v.reason }, 401);

        const plans = await getSubscriptionPlans(env);
        return jsonResponse({
          ok: true,
          plans,
          wallet: (await getWallet(env)) || "",
          analysisPointsCost: Number(env.ANALYSIS_POINTS_COST || 2),
        });
      }

      if (pathEndsWith(url.pathname, "/api/subscription/purchase") && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

        const v = await verifyMiniappAuth(body, env);
        if (!v.ok) return jsonResponse({ ok: false, error: v.reason }, 401);

        const planId = String(body.planId || "").trim();
        const txHashRaw = String(body.txHash || "").trim();
        const txHash = normalizeTxHash(txHashRaw);
        if (!planId || !txHashRaw) return jsonResponse({ ok: false, error: "bad_request" }, 400);
        if (!txHash) return jsonResponse({ ok: false, error: "invalid_txhash" }, 400);

        // Auto-approval disabled: reserve tx until admin approves/rejects
        if (await isTxUsed(env, txHash)) return jsonResponse({ ok: false, error: "tx_used" }, 409);
        if (await isTxReserved(env, txHash)) return jsonResponse({ ok: false, error: "tx_pending" }, 409);

        const plans = await getSubscriptionPlans(env);
        const plan = plans.find((p) => p && p.id === planId) || null;
        if (!plan) return jsonResponse({ ok: false, error: "plan_not_found" }, 404);

        const address = (await getWallet(env)) || "";
        const payload = { txHash, address, amount: Number(plan.amount || 0) };
        const check = await verifyBlockchainPayment(payload, env);

        const st = await ensureUser(v.userId, env, v.fromLike);
        const now = new Date().toISOString();
        const username = String(st.profile?.username || "").trim();

        const paymentId = `pay_${Date.now()}_${v.userId}`;
        const payment = {
          id: paymentId,
          userId: v.userId,
          username,
          amount: Number(plan.amount || 0),
          txHash,
          planId: plan.id,
          days: toInt(plan.days, 30),
          dailyLimit: toInt(plan.dailyLimit, 50),
          status: "pending",
          createdAt: now,
          verifyResult: check || null,
          autoApproved: false,
        };

        await reserveTx(env, txHash, paymentId);
        await saveUser(v.userId, st, env);
        await storePayment(env, payment);

        // Notify admin (Telegram) about new pending payment
        await notifyAdminPayment(env, payment, "created");

        return jsonResponse({ ok: true, activated: false, result: check || null, payment, subscription: st.subscription });
      }




      if (pathEndsWith(url.pathname, "/api/referral/summary") && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

        const v = await verifyMiniappAuth(body, env);
const allowGuest = String(env.WEB_GUEST_ENABLED || "1") === "1" && !v.ok && !!body.allowGuest;
let userId = v.ok ? v.userId : "";
let fromLike = v.ok ? v.fromLike : {};
let issuedMiniToken = "";
if (!v.ok && !allowGuest) return jsonResponse({ ok: false, error: v.reason }, 401);

// Web guest: 3 analyses per day (KV-backed)
if (!v.ok && allowGuest) {
  if (!env.BOT_KV) return jsonResponse({ ok: false, error: "kv_required" }, 500);
  const fp = await webFingerprint(request);
  const day = isoDayKey();
  const k = `web_guest_limit:${day}:${fp}`;
  const raw = await env.BOT_KV.get(k);
  const used = Number(raw || 0);
  if (used >= 3) return jsonResponse({ ok: false, error: "daily_limit_exceeded" }, 429);
  userId = `webguest:${fp}`;
  fromLike = { username: "webguest", first_name: "Web Guest" };
  issuedMiniToken = await issueMiniappToken(env, userId, fromLike);
  // increment after successful enqueue
}

const st = await ensureUser(userId, env, fromLike);

        const code = (st.referral?.codes || [])[0] || "";
        const ref = st.referral || {};
        const recent = await listCommissionWithdrawals(env, 50);
        const mine = recent.filter((x) => String(x?.userId || "") === String(v.userId)).slice(0, 20);

        return jsonResponse({
          ok: true,
          code,
          referral: {
            code,
            successfulInvites: Number(ref.successfulInvites || 0),
            commissionBalance: Number(ref.commissionBalance || 0),
            commissionPending: Number(ref.commissionPending || 0),
            commissionPaid: Number(ref.commissionPaid || 0),
            commissionTotal: Number(ref.commissionTotal || 0),
          },
          withdrawals: mine,
        });
      }

      if (pathEndsWith(url.pathname, "/api/referral/commission/withdraw") && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

        const v = await verifyMiniappAuth(body, env);
        if (!v.ok) return jsonResponse({ ok: false, error: v.reason }, 401);

        const st = await ensureUser(v.userId, env, v.fromLike);
        st.referral = st.referral || {};
        st.referral.commissionBalance = roundMoney(st.referral.commissionBalance || 0);
        st.referral.commissionPending = roundMoney(st.referral.commissionPending || 0);

        const amount = roundMoney(body.amount || 0);
        const address = String(body.address || "").trim();

        if (!Number.isFinite(amount) || amount <= 0) return jsonResponse({ ok: false, error: "invalid_amount" }, 400);
        if (!address || address.length < 6) return jsonResponse({ ok: false, error: "invalid_address" }, 400);

        const bal = roundMoney(st.referral.commissionBalance || 0);
        if (amount > bal) return jsonResponse({ ok: false, error: "insufficient_commission" }, 400);

        st.referral.commissionBalance = roundMoney(bal - amount);
        st.referral.commissionPending = roundMoney((st.referral.commissionPending || 0) + amount);

        const wid = `cw_${Date.now()}_${v.userId}`;
        const createdAt = new Date().toISOString();
        const item = {
          id: wid,
          userId: String(v.userId),
          username: String(st.profile?.username || ""),
          amount,
          address,
          status: "pending",
          createdAt,
          kind: "referral_commission",
        };

        await saveUser(v.userId, st, env);
        await storeCommissionWithdrawal(env, item);

        const supportChatId = env.SUPPORT_CHAT_ID ? Number(env.SUPPORT_CHAT_ID) : 0;
        if (supportChatId) {
          await tgSendMessage(env, supportChatId, `🏧 برداشت کمیسیون (pending)
شناسه: ${wid}
کاربر: ${item.username ? "@"+item.username : "-"}
ChatID: ${item.userId}
مبلغ: ${amount}
آدرس: ${address}`);
        }

        return jsonResponse({ ok: true, withdrawal: item, referral: st.referral });
      }


if (pathEndsWith(url.pathname, "/api/support/ticket") && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

        const v = await verifyMiniappAuth(body, env);
        if (!v.ok) return jsonResponse({ ok: false, error: v.reason }, 401);

        const st = await ensureUser(v.userId, env);
        const text = String(body.text || "").trim();
        const kind = String(body.kind || "general").trim();
        if (text.length < 4) return jsonResponse({ ok: false, error: "ticket_too_short" }, 400);

        const ticket = {
          id: `t_${Date.now()}_${st.userId}`,
          userId: String(st.userId),
          username: st.profile?.username || "",
          phone: st.profile?.phone || "",
          text,
          kind,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        await storeSupportTicket(env, ticket);

        const supportChatId = env.SUPPORT_CHAT_ID ? Number(env.SUPPORT_CHAT_ID) : 0;
        if (supportChatId) {
          await tgSendMessage(env, supportChatId, `📩 تیکت جدید
شناسه: ${ticket.id}
نوع: ${kind}
کاربر: ${st.profile?.username ? "@"+st.profile.username : "-"}
ChatID: ${st.userId}
شماره: ${st.profile?.phone || "-"}
متن:
${text}`);
        }


        return jsonResponse({ ok: true, ticket, supportNotified: !!supportChatId });
      }


      if (pathEndsWith(url.pathname, "/api/support/tickets/list") && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

        const v = await verifyMiniappAuth(body, env);
        if (!v.ok) return jsonResponse({ ok: false, error: v.reason }, 401);

        const limit = Math.min(100, Math.max(1, Number(body.limit || 50)));
        const tickets = await listSupportTicketsForUser(env, String(v.userId), limit);
        return jsonResponse({ ok: true, tickets, count: tickets.length });
      }

      if (pathEndsWith(url.pathname, "/api/support/ticket/get") && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

        const v = await verifyMiniappAuth(body, env);
        if (!v.ok) return jsonResponse({ ok: false, error: v.reason }, 401);

        const id = String(body.id || "").trim();
        if (!id) return jsonResponse({ ok: false, error: "ticket_id_required" }, 400);

        const t = await getSupportTicketById(env, id);
        if (!t) return jsonResponse({ ok: false, error: "not_found" }, 404);
        if (String(t.userId) !== String(v.userId)) return jsonResponse({ ok: false, error: "forbidden" }, 403);

        return jsonResponse({ ok: true, ticket: t });
      }

      if (pathEndsWith(url.pathname, "/api/wallet/deposit/notify") && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);
        const v = await verifyTelegramInitData(body.initData, env.TELEGRAM_BOT_TOKEN, env.INITDATA_MAX_AGE_SEC, env.MINIAPP_AUTH_LENIENT);
        if (!v.ok) return jsonResponse({ ok: false, error: v.reason }, 401);

        const st = await ensureUser(v.userId, env);
        const txid = String(body.txid || body.txHash || "").trim();
        const amount = Number(body.amount || 0);
        if (!txid) return jsonResponse({ ok: false, error: "txid_required" }, 400);

        const payment = {
          id: `dep_${Date.now()}_${st.userId}`,
          userId: String(st.userId),
          username: st.profile?.username || "",
          amount,
          txHash: txid,
          status: "pending",
          createdAt: new Date().toISOString(),
          source: "user_txid",
        };
        await storePayment(env, payment);

        const supportChatId = env.SUPPORT_CHAT_ID ? Number(env.SUPPORT_CHAT_ID) : 0;
        if (supportChatId) {
          await tgSendMessage(env, supportChatId, `💳 درخواست واریز جدید
کاربر: ${st.profile?.username ? "@"+st.profile.username : "-"}
ChatID: ${st.userId}
TxID: ${txid}
مبلغ: ${amount || "-"}
وضعیت: pending`);
        }


        return jsonResponse({ ok: true, payment, supportNotified: !!supportChatId });
      }

      if (pathEndsWith(url.pathname, "/api/chart") && request.method === "GET") {
        const symbol = String(url.searchParams.get("symbol") || "").trim().toUpperCase();
        const tf = String(url.searchParams.get("tf") || "H4").trim().toUpperCase();
        const levelsRaw = String(url.searchParams.get("levels") || "").trim();
        const chartId = String(url.searchParams.get("id") || "").trim();
        const levels = levelsRaw
          ? levelsRaw.split(",").map((x) => Number(x)).filter((n) => Number.isFinite(n)).slice(0, 8)
          : [];

        if (!symbol || !isSymbol(symbol)) {
          return jsonResponse({ ok: false, error: "invalid_symbol" }, 400);
        }

        let candles = [];
        try {
          candles = await getMarketCandlesWithFallback(env, symbol, tf);
        } catch (e) {
          console.error("api/chart market fallback failed:", e?.message || e);
          candles = [];
        }

        if (!Array.isArray(candles) || candles.length === 0) {
          const cacheKey = marketCacheKey(symbol, tf);
          candles = await getMarketCacheStale(env, cacheKey);
        }

        if (!Array.isArray(candles) || candles.length === 0) {
          return jsonResponse({ ok: false, error: "no_market_data" }, 404);
        }

        try {
          let qcSpec = null;
          if (chartId && env.BOT_KV) {
            const raw = await env.BOT_KV.get(chartId);
            if (raw) {
              try { qcSpec = JSON.parse(raw); } catch { qcSpec = null; }
            }
          }
          const png = await renderQuickChartPng(env, candles, symbol, tf, levels, qcSpec);
          return new Response(png, {
            status: 200,
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "no-store",
            },
          });
        } catch (e) {
          console.error("api/chart quickchart render failed:", e?.message || e);
          const autoLevels = (Array.isArray(levels) && levels.length)
            ? levels
            : extractLevelsFromCandles(candles);
          const svg = buildLevelsOnlySvg(symbol, tf, autoLevels);
          return new Response(svg, {
            status: 200,
            headers: {
              "Content-Type": "image/svg+xml; charset=utf-8",
              "Cache-Control": "no-store",
              "X-Chart-Fallback": "internal_svg",
            },
          });
        }
      }


      if (pathEndsWith(url.pathname, "/api/candles") && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

        const v = await verifyMiniappAuth(body, env);
        const allowGuest = miniappGuestEnabled(env) && !v.ok && !!body.allowGuest;
        if (!v.ok && !allowGuest) return jsonResponse({ ok: false, error: v.reason || "unauthorized" }, 401);

        const symbol = String(body.symbol || "").toUpperCase();
        const timeframe = String(body.timeframe || "H4").toUpperCase();
        const limit = Math.min(500, Math.max(20, Number(body.limit || 200)));
        if (!symbol || !isSymbol(symbol)) return jsonResponse({ ok: false, error: "invalid_symbol" }, 400);

        const cacheKey = `candles:${symbol}:${timeframe}:${limit}`;
        const cached = apiRespCacheGet(cacheKey);
        if (cached) return jsonResponse(cached);

        let candles = [];
        try {
          candles = await getMarketCandlesWithFallback(env, symbol, timeframe);
        } catch (e) {
          candles = [];
        }

        const list = Array.isArray(candles)
          ? candles.slice(-limit).map((c) => ({
              t: Number(c.t),
              o: Number(c.o),
              h: Number(c.h),
              l: Number(c.l),
              c: Number(c.c),
              v: Number(c.v || 0),
            }))
          : [];

        const resp = {
          ok: true,
          symbol,
          timeframe,
          candles: list,
          count: list.length,
          lastTs: list.length ? list[list.length - 1].t : null,
        };

        apiRespCacheSet(cacheKey, resp, 15000);
        return jsonResponse(resp);
      }

      if (pathEndsWith(url.pathname, "/api/quote") && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

        const v = await verifyMiniappAuth(body, env);
        if (!v.ok) return jsonResponse({ ok: false, error: "login_required" }, 401);

        const st = v.ok ? await ensureUser(v.userId, env) : defaultUser("guest");
        const symbol = String(body.symbol || "").trim().toUpperCase();
        const tf = String(body.timeframe || st.timeframe || "H4").toUpperCase();
        if (!symbol || !isSymbol(symbol)) return jsonResponse({ ok: false, error: "invalid_symbol" }, 400);

        const quoteRespKey = `quote|${symbol}|${tf}`;
        const quoteCachedResp = apiRespCacheGet(quoteRespKey);
        if (quoteCachedResp) return jsonResponse(quoteCachedResp);


        let candles = [];
        try {
          candles = await getMarketCandlesWithFallback(env, symbol, tf);
        } catch (e) {
          console.error("api/quote market fallback failed:", e?.message || e);
          candles = [];
        }
        if (!Array.isArray(candles) || !candles.length) {
          candles = await getMarketCacheStale(env, marketCacheKey(symbol, tf));
        }
        if (!Array.isArray(candles) || !candles.length) {
          return jsonResponse({ ok: false, error: "quote_unavailable" }, 404);
        }

        const snap = computeSnapshot(candles);
        if (!snap || !Number.isFinite(Number(snap.lastPrice))) {
          return jsonResponse({ ok: false, error: "quote_bad_data" }, 502);
        }
        const cp = Number(snap.changePct || 0);
        const status = cp > 0.08 ? "up" : (cp < -0.08 ? "down" : "flat");
        const quality = candles.length >= minCandlesForTimeframe(tf) ? "full" : "limited";

        const quotePayload = {
          ok: true,
          symbol,
          timeframe: tf,
          price: Number(snap.lastPrice),
          changePct: cp,
          trend: snap.trend || "نامشخص",
          sma20: snap.sma20,
          sma50: snap.sma50,
          lastTs: snap.lastTs,
          candles: candles.length,
          quality,
          status,
        };
        apiRespCacheSet(quoteRespKey, quotePayload, Number(env.QUOTE_RESPONSE_CACHE_MS || 10000));
        return jsonResponse(quotePayload);
      }

      if (pathEndsWith(url.pathname, "/api/news") && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

        const v = await verifyMiniappAuth(body, env);
        if (!v.ok) return jsonResponse({ ok: false, error: "login_required" }, 401);

const symbol = String(body.symbol || "").trim().toUpperCase();
        if (!symbol || !isSymbol(symbol)) return jsonResponse({ ok: false, error: "invalid_symbol" }, 400);

        const newsRespKey = `news|${symbol}`;
        const newsCachedResp = apiRespCacheGet(newsRespKey);
        if (newsCachedResp) return jsonResponse(newsCachedResp);
        try {
          const articles = await fetchSymbolNewsFa(symbol, env);
          const payload = { ok: true, symbol, articles, count: articles.length };
          apiRespCacheSet(newsRespKey, payload, Number(env.NEWS_RESPONSE_CACHE_MS || 30000));
          return jsonResponse(payload);
        } catch (e) {
          console.error("api/news failed:", e?.message || e);
          return jsonResponse({ ok: false, error: "news_unavailable", symbol, articles: [] }, 502);
        }
      }

      if (pathEndsWith(url.pathname, "/api/news/analyze") && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

        const v = await verifyMiniappAuth(body, env);
        const allowGuest = miniappGuestEnabled(env) && !v.ok && !!body.allowGuest;
        if (!v.ok && !allowGuest) return jsonResponse({ ok: false, error: v.reason }, 401);

        const symbol = String(body.symbol || "").trim().toUpperCase();
        if (!symbol || !isSymbol(symbol)) return jsonResponse({ ok: false, error: "invalid_symbol" }, 400);

        const acc = await dbWebGetByUserId(env, v.userId).catch(() => null);
        // Email verification is optional (no hard block)
const newsAnRespKey = `news_an|${symbol}`;
        const newsAnCachedResp = apiRespCacheGet(newsAnRespKey);
        if (newsAnCachedResp) return jsonResponse(newsAnCachedResp);
        try {
          const articles = await fetchSymbolNewsFa(symbol, env);
          const summary = await buildNewsAnalysisSummary(symbol, articles, env);
          const payload = { ok: true, symbol, summary, articles, count: articles.length };
          apiRespCacheSet(newsAnRespKey, payload, Number(env.NEWS_ANALYSIS_RESPONSE_CACHE_MS || 45000));
          return jsonResponse(payload);
        } catch (e) {
          console.error("api/news/analyze failed:", e?.message || e);
          return jsonResponse({ ok: false, error: "news_analysis_unavailable", symbol, summary: "", articles: [] }, 502);
        }
      }
      if (pathEndsWith(url.pathname, "/api/analyze") && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

        const v = await verifyMiniappAuth(body, env);
        if (!v.ok) return jsonResponse({ ok: false, error: v.reason }, 401);

        const st = await ensureUser(v.userId, env, v.fromLike);
        const symbol = String(body.symbol || "").trim();
        if (!symbol || !isSymbol(symbol)) return jsonResponse({ ok: false, error: "invalid_symbol" }, 400);

        
        if (typeof body.timeframe === "string") st.timeframe = String(body.timeframe || "").trim() || st.timeframe;

        if (typeof body.style === "string") {
          const styles = await getStyleList(env);
          const s = String(body.style || "").trim();
          if (styles.includes(s)) st.style = s;
        }

        if (typeof body.risk === "string") st.risk = String(body.risk || "").trim() || st.risk;
        if (typeof body.newsEnabled === "boolean") st.newsEnabled = body.newsEnabled;

        const strictStyleOnly = String((env && env.STRICT_STYLE_ONLY != null) ? env.STRICT_STYLE_ONLY : "1") === "1";
        if (strictStyleOnly) {
          st.promptMode = "style_only";
          st.customPromptId = "";
        } else if (typeof body.promptMode === "string") {
          const pm = String(body.promptMode || "").trim();
          const allowedPromptModes = ["style_only", "combined_all", "custom_only", "style_plus_custom"];
          st.promptMode = allowedPromptModes.includes(pm) ? pm : (st.promptMode || "style_plus_custom");
        }


        if (typeof body.customPromptId === "string") {
          const prompts = await getCustomPrompts(env);
          const id = String(body.customPromptId || "").trim();
          st.customPromptId = prompts.find((p) => String(p?.id || "") === id) ? id : "";
        }

        if (typeof body.selectedSymbol === "string") {
          const ss = String(body.selectedSymbol || "").trim().toUpperCase();
          if (!ss || isSymbol(ss)) st.selectedSymbol = ss;
        }
        const isOnboardingReady = !!(
          st.profile?.onboardingDone &&
          st.profile?.name &&
          st.profile?.phone &&
          st.profile?.preferredStyle &&
          st.profile?.preferredMarket &&
          Number(st.profile?.capital || 0) > 0
        );
        // Relax onboarding gating: allow analysis even if onboarding is incomplete.
        // We only annotate the state so the UI can suggest completing profile later.
        if (!isOnboardingReady && !isStaff(v.fromLike, env)) {
          st.profile = st.profile || {};
          st.profile.needsOnboarding = true;
        }

const userPrompt = typeof body.userPrompt === "string" ? body.userPrompt : "";
        if (hasUserPersistence(env) && !canAnalyzeToday(st, v.fromLike, env)) {
          return jsonResponse({ ok: false, error: "daily_limit_exceeded" }, 429);
        }

        if (hasUserPersistence(env)) {
          // Persist user setting changes immediately (analysis result will be written by queue consumer)
          await saveUser(v.userId, st, env);
        }

        const origin = new URL(request.url).origin;
        const q = await enqueueMiniappAnalysisJob(env, origin, v.userId, v.fromLike, st, symbol, userPrompt);
        if (!q.ok) {
          return jsonResponse({ ok: false, error: q.reason || "queue_error" }, q.status || 500);
        }
        const ptsBal = Number(st.points?.balance || 0);
        const apCost = Number(env.ANALYSIS_POINTS_COST || 2);
        const analysesLeft = Math.max(0, Math.floor(ptsBal / (apCost || 2)));
        const quota = `0/${analysesLeft}`;
        return jsonResponse({ ok: true, queued: true, jobId: q.jobId, status: "queued", quota, points: { balance: ptsBal, cost: apCost, analysesLeft } });
}

      
      
      if (pathEndsWith(url.pathname, "/api/analyze/status") && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const v = await verifyMiniappAuth(body, env);
        if (!v.ok) return jsonResponse({ ok: false, error: v.reason }, 401);

        const jobId = String(body?.jobId || "").trim();
        if (!jobId) return jsonResponse({ ok: false, error: "bad_request" }, 400);

        if (!env.BOT_KV) return jsonResponse({ ok: false, error: "kv_required" }, 500);

        const job = await loadMiniappAnalysisJob(env, jobId);
        if (!job) return jsonResponse({ ok: false, error: "not_found" }, 404);
        if (String(job.userId || "") !== String(v.userId)) return jsonResponse({ ok: false, error: "forbidden" }, 403);

        try { if (job && job.result && !job.resultText) job.resultText = job.result; } catch {}
        const status = String(job.status || job.state || "running");
        const out = { ok: true, jobId, status };
        const rt = (job.resultText || job.result || "");
        if (rt) out.resultText = rt;
        if (job.errorMessage || job.error) out.error = String(job.errorMessage || job.error);
        if (job.chartUrl) out.chartUrl = job.chartUrl;
        if (job.quickChartSpec) out.quickChartSpec = job.quickChartSpec;
        if (job.startedAt) out.startedAt = job.startedAt;
        if (job.finishedAt) out.finishedAt = job.finishedAt;
        if (job.quota) out.quota = job.quota;
        return jsonResponse(out);
      }

if (pathIncludes(url.pathname, "/telegram/")) {
        const parts = url.pathname.split("/").filter(Boolean);
        const tIdx = parts.indexOf("telegram");
        const secret = tIdx >= 0 ? (parts[tIdx + 1] || "") : "";
        if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== String(env.TELEGRAM_WEBHOOK_SECRET)) {
          return new Response("forbidden", { status: 403 });
        }
        if (request.method !== "POST") return new Response("method not allowed", { status: 405 });

        const update = await request.json().catch(() => null);
        if (!update) return new Response("bad request", { status: 400 });

        ctx.waitUntil(handleUpdate(update, env));
        return new Response("ok", { status: 200 });
      }

      return new Response("not found", { status: 404 });
     } catch (e) {
      console.error("fetch error:", e);
      // Return JSON for API callers so the UI can show a meaningful error.
      try {
        const p = new URL(request.url).pathname || "";
        const debug = String(env?.WEB_DEBUG_ERRORS || "") === "1" || String(request.headers.get("x-iqm-debug") || "") === "1";
        if (p.startsWith("/api/") || p.includes("/telegram/")) {
          return jsonResponse({ ok: false, error: "internal_error", detail: debug ? String(e?.message || e) : undefined }, 500);
        }
      } catch {}
      return new Response("error", { status: 500 });
    }
  },
  async queue(batch, env, ctx) {
    for (const message of batch.messages) {
      try {
        const kind = String(message?.body?.kind || "analysis_v1");
        if (kind === "miniapp_analysis_v1") {
          await processMiniappAnalysisQueueMessage(env, message.body);
        } else {
          await processAnalysisQueueMessage(env, message.body);
        }
        message.ack();
      } catch (e) {
        console.error("queue analysis job error:", e);
        try { message.retry({ delaySeconds: 10 }); } catch {}
      }
    }
  },
async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try { await runDailySuggestions(env); } catch (e) { console.error("runDailySuggestions error:", e); }
      try { await runDailyProfileNotifications(env); } catch (e) { console.error("runDailyProfileNotifications error:", e); }
    })());
  },
};

 
const MINIAPP_EXEC_CHECKLIST_TEXT = [
  "✅ دامنه را در BotFather > Bot Settings > Domain ثبت کن",
  "✅ Menu Button را روی MINIAPP_URL تنظیم کن",
  "✅ Worker با RootPath درست Deploy شده باشد (مثلاً /bot)",
  "✅ WEB_ADMIN_TOKEN/WEB_OWNER_TOKEN فقط برای وب (خارج تلگرام) است",
  "✅ داخل تلگرام Mini App باید initData داشته باشد",
].join("\n");

const BOT_NAME = "MarketiQ";
const WELCOME_BOT =
`🎯 متن خوش‌آمدگویی بات تلگرام MarketiQ

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
/signals
/support
────────────────────────

⚠️ سلب مسئولیت:
تمام تحلیل‌ها صرفاً جنبه آموزشی و تحلیلی دارند و مسئولیت نهایی معاملات بر عهده کاربر است.`;

const WELCOME_MINIAPP =
`👋 به MarketiQ خوش آمدید — هوش تحلیلی شما در بازارهای مالی
این مینی‌اپ برای گرفتن تحلیل سریع، تنظیمات، و مدیریت دسترسی طراحی شده است.
⚠️ تحلیل‌ها آموزشی است و مسئولیت معاملات با شماست.`;

 
const MAJORS = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD"];
const METALS = ["XAUUSD", "XAGUSD"];
const INDICES = ["DJI", "NDX", "SPX"];
const CRYPTOS = [
  "BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT",
  "ADAUSDT","DOGEUSDT","TRXUSDT","TONUSDT","AVAXUSDT",
  "LINKUSDT","DOTUSDT","MATICUSDT","LTCUSDT","BCHUSDT",
];

const BTN = {
  ANALYZE: "✅ تحلیل کن",
  SIGNAL: "📈 سیگنال‌ها",
  SETTINGS: "⚙️ تنظیمات",
  PROFILE: "👤 پروفایل",
  INVITE: "🤝 دعوت",
  SUPPORT: "🆘 پشتیبانی",
  SUPPORT_CHAT: "💬 چت با ادمین",
  SUPPORT_TICKET: "✉️ ارسال تیکت",
  SUPPORT_FAQ: "❓ سوالات آماده",
  SUPPORT_CUSTOM_PROMPT: "🧠 درخواست پرامپت اختصاصی",
  EDUCATION: "📚 آموزش",
  LEVELING: "🧪 تعیین سطح",
  BACK: "⬅️ برگشت",
  HOME: "🏠 منوی اصلی",
  MINIAPP: "🧩 مینی‌اپ",
  QUOTE: "💹 قیمت لحظه‌ای",
  NEWS: "📰 اخبار نماد",
  NEWS_ANALYSIS: "🧠 تحلیل خبر",

  WALLET: "💳 ولت",
  SUBSCRIPTION: "💎 اشتراک",

    WALLET_BALANCE: "💰 موجودی",
  WALLET_DEPOSIT: "➕ واریز",
  WALLET_WITHDRAW: "➖ برداشت",

  CAT_MAJORS: "💱 ماجورها",
  CAT_METALS: "🪙 فلزات",
  CAT_INDICES: "📊 شاخص‌ها",
  CAT_CRYPTO: "₿ کریپتو (15)",

  SET_TF: "⏱ تایم‌فریم",
  SET_STYLE: "🎯 سبک",
  SET_RISK: "⚠️ ریسک",
  SET_NEWS: "📰 خبر",
  SET_CAPITAL: "💼 سرمایه",

  REQUEST_CUSTOM_PROMPT: "🧠 درخواست پرامپت اختصاصی",
};

const TYPING_INTERVAL_MS = 4000;


const TIMEOUT_TEXT_MS = 300000;
const TIMEOUT_VISION_MS = 12000;
const TIMEOUT_POLISH_MS = 15000;

 
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function chunkText(s, size = 3500) {
  
  const max = Math.max(500, Number(size) || 3500);
  const src = String(s || "");
  if (!src) return [""];
  if (src.length <= max) return [src];

  const out = [];
  let rest = src;

  while (rest.length > max) {
    
    let cut = rest.lastIndexOf("\n\n", max);
    if (cut < Math.floor(max * 0.35)) cut = rest.lastIndexOf("\n", max);
    if (cut < Math.floor(max * 0.35)) cut = rest.lastIndexOf("۔", max);     
    if (cut < Math.floor(max * 0.35)) cut = rest.lastIndexOf(". ", max);
    if (cut < Math.floor(max * 0.35)) cut = rest.lastIndexOf(" ", max);
    if (cut < Math.floor(max * 0.35)) cut = max;

    const part = rest.slice(0, cut).trimEnd();
    out.push(part);
    rest = rest.slice(cut).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}

function timeoutPromise(ms, label = "timeout") {
  return new Promise((_, rej) => setTimeout(() => rej(new Error(label)), ms));
}

async function fetchWithTimeout(url, init, ms) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

function normalizeDigits(input) {
  const s = String(input ?? "");
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";
  let out = "";
  for (const ch of s) {
    const i1 = fa.indexOf(ch);
    if (i1 >= 0) { out += String(i1); continue; }
    const i2 = ar.indexOf(ch);
    if (i2 >= 0) { out += String(i2); continue; }
    out += ch;
  }
  return out;
}

function toInt(v, d) {
  // NOTE: Number("") === 0, so we must treat null/undefined/empty as "missing" and use default.
  if (v === null || v === undefined) return d;
  const s = String(normalizeDigits(v)).trim();
  if (!s) return d;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : d;
}

function normHandle(h) {
  if (!h) return "";
  return "@" + String(h).replace(/^@/, "").toLowerCase();
}

function inferLocaleByPhone(phone) {
  const p = String(phone || "").replace(/[^+\d]/g, "");
  const map = [
    { prefix: "+98", country: "IR", lang: "fa", tz: "Asia/Tehran" },
    { prefix: "+971", country: "AE", lang: "ar", tz: "Asia/Dubai" },
    { prefix: "+90", country: "TR", lang: "tr", tz: "Europe/Istanbul" },
    { prefix: "+7", country: "RU", lang: "ru", tz: "Europe/Moscow" },
    { prefix: "+44", country: "GB", lang: "en", tz: "Europe/London" },
    { prefix: "+1", country: "US", lang: "en", tz: "America/New_York" },
  ];
  for (const x of map) if (p.startsWith(x.prefix)) return x;
  if (p.startsWith("09") || p.startsWith("98")) return { country: "IR", lang: "fa", tz: "Asia/Tehran" };
  return { country: "INT", lang: "en", tz: "UTC" };
}

function applyLocaleDefaults(st, env) {
  const loc = inferLocaleByPhone(st?.profile?.phone || "");
  st.profile = st.profile || {};
  st.profile.language = st.profile.language || loc.lang;
  st.profile.countryCode = st.profile.countryCode || loc.country;
  st.profile.timezone = st.profile.timezone || loc.tz;

  const policy = localePolicy(st.profile.language, st.profile.countryCode);
  if (!st.timeframe) st.timeframe = policy.timeframe;
  if (!st.risk) st.risk = policy.risk;
  if (!st.style) st.style = policy.style;
  if (st.profile.preferredStyle && ALLOWED_STYLE_LIST.includes(st.profile.preferredStyle)) {
    st.style = st.profile.preferredStyle;
  }
  if (typeof st.newsEnabled !== "boolean") st.newsEnabled = true;
  if (!st.promptMode) st.promptMode = "style_plus_custom";
  const strictStyleOnly = String((env && env.STRICT_STYLE_ONLY != null) ? env.STRICT_STYLE_ONLY : "1") === "1";
  if (strictStyleOnly) {
    st.polishOrder = '';
    st.promptMode = 'style_only';
    st.customPromptId = '';
  }
  return st;
}

function localePolicy(language = "fa", country = "IR") {
  const lang = String(language || "fa").toLowerCase();
  const c = String(country || "IR").toUpperCase();
  if (c === "IR") return { timeframe: "H1", risk: "متوسط", style: "پرایس اکشن" };
  if (lang.startsWith("ar")) return { timeframe: "H1", risk: "متوسط", style: "پرایس اکشن" };
  if (lang.startsWith("tr") || lang.startsWith("ru")) return { timeframe: "H4", risk: "متوسط", style: "ICT" };
  return { timeframe: "H4", risk: "medium", style: "پرایس اکشن" };
}

function applyLocaleFromTelegramUser(st, fromLike = {}) {
  st.profile = st.profile || {};
  const langRaw = String(fromLike?.language_code || "").trim().toLowerCase();
  if (!st.profile.language && langRaw) st.profile.language = langRaw.split("-")[0];
  if (!st.profile.countryCode && langRaw.includes("-")) st.profile.countryCode = langRaw.split("-")[1].toUpperCase();
  if (!st.profile.countryCode) st.profile.countryCode = st.profile.language === "fa" ? "IR" : "INT";
  if (!st.profile.timezone) {
    const tzMap = { fa: "Asia/Tehran", ar: "Asia/Riyadh", tr: "Europe/Istanbul", ru: "Europe/Moscow", en: "UTC" };
    st.profile.timezone = tzMap[st.profile.language] || "UTC";
  }
  const policy = localePolicy(st.profile.language, st.profile.countryCode);
  if (!st.timeframe) st.timeframe = policy.timeframe;
  if (!st.risk) st.risk = policy.risk;
  if (!st.style) st.style = policy.style;
}

async function finalizeOnboardingRewards(env, st, opts = {}) {
  // Award referral points as soon as the user provides a NEW phone number (Share Contact / manual entry)
  if (!st?.referral?.referredBy || !st?.referral?.referredByCode) return { ok: false, reason: "no_referral" };
  if (st?.referral?.onboardingRewardDone) return { ok: false, reason: "already_rewarded" };

  const phone = normalizePhone(st.profile?.phone || "");
  if (!phone) return { ok: false, reason: "no_phone" };
  st.profile.phone = phone;

  // Duplicate phone (already used by another account) => no referral reward
  const ownerId = await getPhoneOwner(env, phone);
  if (ownerId && String(ownerId) !== String(st.userId)) {
    st.referral.onboardingRewardDone = true;
    st.referral.onboardingRewardAt = new Date().toISOString();
    return { ok: false, reason: "duplicate_phone", ownerId };
  }

  // Mark phone as seen for this user (first-time only)
  if (!ownerId) {
    await markPhoneSeen(env, phone, st.userId);
  }

  const tiers = parseReferralTierPoints(env); // e.g. "6,2,1" => [6,2,1] (default: [6])
  let inviterId = String(st.referral.referredBy || "");
  const visited = new Set([String(st.userId)]);
  let anyReward = false;

  for (let level = 0; level < tiers.length; level++) {
    const gain = Number(tiers[level] || 0);
    if (!inviterId || !gain) break;
    if (visited.has(inviterId)) break;
    visited.add(inviterId);

    const inviter = await ensureUser(inviterId, env);
    ensurePoints(inviter);

    inviter.points.balance = Number(inviter.points.balance || 0) + gain;
    inviter.points.earnedFromInvites = Number(inviter.points.earnedFromInvites || 0) + gain;

    inviter.referral = inviter.referral || {};
    if (level === 0) inviter.referral.successfulInvites = Number(inviter.referral.successfulInvites || 0) + 1;

    inviter.referral.invitesByLevel = inviter.referral.invitesByLevel || {};
    const k = `L${level + 1}`;
    inviter.referral.invitesByLevel[k] = Number(inviter.referral.invitesByLevel[k] || 0) + 1;

    const redeemed = maybeRedeemFreeProFromPoints(inviter, env);
    await saveUser(inviterId, inviter, env);

    anyReward = true;

    if (opts?.notify !== false) {
      try {
        const thr = proRedeemThreshold(env);
        const msg =
          (level === 0)
            ? `🎁 یک دعوت موفق ثبت شد!\n+${gain} امتیاز به حساب شما اضافه شد.\n\nامتیاز فعلی: ${inviter.points.balance}\nهر ۲ امتیاز = ۱ تحلیل\nهر ${thr} امتیاز = ۳۰ روز اشتراک پرو رایگان`
            : `🎁 امتیاز رفرال سطح ${level + 1}\n+${gain} امتیاز به حساب شما اضافه شد.\nامتیاز فعلی: ${inviter.points.balance}`;
        await tgSendMessage(env, Number(inviterId), msg, mainMenuKeyboard(env));
        if (redeemed > 0) {
          await tgSendMessage(env, Number(inviterId), `✅ ${redeemed} اشتراک پرو رایگان (۳۰ روزه) برایت فعال/تمدید شد.`, mainMenuKeyboard(env));
        }
      } catch (e) {}
    }

    inviterId = inviter?.referral?.referredBy ? String(inviter.referral.referredBy) : "";
  }

  st.referral.onboardingRewardDone = true;
  st.referral.onboardingRewardAt = new Date().toISOString();
  return { ok: true, rewarded: anyReward };
}

function isStaff(from, env) {
  // Staff can be detected either by configured handles OR by an explicit role hint
  // (e.g., when using WEB_OWNER_TOKEN / WEB_ADMIN_TOKEN outside Telegram).
  const rh = String(from?.roleHint || from?.role || from?.staffRole || "").toLowerCase();
  if (rh === "owner" || rh === "admin") return true;

  return isOwner(from, env) || isAdmin(from, env);
}


function isFreePro(st) {
  return !!(st?.subscription?.active && (st.subscription.type === "gift" || st.subscription.type === "free_pro"));
}
function ensurePoints(st) {
  if (!st.points) st.points = { balance: 0, spent: 0, earnedFromInvites: 0, initialized: false };
  st.points.balance = Number.isFinite(Number(st.points.balance)) ? Number(st.points.balance) : 0;
  st.points.spent = Number.isFinite(Number(st.points.spent)) ? Number(st.points.spent) : 0;
  st.points.earnedFromInvites = Number.isFinite(Number(st.points.earnedFromInvites)) ? Number(st.points.earnedFromInvites) : 0;
  if (typeof st.points.initialized !== "boolean") st.points.initialized = false;
  return st;
}
function hasUnlimitedAnalyses(st, fromLike, env) {
  // Admin/Owner unlimited
  if (isStaff(fromLike, env)) return true;
  // Any active subscription = unlimited (Pro / Gift / Free-Pro)
  if (st?.subscription?.active) return true;
  return false;
}
function canSpendAnalysisPoints(st, fromLike, env) {
  ensurePoints(st);
  const cost = Number(env.ANALYSIS_POINTS_COST || 2);
  const balance = Number(st.points.balance || 0);

  if (hasUnlimitedAnalyses(st, fromLike, env)) {
    return { ok: true, cost: 0, balance, unlimited: true };
  }

  if (balance < cost) return { ok: false, reason: "insufficient_points", cost, balance };
  return { ok: true, cost, balance };
}
function spendAnalysisPoints(st, env) {
  // Only Free users spend points. (Pro/Staff are unlimited.)
  if (st?.subscription?.active) return;
  ensurePoints(st);
  const cost = Number(env.ANALYSIS_POINTS_COST || 2);
  const bal = Number(st.points.balance || 0);
  st.points.balance = Math.max(0, bal - cost);
  st.points.spent = (Number(st.points.spent || 0) + cost);
}
function awardInvitePoints(inviter, gain, env) {
  // Backward-compatible helper: add points and auto-redeem free pro if threshold reached.
  const g = Number(gain || 0);
  if (!g || !Number.isFinite(g) || g <= 0) return 0;
  ensurePoints(inviter);
  inviter.points.balance = Number(inviter.points.balance || 0) + g;
  inviter.points.earnedFromInvites = Number(inviter.points.earnedFromInvites || 0) + g;
  return maybeRedeemFreeProFromPoints(inviter, env);
}
function isOwner(from, env) {
  const u = normHandle(from?.username);
  if (!u) return false;
  const raw = (env.OWNER_HANDLES || "").toString().trim();
  if (!raw) return false;
  const set = new Set(raw.split(",").map(normHandle).filter(Boolean));
  return set.has(u);
}

function isAdmin(from, env) {
  const u = normHandle(from?.username);
  if (!u) return false;
  const raw = (env.ADMIN_HANDLES || "").toString().trim();
  if (!raw) return false;
  const set = new Set(raw.split(",").map(normHandle).filter(Boolean));
  return set.has(u);
}

function firstHandleFromCsv(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  return s.split(",").map((x) => normHandle(x)).filter(Boolean)[0] || "";
}


function kyivDateString(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function parseOrder(raw, fallbackArr) {
  const s = (raw || "").toString().trim();
  if (!s) return fallbackArr;
  // Accept comma/newline/semicolon-separated lists for easier env configuration.
  return s.split(/[\n\r,;]+/).map(x => x.trim().toLowerCase()).filter(Boolean);
}

// Normalize/alias provider names (backward-compat)
function normalizeTextProviderName(name) {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return "";
  // common typo / legacy
  if (n === "aiacc" || n === "aic" || n === "ai.cc" || n === "ai-cc") return "aicc";
  return n;
}


function detectMimeFromHeaders(resp, fallback = "image/jpeg") {
  const ct = resp.headers.get("content-type") || "";
  if (ct.startsWith("image/")) return ct.split(";")[0].trim();
  return fallback;
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function randomCode(len = 10) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

const MARKET_CACHE = new Map();
const ANALYSIS_CACHE = new Map();
const MARKET_PROVIDER_FAIL_UNTIL = new Map();
const PROVIDER_FAILURE_COUNT = new Map();

function providerInCooldown(provider) {
  const key = String(provider || "").toLowerCase();
  if (!key) return false;
  const until = Number(MARKET_PROVIDER_FAIL_UNTIL.get(key) || 0);
  if (!until) return false;
  if (Date.now() >= until) {
    MARKET_PROVIDER_FAIL_UNTIL.delete(key);
    return false;
  }
  return true;
}

function markProviderSuccess(provider, _scope) {
  const key = String(provider || "").toLowerCase();
  if (!key) return;
  MARKET_PROVIDER_FAIL_UNTIL.delete(key);
  PROVIDER_FAILURE_COUNT.delete(key);
}

function markProviderFailure(provider, env, _scope) {
  const key = String(provider || "").toLowerCase();
  if (!key) return;
  const fails = Number(PROVIDER_FAILURE_COUNT.get(key) || 0) + 1;
  PROVIDER_FAILURE_COUNT.set(key, fails);

  const baseMs = Number(env?.PROVIDER_COOLDOWN_BASE_MS || 5000);
  const maxMs = Number(env?.PROVIDER_COOLDOWN_MAX_MS || 120000);
  const cooldownMs = Math.min(maxMs, baseMs * Math.min(16, 2 ** Math.max(0, fails - 1)));
  MARKET_PROVIDER_FAIL_UNTIL.set(key, Date.now() + cooldownMs);
}

function cacheGet(map, key) {
  const hit = map.get(key);
  if (!hit) return null;
  if (hit.expiresAt && hit.expiresAt <= Date.now()) {
    map.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(map, key, value, ttlMs, maxSize = 500) {
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
  if (map.size > maxSize) {
    const [first] = map.keys();
    if (first) map.delete(first);
  }
}

function hash32FNV1a(str) {
  const s = String(str || "");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

async function r2GetJson(bucket, key) {
  if (!bucket) return null;
  const obj = await bucket.get(key);
  if (!obj) return null;
  try { return await obj.json(); } catch { return null; }
}

async function r2PutJson(bucket, key, value, ttlMs) {
  if (!bucket) return;
  const body = JSON.stringify({ value, expiresAt: Date.now() + ttlMs });
  await bucket.put(key, body, {
    httpMetadata: { contentType: "application/json" },
    customMetadata: { ttlMs: String(ttlMs || "") },
  });
}

async function getCachedR2Value(bucket, key) {
  const payload = await r2GetJson(bucket, key);
  if (!payload) return null;
  if (payload.expiresAt && payload.expiresAt <= Date.now()) return null;
  return payload.value;
}

async function getCachedR2ValueAllowStale(bucket, key) {
  const payload = await r2GetJson(bucket, key);
  if (!payload) return null;
  return payload.value;
}

 
const DEFAULT_ANALYSIS_PROMPT = `SYSTEM: تحلیل‌گر حرفه‌ای بازار

قوانین قطعی:
1) خروجی نهایی فقط فارسی باشد.
2) فقط بر اساس STYLE_PROMPT_JSON (سبک انتخابی کاربر) تحلیل کن.
3) فقط از داده MARKET_DATA استفاده کن و خیال‌پردازی نکن.
4) ورودی‌های کاربر را الزامی لحاظ کن: Symbol, Timeframe, Risk, Capital.
5) خروجی را مرحله‌ای، اجرایی و با مدیریت ریسک ارائه بده.
6) در صورت نبود داده کافی، شفاف اعلام کن.
7)خیال پردازی نکن
8)عدد کندل ها را نگو
ساختار خروجی:
۱) بایاس و وضعیت ساختار
۲) نواحی و نقدینگی/سطوح کلیدی
۳) سناریوی ورود (Entry/SL/TP)
۴) مدیریت ریسک و اندازه پوزیشن
۵) سناریوی ابطال و جمع‌بندی اجرایی

فرمول مدیریت سرمایه (برای محاسبه اندازه پوزیشن):
- اندازه پوزیشن = (درصد ریسک مثال: 0.01 برای ۱٪) ÷ حدضرر (به پوینت/پیپ) × سرمایه کل
- حتماً «حدضرر به پوینت/پیپ» را صریح محاسبه کن و مرحله‌به‌مرحله عددگذاری را نشان بده.
`;

const GLOBAL_MONEY_MANAGEMENT_FORMULA = `MONEY_MANAGEMENT_FORMULA:
- Position Size / Risk = (RiskPercent مثال: 0.01) ÷ StopLossPipsOrPoints × Capital
- این فرمول را در بخش «مدیریت ریسک و اندازه پوزیشن» استفاده کن و مراحل محاسبه را شفاف بنویس.
`;






const STYLE_PROMPTS_DEFAULT = {
  "پرایس اکشن": `{
  "role": "system",
  "description": "Professional Price Action Market Analysis Prompt",
  "constraints": {
    "analysis_style": "Pure Price Action Only",
    "indicators": "Forbidden unless explicitly requested",
    "focus": "High-probability setups only",
    "language": "Professional, clear, step-by-step"
  },
  "required_sections": {
    "market_structure": {
      "items": [
        "Trend identification (Uptrend / Downtrend / Range)",
        "HH, HL, LH, LL labeling",
        "Structure status (Intact / BOS / MSS)"
      ]
    },
    "key_levels": {
      "items": [
        "Strong Support zones",
        "Strong Resistance zones",
        "Flip zones (SR to Resistance / Resistance to Support)",
        "Psychological levels (if relevant)"
      ]
    },
    "candlestick_behavior": {
      "items": [
        "Pin Bar",
        "Engulfing",
        "Inside Bar",
        "Explanation of buyer/seller intent"
      ]
    },
    "entry_scenarios": {
      "requirements": [
        "Clear entry zone",
        "Logical structure-based Stop Loss",
        "TP1 and TP2 targets",
        "Minimum Risk:Reward of 1:2"
      ]
    },
    "bias_and_scenarios": {
      "items": [
        "Main bias (Bullish / Bearish / Neutral)",
        "Alternative scenario upon invalidation"
      ]
    },
    "execution_plan": {
      "items": [
        "Continuation or Reversal trade",
        "Required confirmation before entry"
      ]
    }
  },
  "instructions": [
    "Explain everything step-by-step",
    "Use structure-based logic",
    "Avoid overtrading",
    "Execution-focused explanations"
  ]
}`,
  "ICT": `{
  "role": "system",
  "identity": {
    "title": "ICT & Smart Money Analyst",
    "methodology": [
      "ICT (Inner Circle Trader)",
      "Smart Money Concepts"
    ],
    "restrictions": [
      "No indicators",
      "No retail concepts",
      "ICT & Smart Money concepts ONLY"
    ]
  },
  "task": {
    "description": "Analyze the requested market (Symbol, Timeframe) using ICT & Smart Money Concepts ONLY."
  },
  "analysis_requirements": {
    "1_higher_timeframe_bias": {
      "timeframes": [
        "Daily",
        "H4"
      ],
      "elements": [
        "Overall HTF bias (Bullish / Bearish / Neutral)",
        "Premium zone",
        "Discount zone",
        "Equilibrium level (50%)",
        "Imbalance vs Balance state"
      ]
    },
    "2_liquidity_mapping": {
      "identify": [
        "Equal Highs (EQH)",
        "Equal Lows (EQL)",
        "Buy-side liquidity",
        "Sell-side liquidity",
        "Stop-loss pools"
      ],
      "objective": "Determine where liquidity is resting and likely to be engineered toward"
    },
    "3_market_structure": {
      "elements": [
        "BOS (Break of Structure)",
        "MSS / CHoCH (Market Structure Shift)"
      ],
      "clarification": [
        "Manipulation phase",
        "Expansion phase"
      ]
    },
    "4_pd_arrays": {
      "arrays": [
        "Bullish Order Blocks",
        "Bearish Order Blocks",
        "Fair Value Gaps (FVG)",
        "Liquidity Voids",
        "Previous Day High (PDH)",
        "Previous Day Low (PDL)",
        "Previous Week High (PWH)",
        "Previous Week Low (PWL)"
      ]
    },
    "5_kill_zones": {
      "condition": "Intraday only",
      "zones": [
        "London Kill Zone",
        "New York Kill Zone"
      ],
      "explanation": "Explain why timing matters for this setup"
    },
    "6_entry_model": {
      "model_examples": [
        "Liquidity Sweep → MSS → FVG Entry",
        "Liquidity Sweep → Order Block Entry"
      ],
      "must_include": [
        "Entry price",
        "Stop Loss location (above/below OB or swing)",
        "Take Profit targets based on liquidity"
      ]
    },
    "7_narrative": {
      "storytelling": [
        "Who is trapped?",
        "Where did smart money enter?",
        "Where is price likely engineered to go?"
      ]
    }
  },
  "execution_plan": {
    "bias": "Bullish or Bearish",
    "entry_conditions": "Clear confirmation rules",
    "targets": "Liquidity-based targets",
    "invalidation_point": "Price level that invalidates the idea"
  },
  "output_style": {
    "tone": "Professional, precise, educational",
    "structure": "Step-by-step, clearly labeled sections",
    "language": "Clear and technical ICT terminology"
  }
}`,
  "ATR": `{
  "role": "quantitative_trading_assistant",
  "strategy": "ATR-based volatility trading",
  "analysis_requirements": {
    "volatility_state": [
      "Current ATR value",
      "Comparison with historical ATR average",
      "Volatility expansion or contraction"
    ],
    "market_condition": [
      "Trending or Ranging",
      "Breakout vs Mean Reversion suitability"
    ],
    "trade_setup": {
      "entry": "Based on price structure",
      "stop_loss": "SL = Entry ± (ATR × Multiplier)",
      "take_profit": [
        "TP1 based on ATR expansion",
        "TP2 based on ATR expansion"
      ]
    },
    "position_sizing": [
      "Risk per trade (%)",
      "Position size based on SL distance"
    ],
    "trade_filtering": [
      "When NOT to trade based on ATR",
      "High-risk volatility conditions (news, spikes)"
    ],
    "risk_management": [
      "Max daily loss",
      "Max consecutive losses",
      "ATR-based trailing stop logic"
    ],
    "summary": [
      "Statistical justification",
      "Expected trade duration",
      "Risk classification (Low/Medium/High)"
    ]
  }
}`
};
const DEFAULT_CUSTOM_PROMPTS = [
  { id: "ict_style", title: "ICT & Smart Money", text: STYLE_PROMPTS_DEFAULT["ICT"] },
  { id: "atr_style", title: "ATR Volatility", text: STYLE_PROMPTS_DEFAULT["ATR"] },
  { id: "price_action_style", title: "Price Action", text: STYLE_PROMPTS_DEFAULT["پرایس اکشن"] },
];


function normalizeStyleLabel(style) {
  const s = String(style || "").trim();
  if (!s) return "";
  const low = s.toLowerCase();
  
  if (/(^|[^a-z])ict([^a-z]|$)/i.test(low) || low.includes("اسمارت") || low.includes("smart money")) return "ICT";
  if (/(^|[^a-z])atr([^a-z]|$)/i.test(low) || low.includes("volatility") || low.includes("نوسان")) return "ATR";
  if (low.includes("price") || low.includes("action") || low.includes("پرایس") || low.includes("اکشن")) return "پرایس اکشن";
  return s;
}

function getStyleGuide(style) {
  const key = normalizeStyleLabel(style);
  return STYLE_PROMPTS_DEFAULT[key] || "";
}


async function getAnalysisPrompt(env) {
  const kv = env.BOT_KV;
  if (!kv) return DEFAULT_ANALYSIS_PROMPT;
  const p = await kv.get("settings:analysis_prompt");
  return (p && p.trim()) ? p : DEFAULT_ANALYSIS_PROMPT;
}

async function getBotWelcomeText(env) {
  if (!env.BOT_KV) return WELCOME_BOT;
  const raw = await env.BOT_KV.get("settings:welcome_bot");
  return (raw && raw.trim()) ? raw : WELCOME_BOT;
}

async function setBotWelcomeText(env, text) {
  if (!env.BOT_KV) return;
  await env.BOT_KV.put("settings:welcome_bot", String(text || "").trim());
}

async function getMiniappWelcomeText(env) {
  if (!env.BOT_KV) return WELCOME_MINIAPP;
  const raw = await env.BOT_KV.get("settings:welcome_miniapp");
  return (raw && raw.trim()) ? raw : WELCOME_MINIAPP;
}

async function setMiniappWelcomeText(env, text) {
  if (!env.BOT_KV) return;
  await env.BOT_KV.put("settings:welcome_miniapp", String(text || "").trim());
}

 
function styleKey(style) {
  return String(style || "").trim().toLowerCase().replace(/\s+/g, "_");
}
async function getStylePrompt(env, style) {
  const map = await getStylePromptMap(env);
  const key = normalizeStyleLabel(style);
  return (map?.[styleKey(key)] || STYLE_PROMPTS_DEFAULT[key] || "").toString().trim();
}
async function setStylePrompt(env, style, prompt) {
  if (!env.BOT_KV) return;
  const map = await getStylePromptMap(env);
  map[styleKey(style)] = String(prompt || "");
  await setStylePromptMap(env, map);
}

async function getStylePromptMap(env) {
  // Load style prompts from KV (same source as bot) and merge with defaults
  let kvMap = {};
  try {
    if (env.BOT_KV) {
      const raw = await env.BOT_KV.get("settings:style_prompts_json");
      if (raw && String(raw).trim()) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") kvMap = parsed;
      }
    }
  } catch {}

  const out = {};
  try {
    for (const k of Object.keys(STYLE_PROMPTS_DEFAULT || {})) {
      out[styleKey(k)] = String(STYLE_PROMPTS_DEFAULT[k] || "");
    }
  } catch {}

  try {
    for (const [k, v] of Object.entries(kvMap || {})) {
      out[styleKey(k)] = String(v == null ? "" : v);
    }
  } catch {}

  return out;
}


async function setStylePromptMap(env, map) {
  if (!env.BOT_KV) return;
  const payload = map && typeof map === "object" ? map : {};
  await env.BOT_KV.put("settings:style_prompts_json", JSON.stringify(payload));
}

async function getCustomPrompts(env) {
  if (!env.BOT_KV) return DEFAULT_CUSTOM_PROMPTS.slice();
  const raw = await env.BOT_KV.get("settings:custom_prompts");
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return (Array.isArray(parsed) && parsed.length) ? parsed : DEFAULT_CUSTOM_PROMPTS.slice();
  } catch {
    return DEFAULT_CUSTOM_PROMPTS.slice();
  }
}

async function setCustomPrompts(env, prompts) {
  if (!env.BOT_KV) return;
  const clean = Array.isArray(prompts) ? prompts : [];
  await env.BOT_KV.put("settings:custom_prompts", JSON.stringify(clean));
}

async function getFreeDailyLimit(env) {
  if (!env.BOT_KV) return 3;
  const raw = await env.BOT_KV.get("settings:free_daily_limit");
  return toInt(raw, 3);
}

async function setFreeDailyLimit(env, limit) {
  if (!env.BOT_KV) return;
  await env.BOT_KV.put("settings:free_daily_limit", String(limit));
}


async function getBasePoints(env) {
  
  const fallback = 50;
  if (!env.BOT_KV) return fallback;
  const raw = await env.BOT_KV.get("settings:base_points");
  return toInt(raw, fallback);
}
async function setBasePoints(env, points) {
  if (!env.BOT_KV) return;
  await env.BOT_KV.put("settings:base_points", String(points));
}
const ALLOWED_STYLE_LIST = ["پرایس اکشن", "ICT", "ATR"];
const DEFAULT_STYLE_LIST = ALLOWED_STYLE_LIST.slice();

async function getStyleList(env) {
  const core = DEFAULT_STYLE_LIST.slice();
  if (!env.BOT_KV) return core;

  const raw = await env.BOT_KV.get("settings:style_list");
  if (!raw || !String(raw).trim()) return core;

  try {
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed.map(x => String(x || "").trim()).filter(Boolean) : [];
    const out = [];
    const seen = new Set();
    for (const s of list) {
      const n = normalizeStyleLabel(s);
      if (!n || seen.has(n)) continue;
      seen.add(n);
      out.push(n);
    }
    for (const s of core) {
      const n = normalizeStyleLabel(s);
      if (!seen.has(n)) {
        seen.add(n);
        out.push(n);
      }
    }
    return out.length ? out : core;
  } catch {
    return core;
  }
}

async function setStyleList(env, styles) {
  if (!env.BOT_KV) return;
  const clean = (Array.isArray(styles) ? styles : [])
    .map((s) => String(s || "").trim())
    .filter((s) => ALLOWED_STYLE_LIST.includes(s));
  await env.BOT_KV.put("settings:style_list", JSON.stringify(clean));
}

async function getOfferBanner(env) {
  if (!env.BOT_KV) return (env.SPECIAL_OFFER_TEXT || "").toString().trim();
  const raw = await env.BOT_KV.get("settings:offer_banner");
  return (raw || env.SPECIAL_OFFER_TEXT || "").toString().trim();
}

async function setOfferBanner(env, text) {
  if (!env.BOT_KV) return;
  await env.BOT_KV.put("settings:offer_banner", String(text || "").trim());
}

async function getOfferBannerImage(env) {
  if (!env.BOT_KV) return (env.SPECIAL_OFFER_IMAGE || "").toString().trim();
  const raw = await env.BOT_KV.get("settings:offer_banner_image");
  return (raw || env.SPECIAL_OFFER_IMAGE || "").toString().trim();
}






async function setOfferBannerImage(env, dataUrl) {
  if (!env.BOT_KV) return;
  const clean = String(dataUrl || "").trim();
  if (!clean) {
    await env.BOT_KV.delete("settings:offer_banner_image");
    return;
  }
  const isDataImage = clean.startsWith("data:image/");
  const isHttpUrl = /^https?:\/\//i.test(clean);
  if (!isDataImage && !isHttpUrl) throw new Error("bad_offer_image_format");
  if (isDataImage && clean.length > 1_500_000) throw new Error("offer_image_too_large");
  await env.BOT_KV.put("settings:offer_banner_image", clean);
}

async function getCommissionSettings(env) {
  if (!env.BOT_KV) return { globalPercent: 0, overrides: {} };
  const g = await env.BOT_KV.get("settings:commission:globalPercent");
  const o = await env.BOT_KV.get("settings:commission:overrides");
  let overrides = {};
  try { overrides = o ? JSON.parse(o) : {}; } catch { overrides = {}; }
  return {
    globalPercent: toInt(g, 0),
    overrides: overrides && typeof overrides === "object" ? overrides : {},
  };
}

async function setCommissionSettings(env, settings) {
  if (!env.BOT_KV) return;
  if (typeof settings.globalPercent === "number") {
    await env.BOT_KV.put("settings:commission:globalPercent", String(settings.globalPercent));
  }
  if (settings.overrides) {
    await env.BOT_KV.put("settings:commission:overrides", JSON.stringify(settings.overrides || {}));
  }
}

function resolveCommissionPercent(username, settings) {
  const handle = normHandle(username);
  if (!handle) return settings.globalPercent || 0;
  const raw = settings.overrides?.[handle];
  const override = Number(raw);
  if (Number.isFinite(override)) return override;
  return settings.globalPercent || 0;
}

async function updateUserIndexes(env, st) {
  const id = String(st.userId || "");
  const handle = normHandle(st.profile?.username);

  // If D1 is bound, avoid maintaining the heavy KV "users:index" list.
  // (KV PUT can hit rate limits under load.) Keep only a small username->id mapping (optional).
  if (env.BOT_DB) {
    if (env.BOT_KV && handle) {
      try {
        await env.BOT_KV.put(`users:by_username:${handle}`, id);
      } catch (e) {
        console.error("KV username index put failed:", e?.message || e);
      }
    }
    return;
  }

  if (!env.BOT_KV) return;

  const raw = await env.BOT_KV.get("users:index");
  let list = [];
  try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
  if (!Array.isArray(list)) list = [];
  if (!list.includes(id)) list.push(id);

  // Best-effort: avoid blowing up the request if KV is under pressure.
  try {
    await env.BOT_KV.put("users:index", JSON.stringify(list.slice(-2000)));
  } catch (e) {
    console.error("KV users:index put failed:", e?.message || e);
  }

  if (handle) {
    try {
      await env.BOT_KV.put(`users:by_username:${handle}`, id);
    } catch (e) {
      console.error("KV by_username put failed:", e?.message || e);
    }
  }
}


async function getUserIdByUsername(env, username) {
  const handle = normHandle(username);
  if (!handle) return "";

  // Prefer D1 exact lookup if available.
  if (env.BOT_DB) {
    try {
      const row = await env.BOT_DB
        .prepare("SELECT userId FROM users WHERE lower(json_extract(json,'$.profile.username')) = ?1 LIMIT 1")
        .bind(String(handle))
        .first();
      if (row && row.userId) return String(row.userId);
    } catch (e) {
      console.error("dbGetUserIdByUsername error:", e);
    }
  }

  if (!env.BOT_KV) return "";
  return (await env.BOT_KV.get(`users:by_username:${handle}`)) || "";
}


async function dbSearchUsers(env, q, limit = 25) {
  const out = [];
  const qq = String(q || "").trim();
  // Prefer D1 (BOT_DB) because it contains the canonical user JSON snapshots.
  if (env.BOT_DB) {
    try {
      let rows = [];
      if (!qq) {
        const r = await env.BOT_DB.prepare("SELECT userId, json, updatedAt FROM users ORDER BY updatedAt DESC LIMIT ?1").bind(Number(limit)).all();
        rows = r?.results || [];
      } else if (/^\d+$/.test(qq)) {
        const like = qq + "%";
        const r = await env.BOT_DB.prepare("SELECT userId, json, updatedAt FROM users WHERE userId LIKE ?1 ORDER BY updatedAt DESC LIMIT ?2").bind(like, Number(limit)).all();
        rows = r?.results || [];
      } else {
        const token = qq.replace(/^@/, "");
        const like = "%" + token + "%";
        const r = await env.BOT_DB.prepare("SELECT userId, json, updatedAt FROM users WHERE json LIKE ?1 ORDER BY updatedAt DESC LIMIT ?2").bind(like, Number(limit)).all();
        rows = r?.results || [];
      }
      for (const row of rows) {
        try {
          const st = row?.json ? JSON.parse(row.json) : null;
          if (!st) continue;
          out.push(pickUserSummary(st, env));
        } catch (e) {}
      }
      return out.slice(0, limit);
    } catch (e) {
      console.error("dbSearchUsers error:", e);
    }
  }

  // Fallback: KV index
  try {
    const users = await listUsers(env, limit);
    if (!qq) return users.map((u) => pickUserSummary(u, env)).slice(0, limit);
    const token = qq.replace(/^@/, "").toLowerCase();
    return users
      .filter((u) => {
        const uid = String(u.userId || "");
        const un = String(u.username || "").replace(/^@/, "").toLowerCase();
        const em = String(u.email || "").toLowerCase();
        return uid.startsWith(token) || un.includes(token) || em.includes(token);
      })
      .map((u) => pickUserSummary(u, env))
      .slice(0, limit);
  } catch {}
  return [];
}

function pickUserSummary(st, env) {
  const uid = String(st?.userId || "");
  const uname = String(st?.username || st?.from?.username || "").replace(/^@/, "");
  const pts = Number(st?.points?.balance || 0);
  const proActive = !!(st?.subscription?.active && (st.subscription.plan === "pro" || st.subscription.plan === "premium" || st.subscription.plan === "pro_plus"));
  const isStaffUser = isStaff({ username: uname }, env);
  const plan = String(st?.subscription?.plan || st?.plan || "");
  return {
    userId: uid,
    username: uname ? ("@" + uname) : "",
    points: pts,
    proActive,
    isStaff: isStaffUser,
    plan,
    createdAt: st?.createdAt || "",
    updatedAt: st?.updatedAt || ""
  };
}

async function listUsers(env, limit = 100) {
  const lim = Math.max(1, Math.min(200, Number(limit || 100)));

  // Prefer D1 when available.
  if (env.BOT_DB) {
    try {
      const r = await env.BOT_DB.prepare("SELECT json FROM users ORDER BY updatedAt DESC LIMIT ?1").bind(lim).all();
      const rows = r?.results || [];
      return rows.map(x => {
        try { return JSON.parse(x.json); } catch { return null; }
      }).filter(Boolean);
    } catch (e) {
      console.error("listUsers D1 error:", e);
    }
  }

  // Legacy KV fallback.
  if (!env.BOT_KV) return [];
  const raw = await env.BOT_KV.get("users:index");
  let list = [];
  try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
  if (!Array.isArray(list)) return [];
  const ids = list.slice(-lim);
  const users = [];
  for (const id of ids) {
    const u = await getUser(id, env);
    if (u) users.push(u);
  }
  return users;
}



// Paged + sortable user listing for admin UI.
// NOTE: User index is stored in KV under "users:index" (append-only).
// Paged + sortable user listing for admin UI.
async function listUsersPaged(env, opts) {
  const limit = Math.max(1, Math.min(100, Number(opts?.limit || 50)));
  const page = Math.max(0, Number(opts?.page || 0));
  const sort = String(opts?.sort || "recent").trim();
  const dir = String(opts?.dir || "desc").trim();

  // Prefer D1 when available (avoids KV users:index maintenance).
  if (env.BOT_DB) {
    try {
      const cntRow = await env.BOT_DB.prepare("SELECT COUNT(1) as c FROM users").first();
      const totalAll = Number(cntRow?.c || 0);

      // recent sort is cheap: do SQL paging
      if (sort === "recent" || !sort) {
        const offset = page * limit;
        const r = await env.BOT_DB
          .prepare("SELECT json FROM users ORDER BY updatedAt DESC LIMIT ?1 OFFSET ?2")
          .bind(limit, offset)
          .all();
        const users = (r?.results || []).map(x => {
          try { return JSON.parse(x.json); } catch { return null; }
        }).filter(Boolean);
        const pages = Math.ceil(totalAll / limit);
        return { users, total: totalAll, page, pages, limit, sort, truncated: false };
      }

      // For other sorts we scan a capped window and sort in JS (same behavior as KV path).
      const cap = Math.max(50, Math.min(1500, Number(env.ADMIN_USERLIST_SORT_CAP || 500)));
      const r = await env.BOT_DB
        .prepare("SELECT json FROM users ORDER BY updatedAt DESC LIMIT ?1")
        .bind(cap)
        .all();
      const parsed = (r?.results || []).map(x => {
        try { return JSON.parse(x.json); } catch { return null; }
      }).filter(Boolean);

      const rows = parsed.map((u) => {
        const pts = Number(u?.points?.balance || 0);
        const analyses = Number(u?.stats?.successfulAnalyses || 0);
        const last = String(u?.stats?.lastAnalysisAt || "");
        const createdAt = String(u?.createdAt || "");
        return { id: String(u?.userId || ""), pts, analyses, last, createdAt, u };
      }).filter((r) => r.id);

      const desc = dir !== "asc";
      const cmpNum = (a, b, key) => (desc ? (b[key] - a[key]) : (a[key] - b[key]));
      const cmpStr = (a, b, key) => (desc ? String(b[key]).localeCompare(String(a[key])) : String(a[key]).localeCompare(String(b[key])));

      if (sort === "points_desc" || sort === "points") rows.sort((a, b) => cmpNum(a, b, "pts"));
      else if (sort === "analyses_desc" || sort === "analyses") rows.sort((a, b) => cmpNum(a, b, "analyses"));
      else if (sort === "lastAnalysis_desc" || sort === "last") rows.sort((a, b) => cmpStr(a, b, "last"));
      else rows.sort((a, b) => cmpStr(a, b, "createdAt"));

      const truncated = totalAll > cap;
      const effectiveTotal = truncated ? Math.min(totalAll, cap) : totalAll;
      const pages = Math.ceil(effectiveTotal / limit);
      const start = page * limit;
      const end = start + limit;

      const users = rows.slice(start, end).map(r => r.u);
      return { users, total: totalAll, page, pages, limit, sort, truncated };
    } catch (e) {
      console.error("listUsersPaged D1 error:", e);
      // fall through to KV
    }
  }

  // Legacy KV fallback.
  if (!env.BOT_KV) return { users: [], total: 0, page, pages: 0, limit, sort, truncated: false };

  const raw = await env.BOT_KV.get("users:index");
  let list = [];
  try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
  if (!Array.isArray(list)) list = [];
  const total = list.length;

  // build id list depending on sort
  let ids = [];
  let truncated = false;

  if (sort === "recent" || !sort) {
    const end = Math.max(0, total - page * limit);
    const start = Math.max(0, end - limit);
    ids = list.slice(start, end).reverse(); // newest first
  } else {
    // For global sorts we may need to scan many users. Cap for safety.
    const cap = Math.max(50, Math.min(1500, Number(env.ADMIN_USERLIST_SORT_CAP || 500)));
    const scanIds = total <= cap ? list.slice() : list.slice(total - cap);
    if (total > cap) truncated = true;

    // fetch users with bounded concurrency
    const users = await getUsersByIds(env, scanIds);
    const rows = users.map((u) => {
      const pts = Number(u?.points?.balance || 0);
      const analyses = Number(u?.stats?.successfulAnalyses || 0);
      const last = String(u?.stats?.lastAnalysisAt || "");
      const createdAt = String(u?.createdAt || "");
      return { id: String(u?.userId || ""), pts, analyses, last, createdAt, u };
    }).filter((r) => r.id);

    const desc = dir !== "asc";
    const cmpNum = (a, b, key) => (desc ? (b[key] - a[key]) : (a[key] - b[key]));
    const cmpStr = (a, b, key) => (desc ? String(b[key]).localeCompare(String(a[key])) : String(a[key]).localeCompare(String(b[key])));

    if (sort === "points_desc" || sort === "points") rows.sort((a, b) => cmpNum(a, b, "pts"));
    else if (sort === "analyses_desc" || sort === "analyses") rows.sort((a, b) => cmpNum(a, b, "analyses"));
    else if (sort === "lastAnalysis_desc" || sort === "last") rows.sort((a, b) => cmpStr(a, b, "last"));
    else rows.sort((a, b) => cmpStr(a, b, "createdAt"));

    const start = page * limit;
    const end = start + limit;
    ids = rows.slice(start, end).map((r) => r.id);
  }

  const users = await getUsersByIds(env, ids);
  const pages = Math.ceil((truncated ? Math.min(total, Math.max(50, Math.min(1500, Number(env.ADMIN_USERLIST_SORT_CAP || 500)))) : total) / limit);
  return { users, total, page, pages, limit, sort, truncated };
}


async function getUsersByIds(env, ids) {
  const out = [];
  if (!env.BOT_KV) return out;
  const batchSize = 20;
  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    const items = await Promise.all(chunk.map((id) => getUser(String(id), env).catch(() => null)));
    for (const u of items) if (u) out.push(u);
  }
  return out;
}

function isStaffUser(st, env) {
  // staff by userId/username lists
  try {
    const uid = String(st?.userId || "");
    const uname = String(st?.profile?.username || "").replace(/^@/, "").toLowerCase();
    if (uid && (String(env.OWNER_ID || "") === uid || String(env.ADMIN_ID || "") === uid)) return true;
    // support multiple admin ids
    const adminIds = String(env.ADMIN_IDS || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (uid && adminIds.includes(uid)) return true;
    const ownerIds = String(env.OWNER_IDS || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (uid && ownerIds.includes(uid)) return true;
    // username-based staff
    const adminUsers = String(env.ADMIN_USERNAMES || "").split(",").map((x) => x.trim().replace(/^@/, "").toLowerCase()).filter(Boolean);
    const ownerUsers = String(env.OWNER_USERNAMES || "").split(",").map((x) => x.trim().replace(/^@/, "").toLowerCase()).filter(Boolean);
    if (uname && (adminUsers.includes(uname) || ownerUsers.includes(uname))) return true;
  } catch (e) {}
  return false;
}
async function storePayment(env, payment) {
  if (!env.BOT_KV) return;
  await env.BOT_KV.put(`payment:${payment.id}`, JSON.stringify(payment));

  const raw = await env.BOT_KV.get("payments:index");
  let list = [];
  try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
  if (!Array.isArray(list)) list = [];
  if (!list.includes(payment.id)) list.push(payment.id);
  await env.BOT_KV.put("payments:index", JSON.stringify(list.slice(-500)));
}

async function listPayments(env, limit = 50) {
  if (!env.BOT_KV) return [];
  const raw = await env.BOT_KV.get("payments:index");
  let list = [];
  try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
  if (!Array.isArray(list)) return [];
  const ids = list.slice(-limit);
  const out = [];
  for (const id of ids) {
    const rawPay = await env.BOT_KV.get(`payment:${id}`);
    if (rawPay) {
      try { out.push(JSON.parse(rawPay)); } catch {}
    }
  }
  return out.sort((a, b) => (b?.createdAt || "").localeCompare(a?.createdAt || ""));
}


function roundMoney(n){
  const x = Number(n || 0);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

function calcReferralCommission(amount, percent = 10){
  const a = Number(amount || 0);
  const p = Number(percent || 0);
  if (!Number.isFinite(a) || a <= 0) return 0;
  if (!Number.isFinite(p) || p <= 0) return 0;
  return roundMoney(a * (p / 100));
}

// Apply 10% referral commission for a subscription payment (when approved).
// Commission becomes withdrawable for inviter (admin payout later).
async function applyReferralCommissionForPayment(env, buyerState, payment, amount, nowIso){
  try{
    if (!buyerState?.referral?.referredBy) return null;
    if (payment && payment.commission && Number(payment.commission.amount || 0) > 0) return payment.commission;

    const inviterId = String(buyerState.referral.referredBy || "").trim();
    if (!inviterId) return null;

    const inviter = await ensureUser(inviterId, env);
    inviter.referral = inviter.referral || {};
    inviter.referral.commissionTotal = roundMoney(inviter.referral.commissionTotal || 0);
    inviter.referral.commissionBalance = roundMoney(inviter.referral.commissionBalance || 0);
    inviter.referral.commissionPending = roundMoney(inviter.referral.commissionPending || 0);
    inviter.referral.commissionPaid = roundMoney(inviter.referral.commissionPaid || 0);

    const pct = 10; // fixed 10% per requirement
    const reward = calcReferralCommission(amount, pct);
    if (reward <= 0) return null;

    inviter.referral.commissionTotal = roundMoney((inviter.referral.commissionTotal || 0) + reward);
    inviter.referral.commissionBalance = roundMoney((inviter.referral.commissionBalance || 0) + reward);

    await saveUser(inviter.userId, inviter, env);

    if (payment) {
      payment.commission = { inviterId: inviter.userId, percent: pct, amount: reward };
      payment.commissionAppliedAt = nowIso || new Date().toISOString();
    }
    return payment?.commission || null;
  }catch(e){
    console.error("applyReferralCommissionForPayment error:", e);
    return null;
  }
}

// ---- Commission withdrawals (referral earnings) ----
async function storeCommissionWithdrawal(env, w){
  if (!env.BOT_KV) return;
  await env.BOT_KV.put(`cwithdraw:${w.id}`, JSON.stringify(w));
  const raw = await env.BOT_KV.get("cwithdraw:index");
  let list = [];
  try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
  if (!Array.isArray(list)) list = [];
  if (!list.includes(w.id)) list.push(w.id);
  await env.BOT_KV.put("cwithdraw:index", JSON.stringify(list.slice(-1500)));
}

async function listCommissionWithdrawals(env, limit = 50){
  if (!env.BOT_KV) return [];
  const raw = await env.BOT_KV.get("cwithdraw:index");
  let list = [];
  try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
  if (!Array.isArray(list)) return [];
  const ids = list.slice(-Number(limit));
  const out = [];
  for (const id of ids){
    const r = await env.BOT_KV.get(`cwithdraw:${id}`);
    if (!r) continue;
    try { out.push(JSON.parse(r)); } catch {}
  }
  return out.sort((a,b)=>String(b?.createdAt||"").localeCompare(String(a?.createdAt||"")));
}

async function getCommissionWithdrawal(env, id){
  if (!env.BOT_KV) return null;
  const raw = await env.BOT_KV.get(`cwithdraw:${id}`);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function reviewCommissionWithdrawal(env, id, decision, txHash, reviewer){
  if (!env.BOT_KV) throw new Error("bot_kv_missing");
  const w = await getCommissionWithdrawal(env, id);
  if (!w) throw new Error("not_found");
  const prev = String(w.status || "pending");
  const nowIso = new Date().toISOString();

  if (!['approved','rejected'].includes(decision)) throw new Error("bad_decision");

  // Update inviter balances
  const userId = String(w.userId || "");
  if (userId) {
    const st = await ensureUser(userId, env);
    st.referral = st.referral || {};
    st.referral.commissionBalance = roundMoney(st.referral.commissionBalance || 0);
    st.referral.commissionPending = roundMoney(st.referral.commissionPending || 0);
    st.referral.commissionPaid = roundMoney(st.referral.commissionPaid || 0);

    const amt = roundMoney(w.amount || 0);

    // only adjust on first decision
    if (prev === 'pending') {
      if (decision === 'approved') {
        st.referral.commissionPending = roundMoney((st.referral.commissionPending || 0) - amt);
        st.referral.commissionPaid = roundMoney((st.referral.commissionPaid || 0) + amt);
      } else if (decision === 'rejected') {
        st.referral.commissionPending = roundMoney((st.referral.commissionPending || 0) - amt);
        st.referral.commissionBalance = roundMoney((st.referral.commissionBalance || 0) + amt);
      }
      await saveUser(userId, st, env);
    }
  }

  w.status = decision;
  w.reviewedAt = nowIso;
  w.reviewedBy = normHandle(reviewer?.username);
  if (decision === 'approved') {
    w.txHash = String(txHash || '').trim();
    w.paidAt = nowIso;
  }
  if (decision === 'rejected') {
    w.txHash = '';
  }

  await env.BOT_KV.put(`cwithdraw:${id}`, JSON.stringify(w));
  return w;
}



async function storeSupportTicket(env, ticket) {
  if (!env.BOT_KV) return;
  await env.BOT_KV.put(`ticket:${ticket.id}`, JSON.stringify(ticket));

  // global index
  const raw = await env.BOT_KV.get("tickets:index");
  let list = [];
  try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
  if (!Array.isArray(list)) list = [];
  if (!list.includes(ticket.id)) list.push(ticket.id);
  await env.BOT_KV.put("tickets:index", JSON.stringify(list.slice(-1000)));

  // per-user index (NEW)
  try {
    const uKey = `tickets:user:${ticket.userId}`;
    const uRaw = await env.BOT_KV.get(uKey);
    let uList = [];
    try { uList = uRaw ? JSON.parse(uRaw) : []; } catch { uList = []; }
    if (!Array.isArray(uList)) uList = [];
    if (!uList.includes(ticket.id)) uList.push(ticket.id);
    await env.BOT_KV.put(uKey, JSON.stringify(uList.slice(-300)));
  } catch (e) {}
}

async function listSupportTickets(env, limit = 100) {
  if (!env.BOT_KV) return [];
  const raw = await env.BOT_KV.get("tickets:index");
  let list = [];
  try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
  if (!Array.isArray(list)) return [];

  const ids = list.slice(-Number(limit));
  const out = [];
  for (const id of ids) {
    const r = await env.BOT_KV.get(`ticket:${id}`);
    if (!r) continue;
    try { out.push(JSON.parse(r)); } catch {}
  }

  return out.sort((a,b)=>(String(b?.createdAt||"")).localeCompare(String(a?.createdAt||"")));
}



async function getSupportTicketById(env, id) {
  if (!env.BOT_KV) return null;
  const raw = await env.BOT_KV.get(`ticket:${id}`);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function listSupportTicketsForUser(env, userId, limit = 50) {
  if (!env.BOT_KV) return [];
  const key = `tickets:user:${userId}`;
  const raw = await env.BOT_KV.get(key);
  let ids = [];
  try { ids = raw ? JSON.parse(raw) : []; } catch { ids = []; }
  if (!Array.isArray(ids)) ids = [];

  // If user index exists -> fast
  if (ids.length) {
    const want = ids.slice(-Math.min(300, limit * 3));
    const out = [];
    for (const id of want) {
      const t = await getSupportTicketById(env, id);
      if (t) out.push(t);
    }
    return out
      .sort((a, b) => (String(b?.createdAt || "")).localeCompare(String(a?.createdAt || "")))
      .slice(0, limit);
  }

  // fallback: scan global list
  const scan = await listSupportTickets(env, Math.min(500, limit * 10));
  return scan.filter((t) => String(t?.userId) === String(userId)).slice(0, limit);
}



async function updateSupportTicket(env, id, patch = {}) {
  if (!env.BOT_KV) throw new Error("BOT_KV missing");
  const key = `ticket:${id}`;
  const raw = await env.BOT_KV.get(key);
  if (!raw) throw new Error("ticket_not_found");
  let t = null;
  try { t = JSON.parse(raw); } catch {}
  if (!t) throw new Error("ticket_bad_json");

  const next = { ...t };
  if (typeof patch.status === "string" && patch.status) next.status = patch.status;
  if (typeof patch.reply === "string") next.reply = patch.reply;
  if (typeof patch.updatedBy === "string" && patch.updatedBy) next.updatedBy = patch.updatedBy;
  next.updatedAt = new Date().toISOString();

  await env.BOT_KV.put(key, JSON.stringify(next));

  
  const idxRaw = await env.BOT_KV.get("tickets:index");
  let list = [];
  try { list = idxRaw ? JSON.parse(idxRaw) : []; } catch { list = []; }
  if (!Array.isArray(list)) list = [];
  if (!list.includes(id)) list.push(id);
  await env.BOT_KV.put("tickets:index", JSON.stringify(list.slice(-1000)));

  return next;
}

async function listWithdrawals(env, limit = 50) {
  const lim = Number(limit);
  if (env.BOT_DB) {
    try {
      const rows = await env.BOT_DB.prepare("SELECT id, userId, createdAt, amount, address, status FROM withdrawals ORDER BY createdAt DESC LIMIT ?1").bind(lim).all();
      return rows?.results || [];
    } catch (e) {
      console.error("listWithdrawals db error:", e);
    }
  }

  if (!env.BOT_KV || typeof env.BOT_KV.list !== "function") return [];
  const listed = await env.BOT_KV.list({ prefix: "withdraw:", limit: lim });
  const out = [];
  for (const k of listed?.keys || []) {
    const raw = await env.BOT_KV.get(k.name);
    if (!raw) continue;
    try { out.push(JSON.parse(raw)); } catch {}
  }
  return out.sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
}

async function reviewWithdrawal(env, id, decision, txHash, reviewer) {
  const reviewedAt = new Date().toISOString();
  if (env.BOT_DB) {
    await env.BOT_DB.prepare("UPDATE withdrawals SET status=?1 WHERE id=?2").bind(decision, id).run();
    const row = await env.BOT_DB.prepare("SELECT id, userId, createdAt, amount, address, status FROM withdrawals WHERE id=?1").bind(id).first();
    const data = { ...(row || {}), txHash, reviewedAt, reviewedBy: normHandle(reviewer?.username) };
    if (env.BOT_KV) await env.BOT_KV.put(`withdraw:${id}`, JSON.stringify(data));
    return data;
  }
  const raw = env.BOT_KV ? await env.BOT_KV.get(`withdraw:${id}`) : null;
  const data = raw ? JSON.parse(raw) : { id, status: "pending" };
  data.status = decision;
  data.txHash = txHash;
  data.reviewedAt = reviewedAt;
  data.reviewedBy = normHandle(reviewer?.username);
  if (env.BOT_KV) await env.BOT_KV.put(`withdraw:${id}`, JSON.stringify(data));
  return data;
}

async function storeCustomPromptRequest(env, req) {
  if (!env.BOT_KV) return;
  await env.BOT_KV.put(`custom_prompt_req:${req.id}`, JSON.stringify(req));
  const raw = await env.BOT_KV.get("custom_prompt_req:index");
  let list = [];
  try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
  if (!Array.isArray(list)) list = [];
  if (!list.includes(req.id)) list.push(req.id);
  await env.BOT_KV.put("custom_prompt_req:index", JSON.stringify(list.slice(-1000)));
}

async function listCustomPromptRequests(env, limit = 200) {
  if (!env.BOT_KV) return [];
  const raw = await env.BOT_KV.get("custom_prompt_req:index");
  let list = [];
  try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
  if (!Array.isArray(list)) return [];

  const ids = list.slice(-Number(limit));
  const out = [];
  for (const id of ids) {
    const r = await env.BOT_KV.get(`custom_prompt_req:${id}`);
    if (!r) continue;
    try { out.push(JSON.parse(r)); } catch {}
  }

  return out.sort((a,b)=>(String(b?.createdAt||"")).localeCompare(String(a?.createdAt||"")));
}

async function getAdminFlags(env) {
  if (!env.BOT_KV) return { capitalModeEnabled: true, profileTipsEnabled: true };
  const raw = await env.BOT_KV.get("settings:admin_flags");
  try {
    const j = raw ? JSON.parse(raw) : {};
    return {
      capitalModeEnabled: typeof j.capitalModeEnabled === "boolean" ? j.capitalModeEnabled : true,
      profileTipsEnabled: typeof j.profileTipsEnabled === "boolean" ? j.profileTipsEnabled : true,
    };
  } catch {
    return { capitalModeEnabled: true, profileTipsEnabled: true };
  }
}

async function setAdminFlags(env, flags) {
  if (!env.BOT_KV) return;
  await env.BOT_KV.put("settings:admin_flags", JSON.stringify({
    capitalModeEnabled: !!flags.capitalModeEnabled,
    profileTipsEnabled: !!flags.profileTipsEnabled,
  }));
}

async function runDailyProfileNotifications(env) {
  const flags = await getAdminFlags(env);
  if (!flags.profileTipsEnabled) return;
  const users = await listUsers(env, 500);
  const hr = new Date().getUTCHours();
  if (!(hr === 8 || hr === 20)) return;
  for (const u of users) {
    const uid = Number(u?.userId || 0);
    if (!uid) continue;

    const cap = Number(u?.profile?.capital || u?.capital?.amount || 0);
    const risk = u?.risk || "متوسط";
    const msg = `🔔 پیشنهاد روزانه تحلیل
سرمایه ثبت‌شده: ${cap || "-"} ${u?.profile?.capitalCurrency || "USDT"}
ریسک: ${risk}
پیشنهاد: امروز با مدیریت سرمایه محافظه‌کارانه و تایید چند-سبکی وارد شو.`;
    try { await tgSendMessage(env, uid, msg, mainMenuKeyboard(env)); } catch {}
  }
}


async function verifyBlockchainPayment(payload, env) {
  try {
    const txHash = normalizeTxHash(payload?.txHash || "");
    const addressRaw = String(payload?.address || "").trim();
    const address = normalizeHexAddress(addressRaw);
    const amount = Number(payload?.amount || 0);

    if (!txHash) return { ok: false, reason: "invalid_txhash" };
    if (!address) return { ok: false, reason: "invalid_address" };

    const endpoint = (env.BLOCKCHAIN_CHECK_URL || "").toString().trim();
    if (endpoint) {
      const r = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash, address, amount }),
      }, Number(env.BLOCKCHAIN_CHECK_TIMEOUT_MS || 8000));
      const j = await r.json().catch(() => null);
      return j || { ok: false, reason: "bad_response" };
    }

    const provider = String(env.BEP20_SCAN_PROVIDER || "").trim().toLowerCase();

    if (provider === "nodereal") {
      const apiKey = String(env.NODEREAL_API_KEY || env.BEP20SCAN_API_KEY || "").trim();
      if (!apiKey) return { ok: false, reason: "nodereal_key_missing" };
      return await verifyBep20WithNodeReal({ txHash, address, amount }, env, apiKey);
    }

    // Default: Native BEP20 scan via BscScan Proxy API
    const apiKey = String(env.BSCSCAN_API_KEY || env.BEP20SCAN_API_KEY || "").trim();
    if (!apiKey) return { ok: false, reason: "check_url_missing" };

    return await verifyBep20WithBscScan({ txHash, address, amount }, env, apiKey);
  } catch (e) {
    console.error("verifyBlockchainPayment error:", e);
    return { ok: false, reason: "check_failed" };
  }
}

function normalizeHexAddress(addr) {
  const s = String(addr || "").trim();
  if (!s) return "";
  const a = s.toLowerCase();
  if (!a.startsWith("0x")) return "";
  if (a.length !== 42) return "";
  return a;
}

function hexToBigIntSafe(hex) {
  try {
    const h = String(hex || "").trim().toLowerCase();
    if (!h) return 0n;
    return BigInt(h);
  } catch {
    return 0n;
  }
}

function bigIntToDecimalString(bi, decimals) {
  const d = Math.max(0, Number(decimals || 0) | 0);
  const s = bi.toString();
  if (d === 0) return s;
  if (s.length <= d) {
    const z = "0".repeat(d - s.length);
    return "0." + z + s;
  }
  const intPart = s.slice(0, s.length - d);
  const fracPartRaw = s.slice(s.length - d);
  const fracPart = fracPartRaw.replace(/0+$/, "");
  return fracPart ? (intPart + "." + fracPart) : intPart;
}

async function verifyBep20WithBscScan(payload, env, apiKey) {
  const txHash = String(payload?.txHash || "").trim();
  const toAddr = normalizeHexAddress(payload?.address || "");
  const expected = Number(payload?.amount || 0);

  const tokenContract = String(env.BEP20_TOKEN_CONTRACT || env.BEP20_USDT_CONTRACT || "0x55d398326f99059ff775485246999027b3197955").trim().toLowerCase();
  const decimals = Number(env.BEP20_TOKEN_DECIMALS || 18);

  const urls = {
    receipt: `https://api.bscscan.com/api?module=proxy&action=eth_getTransactionReceipt&txhash=${encodeURIComponent(txHash)}&apikey=${encodeURIComponent(apiKey)}`,
    tx: `https://api.bscscan.com/api?module=proxy&action=eth_getTransactionByHash&txhash=${encodeURIComponent(txHash)}&apikey=${encodeURIComponent(apiKey)}`,
  };

  const raw = { receipt: null, tx: null, block: null };
  const r1 = await fetchWithTimeout(urls.receipt, { method: "GET" }, Number(env.BLOCKCHAIN_CHECK_TIMEOUT_MS || 8000));
  raw.receipt = await r1.json().catch(() => null);

  const receipt = raw.receipt?.result || raw.receipt?.Result || null;
  if (!receipt) return { ok: false, reason: "receipt_not_found", provider: "bscscan", txHash, to: toAddr, expected, tokenContract, decimals, raw };

  const status = String(receipt.status || "").toLowerCase();
  if (status && status !== "0x1") return { ok: false, reason: "tx_failed", provider: "bscscan", status, txHash, to: toAddr, expected, tokenContract, decimals, report: { receipt }, raw };

  // Optional tx + block timestamp for reporting
  try {
    const r2 = await fetchWithTimeout(urls.tx, { method: "GET" }, Number(env.BLOCKCHAIN_CHECK_TIMEOUT_MS || 8000));
    raw.tx = await r2.json().catch(() => null);
  } catch {}
  const tx = raw.tx?.result || null;

  let block = null;
  try {
    const bn = receipt.blockNumber || tx?.blockNumber;
    if (bn) {
      const urlB = `https://api.bscscan.com/api?module=proxy&action=eth_getBlockByNumber&tag=${encodeURIComponent(String(bn))}&boolean=true&apikey=${encodeURIComponent(apiKey)}`;
      const r3 = await fetchWithTimeout(urlB, { method: "GET" }, Number(env.BLOCKCHAIN_CHECK_TIMEOUT_MS || 8000));
      raw.block = await r3.json().catch(() => null);
      block = raw.block?.result || null;
    }
  } catch {}

  const transferSig = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
  let sum = 0n;
  let hits = 0;
  const matches = [];

  for (const log of logs) {
    const addr = String(log?.address || "").toLowerCase();
    const topics = Array.isArray(log?.topics) ? log.topics : [];
    if (addr !== tokenContract) continue;
    if (!topics[0] || String(topics[0]).toLowerCase() !== transferSig) continue;
    if (!topics[2]) continue;

    const t2 = String(topics[2]).toLowerCase().replace(/^0x/, "");
    const to = "0x" + t2.slice(-40);
    if (to !== toAddr) continue;

    const t1 = String(topics[1] || "").toLowerCase().replace(/^0x/, "");
    const from = t1 ? ("0x" + t1.slice(-40)) : "";
    const amt = hexToBigIntSafe(log?.data || "0x0");

    if (amt > 0n) {
      sum += amt;
      hits += 1;
      const decStr = bigIntToDecimalString(amt, decimals);
      matches.push({ from, to, amountRaw: String(amt), amount: decStr, logIndex: log?.logIndex, txHash: log?.transactionHash || txHash });
    }
  }

  if (hits <= 0) {
    return {
      ok: false,
      reason: "no_matching_transfer_to_wallet",
      provider: "bscscan",
      tokenContract,
      decimals,
      txHash,
      to: toAddr,
      expected,
      report: { receipt, tx, block, matches },
      raw,
    };
  }

  const sumDec = bigIntToDecimalString(sum, decimals);
  const sumNum = Number(sumDec);
  const report = { receipt, tx, block, matches, sum: sumDec, transfers: hits };

  if (!Number.isFinite(sumNum)) {
    return { ok: true, provider: "bscscan", tokenContract, decimals, txHash, to: toAddr, amount: sumDec, expected, transfers: hits, report, raw };
  }

  const tol = Math.max(0.01, (Number.isFinite(expected) ? expected : 0) * 0.005);
  const minAccept = Number.isFinite(expected) && expected > 0 ? (expected - tol) : 0;

  if (Number.isFinite(expected) && expected > 0 && sumNum + 1e-12 < minAccept) {
    return { ok: false, reason: "amount_too_low", provider: "bscscan", tokenContract, decimals, txHash, to: toAddr, amount: sumNum, expected, tolerance: tol, transfers: hits, report, raw };
  }

  return { ok: true, provider: "bscscan", tokenContract, decimals, txHash, to: toAddr, amount: sumNum, expected, transfers: hits, report, raw };
}
async function verifyBep20WithNodeReal(payload, env, apiKey) {
  const txHash = String(payload?.txHash || "").trim();
  const toAddr = normalizeHexAddress(payload?.address || "");
  const expected = Number(payload?.amount || 0);

  const tokenContract = String(env.BEP20_TOKEN_CONTRACT || env.BEP20_USDT_CONTRACT || "0x55d398326f99059ff775485246999027b3197955").trim().toLowerCase();
  const decimals = Number(env.BEP20_TOKEN_DECIMALS || 18);

  const net = String(env.BEP20_SCAN_NETWORK || "bsc-mainnet").trim().toLowerCase();
  let base = String(env.NODEREAL_RPC_BASE || "").trim();
  if (!base) {
    base = net.includes("test") ? "https://bsc-testnet.nodereal.io/v1/" : "https://bsc-mainnet.nodereal.io/v1/";
  }
  if (!base.endsWith("/")) base += "/";
  const rpcUrl = base + apiKey;

  const raw = { tx: null, receipt: null, block: null };
  const tx = await jsonRpc(rpcUrl, "eth_getTransactionByHash", [txHash], env).catch(() => null);
  raw.tx = tx;
  const receipt = await jsonRpc(rpcUrl, "eth_getTransactionReceipt", [txHash], env).catch(() => null);
  raw.receipt = receipt;

  if (!receipt) return { ok: false, reason: "receipt_not_found", provider: "nodereal", txHash, to: toAddr, expected, tokenContract, decimals, raw };

  const status = String(receipt.status || "").toLowerCase();
  if (status && status !== "0x1") return { ok: false, reason: "tx_failed", provider: "nodereal", status, txHash, to: toAddr, expected, tokenContract, decimals, report: { tx, receipt }, raw };

  let block = null;
  try {
    const bn = receipt.blockNumber || tx?.blockNumber;
    if (bn) {
      block = await jsonRpc(rpcUrl, "eth_getBlockByNumber", [bn, true], env).catch(() => null);
      raw.block = block;
    }
  } catch {}

  const transferSig = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
  let sum = 0n;
  let hits = 0;
  const matches = [];

  for (const log of logs) {
    const addr = String(log?.address || "").toLowerCase();
    const topics = Array.isArray(log?.topics) ? log.topics : [];
    if (addr !== tokenContract) continue;
    if (!topics[0] || String(topics[0]).toLowerCase() !== transferSig) continue;
    if (!topics[2]) continue;

    const t2 = String(topics[2]).toLowerCase().replace(/^0x/, "");
    const to = "0x" + t2.slice(-40);
    if (to !== toAddr) continue;

    const t1 = String(topics[1] || "").toLowerCase().replace(/^0x/, "");
    const from = t1 ? ("0x" + t1.slice(-40)) : "";
    const amt = hexToBigIntSafe(log?.data || "0x0");

    if (amt > 0n) {
      sum += amt;
      hits += 1;
      const decStr = bigIntToDecimalString(amt, decimals);
      matches.push({ from, to, amountRaw: String(amt), amount: decStr, logIndex: log?.logIndex, txHash: log?.transactionHash || txHash });
    }
  }

  const sumDec = bigIntToDecimalString(sum, decimals);
  const sumNum = Number(sumDec);
  const report = { tx, receipt, block, matches, sum: sumDec, transfers: hits };

  if (hits <= 0) {
    return { ok: false, reason: "no_matching_transfer_to_wallet", provider: "nodereal", tokenContract, decimals, txHash, to: toAddr, expected, report, raw };
  }

  const tol = Math.max(0.01, (Number.isFinite(expected) ? expected : 0) * 0.005);
  const minAccept = Number.isFinite(expected) && expected > 0 ? (expected - tol) : 0;

  if (Number.isFinite(expected) && expected > 0 && Number.isFinite(sumNum) && sumNum + 1e-12 < minAccept) {
    return { ok: false, reason: "amount_too_low", provider: "nodereal", tokenContract, decimals, txHash, to: toAddr, amount: sumNum, expected, tolerance: tol, transfers: hits, report, raw };
  }

  return { ok: true, provider: "nodereal", tokenContract, decimals, txHash, to: toAddr, amount: Number.isFinite(sumNum) ? sumNum : sumDec, expected, transfers: hits, report, raw };
}

async function jsonRpc(url, method, params, env) {
  const payload = { jsonrpc: "2.0", id: 1, method, params };
  const r = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }, Number(env.BLOCKCHAIN_CHECK_TIMEOUT_MS || 8000));
  const j = await r.json().catch(() => null);
  if (!j || j.error) throw new Error(j?.error?.message || "rpc_error");
  return j.result;
}


function normalizePlan(p) {
  const id = String(p && p.id ? p.id : "").trim();
  if (!id) return null;
  return {
    id,
    title: String(p && p.title ? p.title : id),
    amount: Number(p && p.amount ? p.amount : 0),
    days: toInt(p && p.days ? p.days : 30, 30),
    dailyLimit: toInt(p && p.dailyLimit ? p.dailyLimit : 50, 50),
    currency: String(p && p.currency ? p.currency : "USDT"),
    network: String(p && p.network ? p.network : "BEP20"),
  };
}

function parseSubscriptionPlansRaw(raw) {
  const txt = String(raw || "").trim();
  if (!txt) return [];
  try {
    const arr = JSON.parse(txt);
    const out = [];
    if (Array.isArray(arr)) {
      for (const x of arr) {
        const n = normalizePlan(x);
        if (n) out.push(n);
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function getSubscriptionPlans(env) {
  // KV override (settable from admin panel)
  if (env && env.BOT_KV) {
    try {
      const rawKv = await env.BOT_KV.get("settings:subscription_plans");
      const kvPlans = parseSubscriptionPlansRaw(rawKv);
      if (kvPlans.length) return kvPlans;
    } catch {}
  }

  const envPlans = parseSubscriptionPlansRaw(env ? env.SUBSCRIPTION_PLANS : "");
  if (envPlans.length) return envPlans;

  return [
    normalizePlan({ id: "pro_30", title: "PRO 30 روز", amount: 25, days: 30, dailyLimit: 50, currency: "USDT", network: "BEP20" }),
  ].filter(Boolean);
}

async function setSubscriptionPlans(env, plans) {
  if (!env || !env.BOT_KV) return { ok: false, error: "bot_kv_missing" };
  const arr = Array.isArray(plans) ? plans : [];
  const norm = arr.map(normalizePlan).filter(Boolean);
  await env.BOT_KV.put("settings:subscription_plans", JSON.stringify(norm));
  return { ok: true, plans: norm };
}

function extendISO(currentIso, days) {
  const now = Date.now();
  const cur = Date.parse(currentIso || "");
  const base = (Number.isFinite(cur) && cur > now) ? cur : now;
  return new Date(base + days * 24 * 3600 * 1000).toISOString();
}

async function isTxUsed(env, txHash) {
  if (!env.BOT_KV) return false;
  const key = `txused:${String(txHash || "").toLowerCase()}`;
  const v = await env.BOT_KV.get(key);
  return !!v;
}
async function markTxUsed(env, txHash) {
  if (!env.BOT_KV) return;
  const key = `txused:${String(txHash || "").toLowerCase()}`;
  await env.BOT_KV.put(key, "1", { expirationTtl: 60 * 60 * 24 * 365 });
}

// Reserve tx hashes for pending subscription payments (auto-approval disabled).
async function isTxReserved(env, txHash) {
  if (!env.BOT_KV) return false;
  const key = `txpending:${String(txHash || "").toLowerCase()}`;
  const v = await env.BOT_KV.get(key);
  return !!v;
}
async function reserveTx(env, txHash, paymentId) {
  if (!env.BOT_KV) return;
  const h = String(txHash || "").toLowerCase();
  if (!h) return;
  const key = `txpending:${h}`;
  // keep a short reservation so a single txHash can't be reused while waiting for review
  await env.BOT_KV.put(key, String(paymentId || "1"), { expirationTtl: 60 * 60 * 24 * 14 });
}
async function releaseTxReservation(env, txHash, paymentId) {
  if (!env.BOT_KV) return;
  const h = String(txHash || "").toLowerCase();
  if (!h) return;
  const key = `txpending:${h}`;
  try {
    const cur = await env.BOT_KV.get(key);
    // only release if same payment id (best-effort safety)
    if (!paymentId || !cur || String(cur) === String(paymentId)) {
      await env.BOT_KV.delete(key);
    }
  } catch (e) {
    try { await env.BOT_KV.delete(key); } catch {}
  }
}

function normalizeTxHash(input) {
  const s = String(input || "").trim();
  if (!s) return "";
  const m = s.match(/0x[a-fA-F0-9]{64}/i);
  if (!m) return "";
  // normalize to lowercase to dedupe tx_used checks
  return ("0x" + m[0].slice(2)).toLowerCase();
}



 
function kb(rows) {
  return {
    keyboard: rows,
    resize_keyboard: true,
    one_time_keyboard: false,
    input_field_placeholder: "از دکمه‌ها استفاده کن…",
  };
}

function mainMenuKeyboard(env) {
  return kb([
    [BTN.SIGNAL, BTN.SETTINGS],
    [BTN.SUBSCRIPTION, BTN.WALLET],
    [BTN.PROFILE, BTN.INVITE],
    [BTN.SUPPORT, BTN.HOME],
  ]);
}

function signalMenuKeyboard() {
  return kb([[BTN.CAT_MAJORS, BTN.CAT_METALS], [BTN.CAT_INDICES, BTN.CAT_CRYPTO], [BTN.QUOTE, BTN.NEWS], [BTN.BACK, BTN.HOME]]);
}

function settingsMenuKeyboard() {

  return kb([[BTN.SET_TF, BTN.SET_STYLE], [BTN.SET_RISK, BTN.SET_NEWS], [BTN.SET_CAPITAL, BTN.REQUEST_CUSTOM_PROMPT], [BTN.BACK, BTN.HOME]]);
}

function walletMenuKeyboard() {
  return kb([
    [BTN.SUBSCRIPTION],
    [BTN.WALLET_BALANCE],
    [BTN.WALLET_DEPOSIT, BTN.WALLET_WITHDRAW],
    [BTN.HOME],
  ]);
}


function listKeyboard(items, columns = 2) {
  const rows = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  rows.push([BTN.BACK, BTN.HOME]);
  return kb(rows);
}

function optionsKeyboard(options) {
  const rows = [];
  for (let i = 0; i < options.length; i += 2) rows.push(options.slice(i, i + 2));
  rows.push([BTN.BACK, BTN.HOME]);
  return kb(rows);
}

function contactKeyboard() {
  return {
    keyboard: [[{ text: "📱 ارسال شماره تماس", request_contact: true }], [BTN.BACK, BTN.HOME]],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

const DEFAULT_MINIAPP_URL = "https://sniperim.mad-pyc.workers.dev/";

function getMiniappUrl(env) {
  const configured = (env.MINIAPP_URL || env.PUBLIC_BASE_URL || "").toString().trim();
  const raw = configured || DEFAULT_MINIAPP_URL;
  try {
    const u = new URL(raw);
    u.pathname = "/";
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return DEFAULT_MINIAPP_URL;
  }
}
async function miniappInlineKeyboard(env, st, from) {
  const url = getMiniappUrl(env);
  if (!url) return null;
  const token = await issueMiniappToken(env, st?.userId, from || {});
  const finalUrl = token ? appendQuery(url, { miniToken: token }) : url;
  return { inline_keyboard: [[{ text: BTN.MINIAPP, web_app: { url: finalUrl } }]] };
}

async function miniappInlineKeyboardTab(env, st, from, tab, buttonText) {
  const url = getMiniappUrl(env);
  if (!url) return null;
  const token = await issueMiniappToken(env, st?.userId, from || {});
  let finalUrl = token ? appendQuery(url, { miniToken: token }) : url;
  if (tab) finalUrl = appendQuery(finalUrl, { tab });
  const txt = buttonText || BTN.MINIAPP;
  return { inline_keyboard: [[{ text: txt, web_app: { url: finalUrl } }]] };
}

function appendQuery(url, params) {
  try {
    const u = new URL(url);
    Object.entries(params || {}).forEach(([k,v]) => { if (v != null && String(v) !== "") u.searchParams.set(k, String(v)); });
    return u.toString();
  } catch {
    return url;
  }
}



 
















async function dbGetUser(userId, env) {
  if (!env.BOT_DB) return null;
  try {
    const row = await env.BOT_DB.prepare("SELECT json FROM users WHERE userId=?1").bind(String(userId)).first();
    if (!row || !row.json) return null;
    return JSON.parse(row.json);
  } catch (e) {
    console.error("dbGetUser error:", e);
    return null;
  }
}

async function dbSaveUser(userId, st, env) {
  if (!env.BOT_DB) return;
  try {
    const now = new Date().toISOString();
    await env.BOT_DB.prepare(
      "INSERT INTO users (userId, json, updatedAt) VALUES (?1, ?2, ?3) " +
      "ON CONFLICT(userId) DO UPDATE SET json=excluded.json, updatedAt=excluded.updatedAt"
    ).bind(String(userId), JSON.stringify(st), now).run();
  } catch (e) {
    console.error("dbSaveUser error:", e);
  }
}
 
async function getUser(userId, env) {
  
  const db = await dbGetUser(userId, env);
  if (db) return db;

  if (!env.BOT_KV) return null;
  const raw = await env.BOT_KV.get(`u:${userId}`);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
async function saveUser(userId, st, env) {
  // Canonical persistence: D1 when bound.
  await dbSaveUser(userId, st, env);

  // If D1 is bound, do NOT persist full user JSON to KV anymore (prevents KV write rate-limit issues).
  if (env.BOT_DB) {
    await updateUserIndexes(env, st); // optional small mapping
    return;
  }

  if (!env.BOT_KV) return;
  await env.BOT_KV.put(`u:${userId}`, JSON.stringify(st));
  await updateUserIndexes(env, st);
}


function defaultUser(userId) {
  return {
    userId,
    createdAt: new Date().toISOString(),

    
    state: "idle",
    selectedSymbol: "",

    
    timeframe: "H4",
    style: "پرایس اکشن",
    risk: "متوسط",
    newsEnabled: true,
    promptMode: "style_plus_custom",

    
    dailyDate: kyivDateString(),
    dailyUsed: 0,
    freeDailyLimit: 3,

    
    profile: {
      name: "",
      phone: "",
      username: "",
      firstName: "",
      lastName: "",
      marketExperience: "",
      preferredMarket: "",
      level: "", 
      levelNotes: "",
      preferredStyle: "",
      language: "fa",
      countryCode: "IR",
      timezone: "Asia/Tehran",
      entrySource: "",
      lastEntryVia: "",
      lastEntryAt: "",
      onboardingDone: false,
      capital: 0,
      capitalCurrency: "USDT",

    },

    capital: {
      amount: 0,
      enabled: true,
    },

    
    points: {
      balance: 0,
      spent: 0,
      earnedFromInvites: 0,
    },
    referral: {
      codes: [],            
      referredBy: "",       
      referredByCode: "",   
      successfulInvites: 0,
      points: 0,
      commissionTotal: 0,
      commissionBalance: 0,
      commissionPending: 0,
      commissionPaid: 0,
      onboardingRewardDone: false,
      onboardingRewardAt: "",
    },
    subscription: {
      active: false,
      type: "free", 
      expiresAt: "",
      dailyLimit: 3,
    },

    
    wallet: {
      balance: 0,
      transactions: [],
    },

    
    textOrder: "",
    visionOrder: "",
    polishOrder: "",

    stats: {
      totalAnalyses: 0,
      successfulAnalyses: 0,
      lastAnalysisAt: "",
      totalPayments: 0,
      totalPaymentAmount: 0,
    },
    customPromptId: "",
    pendingCustomPromptRequestId: "",
  };
}

function patchUser(st, userId) {
  const d = defaultUser(userId);
  const merged = { ...d, ...st };
  merged.profile = { ...d.profile, ...(st?.profile || {}) };
  merged.points = { ...d.points, ...(st?.points || {}) };
  merged.referral = { ...d.referral, ...(st?.referral || {}) };
  merged.subscription = { ...d.subscription, ...(st?.subscription || {}) };
  merged.wallet = { ...d.wallet, ...(st?.wallet || {}) };
  merged.capital = { ...d.capital, ...(st?.capital || {}) };
  merged.stats = { ...d.stats, ...(st?.stats || {}) };
  merged.customPromptId = typeof merged.customPromptId === "string" ? merged.customPromptId : "";
  merged.pendingCustomPromptRequestId = typeof merged.pendingCustomPromptRequestId === "string" ? merged.pendingCustomPromptRequestId : "";
  merged.profile.capital = Number.isFinite(Number(merged.profile?.capital)) ? Number(merged.profile.capital) : 0;
  merged.profile.capitalCurrency = typeof merged.profile?.capitalCurrency === "string" ? merged.profile.capitalCurrency : "USDT";

  merged.timeframe = merged.timeframe || d.timeframe;
  merged.style = merged.style || d.style;
  merged.risk = merged.risk || d.risk;
  merged.newsEnabled = typeof merged.newsEnabled === "boolean" ? merged.newsEnabled : d.newsEnabled;

  merged.dailyDate = merged.dailyDate || d.dailyDate;
  merged.dailyUsed = Number.isFinite(Number(merged.dailyUsed)) ? Number(merged.dailyUsed) : d.dailyUsed;
  merged.freeDailyLimit = Number.isFinite(Number(merged.freeDailyLimit)) ? Number(merged.freeDailyLimit) : d.freeDailyLimit;

  merged.state = merged.state || "idle";
  merged.selectedSymbol = merged.selectedSymbol || "";

  merged.textOrder = typeof merged.textOrder === "string" ? merged.textOrder : "";
  merged.visionOrder = typeof merged.visionOrder === "string" ? merged.visionOrder : "";
  merged.polishOrder = typeof merged.polishOrder === "string" ? merged.polishOrder : "";

  return merged;
}

async function ensureUser(userId, env, from) {
  const dbExisting = await dbGetUser(userId, env);
  const kvExisting = dbExisting ? null : await getUser(userId, env);
  const existing = dbExisting || kvExisting;
  let st = patchUser(existing || {}, userId);

  // Persist only when we actually changed something.
  let dirty = !existing;

  const basePts = await getBasePoints(env);
  ensurePoints(st);

  // Migration: grant base points once for legacy users (so old accounts won't be stuck at 0).
  if (existing && !st.points.migratedBaseV1) {
    const cur = Number(st.points.balance || 0);
    const base = Number(basePts || 0);
    const nextBal = Math.max(cur, base);
    if (nextBal !== cur) st.points.balance = nextBal;
    st.points.migratedBaseV1 = true;
    st.points.initialized = true;
    dirty = true;
  } else if (existing && !st.points.initialized) {
    st.points.initialized = true;
    dirty = true;
  }

  if (!existing) {
    st.points.balance = Number(basePts);
    st.points.initialized = true;
    dirty = true;
  } else {
    const spent = Number(st.points.spent || 0);
    const earned = Number(st.points.earnedFromInvites || 0);
    const bal = Number(st.points.balance || 0);

    if (!st.points.initialized && bal === 0 && spent === 0 && earned === 0) {
      st.points.balance = Number(basePts);
      st.points.initialized = true;
      dirty = true;
    }
  }

  // If we have KV legacy data but no D1 row, migrate once.
  if (env.BOT_DB && !dbExisting && kvExisting) {
    dirty = true;
  }

  // Telegram profile fields (only set if changed)
  if (from?.username && st.profile.username !== String(from.username)) { st.profile.username = String(from.username); dirty = true; }
  if (from?.first_name && st.profile.firstName !== String(from.first_name)) { st.profile.firstName = String(from.first_name); dirty = true; }
  if (from?.last_name && st.profile.lastName !== String(from.last_name)) { st.profile.lastName = String(from.last_name); dirty = true; }

  // Locale defaults (idempotent but we detect changes)
  const preLocale = {
    language: st.profile?.language,
    countryCode: st.profile?.countryCode,
    timezone: st.profile?.timezone,
    timeframe: st.timeframe,
    risk: st.risk,
    style: st.style,
  };
  applyLocaleFromTelegramUser(st, from || {});
  if (
    preLocale.language !== st.profile?.language ||
    preLocale.countryCode !== st.profile?.countryCode ||
    preLocale.timezone !== st.profile?.timezone ||
    preLocale.timeframe !== st.timeframe ||
    preLocale.risk !== st.risk ||
    preLocale.style !== st.style
  ) dirty = true;

  if (st.profile?.phone) {
    const preTz = st.profile?.timezone;
    const preCC = st.profile?.countryCode;
    applyLocaleDefaults(st, env);
    if (preTz !== st.profile?.timezone || preCC !== st.profile?.countryCode) dirty = true;
  }

  const today = kyivDateString();
  if (st.dailyDate !== today) {
    st.dailyDate = today;
    st.dailyUsed = 0;
    dirty = true;
  }

  if (!Array.isArray(st.referral.codes) || st.referral.codes.length < 1) {
    st.referral.codes = (st.referral.codes || []).filter(Boolean);
    while (st.referral.codes.length < 1) st.referral.codes.push(randomCode(10));
    dirty = true;
  }

  const freeLimit = await getFreeDailyLimit(env);
  if (st.freeDailyLimit !== freeLimit) {
    st.freeDailyLimit = freeLimit;
    dirty = true;
  }

  if (dirty) await saveUser(userId, st, env);
  return st;
}


function dailyLimit(env, st) {
  if (st?.subscription?.active) {
    return toInt(st?.subscription?.dailyLimit, 3) || 3;
  }
  return toInt(st?.freeDailyLimit || st?.subscription?.dailyLimit || 0, 0) || 3;
}

function canAnalyzeToday(st, from, env) {
  // Points-based gating is the primary limiter. Daily limit is optional (disabled by default).
  if (String(env.ENABLE_DAILY_LIMIT || "") !== "1") return true;
  const today = kyivDateString();
  const used = (st.dailyDate === today) ? (st.dailyUsed || 0) : 0;
  return used < dailyLimit(env, st);
}

function hasUserPersistence(env){
  return !!(env && (env.BOT_DB || env.BOT_KV));
}

function consumeDaily(st, from, env) {
  if (String(env.ENABLE_DAILY_LIMIT || "") !== "1") return;
  const today = kyivDateString();
  if (st.dailyDate !== today) {
    st.dailyDate = today;
    st.dailyUsed = 0;
  }
  st.dailyUsed = (st.dailyUsed || 0) + 1;
}


function recordAnalysisSuccess(st) {
  st.stats = st.stats || {};
  st.stats.totalAnalyses = (st.stats.totalAnalyses || 0) + 1;
  st.stats.successfulAnalyses = (st.stats.successfulAnalyses || 0) + 1;
  st.stats.lastAnalysisAt = new Date().toISOString();
}

 

const MARKETIQ_THINKING_GIF_B64 = "R0lGODlhQAF4AIcAAP////7+/v39/fz8/Pv7+/r6+vn5+fj4+Pf39/b29vX19fT09PPz8/Ly8vHx8fDw8O/v7+7u7u3t7ezs7Ovr6+rq6unp6ejo6Ofn5+bm5uXl5ePj4+Li4uHh4eDg4N/f397e3tzc3Nvb29ra2tnZ2djY2NbW1tXV1dTU1NPT09LS0tHR0dDQ0M/Pz87Ozs3NzczMzMvLy8nJycfHx8bGxsXFxcTExMPDw8HBwcDAwL+/v76+vr29vby8vLu7u7q6urm5ubi4uLe3t7a2trW1tbS0tLOzs7KysrGxsa+vr66urq2traysrKmpqaioqKenp6ampqWlpaSkpKOjo6KioqGhoZ+fn5ycnJubm5qampmZmZiYmJeXl5aWlpWVlZSUlJOTk5KSkpGRkZCQkI+Pj46Ojo2NjYyMjIuLi4qKiomJiYeHh4aGhoSEhIODg4KCgoGBgX5+fn19fXx8fHt7e3p6end3d3Z2dnV1dXR0dHNzc3JycnBwcG5ubmxsbGtra2pqamlpaWdnZ2ZmZmNjY2FhYWBgYF9fX15eXl1dXVxcXFtbW1lZWVdXV1ZWVlVVVVRUVFNTU1JSUlFRUVBQUE9PT05OTk1NTUxMTEtLS0pKSklJSUhISEdHR0ZGRkVFRURERENDQ0JCQkFBQUBAQD8/Pz4+Pj09PTw8PDs7Ozo6Ojk5OTg4ODY2NjU1NTQ0NDMzMzIyMjExMTAwMC8vLy4uLi0tLSwsLCsrKyoqKikpKSgoKCcnJyYmJiUlJSQkJCMjIyIiIiEhISAgIB8fHx4eHh0dHRwcHBsbGxoaGhkZGRgYGBcXFxYWFhUVFRQUFBMTExISEhERERAQEA8PDw4ODg0NDQwMDAsLCwoKCgkJCQgICAcHBwYGBgUFBQQEBAMDAwICAgEBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQADAAAACwAAAAAQAF4AAAI/wABCBxIsKDBgwgTKlzIsKHDhxAjSpxIsaLFixgzatzIsaPHjyBDihxJsqTJkyhTqlzJsqXLlzBjypxJs6bNmzhz6tzJs6fPn0CDCh1KtKjRo0iTKl3KtKnTp1CjSp1KtarVq1izat3KtavXr2DDimW5aNy4bxUONjE7bgrCJGY/ISzLdhw2XoReHCzbyWAGXeOetRBIt25dMBQMK2YbKiHfgxberGrWjZkpNQ/Gfi385aAltm4PUjIbbsPexePAdTH4mCCHX+OWnRhYeDFi1Iobzx3Xt+AVa4uhKdHcteyycaoMSuhWLVvbgxO8jYs2bs3p3gE0RDl2VkTB1gJBDP8bd4wEQfANgY2j8xA9ADNmeU3JYICDFu7hQhPPWvZRMnEfFLTFOIZQ85xBYYwzDBvj7HJdQTOYxcZ3vA00AnfDgEBhbw6px55D6NEADm8IFAQBLONkY95+WJXVyB7jTEjQKeP4YKB+BKF4BwhmycBahQVBM04hGwp0wnG+mFbkQx62B6RAo4yjDAQHeYDNOIqw2OI4jcAwzi0EdSDOMgPcaBAKZunlyjiA/MjhQNKME0iRLDgzTi4YPMjkek5yKIJZaiTkxzjeOKClVS4CsMs4Kwy0xjh8AGBmQXiMA4xAZ0xnwJID2WDWaufxFkOctKSlZ4d8gvgkFmZ5h5AOZgX/cWhVib4xjh0D3TJODJIeONAAyoxTh0AciDMOE0sGkIEUyEjJAIXBGOhKBI49mV6qDYEHozUKQWAWGbNSlWgI4xATAAAsjNOLQJMONIRZjQqkyjiXULiYKyX8yBYMCtWmGJUGNakqh4YouNA348gR7lSJAsDKODcAUCkc7PoqUCPj8EKQGGeZSthi1Ahxmi9xGhPgbrgBXJDA2T55iMEKIfzhwlA1nGAgAXDnarsAPLDNOHEQlEE444wRam8IsAAJoRFvGEM14wijpJsQscyQtuNwm5C345hBc1QNW/DNMz+M08pAPGthFgoFlTKOLEcTFMAmlhZQZA3XjONLnlTv/znz1auaFUJCsI4j8tdPNQwAJ3qPIwbaFs+L2zgq0GYtACEgzMWSOTiXi8eWv8mQ1QuB9+c4aQg6zjYLIJ44lwNNYRY4F0Cu3+mT6xG6QYgoSEDcAv3AzTi0SMDptX+Xbi0p4ySTmUEd5H2I6683MhADznlCULtznJXBQYnENsDHogOggllRAC9QEd2M88rz5FeNLeBv2jCiJgcU9EAr41xzMvVMURxCJhUAYoxjEgi5gVmIED+DMK4W6hOIEhC2imc1EFXJ69fl1GAWXUgBAwbYABaKkZrhALApAjzIpHZglsMdJBfjcMQFCcJCw+2uIE4YkSkU8DHcTC9g81Ne+f+0kDfFIMMHJ3RKCg0yqZcRQwAJGcM4uEEl9wxkTaW4YUGqQDRQlMhfhvnhyoKowfIB4AJwYMUziJaiqSXxjVBhAXBMsSk42tEpQkCYIe7IR6YMqDp9DKQgB0nIQhrykIhMpCIXychGOvKRkIykJCdJyUpaUiKJmRxjZkiQSIyjEhGkCywOkolxCCKCAvlLYAbjHlGS0pQHUcAWKEEMbGzDGJTYggUvqZNManIcurGiQDwJSi0CoDAmJEgpT2lMALwmNrM55uWQaZBlGmQJzEANNcAARV7+hHTNHAgxQ8kWW5xLmbA0pnjIsyJpiq4w5iyINQniBWMhIw0seIABMjD/hD4YKAXe/CYZOSnOT5KzFNoYxxPkmc4LXkhBGmpmWRCqUIYyUyAzQJgnGnCQBvTBBAH1CTgJOkyDGtNFecjY+AYyzwYeSW9udCeFGpFSXqxUIC0FQJSIYaiQHmWkMj3IOE/KJQoAxwrovKhM63QnvqHSRUYdB1JZ2tDTPc6nPx1oUA0y1BkmqnvCsBtOG+rOUREPdBKFHVjFCoCWsmoc/8MqUYAqTAB0davStB4EpjGOLVBVqWWJ1jimtZt3wm6vff3rQGBUDblmNYM9nFwxvQo7ALiBPPlrK1lrw6/CzlQglz1GZltasGEY5A9hdGxO6PrLyeK1YQx4RtHGCli9/5Usrk+tbGxnq9mLlva0qVXtTVhrRrualLLWEwgaxsEMHuaUL0+LWkw5qbjlNre3ix1HYxPSiXGIUbg0IS5C7ooexSXgOIF6boXwpjenpjW5ADjvONLb0Ld6gLveBa9NxCvU4762sgJJEDQaoN7edO5OaG0lgAEgYAJX1SxXPUh3v6vfmPCXq/4t74INQEI4FHggwiOe8d5LEA6Pw8NkjdIwOCrh/FZ4JhcuCHmtlcIsjIMa86rtm9jnPvgpGL4CsTGOyZrRcWxilwSZ8IthrNW6zvhNKSSAesyi44JMcBwVpO6CASBltigVAPUchzHQsAIHDGACPEjE8Pa4ZAs3+f9yBXWthoEskCp4GZUAyOE4dojXvBrEzlS+ZjNQEw5GfK/NMIlxJzNM4y0DQACA2SycAcDFcXjxxwaBdKANogAuVIIY2eCGMkIBh4gi+tSoTrWqV83qVrv61bCOtaxnTeta2/rWuM61rnfN6177+tfADrawh03sYhv72MhOtrKXzWw7FuHZ0I62tKdN7Wpb+9rYzra2t83tbnv72+AOt7jDPZRnZ+Dc6E63utfN7na7+93wjre8503vetv73vjOt77z/WygFOHcmty3wAdO8IIb/OAIT3i7i+CTf2fgl+NQuMQnTvGKW/zi6WY4T/4NcbNg/OMgD7nIQ65xnXC84x7/H7nKV87yltO75Dg5OcpdTvOa23zkML+JzDt+8577/OcGz7lNdg5xoBv96EiHt9BrQvRfJv3pUD/60pn+cJ5H/epYd/nUqV71gGf962AH+da57vWwm/3sCR/70B2O9ra7Pe1qj/m45073utv97njPu9673ey++/3vgA+84AdP+MIb/vCIv4kRxpEEiyy+8YlvSQSGt9CNPN7xjI98S8AwDm2AgiOX1zxRZrGLOwDI8pkXvVBeMN8SAI0gsvMBFXbRDV5AgSACQIImlLENW3iBIJf3wTjKUJBXHGMAi4mEQEIf+9nX/vYD6QAkqkGNR1wAF6NUvUQAAY7vraIY3QSA/+wUURdx5GAgMVAMxZaf+QD4QhcESRfFFrN+5mOp/OcHQARIyJZa9CL72vcQCCANmCAQrAIEsUMoYnABENAG48AIA+ECjYADE+AAPwAM2cBioQcfNjAQf/ANGmAQg5AI52R/3rCADfiAAmEH4/AJKbAANwBDABiADREF47AEAtEA2SBDAiE7d0AQwQAmbzEOPcB+kCcB28BmCTANkmAQdJAJv2OEPTgOPzgQQSgQuxANPQUAaDKDNLgQovAMbIUI3TABU2gEBCEKpjUQVoAK02AsZkEFUigQiJANmUEFNVIQY5AKCQB8qSc7aDgQaigQ3CAXBLEMXviFCAECcGgYRqwjfnk4EKFADAORBouBBXMIABGyGqfgC+ckEFJACyozh7FHEJNIiNpziImoiAYhB6gBQZCIRJJIiQLRC8zAAxEwPkgwDpgIAKEnELMQC653BgRBBL1waH4IeaU4i1iohQNxAuOwiqw4EAJgDNfAYgMxCbsSi6ZIiwDQC8ggAwYQAUdgQL34iwCgNp+wDWYoEDUgDK5SEPYniwJxigBwB+PACSegADWgK9L4NQEBACH5BAEMAOQALC4AVwCcACEAh/////7+/v39/fz8/Pv7+/r6+vn5+fj4+Pf39/b29vX19fT09PPz8/Ly8vHx8fDw8O/v7+7u7u3t7ezs7Ovr6+rq6unp6ejo6Ofn5+bm5uXl5ePj4+Li4uHh4eDg4N/f397e3tzc3Nvb29ra2tnZ2djY2NbW1tXV1dTU1NPT09LS0tHR0dDQ0M/Pz87Ozs3NzczMzMvLy8nJycfHx8bGxsXFxcTExMPDw8HBwcDAwL+/v76+vr29vby8vLu7u7q6urm5ubi4uLe3t7a2trW1tbS0tLOzs7KysrGxsa+vr66urq2traysrKmpqaioqKenp6ampqWlpaSkpKOjo6KioqGhoZ+fn5ycnJubm5qampmZmZiYmJeXl5aWlpWVlZSUlJOTk5KSkpGRkZCQkI+Pj46Ojo2NjYyMjIuLi4qKiomJiYeHh4aGhoSEhIODg4KCgoGBgX5+fn19fXx8fHt7e3p6end3d3Z2dnV1dXR0dHNzc3JycnBwcG5ubmxsbGtra2pqamlpaWdnZ2ZmZmNjY2FhYWBgYF9fX15eXl1dXVxcXFtbW1lZWVdXV1ZWVlVVVVRUVFNTU1JSUlFRUVBQUE9PT05OTk1NTUxMTEtLS0pKSklJSUhISEdHR0ZGRkVFRURERENDQ0JCQkFBQUBAQD8/Pz4+Pj09PTw8PDs7Ozo6Ojk5OTg4ODY2NjU1NTQ0NDMzMzIyMjExMTAwMC8vLy4uLi0tLSwsLCsrKyoqKikpKSgoKCcnJyYmJiUlJSQkJCMjIyIiIiEhISAgIB8fHx4eHh0dHRwcHBsbGxoaGhkZGRgYGBcXFxYWFhUVFRQUFBMTExISEhERERAQEA8PDw4ODg0NDQwMDAsLCwoKCgkJCQgICAcHBwYGBgUFBQQEBAMDAwICAgEBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAj/AMcJHEiw4DhyCBMqXMiwocOHECNKnEixosWFBjMOvMixo8ePIEOS06hRpMmTKFNGJJlRpcuXMDmyNBizps2bCGcWxMmz50mdBH0KHXoR6EaiSJMyNCpQqVOlTA8+nSo0KtWrWLNq3cq1q9evYMOKHUu2rNmzaNOqXcu2rdu3cOOaNDIuCYC7HenaxSuXYgRu457cBTC37uC8hvn2lQhmnDZQh0Xqjbz45qxdd8R9oPxxsuLKMV+MU1OCXJzDU8b5oLKrGy8ohwUg0aRsmy0vhyf7GFcm8qtjA44ijHTXc+rVrV8f7gCpGrVHF3DB4mwWELgMAFYVEzA4taKDB8Xl/xgcQzicwZMD+NJ1mMW48yOlIjwPwPi47yPJib8bodjGWr1M91lZCEiDyV1YjANEd+N4I8YFELQxDiODudAIDhM48AMw2TRQXGJmjGPDYH98owFlgyQSwId7peYghBJSCIAd43ySwgI35DKOgIShFcU4S9zVQDaOMHjHYcHcQs6A5CQxTg8s3iXBNobclcA0klBGRyYEoJdYakfileSSu0TjwGAo7EgdWaI8U8BgiHQzwV2pGXGYKMMsSZgVqEwjzkBURHkXItk8AAAVqkU2RioJ5PblOHbiheeS3HyiJ0LLwHLpWSD82VRCY9CZKF6hEKNnGsKRg4WgAMwwThcAnIDiy4p4SUELBJHZ58NhpVLqyaaZbmqWHKmSU4uou5Jq6l29MMNDBAMAgMQ4q9aXGGGzxFLCOGccRkQv2CmmK6/LlnnmXSeoyWRYAhhzjYd8TTJODAAcR66evSAjgwERHEEMtaySo0WN28x5Vw3CiMDZuMouecc4nJygQA23qAtAQAAh+QQBDADkACw+AFcAiQAhAIf////+/v79/f38/Pz7+/v6+vr5+fn4+Pj39/f29vb19fX09PTz8/Py8vLx8fHw8PDv7+/u7u7t7e3s7Ozr6+vq6urp6eno6Ojn5+fm5ubl5eXj4+Pi4uLh4eHg4ODf39/e3t7c3Nzb29va2trZ2dnY2NjW1tbV1dXU1NTT09PS0tLR0dHQ0NDPz8/Ozs7Nzc3MzMzLy8vJycnHx8fGxsbFxcXExMTDw8PBwcHAwMC/v7++vr69vb28vLy7u7u6urq5ubm4uLi3t7e2tra1tbW0tLSzs7OysrKxsbGvr6+urq6tra2srKypqamoqKinp6empqalpaWkpKSjo6OioqKhoaGfn5+cnJybm5uampqZmZmYmJiXl5eWlpaVlZWUlJSTk5OSkpKRkZGQkJCPj4+Ojo6NjY2MjIyLi4uKioqJiYmHh4eGhoaEhISDg4OCgoKBgYF+fn59fX18fHx7e3t6enp3d3d2dnZ1dXV0dHRzc3NycnJwcHBubm5sbGxra2tqamppaWlnZ2dmZmZjY2NhYWFgYGBfX19eXl5dXV1cXFxbW1tZWVlXV1dWVlZVVVVUVFRTU1NSUlJRUVFQUFBPT09OTk5NTU1MTExLS0tKSkpJSUlISEhHR0dGRkZFRUVERERDQ0NCQkJBQUFAQEA/Pz8+Pj49PT08PDw7Ozs6Ojo5OTk4ODg2NjY1NTU0NDQzMzMyMjIxMTEwMDAvLy8uLi4tLS0sLCwrKysqKiopKSkoKCgnJycmJiYlJSUkJCQjIyMiIiIhISEgICAfHx8eHh4dHR0cHBwbGxsaGhoZGRkYGBgXFxcWFhYVFRUUFBQTExMSEhIREREQEBAPDw8ODg4NDQ0MDAwLCwsKCgoJCQkICAgHBwcGBgYFBQUEBAQDAwMCAgIBAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAI/wDHCRxIsOA4cggTKlzIsKHDhxAjSpxIsSJCgxgHWtzIsaPHjxEzZgRJsqTJkxdFGkTJsqXLhipXvpxJs2TMgjVz6rR4k+DOn0Bh9hQYtCjQoUSNKq2J9ODSpy6bQp1KtarVq1izat3KtavXr2DDih1LtqzZs2jTql2r1ci4JADidnQLVy5bchG4jXsSF4BJun3nvg18F8w4baAIkwRs927JWbvuiPug+CNjv45JvhinpgS5OIGnjPNBZVc3XlACC0CiSdk2W14CA/YxrgzhV8cGaEwYKS5j0aRNow7cAVI1ao8u4IJVeSogcBkArComoK9oRQcPisvRN8ZucnD6Av8O4EtXYBbjwpNLijA8gN/jsK8ntz1uhGIaa/Vi3ngqAmmYxIXFOEBYN443YlwAQRvjMNKXC43gMIEDPwCTTQO+DQaAGePY0Ncf32ig2CCJBJBhXaIhqCCDDgJgxzifpLDADbmMwx9mVEUxzhJxNZCNIwbeEVgwt5DTH0JJjNPDiXFJsI0hcSUwjSSK0ZEJAeJpKJqQchFp5C7RONAXCjY295QozxTQFyLdTBCXaEYEJsowRvplBSrTiDMQFUzGhUg2DwBAxWiEjZFKArJpOU6ccs1pJDef1InQMrBIShUIerJHzhhvEipXKMTUmcZ35GDRJwAzjNMFAKf4YqJcUtB6AgFh8PkQGKiPemIppZZOJQep5NTSqa2fhhpXL8zwEMEAACAxjqnvaejXLLGUMM4ZgRHRS3SN1XqrsWCKGdcJZR6plADGXIOhXZOMEwMAwH1bZy/IyGBABEcQ8+yp5GgB4zZuxlWDMCJU5m2xRt4xDicnKFDDLeUCEBAAIfkEAQwA5AAsTgBXAHYAIQCH/////v7+/f39/Pz8+/v7+vr6+fn5+Pj49/f39vb29fX19PT08/Pz8vLy8fHx8PDw7+/v7u7u7e3t7Ozs6+vr6urq6enp6Ojo5+fn5ubm5eXl4+Pj4uLi4eHh4ODg39/f3t7e3Nzc29vb2tra2dnZ2NjY1tbW1dXV1NTU09PT0tLS0dHR0NDQz8/Pzs7Ozc3NzMzMy8vLycnJx8fHxsbGxcXFxMTEw8PDwcHBwMDAv7+/vr6+vb29vLy8u7u7urq6ubm5uLi4t7e3tra2tbW1tLS0s7OzsrKysbGxr6+vrq6ura2trKysqampqKiop6enpqampaWlpKSko6OjoqKioaGhn5+fnJycm5ubmpqamZmZmJiYl5eXlpaWlZWVlJSUk5OTkpKSkZGRkJCQj4+Pjo6OjY2NjIyMi4uLioqKiYmJh4eHhoaGhISEg4ODgoKCgYGBfn5+fX19fHx8e3t7enp6d3d3dnZ2dXV1dHR0c3NzcnJycHBwbm5ubGxsa2trampqaWlpZ2dnZmZmY2NjYWFhYGBgX19fXl5eXV1dXFxcW1tbWVlZV1dXVlZWVVVVVFRUU1NTUlJSUVFRUFBQT09PTk5OTU1NTExMS0tLSkpKSUlJSEhIR0dHRkZGRUVFREREQ0NDQkJCQUFBQEBAPz8/Pj4+PT09PDw8Ozs7Ojo6OTk5ODg4NjY2NTU1NDQ0MzMzMjIyMTExMDAwLy8vLi4uLS0tLCwsKysrKioqKSkpKCgoJycnJiYmJSUlJCQkIyMjIiIiISEhICAgHx8fHh4eHR0dHBwcGxsbGhoaGRkZGBgYFxcXFhYWFRUVFBQUExMTEhISEREREBAQDw8PDg4ODQ0NDAwMCwsLCgoKCQkJCAgIBwcHBgYGBQUFBAQEAwMDAgICAQEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACP8AxwkcSLDgOHIIEypcyLChw4cQI0qcKNGgxYEUM2rcyLGjwosXPYocSXIjSIslU6pcedLgypcwObYsGLOmzYczCd7cyTMnRp5AYfoUGLSoyqEHjSoViXSp06dQo0qdSrWq1atYs2rdyrWr169gw4odS7bsSCPjkgBY2xGtWrZaI3Ab92QtgJRu7bZNq1crmHHaQPUlmReuWYmzdt0R92GwyMJ3D0d8MU5NCXJx9E4Z54PKrm68oOgVgESTsm22vOjN62Ncmb6vjg34iTDS2sKbO38OrbcDpGrUHl3ABcvxS0DgMgBYVUyA3c2KDh4Ul8NuDNpw7OYN4EuXXhbjspP/I5owOwDc46KPJ0d9bYRiGGv1Km74JQJpmNZiGQfk+ThvYlwAQRvjMGKXC43gMIEDPwCTTQO38QWAGePYYNcf32gw2CCJBBDhW5sBKCCBBgJgxzifpLDADbmMQ19kMEUxzhJrNZCNI/7doVcwt5BTH0JJjNPDh2tJsI0hayUwjSSD0ZEJAdpJuJmObPHo4y7ROGAXCi4ap5IozxRgFyLdTLDWZkboJcowPt5lBSrTiDMQFUSuhUg2DwBABWd9jZFKAqtJOU6abK3pIzeftInQMrAoChMIcpKH0Bhn8slWKMS0mQZt5GBRJwAzjNMFAKf44iFbUtACQV/o+aAXpod6cOIoo46+JAen5NRSqauXZrpWL8zwEMEAACAxjqfnSXjXLLGUMM4ZehHRi3KGtfqqr1hqudYJXf5YkgDGXAMhXJOMEwMAuV3bZi/IyGBABEcQc+yn5GiB4jZmrlWDMCI4Zm2vPt4xDicnKFDDLd0CEBAAIfkEAQwA5AAsXgBXAGwAIQCH/////v7+/f39/Pz8+/v7+vr6+fn5+Pj49/f39vb29fX19PT08/Pz8vLy8fHx8PDw7+/v7u7u7e3t7Ozs6+vr6urq6enp6Ojo5+fn5ubm5eXl4+Pj4uLi4eHh4ODg39/f3t7e3Nzc29vb2tra2dnZ2NjY1tbW1dXV1NTU09PT0tLS0dHR0NDQz8/Pzs7Ozc3NzMzMy8vLycnJx8fHxsbGxcXFxMTEw8PDwcHBwMDAv7+/vr6+vb29vLy8u7u7urq6ubm5uLi4t7e3tra2tbW1tLS0s7OzsrKysbGxr6+vrq6ura2trKysqampqKiop6enpqampaWlpKSko6OjoqKioaGhn5+fnJycm5ubmpqamZmZmJiYl5eXlpaWlZWVlJSUk5OTkpKSkZGRkJCQj4+Pjo6OjY2NjIyMi4uLioqKiYmJh4eHhoaGhISEg4ODgoKCgYGBfn5+fX19fHx8e3t7enp6d3d3dnZ2dXV1dHR0c3NzcnJycHBwbm5ubGxsa2trampqaWlpZ2dnZmZmY2NjYWFhYGBgX19fXl5eXV1dXFxcW1tbWVlZV1dXVlZWVVVVVFRUU1NTUlJSUVFRUFBQT09PTk5OTU1NTExMS0tLSkpKSUlJSEhIR0dHRkZGRUVFREREQ0NDQkJCQUFBQEBAPz8/Pj4+PT09PDw8Ozs7Ojo6OTk5ODg4NjY2NTU1NDQ0MzMzMjIyMTExMDAwLy8vLi4uLS0tLCwsKysrKioqKSkpKCgoJycnJiYmJSUlJCQkIyMjIiIiISEhICAgHx8fHh4eHR0dHBwcGxsbGhoaGRkZGBgYFxcXFhYWFRUVFBQUExMTEhISEREREBAQDw8PDg4ODQ0NDAwMCwsLCgoKCQkJCAgIBwcHBgYGBQUFBAQEAwMDAgICAQEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACP8AxwkcSLDgOHIIEypcyLChw4cQI0qciNCgxYEUM2rcyHHixYsdQ4ocGfGjRZIoU4Y0aVCly5clWRKESbNmRZkYbepUiTPnzp8rex4ESnSj0KFFk0o8qrSp06dQo0qdSrWq1atYs2rdyrWr169gw4qlCqAsQyPjkkwsC+Bs2qRs2yqMwG3ck45s3aqVmHch2r1E4y4EM04bKLxm/b4dG1cuwlm77oj7wLGvwr+MGyd8MU5NiXFx8k4Z54PKrm68oCQWgESTsm22vCT+C8DHuDKNXx0bIJAcwUhlaZMbXfp06rwdIFWj9ugCLlga8/YFBC4DgFXFBLAdrQipuBxmY/T/HghHLu0AvnTFZZFwPPng5JKU5e4dPIAIxQjW6gWdYt+8CEiDSVlYjAPEduN4I8YFELQxDiNsudAIDhM48AMw2TTQFm0AmDGODQn98Y0GCOU1SCIBBJfWfAku2OCDZdkxzicpLHBDLuP0t1ZieUUxzhJlNZCNI+SweIdCwdzyn1lJjNPDhiuSI8E2hiCUwDSSJMQWHZkQYBaHo92RWJJl7RKNAwmhkGNGlrElyjMFmIVINxOwaESRZYkyTF5WoDKNOANRoaJ8CCGSzQMAUEGalgCMkUoCeYE5jhGO6VkWN58stIyOETUWFwiAHkTQGCz6EFcoxLCVhnsCYTGoXDOMjtMFAKf4EoCWUtACAZ5QygcAcY6heqknmnIKkadsyYGRfqWemmpZvTDDQwQDkIPEOK4CcCdg5MwSy2dnKERELxmU+OWKv5KWmLAAmIkmQiesyZdlCAlgzDUaJjbJODGkaypb7ALQCzIyGBDBEcRgO6iWWsy4zQQJ1SCMCHJFii6wAD97xzicnKBADbfkGBAAIfkEAQwA5AAsbgBXAFwAIQCH/////v7+/f39/Pz8+/v7+vr6+fn5+Pj49/f39vb29fX19PT08/Pz8vLy8fHx8PDw7+/v7u7u7e3t7Ozs6+vr6urq6enp6Ojo5+fn5ubm5eXl4+Pj4uLi4eHh4ODg39/f3t7e3Nzc29vb2tra2dnZ2NjY1tbW1dXV1NTU09PT0tLS0dHR0NDQz8/Pzs7Ozc3NzMzMy8vLycnJx8fHxsbGxcXFxMTEw8PDwcHBwMDAv7+/vr6+vb29vLy8u7u7urq6ubm5uLi4t7e3tra2tbW1tLS0s7OzsrKysbGxr6+vrq6ura2trKysqampqKiop6enpqampaWlpKSko6OjoqKioaGhn5+fnJycm5ubmpqamZmZmJiYl5eXlpaWlZWVlJSUk5OTkpKSkZGRkJCQj4+Pjo6OjY2NjIyMi4uLioqKiYmJh4eHhoaGhISEg4ODgoKCgYGBfn5+fX19fHx8e3t7enp6d3d3dnZ2dXV1dHR0c3NzcnJycHBwbm5ubGxsa2trampqaWlpZ2dnZmZmY2NjYWFhYGBgX19fXl5eXV1dXFxcW1tbWVlZV1dXVlZWVVVVVFRUU1NTUlJSUVFRUFBQT09PTk5OTU1NTExMS0tLSkpKSUlJSEhIR0dHRkZGRUVFREREQ0NDQkJCQUFBQEBAPz8/Pj4+PT09PDw8Ozs7Ojo6OTk5ODg4NjY2NTU1NDQ0MzMzMjIyMTExMDAwLy8vLi4uLS0tLCwsKysrKioqKSkpKCgoJycnJiYmJSUlJCQkIyMjIiIiISEhICAgHx8fHh4eHR0dHBwcGxsbGhoaGRkZGBgYFxcXFhYWFRUVFBQUExMTEhISEREREBAQDw8PDg4ODQ0NDAwMCwsLCgoKCQkJCAgIBwcHBgYGBQUFBAQEAwMDAgICAQEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACP8AxwkcSLDgOHIIEypcyLChw4cQI0Y0SHGgxIsYM2psWLHixo8gQybsSFGkyZMQSRpEybIlOZUFXcoUCZPgzJsba1rEyXOizoM9g3L8KbSowp9AjSpdyrSp06dQo0qdSrWq1atYs2rdyrWrVCPjkgAYCxKsWLIyI3Ab92QsAJZm3ZYNK1cmmHHaQNU9GRct1lm77oj7sFdk37dYX4xTU4JcHLlTxvmgsqsbLyhyBSDRpGybLS9y4/oYV6buq2MDdiKMNLZv5MmVL8vtAKkatUcXcMEqjBAQuAwAVhUT4DayooMHxeVwG0M1HLdxA/jSJZfFuOcvk5J7DsD1uOMvySn/HxuhmMVavXb7RYhAGqaxWMYBKT7Om5gLENqMY+TWRSMcEzjwAzDZNNAaXQCYMY4Nbv3xjQZ7DZJIAAeeFZl9+OnHHwB2jPNJCgvckMs46iGWUBTjLDFWA9k4Qt8dcgVzCznrIZTEOD1UOJYE2xgyVgLTSLIXHZkQAB2CkcFIlow07hKNA26hQCJvojxTgFuIdDPBWJEZIZcow9D4lhWoTCPOQFToOBYi2TwAABWS1TVGKgmEhuQ4XpIFJo3cfCImQsvA8mdCIJwpkEJjcBknWaEQI2YaqpGDhZoAzDBOFwCc4guFZElBCwR1eeeDXI3y6cmggQ6KkByRklOLoqMyYeroWL0ww0MEAwCAxDiTdofgW7PEUsI4Z8hFRC/A+SUqqbM6CeVYJ0zplwDGXGMgWpOMEwMArzErZi/IyGBABEcQwyul5Gjh4TZbjlWDMCIUtqysNN4xDicnKFDDLdICEBAAIfkEAQwA5AAsbgBXAFkAIQCH/////v7+/f39/Pz8+/v7+vr6+fn5+Pj49/f39vb29fX19PT08/Pz8vLy8fHx8PDw7+/v7u7u7e3t7Ozs6+vr6urq6enp6Ojo5+fn5ubm5eXl4+Pj4uLi4eHh4ODg39/f3t7e3Nzc29vb2tra2dnZ2NjY1tbW1dXV1NTU09PT0tLS0dHR0NDQz8/Pzs7Ozc3NzMzMy8vLycnJx8fHxsbGxcXFxMTEw8PDwcHBwMDAv7+/vr6+vb29vLy8u7u7urq6ubm5uLi4t7e3tra2tbW1tLS0s7OzsrKysbGxr6+vrq6ura2trKysqampqKiop6enpqampaWlpKSko6OjoqKioaGhn5+fnJycm5ubmpqamZmZmJiYl5eXlpaWlZWVlJSUk5OTkpKSkZGRkJCQj4+Pjo6OjY2NjIyMi4uLioqKiYmJh4eHhoaGhISEg4ODgoKCgYGBfn5+fX19fHx8e3t7enp6d3d3dnZ2dXV1dHR0c3NzcnJycHBwbm5ubGxsa2trampqaWlpZ2dnZmZmY2NjYWFhYGBgX19fXl5eXV1dXFxcW1tbWVlZV1dXVlZWVVVVVFRUU1NTUlJSUVFRUFBQT09PTk5OTU1NTExMS0tLSkpKSUlJSEhIR0dHRkZGRUVFREREQ0NDQkJCQUFBQEBAPz8/Pj4+PT09PDw8Ozs7Ojo6OTk5ODg4NjY2NTU1NDQ0MzMzMjIyMTExMDAwLy8vLi4uLS0tLCwsKysrKioqKSkpKCgoJycnJiYmJSUlJCQkIyMjIiIiISEhICAgHx8fHh4eHR0dHBwcGxsbGhoaGRkZGBgYFxcXFhYWFRUVFBQUExMTEhISEREREBAQDw8PDg4ODQ0NDAwMCwsLCgoKCQkJCAgIBwcHBgYGBQUFBAQEAwMDAgICAQEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACP8AyQkcSLAguXEIEypcOM6gw4cQI0qcKJGhxYQUM2rcuPHiRY4gQ4r0aFGkyZMRSTJEybLlQZUKXcocCRPjzJsaa9rEyROiToQ9gzr82VCoUYFEjypdyrSp06dQo0qdSrWq1atYs2rdyrUrRyPjkgAYGxKsWLItI3Ab92QsgJZm3ZYNK7clmHHaQNVFGRet1Vm77oj7sNdk37dWX4xTU4JcHLlTxvmgsqsbLyhyBSDRpGybLS9y4/oYV6buq2MDdpKLNLZv5MmVL8vtAKkatUcXcMHaCwhcBgCriglwG1lRw4bicriNsROO27gBfOmSy2Kc85cEnQNwPc74QXLJx0b/KIaxVq/daBFIwzQWyzggxMd5E3MBQptxjNy6aIRjgoMfwGTTQGt0AWDGODa49cc3Guw1SCIBEHhWZPPVd19+ANgxzicpLHBDLuOgh1gU4ywxVgPZOBLfHXIFcws5fg2UxDg9SDiWBNsYMlYC00iyFx2ZEPBcgZGxSJaLMO4SjQNuoRBiXaI8U4BbiHQzwViRGSGXKMPA+JYVqEwjTkJU2DgWItk8AAAVktU1RioJhEbkOFqSxSWM3HzipUDLwLInCGMCNdAYWLZJVijEeJmGaliYCcAM43QBwCm+REiWFLRAUBd3PsiFKJ6e7ElOn3vKoRo5tRTa6aGJjtULMzxEWjAAAEiM0+h2Bb41SywljHOGXET08ptfnHraqpJMjnXCk2MJYMw1A6I1yTgxAPCasV72gowMBkRwBDG2OkqOFhtuc+VYNQgjQmHFsgrjHeNwcoICNdzCLAABAQAh+QQBDADkACxrAFcAWQAhAIf////+/v79/f38/Pz7+/v6+vr5+fn4+Pj39/f29vb19fX09PTz8/Py8vLx8fHw8PDv7+/u7u7t7e3s7Ozr6+vq6urp6eno6Ojn5+fm5ubl5eXj4+Pi4uLh4eHg4ODf39/e3t7c3Nzb29va2trZ2dnY2NjW1tbV1dXU1NTT09PS0tLR0dHQ0NDPz8/Ozs7Nzc3MzMzLy8vJycnHx8fGxsbFxcXExMTDw8PBwcHAwMC/v7++vr69vb28vLy7u7u6urq5ubm4uLi3t7e2tra1tbW0tLSzs7OysrKxsbGvr6+urq6tra2srKypqamoqKinp6empqalpaWkpKSjo6OioqKhoaGfn5+cnJybm5uampqZmZmYmJiXl5eWlpaVlZWUlJSTk5OSkpKRkZGQkJCPj4+Ojo6NjY2MjIyLi4uKioqJiYmHh4eGhoaEhISDg4OCgoKBgYF+fn59fX18fHx7e3t6enp3d3d2dnZ1dXV0dHRzc3NycnJwcHBubm5sbGxra2tqamppaWlnZ2dmZmZjY2NhYWFgYGBfX19eXl5dXV1cXFxbW1tZWVlXV1dWVlZVVVVUVFRTU1NSUlJRUVFQUFBPT09OTk5NTU1MTExLS0tKSkpJSUlISEhHR0dGRkZFRUVERERDQ0NCQkJBQUFAQEA/Pz8+Pj49PT08PDw7Ozs6Ojo5OTk4ODg2NjY1NTU0NDQzMzMyMjIxMTEwMDAvLy8uLi4tLS0sLCwrKysqKiopKSkoKCgnJycmJiYlJSUkJCQjIyMiIiIhISEgICAfHx8eHh4dHR0cHBwbGxsaGhoZGRkYGBgXFxcWFhYVFRUUFBQTExMSEhIREREQEBAPDw8ODg4NDQ0MDAwLCwsKCgoJCQkICAgHBwcGBgYFBQUEBAQDAwMCAgIBAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAI/wDJCRxIsKDBgwfHKVzIsOE4hBAjSpxIUaLDiwsratzIcSJGjB1DiuT48eLIkygTlmyYsmXKlSxdygwJk+HMmxtrZsTJM6JOhT2DqtQptOjAnw+NKl3KtKnTp1CjSp1KtarVq1izat3KVauRcUkAiA35NezYlhG4jXsiFkDLsm3Jgo3bEsw4baDoooR71uqsXXfEfdA7kq9bqy/GqSlBLk7cKeN8UNnVjReUuAKQaFK2zZaXuHB9jCtD99WxATsFRhLLF7JkypbjdoBUjdqjC7hg6QUELgOAVcUEtIWs6OFDcTnaxkgNpy3cAL50xWUxrjk5oAObA2g9rvh1csjFRv8olrFWL91nEUjDJBbLOCDDx3kTcwFCm3GM2rpohGOCgx/AZNMAa3MBYMY4NrT1xzca6DVIIgEQaBZk89V3X34A2DHOJykscEMu46B3WBTjLCFWA9k4Et8dcQVzCzl9DZTEOD1IKJYE2xgiVgLTSKIXHZkQ4FyBkLE4losw7hKNA22hECJdojxTQFuIdDOBWJAZEZcow8DolhWoTCPOQlTYKBYi2TwAABWR0TVGKgmARuQ4Wo7FJYzcfOKlQMvAsicIY2In0BhYtjlWKMR4mUZq5GBhJgAzjNMFAKf4EuFYUtACAV3c+RAXonh6sic5fe4pB6Pk1FKop4cmKlYvzPBbEMEAACAxjqPbFejWLLGUMM4ZcRHRi299dfqpq0oyKdYJT4olgDHXDHjWJOPEAIBrx3rZCzIyGBDBEcTc+ig5Wmy4zZVi1SCMCIQZ2yqMd4zDyQkK1HBLswAEBAAh+QQBDADkACxrAFcAXwAhAIf////+/v79/f38/Pz7+/v6+vr5+fn4+Pj39/f29vb19fX09PTz8/Py8vLx8fHw8PDv7+/u7u7t7e3s7Ozr6+vq6urp6eno6Ojn5+fm5ubl5eXj4+Pi4uLh4eHg4ODf39/e3t7c3Nzb29va2trZ2dnY2NjW1tbV1dXU1NTT09PS0tLR0dHQ0NDPz8/Ozs7Nzc3MzMzLy8vJycnHx8fGxsbFxcXExMTDw8PBwcHAwMC/v7++vr69vb28vLy7u7u6urq5ubm4uLi3t7e2tra1tbW0tLSzs7OysrKxsbGvr6+urq6tra2srKypqamoqKinp6empqalpaWkpKSjo6OioqKhoaGfn5+cnJybm5uampqZmZmYmJiXl5eWlpaVlZWUlJSTk5OSkpKRkZGQkJCPj4+Ojo6NjY2MjIyLi4uKioqJiYmHh4eGhoaEhISDg4OCgoKBgYF+fn59fX18fHx7e3t6enp3d3d2dnZ1dXV0dHRzc3NycnJwcHBubm5sbGxra2tqamppaWlnZ2dmZmZjY2NhYWFgYGBfX19eXl5dXV1cXFxbW1tZWVlXV1dWVlZVVVVUVFRTU1NSUlJRUVFQUFBPT09OTk5NTU1MTExLS0tKSkpJSUlISEhHR0dGRkZFRUVERERDQ0NCQkJBQUFAQEA/Pz8+Pj49PT08PDw7Ozs6Ojo5OTk4ODg2NjY1NTU0NDQzMzMyMjIxMTEwMDAvLy8uLi4tLS0sLCwrKysqKiopKSkoKCgnJycmJiYlJSUkJCQjIyMiIiIhISEgICAfHx8eHh4dHR0cHBwbGxsaGhoZGRkYGBgXFxcWFhYVFRUUFBQTExMSEhIREREQEBAPDw8ODg4NDQ0MDAwLCwsKCgoJCQkICAgHBwcGBgYFBQUEBAQDAwMCAgIBAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAI/wDJCRxIsKDBgwgTGhzHsKHDh+MUSpxIsaLFghAzNrzIsaNHhRo1fhxJkmPIjCVTqjx4EuLKlytbPoRJk6RMhzVzdry5UafPiTwZ/hyaMGhEokgJGk3KtKnTp1CjSp1KtarVq1izat3KtavXrwYBiDVoZFwSimIBkDW7Mq1aghG4jXviMe3asxPtFiyLN6XbgmDGaQNVd+xetlfdvhU4a9cdcR866iXIN7HigS/GqSkxLo7dKeN8UNnVjRcUwwKQaFK2zZYXw3wB+BhXRvGrYwOEOowkNjY50KJJm7bbAVI1ao8u4II10K5eQOAyAFhVTEBa0IqOkhOXY2wM3QzhvP+NHcCXLrcsBoIP35tcErHYtXMXG6GYw1q9mJPTaxeBNExiYTEOENeN440YF0DQxjiMpOVCIzhM4MAPwGTTgFqxAWDGODYM9Mc3Gghk1yCJBNCbWfAZiKCCDIplxzifpLDADbmMox9/Y0UxzhJiNZCNI/sBANodBAVzC45qJTFODxiiSI4E2xgiUALTSNKcWHRkQsBYGQ5pmJFi7RKNAwOhYKOIhgUJgCjPFDAWIt1MkKIRaooyjF1WoDKNOA1RceJ7AiGSzQMAUBHalWOkkoBdXY5jxGJ2isXNJwUtw5xiboHAZ0QOjZGiD26FQkxaaaw3DhZ/vjXDOF0AcIovATSCJwUtEKhJTqOgDiSqpJ5UeimmYsmx0X2fhjqqWL0ww0MEA5CDxKnt9UXOLLFwdgZBRPSSAZpNvidkaIbtCoCYZAp0go1/ESSAMddcaNgk48TwLahpiQtAL8jIYEAERxADLQCViagFjNtMMFANwojwFqMozmusWHeMw8kJCtRwi40BAQAh+QQBDADkACxxAFcAWQAhAIf////+/v79/f38/Pz7+/v6+vr5+fn4+Pj39/f29vb19fX09PTz8/Py8vLx8fHw8PDv7+/u7u7t7e3s7Ozr6+vq6urp6eno6Ojn5+fm5ubl5eXj4+Pi4uLh4eHg4ODf39/e3t7c3Nzb29va2trZ2dnY2NjW1tbV1dXU1NTT09PS0tLR0dHQ0NDPz8/Ozs7Nzc3MzMzLy8vJycnHx8fGxsbFxcXExMTDw8PBwcHAwMC/v7++vr69vb28vLy7u7u6urq5ubm4uLi3t7e2tra1tbW0tLSzs7OysrKxsbGvr6+urq6tra2srKypqamoqKinp6empqalpaWkpKSjo6OioqKhoaGfn5+cnJybm5uampqZmZmYmJiXl5eWlpaVlZWUlJSTk5OSkpKRkZGQkJCPj4+Ojo6NjY2MjIyLi4uKioqJiYmHh4eGhoaEhISDg4OCgoKBgYF+fn59fX18fHx7e3t6enp3d3d2dnZ1dXV0dHRzc3NycnJwcHBubm5sbGxra2tqamppaWlnZ2dmZmZjY2NhYWFgYGBfX19eXl5dXV1cXFxbW1tZWVlXV1dWVlZVVVVUVFRTU1NSUlJRUVFQUFBPT09OTk5NTU1MTExLS0tKSkpJSUlISEhHR0dGRkZFRUVERERDQ0NCQkJBQUFAQEA/Pz8+Pj49PT08PDw7Ozs6Ojo5OTk4ODg2NjY1NTU0NDQzMzMyMjIxMTEwMDAvLy8uLi4tLS0sLCwrKysqKiopKSkoKCgnJycmJiYlJSUkJCQjIyMiIiIhISEgICAfHx8eHh4dHR0cHBwbGxsaGhoZGRkYGBgXFxcWFhYVFRUUFBQTExMSEhIREREQEBAPDw8ODg4NDQ0MDAwLCwsKCgoJCQkICAgHBwcGBgYFBQUEBAQDAwMCAgIBAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAI/wDJCRxIsKDBgwgTKjQ4rqHDhxDHLZxIsaLFhBEzOrzIsaNHgho1fhxJcmHIjCVTqiR3MuLKlx9bQoRJ86LMhzVzTry5UadPhjwl/hwqMKhQoj+NIl3KtKnTp1CjSp1KtarVq1izat3KtStCI+OSABjrEaxYsiojcBv3ZCwAlWbdlg0rVyWYcdpA1S0ZF63VWbvuiPuwd2Tft1ZfjFNTglwcuVPG+aCyqxsvKHIFINGkbJstL3Lj+hhXpu6rYwN6Cow0tm/kyZUvy+0AqRq1RxdwwdoLCFwGAKuKCXAbWZFEieJyuI2hGo7buAF86ZLLYpxzlkfJOQfgepxxluSSj/+NUGxjrV670SKQhmkslnFAiI/zJuYChDbjGLl10QjHBAc/AJNNA63RBYAZ49jg1h/faLDXIIkEUOBZkdFnH376AWDHOJ+ksMANuYyTHmJRjLPEWA1k44h8d8gVzC3k+DVQEuP0MOFYEmxjyFgJTCPJXnRkQsBzBkbWIlkvxrhLNA64hYKIdYnyTAFuIdLNBGNFZoRcogwT41tWoDKNOA5RceNYiGTzAABUSFbXGKkkEFqR42xJVpcxcvPJlwItAwufIJDZEEFjZOkmWaEQ82UaqpGDxZkAzDBOFwCc4ouEZElBCwR1deeDXInm6Qmf5PjJpxyNklOLoZ8iquhYvTBcw0MEAwCAxDiPcmfgW7PEUsI4Z8hFRC+/+eUpqK8u2eRYJ0A5lgDGXEMgWpOMEwMAryH7ZS/IyGBABEcQgyuk5GjB4TZYjlWDMCIUdqyrMd4xDicnKFDDLc4CEBAAIfkEAQwA5AAsbgBXAGMAIQCH/////v7+/f39/Pz8+/v7+vr6+fn5+Pj49/f39vb29fX19PT08/Pz8vLy8fHx8PDw7+/v7u7u7e3t7Ozs6+vr6urq6enp6Ojo5+fn5ubm5eXl4+Pj4uLi4eHh4ODg39/f3t7e3Nzc29vb2tra2dnZ2NjY1tbW1dXV1NTU09PT0tLS0dHR0NDQz8/Pzs7Ozc3NzMzMy8vLycnJx8fHxsbGxcXFxMTEw8PDwcHBwMDAv7+/vr6+vb29vLy8u7u7urq6ubm5uLi4t7e3tra2tbW1tLS0s7OzsrKysbGxr6+vrq6ura2trKysqampqKiop6enpqampaWlpKSko6OjoqKioaGhn5+fnJycm5ubmpqamZmZmJiYl5eXlpaWlZWVlJSUk5OTkpKSkZGRkJCQj4+Pjo6OjY2NjIyMi4uLioqKiYmJh4eHhoaGhISEg4ODgoKCgYGBfn5+fX19fHx8e3t7enp6d3d3dnZ2dXV1dHR0c3NzcnJycHBwbm5ubGxsa2trampqaWlpZ2dnZmZmY2NjYWFhYGBgX19fXl5eXV1dXFxcW1tbWVlZV1dXVlZWVVVVVFRUU1NTUlJSUVFRUFBQT09PTk5OTU1NTExMS0tLSkpKSUlJSEhIR0dHRkZGRUVFREREQ0NDQkJCQUFBQEBAPz8/Pj4+PT09PDw8Ozs7Ojo6OTk5ODg4NjY2NTU1NDQ0MzMzMjIyMTExMDAwLy8vLi4uLS0tLCwsKysrKioqKSkpKCgoJycnJiYmJSUlJCQkIyMjIiIiISEhICAgHx8fHh4eHR0dHBwcGxsbGhoaGRkZGBgYFxcXFhYWFRUVFBQUExMTEhISEREREBAQDw8PDg4ODQ0NDAwMCwsLCgoKCQkJCAgIBwcHBgYGBQUFBAQEAwMDAgICAQEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACP8AyQkcSLCgwYMIEypcyFDguIcQI0oc17CixYsYE07cCDGjx48gDXLkGLKkSYsjN55cybJgyoktY658KVGmzZA0I97cmTFnR55AGfp8GLSoxqFGk7pEqrSp06dQo0qdSrWq1atYs2rdyrWr169GjYxLAqCsR7FkzQKNwG3ck7IATqKFe3YsXaBgxmkDdbfkXLVfZ+26I+5DX5B/4359MU5NCXJx6E4Z54PKrm68oNAVgESTsm22vNCd62Ncmbuvjg34KTBS2b+TK1/OTLcDpGrUHl3ABetwQkDgMgBYVUwA3MmKKFIUlwNuDNZw4M4N4EsXXRbjopMjOjA6ANjjkm//J8e8bIRiHWv16g04IQJpmMpiGQfk+DhvYi5AaDOOEVwXjeAwgQM/AJNNA6/ZBYAZ49gA1x/faNDXIIkEkGBak+GnH3/+AWDHOJ+ksMANuYzDnmIKRTHOEmU1kI0j9t1BVzC3kNOeQEmM08OFZUmwjSFlJTCNJH3RkQkB0ik4mYxm0WjjLtE4ABcKJvp2kCjPFAAXIt1MUNZkRtAlyjA2xmUFKtOIAxEVPJaFSDYPAEAFZXeNkUoCoyk5TphmjWkjN5+UKdAysAiqEAhqcifQGF/SaVYoxJSZBmvkYNEmADOM0wUAp/hioVlS0ALBXeD5QBekf3piKKGGJiQHpeTUZ9KoqY9GWlYvzPAQwQAAIDGOpd8pGNcssZQwzhl0EdGLcICVeqqtUEpZ1glV3liQAMZcg6Bak4wTAwCxPVtmL8jIYEAERxDz66XkaAHiNl6WVYMwIhzmbK023jEOJycoUMMt1aJ4UEAAIfkEAQwA5AAsawBXAHYAIQCH/////v7+/f39/Pz8+/v7+vr6+fn5+Pj49/f39vb29fX19PT08/Pz8vLy8fHx8PDw7+/v7u7u7e3t7Ozs6+vr6urq6enp6Ojo5+fn5ubm5eXl4+Pj4uLi4eHh4ODg39/f3t7e3Nzc29vb2tra2dnZ2NjY1tbW1dXV1NTU09PT0tLS0dHR0NDQz8/Pzs7Ozc3NzMzMy8vLycnJx8fHxsbGxcXFxMTEw8PDwcHBwMDAv7+/vr6+vb29vLy8u7u7urq6ubm5uLi4t7e3tra2tbW1tLS0s7OzsrKysbGxr6+vrq6ura2trKysqampqKiop6enpqampaWlpKSko6OjoqKioaGhn5+fnJycm5ubmpqamZmZmJiYl5eXlpaWlZWVlJSUk5OTkpKSkZGRkJCQj4+Pjo6OjY2NjIyMi4uLioqKiYmJh4eHhoaGhISEg4ODgoKCgYGBfn5+fX19fHx8e3t7enp6d3d3dnZ2dXV1dHR0c3NzcnJycHBwbm5ubGxsa2trampqaWlpZ2dnZmZmY2NjYWFhYGBgX19fXl5eXV1dXFxcW1tbWVlZV1dXVlZWVVVVVFRUU1NTUlJSUVFRUFBQT09PTk5OTU1NTExMS0tLSkpKSUlJSEhIR0dHRkZGRUVFREREQ0NDQkJCQUFBQEBAPz8/Pj4+PT09PDw8Ozs7Ojo6OTk5ODg4NjY2NTU1NDQ0MzMzMjIyMTExMDAwLy8vLi4uLS0tLCwsKysrKioqKSkpKCgoJycnJiYmJSUlJCQkIyMjIiIiISEhICAgHx8fHh4eHR0dHBwcGxsbGhoaGRkZGBgYFxcXFhYWFRUVFBQUExMTEhISEREREBAQDw8PDg4ODQ0NDAwMCwsLCgoKCQkJCAgIBwcHBgYGBQUFBAQEAwMDAgICAQEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACP8AyQkcSLCgwYMIEypcyLAhwnEQI0qcOM6hxYsYM2okSLFjxI0gQ4rE6NHjyJMoU5Ir2VGly5cWWVKESbOmQZkTbeqsiVPizp8ue34ESlSkUIhFk248WlGp05hHn0qdSrWq1atYs2rdyrWr169gw4odS7as2Y1GxiUBwFZj2rVtt0bgNu4JWwAn3951q3bvVjDjtIHyK1Jv3LMMZ+26I+4DYZCG8SJe+GKcmhLk4uydMs4HlV3deEHZKwCJJmXbbHnZq9fHuDJ+Xx0bMFRgJLaGOXsGLXpvB0jVqD26gAvWY5WAwGUAsKqYgLucFVWsKC7H3Ri14dzVG8CXrr0sxmn/X9lUoHYAucdJX0muOtsIxT7W6mX8sEoE0jCxxTIOCPRx3ohxAQRtjMPIXS40gsMEDvwATDYN4NYXAGaMY8Ndf3yjAWGDJBKAhHBxFuCABR4IgB3jfJLCAjfkMk59krkUxThLsNVANo78d8dewdxCjn0CJTFODyCyJcE2hrCVwDSSEEZHJgRsNyFnO7bV44+7ROPAXSi8eBxKojxTwF2IdDMBW5wZsZcow/yIlxWoTCNORFQUyRYi2TwAABWd+TVGKgmwNuU4arbF5o/cfOKmQMvAsqhLIMyJ1EBjoNlnW6EQ42YatZGDhZ0AzDBOFwCc4suHbUlBCwR+pefDXpkic+rJo40+qpIcnZJTi6WvYqopW70ww0MEAwCAxDifojchXrPEUsI4Z+xFRC/LHeYqrL9muSVbJ3gJ5EgCGHNNhHFNMk4MAOiGrZu9ICODAREcQQyyoJKjRYrbnMlWDcKI8Ni1vv54xzicnKBADbd4GyNKAQEAIfkEAQwA5AAsawBXAIYAIQCH/////v7+/f39/Pz8+/v7+vr6+fn5+Pj49/f39vb29fX19PT08/Pz8vLy8fHx8PDw7+/v7u7u7e3t7Ozs6+vr6urq6enp6Ojo5+fn5ubm5eXl4+Pj4uLi4eHh4ODg39/f3t7e3Nzc29vb2tra2dnZ2NjY1tbW1dXV1NTU09PT0tLS0dHR0NDQz8/Pzs7Ozc3NzMzMy8vLycnJx8fHxsbGxcXFxMTEw8PDwcHBwMDAv7+/vr6+vb29vLy8u7u7urq6ubm5uLi4t7e3tra2tbW1tLS0s7OzsrKysbGxr6+vrq6ura2trKysqampqKiop6enpqampaWlpKSko6OjoqKioaGhn5+fnJycm5ubmpqamZmZmJiYl5eXlpaWlZWVlJSUk5OTkpKSkZGRkJCQj4+Pjo6OjY2NjIyMi4uLioqKiYmJh4eHhoaGhISEg4ODgoKCgYGBfn5+fX19fHx8e3t7enp6d3d3dnZ2dXV1dHR0c3NzcnJycHBwbm5ubGxsa2trampqaWlpZ2dnZmZmY2NjYWFhYGBgX19fXl5eXV1dXFxcW1tbWVlZV1dXVlZWVVVVVFRUU1NTUlJSUVFRUFBQT09PTk5OTU1NTExMS0tLSkpKSUlJSEhIR0dHRkZGRUVFREREQ0NDQkJCQUFBQEBAPz8/Pj4+PT09PDw8Ozs7Ojo6OTk5ODg4NjY2NTU1NDQ0MzMzMjIyMTExMDAwLy8vLi4uLS0tLCwsKysrKioqKSkpKCgoJycnJiYmJSUlJCQkIyMjIiIiISEhICAgHx8fHh4eHR0dHBwcGxsbGhoaGRkZGBgYFxcXFhYWFRUVFBQUExMTEhISEREREBAQDw8PDg4ODQ0NDAwMCwsLCgoKCQkJCAgIBwcHBgYGBQUFBAQEAwMDAgICAQEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACP8AyQkcSLCgwYMIEypcyLChQ4XjIkqcSHHcw4sYM2rc6LCiR4kcQ4ocSZLgx48lU6pcmfCkR5YwY5J0WVGmzZsXaVLEybPnQZ0TfQr1CRTk0KMyi0ZEypSlUotNo85UKrWq1atYs2rdyrWr169gw4odS7as2bNo06ptCqCtQSPjkjRsC+BtXLN06xKMwG3cE4107cplGLgg3MFk8xYEM04bKMBuDd9dC7mwwFm77oj7kNHywMOUO+fVS+7FODUlxsUJPGWcDyq7uvGCElkAEk3KttnyEvkwAB/jyox+dWzA0omR2vom1/p17NmBO0CqRu3RBVywjgYuDAhcBgCrign/oNtaEVRy4nK4jXE8Ihy9vgP40pWXxcD27pWTS9K2/Pn0bUVQzES19JKdUIUFhoA0mLSFxThAkDeON2JcAEEb4zBClwuN4DCBAz8Ak00DdfkGgBnj2DDQH99oIFBggyQSgHJx9TdhhRdm2JYd43ySwgI35DLOgT4l6FYU4yzRVgPZOEKOjXcQFMwtRtaVxDg9lFgjORJsY4hACUwjyUB00ZEJAW6Z2NodkU3Z1i7RODAQCkMOZRldojxTgFuIdDOBjUY82ZYowwRmBSrTiCMRFTTyJxAi2TwAABWukQnAGKkkEJia4xhBGqFtcfNJQcsQydNoeYGgqEUTjWGjD3mFm0IMXWngNw4Wjeo1wzhdAHCKLwGQKQUtEAiqJX8ANEearKF6QqqpOKFKlxwgEfhqrLO21QszPEQwADlI3KofYuTMEktqZxBERC8ZvJhmjcm6FhmzAMApp0An1NmTYgQJYMw1JEY2yTgxxAsrXfQC0AsyMhgQwRHEiAsAaC9q0eM2EwxUgzAi6LUpvMoinO0d43ByggI13KIvTwEBACH5BAEMAOQALHEAVwCQACEAh/////7+/v39/fz8/Pv7+/r6+vn5+fj4+Pf39/b29vX19fT09PPz8/Ly8vHx8fDw8O/v7+7u7u3t7ezs7Ovr6+rq6unp6ejo6Ofn5+bm5uXl5ePj4+Li4uHh4eDg4N/f397e3tzc3Nvb29ra2tnZ2djY2NbW1tXV1dTU1NPT09LS0tHR0dDQ0M/Pz87Ozs3NzczMzMvLy8nJycfHx8bGxsXFxcTExMPDw8HBwcDAwL+/v76+vr29vby8vLu7u7q6urm5ubi4uLe3t7a2trW1tbS0tLOzs7KysrGxsa+vr66urq2traysrKmpqaioqKenp6ampqWlpaSkpKOjo6KioqGhoZ+fn5ycnJubm5qampmZmZiYmJeXl5aWlpWVlZSUlJOTk5KSkpGRkZCQkI+Pj46Ojo2NjYyMjIuLi4qKiomJiYeHh4aGhoSEhIODg4KCgoGBgX5+fn19fXx8fHt7e3p6end3d3Z2dnV1dXR0dHNzc3JycnBwcG5ubmxsbGtra2pqamlpaWdnZ2ZmZmNjY2FhYWBgYF9fX15eXl1dXVxcXFtbW1lZWVdXV1ZWVlVVVVRUVFNTU1JSUlFRUVBQUE9PT05OTk1NTUxMTEtLS0pKSklJSUhISEdHR0ZGRkVFRURERENDQ0JCQkFBQUBAQD8/Pz4+Pj09PTw8PDs7Ozo6Ojk5OTg4ODY2NjU1NTQ0NDMzMzIyMjExMTAwMC8vLy4uLi0tLSwsLCsrKyoqKikpKSgoKCcnJyYmJiUlJSQkJCMjIyIiIiEhISAgIB8fHx4eHh0dHRwcHBsbGxoaGhkZGRgYGBcXFxYWFhUVFRQUFBMTExISEhERERAQEA8PDw4ODg0NDQwMDAsLCwoKCgkJCQgICAcHBwYGBgUFBQQEBAMDAwICAgEBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAj/AMkJHEiwoMGDCBMqXMiwocOHBcdJnEix4jiIGDNq3Mgxo8WPEzuKHEmyZEKQIE2qXMnyIcqPLWPKjPnS4sybOEXWrJizp0+HOyn+HEo0YlCJRZP+PIpUqdObTC8+ndoyKtWrWLNq3cq1q9evYMOKHUu2rNmzaNOqXcu2rUkj45IAmKsRrly6bg9G4DbuyVwAJO3+rRt3cF6DYMZpA2VYpGC8h1fO2nVH3IfGHB8DjqzyxTg1JcjFGTxlnA8qu7rxgjJYABJNyrbZ8jJYsI9xZQy/OjYg5MBIcx+XPp169eAOkKpRe3QBFyzMWwGBywBgVTEBf0srunhRXI6/MXyT/4PzV3AAX7oGsxhHnlxTgeQBCB+33T0573MjFAtZq9dzyFshIA0mc2ExDhDZjeONGBdA0MY4jPzlQiM4TODAD8Bk00BwhQFgxjg2/PXHNxo0NkgiAXB4V2kLNvhghADYMc4nKSxwQy7j/LcZV1GMs8RcDWTjSIJ3DBbMLeQAKFAS4/Sg4lwSbGPIXAlMI0ljdGRCQHkdllYkXUcmuUs0DvyFQo7QZSXKMwX8hUg3E8xVmhGDiTJMkoBZgco04kxExZNzIZLNAwBQYZphY6SSQG1djkMnXXYmyc0neAq0DCyVcgVCn++RM4ach9IVCjF4piEeOVgACsAM43QBwCm+pH9IlxS0QGDYfD4MNqqknmR6aaZbyXEqObWAmquopM7VCzM8RDAAAEiMk6p8HQI2SywljHPGYET0Qh1kuOqa7JhlznUCmkpeJYAx12yI1yTjxADAcOLi2QsyMhgQwRHESKsqOVrMuE2cc9UgjAiYhYtskneMw8kJCtRwC7o7ZhUQACH5BAEMAOQALG4AVwCjACEAh/////7+/v39/fz8/Pv7+/r6+vn5+fj4+Pf39/b29vX19fT09PPz8/Ly8vHx8fDw8O/v7+7u7u3t7ezs7Ovr6+rq6unp6ejo6Ofn5+bm5uXl5ePj4+Li4uHh4eDg4N/f397e3tzc3Nvb29ra2tnZ2djY2NbW1tXV1dTU1NPT09LS0tHR0dDQ0M/Pz87Ozs3NzczMzMvLy8nJycfHx8bGxsXFxcTExMPDw8HBwcDAwL+/v76+vr29vby8vLu7u7q6urm5ubi4uLe3t7a2trW1tbS0tLOzs7KysrGxsa+vr66urq2traysrKmpqaioqKenp6ampqWlpaSkpKOjo6KioqGhoZ+fn5ycnJubm5qampmZmZiYmJeXl5aWlpWVlZSUlJOTk5KSkpGRkZCQkI+Pj46Ojo2NjYyMjIuLi4qKiomJiYeHh4aGhoSEhIODg4KCgoGBgX5+fn19fXx8fHt7e3p6end3d3Z2dnV1dXR0dHNzc3JycnBwcG5ubmxsbGtra2pqamlpaWdnZ2ZmZmNjY2FhYWBgYF9fX15eXl1dXVxcXFtbW1lZWVdXV1ZWVlVVVVRUVFNTU1JSUlFRUVBQUE9PT05OTk1NTUxMTEtLS0pKSklJSUhISEdHR0ZGRkVFRURERENDQ0JCQkFBQUBAQD8/Pz4+Pj09PTw8PDs7Ozo6Ojk5OTg4ODY2NjU1NTQ0NDMzMzIyMjExMTAwMC8vLy4uLi0tLSwsLCsrKyoqKikpKSgoKCcnJyYmJiUlJSQkJCMjIyIiIiEhISAgIB8fHx4eHh0dHRwcHBsbGxoaGhkZGRgYGBcXFxYWFhUVFRQUFBMTExISEhERERAQEA8PDw4ODg0NDQwMDAsLCwoKCgkJCQgICAcHBwYGBgUFBQQEBAMDAwICAgEBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAj/AMkJHEiwoMGDCBMqXMiwocOHEBGOm0ixosVxETNq3Mixo0eJF0NO/EiypMmTGUWKRMmypcuSKkO+nEmzZsKYF23q3PkSp0WeQIN+9FlRqNGjD4lSRMq0aUGlI51KRQoV49SrQati3cq1q9evYMOKHUu2rNmzaNOqXcu2rdu3cOPKNWpkXBIAeDXWvZt3LscI3MY9wQuA5F7Ceu0i9rsRzDhtoBZ7PNyXsdBZu+6I+yCZI+XCloO+GKemBLk4iKeM80FlVzdeUBALQKJJ2TZbXhAf9jGuzOJXxwYsHRgJL2XVrF3DRtwBUjVqjy7ggtXZLSBwGQCsKiaAsGpFGDGK/8tBOMZwcnAIHw7gSxdiFuPSk4sqMD2A4+PAzyc3Hm+EYkvV0gt1lbmFgDSY4IXFOEB4N443YlwAQRvjMEKYC43gMIEDPwCTTQPGKQaAGePYQNgf32gg2SCJBBAiX6pBKCGFFgJgxzifpLDADbmMQyBob0UxzhJ4NZCNIw7egVgwt5BToEBJjNPDi3hJsI0heCUwjSSS0ZEJAeqJqJqSeTHp5C7ROEAYCj5Wx5YozxRAGCLdTICXakYgJsowThZmBSrTiEMRFVTihUg2DwBAxWqLjZFKArqJOU6eee3pJDef9CnQMrBo+hYIgtJHzhh3MppXKMT0mcZ55GBRKAAzjIXTBQCn+OJiXlLQAsFi+PmAGKqXeuIpp566JQer5NRSqq+npopXL8zwEMEAACAxjqv3iVjYLLGUMM4ZiBHRS3aV9fqrs2iqidcJbT6plgDGXANiX5OMEwMAyJ3bZy/IyGBABEcQc+2r5GiB4zZ24lWDMCJ0Zm6zTt4xDicnKFDDLe0CyVZAACH5BAEMAOQALGsAVwC2ACEAh/////7+/v39/fz8/Pv7+/r6+vn5+fj4+Pf39/b29vX19fT09PPz8/Ly8vHx8fDw8O/v7+7u7u3t7ezs7Ovr6+rq6unp6ejo6Ofn5+bm5uXl5ePj4+Li4uHh4eDg4N/f397e3tzc3Nvb29ra2tnZ2djY2NbW1tXV1dTU1NPT09LS0tHR0dDQ0M/Pz87Ozs3NzczMzMvLy8nJycfHx8bGxsXFxcTExMPDw8HBwcDAwL+/v76+vr29vby8vLu7u7q6urm5ubi4uLe3t7a2trW1tbS0tLOzs7KysrGxsa+vr66urq2traysrKmpqaioqKenp6ampqWlpaSkpKOjo6KioqGhoZ+fn5ycnJubm5qampmZmZiYmJeXl5aWlpWVlZSUlJOTk5KSkpGRkZCQkI+Pj46Ojo2NjYyMjIuLi4qKiomJiYeHh4aGhoSEhIODg4KCgoGBgX5+fn19fXx8fHt7e3p6end3d3Z2dnV1dXR0dHNzc3JycnBwcG5ubmxsbGtra2pqamlpaWdnZ2ZmZmNjY2FhYWBgYF9fX15eXl1dXVxcXFtbW1lZWVdXV1ZWVlVVVVRUVFNTU1JSUlFRUVBQUE9PT05OTk1NTUxMTEtLS0pKSklJSUhISEdHR0ZGRkVFRURERENDQ0JCQkFBQUBAQD8/Pz4+Pj09PTw8PDs7Ozo6Ojk5OTg4ODY2NjU1NTQ0NDMzMzIyMjExMTAwMC8vLy4uLi0tLSwsLCsrKyoqKikpKSgoKCcnJyYmJiUlJSQkJCMjIyIiIiEhISAgIB8fHx4eHh0dHRwcHBsbGxoaGhkZGRgYGBcXFxYWFhUVFRQUFBMTExISEhERERAQEA8PDw4ODg0NDQwMDAsLCwoKCgkJCQgICAcHBwYGBgUFBQQEBAMDAwICAgEBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAj/AMkJHEiwoMGDCBMqXMiwocOHECMqHEexosWL4yRq3Mixo8ePGzGKrAiypMmTKFMKHDlSpcuXMGOuZIlRps2bOCHSrJmzp0+fOy/+HEoUZlCLRZMqBXmU5NKnUB02pRi1qlWDUzNe3Vo1K9evYMOKHUu2rNmzaNOqXcu2rdu3cOPKnUu3rt27UY2MSwKgr0a9fP3ijRmB27gnfQGABJz4797Gg2GCGacNFGSPjAVH5jpr1x1xHy5zzKx489YX49SUIBen8ZRxPqjs6sYLSmMBSDQp22bLS2PGPsaVgfzq2ACnAiP1zfw69uzajTtAqkbt0QVcsESbLggIXAYAq4oJ/0j8WlHGjOJyJI6BHE5ixgF86WrMYpx7clQHugfAfJx5/OSk11cExZBUSy/ZabYdQQhIg0lfWIwDBHnjeCPGBRC0MQ4jibnQCA4TOPADMNk0sNxjAJgxjg2J/fGNBpcNkkgAJwb2moUYasghAHaM80kKC9yQyzgJlrYgQVGMs0RfDWTjCIV3NBbMLeQoKFAS4/RQY18SbGNIXwlMI8lldGRCwHsovhalX1NWuUs0DiSGApHaHSnKMwUkhkg3E/T1mhGNiTJMlYpZgco04lRExZZ9IZLNAwBQARtkY6SSwG9pjgOoX4JWyc0nhAq0DCyhHjkQCInmJ9AYfk7qVyjEEJGaBnLkYMEoADOM0wUAp/hCo19S0AIBZP350BisnnpS6qilmkqOHLSSU0urxr4aa1+9MMNDBAMAgMQ4tvKHomKzxFLCOGc0RkQv32lW7LHXvhlnXyfQaeV2AhhzjYmCTTJODAA0By+hvSAjgwERHEEMuLeSo4WP2/TZVw3CiCDau9ZWecc4nJygQA232GvkkQEBADs=";

function base64ToU8(b64) {
  const bin = atob(String(b64 || ""));
  const len = bin.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function tgSendAnimationUpload(env, chatId, gifBytes, filename = "marketiq-thinking.gif", captionHtml, replyMarkup) {
  const boundary = "----tgform" + Math.random().toString(16).slice(2);
  const CRLF = "\r\n";

  const parts = [];
  const push = (s) => parts.push(typeof s === "string" ? new TextEncoder().encode(s) : s);

  push(`--${boundary}${CRLF}`);
  push(`Content-Disposition: form-data; name="chat_id"${CRLF}${CRLF}`);
  push(String(chatId) + CRLF);

  if (captionHtml) {
    push(`--${boundary}${CRLF}`);
    push(`Content-Disposition: form-data; name="caption"${CRLF}${CRLF}`);
    push(String(captionHtml).slice(0, 900) + CRLF);

    push(`--${boundary}${CRLF}`);
    push(`Content-Disposition: form-data; name="parse_mode"${CRLF}${CRLF}`);
    push("HTML" + CRLF);
  }

  if (replyMarkup) {
    push(`--${boundary}${CRLF}`);
    push(`Content-Disposition: form-data; name="reply_markup"${CRLF}${CRLF}`);
    push(JSON.stringify(replyMarkup) + CRLF);
  }

  push(`--${boundary}${CRLF}`);
  push(`Content-Disposition: form-data; name="animation"; filename="${filename}"${CRLF}`);
  push(`Content-Type: image/gif${CRLF}${CRLF}`);
  push(new Uint8Array(gifBytes));
  push(CRLF);

  push(`--${boundary}--${CRLF}`);

  const body = concatU8(parts);
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendAnimation`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  });
  const j = await r.json().catch(() => null);
  if (!j || !j.ok) console.error("Telegram sendAnimation(upload) error:", j);
  return j;
}

async function tgSendThinking(env, chatId, replyMarkup) {
  try {
    const bytes = base64ToU8(MARKETIQ_THINKING_GIF_B64);
    
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return await tgSendAnimationUpload(env, chatId, buf, "marketiq-thinking.gif", "<b>MARKET IQ THINKING…</b>", replyMarkup);
  } catch (e) {
    return tgSendMessageHtml(env, chatId, "⏳ <b>MARKET IQ THINKING…</b>", replyMarkup);
  }
}




function thinkingMsgKey(userId) {
  return `analysis:thinking_msg:${String(userId)}`;
}

async function saveThinkingMsgId(env, userId, messageId, ttlSec) {
  if (!env.BOT_KV) return;
  const id = Number(messageId || 0);
  if (!id) return;
  const ttl = Math.max(30, Math.min(3600, Number(ttlSec || 600)));
  try {
    await env.BOT_KV.put(thinkingMsgKey(userId), String(id), { expirationTtl: ttl });
  } catch {}
}

async function loadThinkingMsgId(env, userId) {
  if (!env.BOT_KV) return 0;
  try {
    const v = await env.BOT_KV.get(thinkingMsgKey(userId));
    const n = Number(v || 0);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

async function clearThinkingMsgId(env, userId) {
  if (!env.BOT_KV) return;
  try { await env.BOT_KV.delete(thinkingMsgKey(userId)); } catch {}
}

async function tgDeleteMessage(env, chatId, messageId) {
  const mid = Number(messageId || 0);
  if (!mid) return null;
  return tgApi(env, "deleteMessage", { chat_id: chatId, message_id: mid });
}

async function tgApi(env, method, payload) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => null);
  if (!j || !j.ok) console.error("Telegram API error:", method, j);
  return j;
}
async function tgSendMessage(env, chatId, text, replyMarkup) {
  
  const safe = String(text == null ? "" : text).slice(0, 4090);
  return tgApi(env, "sendMessage", {
    chat_id: chatId,
    text: safe,
    reply_markup: replyMarkup,
    disable_web_page_preview: true,
  });
}

async function tgSendLongMessage(env, chatId, text, replyMarkup) {
  const chunkSize = toInt(env.TG_CHUNK_SIZE, 3500);
  const delayMs = toInt(env.TG_CHUNK_DELAY_MS, 80);

  const parts = chunkText(String(text || ""), chunkSize).filter((p) => String(p || "").trim().length);
  if (!parts.length) return tgSendMessage(env, chatId, "", replyMarkup);

  for (let i = 0; i < parts.length; i++) {
    const isLast = i === parts.length - 1;
    const rm = isLast ? replyMarkup : undefined; 
    await tgSendMessage(env, chatId, parts[i], rm);
    if (!isLast && delayMs > 0) await sleep(delayMs);
  }
}

function isModelHeadingLine(line) {
  const raw = String(line == null ? "" : line);
  const t = raw.trim();
  if (!t) return false;

  
  if (/^#{1,6}\s+/.test(t)) return true;

  
  if (/^(?:\d+|[۰-۹]+)\s*[\.\)]\s+/.test(t)) return true;

  
  if (/[:：]\s*$/.test(t) && t.length <= 80 && t.split(/\s+/).length <= 12 && !/https?:\/\//i.test(t)) return true;

  
  const noEmoji = t.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D]+\s*/u, "");
  const base = noEmoji.replace(/[:：]\s*$/, "");

  const known = [
    "Market Structure",
    "Key Levels",
    "Candlestick Behavior",
    "Entry Scenarios",
    "Bias & Scenarios",
    "Bias and Scenarios",
    "Execution Plan",

    "ساختار بازار",
    "سطوح کلیدی",
    "رفتار کندلی",
    "رفتار کندل",
    "سناریوهای ورود",
    "سناریو ورود",
    "بایاس و سناریوها",
    "بایاس و سناریو",
    "پلن اجرا",
    "برنامه اجرا",
    "برنامه‌ی اجرا",
    "پلن اجرایی",
  ];

  return known.some((k) => base === k || base.startsWith(k + " ") || base.startsWith(k + " -") || base.startsWith(k + " –") || base.startsWith(k + " —"));
}


function formatModelOutputBoldHeadingsHtml(text) {
  const src = String(text == null ? "" : text);
  const lines = src.split(/\r?\n/);
  return lines
    .map((line) => {
      const escaped = escapeHtml(line);
      return isModelHeadingLine(line) ? `<b>${escaped}</b>` : escaped;
    })
    .join("\n");
}

async function tgSendLongMessageHtml(env, chatId, html, replyMarkup) {
  const chunkSize = toInt(env.TG_CHUNK_SIZE, 3500);
  const delayMs = toInt(env.TG_CHUNK_DELAY_MS, 80);

  const parts = chunkText(String(html || ""), chunkSize).filter((p) => String(p || "").trim().length);
  if (!parts.length) return tgSendMessageHtml(env, chatId, "", replyMarkup);

  for (let i = 0; i < parts.length; i++) {
    const isLast = i === parts.length - 1;
    const rm = isLast ? replyMarkup : undefined; 
    await tgSendMessageHtml(env, chatId, parts[i], rm);
    if (!isLast && delayMs > 0) await sleep(delayMs);
  }
}

async function tgSendMessageHtml(env, chatId, html, replyMarkup) {
  const safe = String(html == null ? "" : html).slice(0, 4090);
  return tgApi(env, "sendMessage", {
    chat_id: chatId,
    text: safe,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
    disable_web_page_preview: false,
  });
}


function injectAdminMobileCss(html, href) {
  const h = String(html || "");
  const u = String(href || "").trim();
  if (!u) return h;
  if (h.includes(u)) return h;
  const tag = `<link rel="stylesheet" href="${u}">`;
  if (h.includes("</head>")) return h.replace("</head>", `  ${tag}\n</head>`);
  return tag + "\n" + h;
}

function adminNotifyChatId(env) {
  const id = env && env.SUPPORT_CHAT_ID ? Number(env.SUPPORT_CHAT_ID) : 0;
  return Number.isFinite(id) ? id : 0;
}

async function notifyAdminPayment(env, payment, event = "created") {
  const chatId = adminNotifyChatId(env);
  if (!chatId) return;
  const p = payment || {};
  const evt = String(event || "").toLowerCase();
  const title = (evt === "approved") ? "✅ پرداخت تایید شد" : (evt === "rejected") ? "❌ پرداخت رد شد" : "💳 پرداخت جدید";
  const uname = p.username ? ("@" + String(p.username).replace(/^@/, "")) : "";
  const uid = String(p.userId || "-");
  const amount = (p.amount == null) ? "-" : String(p.amount);
  const tx = String(p.txHash || "-");
  const plan = String(p.planId || p.plan || p.type || "-");
  const source = String(p.source || "subscription");

  let checkLine = "";
  try {
    if (p.verifyResult && typeof p.verifyResult === "object") {
      const ok = !!p.verifyResult.ok;
      checkLine = `چک بلاک‌چین: ${ok ? "ok" : "fail"}`;
    }
  } catch (e) {}

  const scanBase = String(env?.BSCSCAN_TX_BASE || "https://bscscan.com/tx/");
  const link = (tx && tx.startsWith("0x") && tx.length >= 10) ? (scanBase + tx) : "";

  const msg = `${title}\nشناسه: ${p.id || "-"}\nکاربر: ${uname || "-"}\nChatID: ${uid}\nنوع/پلن: ${plan}\nمبلغ: ${amount}\nTxHash: ${tx}\nوضعیت: ${p.status || evt || "pending"}\nمنبع: ${source}${checkLine ? "\n" + checkLine : ""}${link ? "\nلینک: " + link : ""}`;
  await tgSendMessage(env, chatId, msg);
}

async function notifyAdminWithdrawal(env, withdrawal, event = "created") {
  const chatId = adminNotifyChatId(env);
  if (!chatId) return;
  const w = withdrawal || {};
  const evt = String(event || "").toLowerCase();
  const title = (evt === "approved") ? "✅ برداشت تایید شد" : (evt === "rejected") ? "❌ برداشت رد شد" : "🏧 درخواست برداشت جدید";
  const uname = w.username ? ("@" + String(w.username).replace(/^@/, "")) : "";
  const uid = String(w.userId || "-");
  const amount = (w.amount == null) ? "-" : String(w.amount);
  const addr = String(w.address || "-");
  const tx = String(w.txHash || "-");
  const msg = `${title}\nشناسه: ${w.id || "-"}\nکاربر: ${uname || "-"}\nChatID: ${uid}\nمبلغ: ${amount}\nآدرس: ${addr}\nوضعیت: ${w.status || evt || "pending"}\nTxHash: ${tx}`;
  await tgSendMessage(env, chatId, msg);
}

async function tgSendPhoto(env, chatId, photoUrl, caption, replyMarkup) {
  return tgApi(env, "sendPhoto", {
    chat_id: chatId,
    photo: photoUrl,
    caption: caption ? String(caption).slice(0, 900) : undefined,
    reply_markup: replyMarkup,
  });
}

async function tgSendPhotoUpload(env, chatId, photoBytes, filename = "chart.png", caption, replyMarkup) {
  const boundary = "----tgform" + Math.random().toString(16).slice(2);
  const CRLF = "\r\n";

  const parts = [];
  const push = (s) => parts.push(typeof s === "string" ? new TextEncoder().encode(s) : s);

  push(`--${boundary}${CRLF}`);
  push(`Content-Disposition: form-data; name="chat_id"${CRLF}${CRLF}`);
  push(String(chatId) + CRLF);

  if (caption) {
    push(`--${boundary}${CRLF}`);
    push(`Content-Disposition: form-data; name="caption"${CRLF}${CRLF}`);
    push(String(caption).slice(0, 900) + CRLF);
  }

  if (replyMarkup) {
    push(`--${boundary}${CRLF}`);
    push(`Content-Disposition: form-data; name="reply_markup"${CRLF}${CRLF}`);
    push(JSON.stringify(replyMarkup) + CRLF);
  }

  push(`--${boundary}${CRLF}`);
  push(`Content-Disposition: form-data; name="photo"; filename="${filename}"${CRLF}`);
  push(`Content-Type: image/png${CRLF}${CRLF}`);
  push(new Uint8Array(photoBytes));
  push(CRLF);

  push(`--${boundary}--${CRLF}`);

  const body = concatU8(parts);
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  });
  const j = await r.json().catch(() => null);
  if (!j || !j.ok) console.error("Telegram sendPhoto(upload) error:", j);
  return j;
}

async function tgSendPhotoSmart(env, chatId, photoUrl, caption, replyMarkup) {
  let j = null;
  try {
    const preferUpload = String(env.TG_PHOTO_UPLOAD_FIRST || "") === "1" || String(photoUrl || "").includes("quickchart.io/chart");
    if (preferUpload) {
      const r = await fetch(photoUrl);
      if (!r.ok) return await tgSendPhoto(env, chatId, photoUrl, caption, replyMarkup);
      const buf = await r.arrayBuffer();
      const uploadRes = await tgSendPhotoUpload(env, chatId, buf, "chart.png", caption, replyMarkup);
      if (uploadRes?.ok) return uploadRes;
    }
    j = await tgSendPhoto(env, chatId, photoUrl, caption, replyMarkup);
    if (j?.ok) return j;

    const r = await fetch(photoUrl);
    if (!r.ok) return j;
    const buf = await r.arrayBuffer();
    return await tgSendPhotoUpload(env, chatId, buf, "chart.png", caption, replyMarkup);
  } catch (e) {
    console.error("tgSendPhotoSmart fallback failed:", e?.message || e);
    return j;
  }
}

async function tgSendChatAction(env, chatId, action) {
  return tgApi(env, "sendChatAction", { chat_id: chatId, action });
}
async function tgGetFilePath(env, fileId) {
  const j = await tgApi(env, "getFile", { file_id: fileId });
  return j?.result?.file_path || "";
}


async function tgSendSvgDocument(env, chatId, svgText, filename = "zones.svg", caption = "🖼️ نقشه زون‌ها") {
  const boundary = "----tgform" + Math.random().toString(16).slice(2);
  const CRLF = "\r\n";

  const parts = [];
  const push = (s) => parts.push(typeof s === "string" ? new TextEncoder().encode(s) : s);

  push(`--${boundary}${CRLF}`);
  push(`Content-Disposition: form-data; name="chat_id"${CRLF}${CRLF}`);
  push(String(chatId) + CRLF);

  push(`--${boundary}${CRLF}`);
  push(`Content-Disposition: form-data; name="caption"${CRLF}${CRLF}`);
  push(String(caption) + CRLF);

  push(`--${boundary}${CRLF}`);
  push(`Content-Disposition: form-data; name="document"; filename="${filename}"${CRLF}`);
  push(`Content-Type: image/svg+xml${CRLF}${CRLF}`);
  push(svgText + CRLF);

  push(`--${boundary}--${CRLF}`);

  const body = concatU8(parts);
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  });
  const j = await r.json().catch(() => null);
  if (!j || !j.ok) console.error("Telegram sendDocument error:", j);
  return j;
}

function concatU8(chunks) {
  let total = 0;
  for (const c of chunks) total += c.byteLength;
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(new Uint8Array(c), off); off += c.byteLength; }
  return out;
}

 
function stopToken() { return { stop: false }; }
async function typingLoop(env, chatId, token) {
  while (!token.stop) {
    await tgSendChatAction(env, chatId, "typing");
    await sleep(TYPING_INTERVAL_MS);
  }
}

 
function extractImageFileId(msg, env) {
  if (msg.photo && msg.photo.length) {
    const maxBytes = Number(env.VISION_MAX_BYTES || 900000);
    const sorted = [...msg.photo].sort((a, b) => (a.file_size || 0) - (b.file_size || 0));
    let best = null;
    for (const p of sorted) {
      if ((p.file_size || 0) <= maxBytes) best = p;
    }
    if (!best) best = sorted[0];
    return best?.file_id || "";
  }
  if (msg.document && msg.document.mime_type?.startsWith("image/")) {
    return msg.document.file_id || "";
  }
  return "";
}

 

function isChatMessages(x) {
  return Array.isArray(x) && x.length && typeof x[0] === "object" && typeof x[0].role === "string" && ("content" in x[0]);
}

function seedFromPromptInput(input) {
  if (typeof input === "string") return input;
  if (!isChatMessages(input)) return String(input || "");
  const parts = [];
  for (const m of input) {
    const role = String(m?.role || "user");
    const c = (m && m.content != null) ? String(m.content) : "";
    parts.push(role + ":" + c);
  }
  return parts.join("");
}

function messagesToText(input) {
  if (typeof input === "string") return input;
  if (!isChatMessages(input)) return String(input || "");
  return input.map(m => (String(m.role||'user') + "" + String(m.content||''))).join("");
}

function resolveTextProviderChain(env, orderOverride, promptInput = "") {
  // Default chain includes multiple providers so we don't fall back to local just because one provider is rate-limited.
  const defaultRaw = "aicc,openai,openrouter,deepseek,gemini,cf";
  const rawIn = (orderOverride || env.TEXT_PROVIDER_ORDER || defaultRaw).toString().trim();

  const allowed = ["aicc","openai","openrouter","deepseek","gemini","cf"];

  let base = [...new Set(parseOrder(rawIn, allowed).map(normalizeTextProviderName).filter((p) => allowed.includes(p)))];

  // Backward-compat: if someone has an old env like TEXT_PROVIDER_ORDER=openai (single provider),
  // automatically append the rest unless strict mode is enabled.
  const strict = String(env.TEXT_PROVIDER_ORDER_STRICT || "0") === "1";
  if (!strict && base.length === 1) {
    const extra = parseOrder(defaultRaw, allowed).map(normalizeTextProviderName).filter((p) => allowed.includes(p) && !base.includes(p));
    base = base.concat(extra);
  }

  // Filter out providers that are not configured to avoid noisy failures.
  function isTextProviderConfigured(p) {
    p = normalizeTextProviderName(p);
    if (p === "cf") return !!env.AI;
    if (p === "openai") return parseApiKeyPool(env.OPENAI_API_KEY, env.OPENAI_API_KEYS).length > 0;
    if (p === "openrouter") return parseApiKeyPool(env.OPENROUTER_API_KEY, env.OPENROUTER_API_KEYS).length > 0;
    if (p === "deepseek") return parseApiKeyPool(env.DEEPSEEK_API_KEY, env.DEEPSEEK_API_KEYS).length > 0;
    if (p === "gemini") return parseApiKeyPool(env.GEMINI_API_KEY, env.GEMINI_API_KEYS).length > 0;
    if (p === "aicc") return parseApiKeyPool(env.AICC_API_KEY, env.AICC_API_KEYS).length > 0;
    return false;
  }
  const configured = base.filter(isTextProviderConfigured);
  if (configured.length) base = configured;

  if (base.length <= 1) return base;

  // Roll provider priority over time (within the configured order) for better load distribution.
  const rollMs = Math.max(1000, Math.min(3600000, Number(env.TEXT_PROVIDER_ROLL_MS || 60000)));
  const bucket = Math.floor(Date.now() / rollMs);

  const promptSeed = String(seedFromPromptInput(promptInput) || "").slice(0, 256);
  return rotateBySeed(base, `text|${bucket}|${promptSeed}`);
}

function providerApiKey(name, env, seed = "") {
  const key = normalizeTextProviderName(name);
  if (key === "openai") {
    const pool = parseApiKeyPool(env.OPENAI_API_KEY, env.OPENAI_API_KEYS);
    return pickApiKey(pool, `openai|${seed}`);
  }
  if (key === "openrouter") {
    const pool = parseApiKeyPool(env.OPENROUTER_API_KEY, env.OPENROUTER_API_KEYS);
    return pickApiKey(pool, `openrouter|${seed}`);
  }
  if (key === "deepseek") {
    const pool = parseApiKeyPool(env.DEEPSEEK_API_KEY, env.DEEPSEEK_API_KEYS);
    return pickApiKey(pool, `deepseek|${seed}`);
  }
  if (key === "gemini") {
    const pool = parseApiKeyPool(env.GEMINI_API_KEY, env.GEMINI_API_KEYS);
    return pickApiKey(pool, `gemini|${seed}`);
  }
  if (key === "aicc") {
    const pool = parseApiKeyPool(env.AICC_API_KEY, env.AICC_API_KEYS);
    return pickApiKey(pool, `aicc|${seed}`);
  }
  return "";
}

function providerApiKeys(name, env, seed = "") {
  const key = normalizeTextProviderName(name);
  const rollMs = Math.max(1000, Math.min(3600000, Number(env.API_KEY_ROLL_MS || 60000)));
  const bucket = Math.floor(Date.now() / rollMs);

  let pool = [];
  if (key === "openai") pool = parseApiKeyPool(env.OPENAI_API_KEY, env.OPENAI_API_KEYS);
  else if (key === "openrouter") pool = parseApiKeyPool(env.OPENROUTER_API_KEY, env.OPENROUTER_API_KEYS);
  else if (key === "deepseek") pool = parseApiKeyPool(env.DEEPSEEK_API_KEY, env.DEEPSEEK_API_KEYS);
  else if (key === "gemini") pool = parseApiKeyPool(env.GEMINI_API_KEY, env.GEMINI_API_KEYS);
  else if (key === "aicc") pool = parseApiKeyPool(env.AICC_API_KEY, env.AICC_API_KEYS);

  if (!Array.isArray(pool) || !pool.length) return [];
  return rotateBySeed(pool, `${key}|${bucket}|${seed}`);
}

async function runTextProviders(prompt, env, orderOverride) {
  const chain = resolveTextProviderChain(env, orderOverride, prompt);
  const tmo = Math.max(5000, Math.min(300000, Number(env.TEXT_TIMEOUT_MS || TIMEOUT_TEXT_MS)));
  let lastErr = null;
  for (const p of chain) {
    if (providerInCooldown(p)) continue;
    try {
      const out = await Promise.race([
        textProvider(p, prompt, env),
        timeoutPromise(tmo, `text_${p}_timeout`)
      ]);
      if (out && String(out).trim()) {
        markProviderSuccess(p, "text");
        return String(out);
      }
      markProviderFailure(p, env, "text");
    } catch (e) {
      lastErr = e;
      markProviderFailure(p, env, "text");
      console.error("text provider failed:", p, e?.message || e);
    }
  }
  throw lastErr || new Error("all_text_providers_failed");
}

async function runPolishProviders(draft, env, orderOverride) {
  
  if (String(env.DISABLE_POLISH || '1') === '1') return draft;
  const raw = (orderOverride || env.POLISH_PROVIDER_ORDER || '').toString().trim();
  if (!raw) return draft;

  const chain = parseOrder(raw, ["openai","cf","gemini"]);
  const polishPrompt =
    `تو یک ویراستار سخت‌گیر فارسی هستی. متن زیر را فقط “سفت‌وسخت” کن:\n` +
    `- فقط فارسی\n- قالب شماره‌دار ۱ تا ۵ حفظ شود\n- لحن افشاگر/تیز\n- خیال‌بافی نکن\n\n` +
    `متن:\n${draft}`;

  for (const p of chain) {
    if (providerInCooldown(p)) continue;
    try {
      const out = await Promise.race([
        textProvider(p, polishPrompt, env),
        timeoutPromise(TIMEOUT_POLISH_MS, `polish_${p}_timeout`)
      ]);
      if (out && String(out).trim()) {
        markProviderSuccess(p, "polish");
        return String(out);
      }
      markProviderFailure(p, env, "polish");
    } catch (e) {
      markProviderFailure(p, env, "polish");
      console.error("polish provider failed:", p, e?.message || e);
    }
  }
  return draft;
}

async function buildVisionPrompt(st, env) {
  const sym = String(st?.symbol || st?.selectedSymbol || "BTCUSDT").toUpperCase();
  const tf = String(st?.timeframe || "H4").toUpperCase();
  // هدف: گرفتن توصیف ساختار و کندل‌ها از تصویر برای افزودن به تحلیل
  return [
    "You are a trading assistant. Analyze the provided chart image.",
    "Return a concise Persian description of:",
    "1) Market structure (trend / range) on timeframe " + tf,
    "2) Key levels (support/resistance) visible",
    "3) Notable candlestick behavior",
    "Keep it factual, no indicators.",
    "Symbol: " + sym
  ].join("\n");
}

async function runVisionProviders(imageUrl, visionPrompt, env, orderOverride) {
  const chain = parseOrder(orderOverride || env.VISION_PROVIDER_ORDER, ["openai","cf","gemini","hf"]);
  const totalBudget = Number(env.VISION_TOTAL_BUDGET_MS || 20000);
  const deadline = Date.now() + totalBudget;

  let lastErr = null;
  /** @type {{tooLarge?: boolean, text?: string, at?: number}|null} */
  let cached = null;

  for (const p of chain) {
    const remaining = deadline - Date.now();
    if (remaining <= 500) break;

    try {
      if ((p === "cf" || p === "gemini" || p === "hf") && cached && cached.tooLarge) continue;

      const out = await Promise.race([
        visionProvider(p, imageUrl, visionPrompt, env, () => cached, (c) => (cached = c)),
        timeoutPromise(Math.min(TIMEOUT_VISION_MS, remaining), `vision_${p}_timeout`)
      ]);
      if (out && String(out).trim()) return String(out);
    } catch (e) {
      lastErr = e;
      console.error("vision provider failed:", p, e?.message || e);
    }
  }

  throw lastErr || new Error("all_vision_providers_failed_or_budget_exceeded");
}


function clampMaxTokensForProvider(providerName, env, fallback) {
  // Enforce *at least* the fallback (per-route preferred) token budget.
  // This ensures user/pro outputs aren't unintentionally shortened by a low TEXT_MAX_TOKENS env value.
  const fb = Number(fallback || 8000);
  const envReqRaw = Number(env.TEXT_MAX_TOKENS);
  const reqBase = Number.isFinite(envReqRaw) ? Math.max(envReqRaw, fb) : fb;
  const min = 256;

  const pName = String(providerName || "").toLowerCase();
  const defaultHard = 128000;
  const hardEnv = Number(env.TEXT_MAX_TOKENS_HARD_MAX || defaultHard);
  const hard = Math.max(min, Math.min(128000, (Number.isFinite(hardEnv) ? hardEnv : defaultHard)));

  if (!Number.isFinite(reqBase)) return Math.max(min, Math.min(hard, fb));
  return Math.max(min, Math.min(hard, reqBase));
}

function normalizeOpenAIModelName(model) {
  
  const raw = String(model || "").trim();
  if (!raw) return "gpt-5.1";
  let m = raw.toLowerCase().replace(/\s+/g, "");
  
  if (m.startsWith("got")) m = "gpt" + m.slice(3);
  
  m = m.replace(/^gpt5-1$/, "gpt-5.1");
  m = m.replace(/^gpt-5-1$/, "gpt-5.1");
  m = m.replace(/^gpt5\.1$/, "gpt-5.1");
  
  return m;
}

function toLatinDigits(s) {
  return String(s || "").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

function detectMaxNumberedSection(promptText) {
  const src = toLatinDigits(String(promptText || ""));
  const nums = [];
  const re = /(^|\n)\s*(?:###\s*)?(\d{1,2})\s*[\.\)\:\-]/g;
  let m;
  while ((m = re.exec(src))) {
    const n = Number(m[2]);
    if (Number.isFinite(n) && n >= 1 && n <= 30) nums.push(n);
  }
  if (!nums.length) return 0;
  return Math.max(...nums);
}

function hasNumberedSection(outText, n) {
  const s = toLatinDigits(String(outText || ""));
  const re = new RegExp(`(^|\\n)\\s*(?:###\\s*)?${Number(n)}\\s*[\\.\\)\\:\\-]`, "m");
  return re.test(s);
}

function looksIncompleteByPrompt(outText, sysText, promptText) {
  const src = [sysText, promptText].filter(Boolean).join("\n");
  const wantN = detectMaxNumberedSection(src);
  if (wantN < 2) return false;

  const out = String(outText || "");
  if (!hasNumberedSection(out, 1)) return false;
  if (hasNumberedSection(out, wantN)) return false;

  // اگر مدل صریحاً جمع‌بندی/پایان داده و متن به اندازه کافی مفصل است، احتمالاً کامل است.
  if (/(جمع[‌ ]?بندی|نتیجه[‌ ]?گیری|پایان|تمام)/i.test(out) && out.trim().length > 400) return false;

  return true;
}



async function textProvider(name, promptInput, env) {
  name = normalizeTextProviderName(name);

  const messages = isChatMessages(promptInput)
    ? promptInput.map(m => ({ role: String(m.role || "user"), content: (m.content == null ? "" : String(m.content)) }))
    : [{ role: "user", content: String(promptInput || "") }];

  const promptText = messagesToText(promptInput);

  if (name === "cf") {
    if (!env.AI) throw new Error("AI_binding_missing");

    const model = String(env.CF_MODEL || "@cf/meta/llama-3.1-8b-instruct");
    const maxTokens = clampMaxTokensForProvider("cf", env, 128000);
    const autoContinue = String(env.AUTO_CONTINUE || "1") === "1";
    const maxRounds = Math.max(1, Math.min(6, Number(env.AUTO_CONTINUE_MAX_ROUNDS || 6)));
    const continuePrompt = String(env.AUTO_CONTINUE_PROMPT || "Continue from exactly where you stopped. Do not repeat. If any required numbered sections are missing, complete them with full detail.").trim();
    const tailChars = Math.max(500, Math.min(20000, Number(env.AUTO_CONTINUE_TAIL_CHARS || 6000)));
    const minChars = Math.max(500, Math.min(80000, Number(env.AUTO_CONTINUE_MIN_CHARS || 9000)));
    const sysText = (messages.find(m => m.role === "system") || {}).content || "";

    async function once(msgs, tokenBudget = maxTokens) {
      const out = await env.AI.run(model, {
        messages: msgs,
        max_tokens: tokenBudget,
        temperature: 0,
      });
      const text = String(out?.response || out?.result || "");
      return { text };
    }

    const first = await once(messages, maxTokens);
    if (!first.text || !String(first.text).trim()) return "";
    if (!autoContinue) return first.text;

    let combined = String(first.text);

    // No finish_reason from Workers AI: use heuristics.
    let needMore = combined.trim().length < minChars;
    if (!needMore && String(env.AUTO_COMPLETE_SECTIONS || "1") === "1") {
      needMore = looksIncompleteByPrompt(combined, sysText, promptText);
    }

    let round = 1;
    let convo = messages.slice();

    while (round < maxRounds && needMore) {
      const tail = combined.slice(Math.max(0, combined.length - tailChars));
      convo = convo.concat([
        { role: "assistant", content: String(tail) },
        { role: "user", content: continuePrompt }
      ]);

      const nxt = await once(convo, maxTokens);
      if (!nxt.text || !String(nxt.text).trim()) break;

      const nxtText = String(nxt.text);
      const recent = combined.slice(Math.max(0, combined.length - Math.max(1200, tailChars)));
      if (recent && nxtText.trim() && recent.includes(nxtText.trim())) break;

      combined += nxtText;

      needMore = combined.trim().length < minChars;
      if (!needMore && String(env.AUTO_COMPLETE_SECTIONS || "1") === "1") {
        needMore = looksIncompleteByPrompt(combined, sysText, promptText);
      }

      round += 1;
    }

    return combined;
  }

  if (name === "openai") {
    const pool = parseApiKeyPool(env.OPENAI_API_KEY, env.OPENAI_API_KEYS);
    if (!pool.length) throw new Error("OPENAI_API_KEY_missing");

    const promptSeed = String(seedFromPromptInput(promptInput) || "").slice(0, 64);
    const keys = providerApiKeys("openai", env, promptSeed);
    if (!keys.length) throw new Error("OPENAI_API_KEY_missing");

    const model = normalizeOpenAIModelName(env.OPENAI_MODEL || "gpt-5.1");
    const maxTokens = clampMaxTokensForProvider("openai", env, 128000);
    const autoContinue = String(env.AUTO_CONTINUE || "1") === "1";
    const maxRounds = Math.max(1, Math.min(6, Number(env.AUTO_CONTINUE_MAX_ROUNDS || 6)));
    const continuePrompt = String(env.AUTO_CONTINUE_PROMPT || "Continue from exactly where you stopped. Do not repeat. If any required numbered sections are missing, complete them with full detail.").trim();
    const tailChars = Math.max(500, Math.min(20000, Number(env.AUTO_CONTINUE_TAIL_CHARS || 6000)));
    const minChars = Math.max(500, Math.min(80000, Number(env.AUTO_CONTINUE_MIN_CHARS || 9000)));

    function openAIWantsMaxCompletionTokens(m) {
      const override = String(env.OPENAI_TOKENS_PARAM || "").trim().toLowerCase();
      if (override === "max_tokens") return false;
      if (override === "max_completion_tokens") return true;

      const mm = String(m || "").toLowerCase();
      
      return mm.startsWith("gpt-5") || mm.startsWith("o1") || mm.startsWith("o3") || mm.startsWith("o4") || mm.includes("reasoning");
    }


    const openaiMode = String(env.OPENAI_API_MODE || "").trim().toLowerCase();
    const useResponses = openaiMode === "responses" || (openaiMode !== "chat" && String(model).toLowerCase().startsWith("gpt-5"));
    const openaiVerbosity = String(env.OPENAI_VERBOSITY || "").trim().toLowerCase(); // low|medium|high

    function toResponsesInput(msgs) {
      return (Array.isArray(msgs) ? msgs : []).map((m) => ({
        type: "message",
        role: String(m?.role || "user"),
        content: [
          { type: "input_text", text: String(m?.content == null ? "" : m.content) }
        ],
      }));
    }

    async function openaiOnce(apiKey, msgs, tokenBudget = maxTokens, previousResponseId = "") {
      const headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };

      // Prefer Responses API for GPT-5 unless explicitly forced to chat.
      if (useResponses) {
        const payload = {
          model,
          input: toResponsesInput(msgs),
          max_output_tokens: tokenBudget,
        };

        // Bias toward longer, more detailed answers on GPT-5 via parameter (not prompt).
        const vb = openaiVerbosity || "high";
        if (vb === "low" || vb === "medium" || vb === "high") payload.text = { verbosity: vb };

        if (previousResponseId) payload.previous_response_id = previousResponseId;

        const r = await fetchWithTimeout(
          "https://api.openai.com/v1/responses",
          { method: "POST", headers, body: JSON.stringify(payload) },
          Math.max(5000, Math.min(300000, Number(env.TEXT_TIMEOUT_MS || TIMEOUT_TEXT_MS)))
        );

        const j = await r.json().catch(() => null);
        const errMsg = String(j?.error?.message || j?.error?.type || "");

        // Progressive backoff if tokenBudget is rejected.
        if (r.status === 400 && tokenBudget > 4096 && /max_output_tokens|max tokens|context|length|maximum/i.test(errMsg)) {
          const retryMax = Math.max(4096, Math.floor(tokenBudget / 2));
          return openaiOnce(apiKey, msgs, retryMax, previousResponseId);
        }

        const out = String(j?.output_text || "");
        const finish = j?.incomplete_details?.reason === "max_output_tokens" ? "length" : "stop";

        // If the API key cannot call Responses API (restricted key missing scopes), transparently fall back to Chat Completions.
        if (!(r.status === 401 && /api\.responses\.write/i.test(errMsg))) {
          return { status: r.status, json: j, text: out, finish_reason: finish, response_id: String(j?.id || "") };
        }
        // otherwise: fall through to chat-completions below
      }

      // Chat Completions (OpenAI-compatible)
      const tokenKey = openAIWantsMaxCompletionTokens(model) ? "max_completion_tokens" : "max_tokens";
      const payload = {
        model,
        messages: msgs,
        temperature: 0,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      };
      payload[tokenKey] = tokenBudget;

      const r = await fetchWithTimeout(
        "https://api.openai.com/v1/chat/completions",
        { method: "POST", headers, body: JSON.stringify(payload) },
        Math.max(5000, Math.min(300000, Number(env.TEXT_TIMEOUT_MS || TIMEOUT_TEXT_MS)))
      );

      const j = await r.json().catch(() => null);
      const errMsg = String(j?.error?.message || j?.error?.type || "");

      // Progressive backoff if tokenBudget is rejected.
      if (r.status === 400 && tokenBudget > 4096 && /max_?tokens|max completion tokens|max_completion_tokens|max_tokens|context length|maximum/i.test(errMsg)) {
        const retryMax = Math.max(4096, Math.floor(tokenBudget / 2));
        return openaiOnce(apiKey, msgs, retryMax, previousResponseId);
      }

      const out = String(j?.choices?.[0]?.message?.content || "");
      const finish = String(j?.choices?.[0]?.finish_reason || "");
      return { status: r.status, json: j, text: out, finish_reason: finish, response_id: "" };
    }

    let lastStatus = 0;
    let lastBody = null;

    for (const apiKey of keys) {
      
      const first = await openaiOnce(apiKey, messages);
      lastStatus = first.status;
      lastBody = first.json;

      if (!first.text || !String(first.text).trim()) {
        if (![401, 429, 500, 502, 503, 504].includes(first.status)) break;
        continue;
      }

      if (!autoContinue) return first.text;

      
            let combined = String(first.text);
      let finish = String(first.finish_reason || "");
      let prevRespId = String(first.response_id || "");

      const sysText = (messages.find(m => m.role === "system") || {}).content || "";

      // If the model stopped early but output is still short, force continuation.
      if (combined.trim().length < minChars) finish = "length";

      if (String(env.AUTO_COMPLETE_SECTIONS || "1") === "1" && finish !== "length" && looksIncompleteByPrompt(combined, sysText, promptText)) {
        finish = "length";
      }

      let round = 1;
      let convo = messages.slice();

      while (round < maxRounds && finish === "length") {
        let nxtMsgs = convo;

        if (useResponses && prevRespId) {
          // Responses API can continue from previous_response_id with just a new user message.
          nxtMsgs = [{ role: "user", content: continuePrompt }];
        } else {
          const tail = combined.slice(Math.max(0, combined.length - tailChars));
          convo = convo.concat([
            { role: "assistant", content: String(tail) },
            { role: "user", content: continuePrompt }
          ]);
          nxtMsgs = convo;
        }

        const nxt = await openaiOnce(apiKey, nxtMsgs, maxTokens, prevRespId);
        lastStatus = nxt.status;
        lastBody = nxt.json;
        if (nxt.response_id) prevRespId = String(nxt.response_id);

        if (!nxt.text || !String(nxt.text).trim()) break;

        // Simple repetition guard: if the model starts repeating the last chunk, stop.
        const nxtText = String(nxt.text);
        const recent = combined.slice(Math.max(0, combined.length - Math.max(1200, tailChars)));
        if (recent && nxtText.trim() && recent.includes(nxtText.trim())) break;

        combined += nxtText;
        finish = String(nxt.finish_reason || "");

        // Keep going until minimum size is reached (or maxRounds).
        if (combined.trim().length < minChars && round + 1 <= maxRounds) finish = "length";

        if (String(env.AUTO_COMPLETE_SECTIONS || "1") === "1" && finish !== "length" && looksIncompleteByPrompt(combined, sysText, promptText)) {
          finish = "length";
        }

        round += 1;
      }

      return combined;
    }

    throw new Error(`openai_failed_status_${lastStatus}` + (lastBody?.error?.message ? `:${lastBody.error.message}` : ""));
  }


  
  if (name === "aicc") {
    const pool = parseApiKeyPool(env.AICC_API_KEY, env.AICC_API_KEYS);
    if (!pool.length) throw new Error("AICC_API_KEY_missing");

    const promptSeed = String(seedFromPromptInput(promptInput) || "").slice(0, 64);
    const keys = providerApiKeys("aicc", env, promptSeed);
    if (!keys.length) throw new Error("AICC_API_KEY_missing");

    const baseURL = String(env.AICC_BASE_URL || "https://api.ai.cc/v1").trim().replace(/\/+$/, "");
    const model = String(env.AICC_MODEL || "gpt-4o-mini");
    const maxTokens = clampMaxTokensForProvider("aicc", env, 128000);
    const autoContinue = String(env.AUTO_CONTINUE || "1") === "1";
    const maxRounds = Math.max(1, Math.min(6, Number(env.AUTO_CONTINUE_MAX_ROUNDS || 6)));
    const continuePrompt = String(env.AUTO_CONTINUE_PROMPT || "Continue from exactly where you stopped. Do not repeat. If any required numbered sections are missing, complete them with full detail.").trim();
    const tailChars = Math.max(500, Math.min(20000, Number(env.AUTO_CONTINUE_TAIL_CHARS || 6000)));
    const minChars = Math.max(500, Math.min(80000, Number(env.AUTO_CONTINUE_MIN_CHARS || 9000)));
    const sysText = (messages.find(m => m.role === "system") || {}).content || "";

    async function once(apiKey, msgs, tokenBudget = maxTokens) {
      const url = `${baseURL}/chat/completions`;
      const r = await fetchWithTimeout(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: msgs,
          temperature: 0,
          max_tokens: tokenBudget,
        }),
      }, Math.max(5000, Math.min(300000, Number(env.TEXT_TIMEOUT_MS || TIMEOUT_TEXT_MS))));

      const j = await r.json().catch(() => null);
      const errMsg = String(j?.error?.message || j?.error?.type || j?.message || "");
      if (r.status === 400 && tokenBudget > 4096 && /max_?tokens|max completion tokens|context length|maximum/i.test(errMsg)) {
        const retryMax = Math.max(4096, Math.floor(tokenBudget / 2));
        return once(apiKey, msgs, retryMax);
      }
      const out = String(j?.choices?.[0]?.message?.content || "");
      const finish = String(j?.choices?.[0]?.finish_reason || "");
      return { status: r.status, json: j, text: out, finish_reason: finish, errMsg };
    }

    let lastStatus = 0;
    let lastBody = null;

    for (const apiKey of keys) {
      const first = await once(apiKey, messages, maxTokens);
      lastStatus = first.status;
      lastBody = first.json;

      if (first.status === 200 && first.text && String(first.text).trim()) {
        if (!autoContinue) return String(first.text);

        let combined = String(first.text);
        let finish = String(first.finish_reason || "");

        if (combined.trim().length < minChars && finish !== "length") finish = "length";
        if (String(env.AUTO_COMPLETE_SECTIONS || "1") === "1" && finish !== "length" && looksIncompleteByPrompt(combined, sysText, promptText)) {
          finish = "length";
        }

        let round = 1;
        let convo = messages.slice();

        while (round < maxRounds && finish === "length") {
          const tail = combined.slice(Math.max(0, combined.length - tailChars));
          convo = convo.concat([
            { role: "assistant", content: String(tail) },
            { role: "user", content: continuePrompt }
          ]);

          const nxt = await once(apiKey, convo, maxTokens);
          lastStatus = nxt.status;
          lastBody = nxt.json;

          if (!nxt.text || !String(nxt.text).trim()) break;

          const nxtText = String(nxt.text);
          const recent = combined.slice(Math.max(0, combined.length - Math.max(1200, tailChars)));
          if (recent && nxtText.trim() && recent.includes(nxtText.trim())) break;

          combined += nxtText;
          finish = String(nxt.finish_reason || "");

          if (combined.trim().length < minChars && round + 1 <= maxRounds) finish = "length";
          if (String(env.AUTO_COMPLETE_SECTIONS || "1") === "1" && finish !== "length" && looksIncompleteByPrompt(combined, sysText, promptText)) {
            finish = "length";
          }

          round += 1;
        }

        return combined;
      }

      // Rate-limit / quota: try next key (if any), otherwise provider chain will continue.
      if (first.status === 429 || /quota|rate limit|too many requests/i.test(first.errMsg)) {
        continue;
      }
    }

    throw new Error(`aicc_failed_status_${lastStatus}` + (lastBody?.error?.message ? `:${lastBody.error.message}` : ""));
  }


  if (name === "openrouter") {
    const pool = parseApiKeyPool(env.OPENROUTER_API_KEY, env.OPENROUTER_API_KEYS);
    if (!pool.length) throw new Error("OPENROUTER_API_KEY_missing");

    const promptSeed = String(seedFromPromptInput(promptInput) || "").slice(0, 64);
    const keys = providerApiKeys("openrouter", env, promptSeed);
    if (!keys.length) throw new Error("OPENROUTER_API_KEY_missing");

    let model = String(env.OPENROUTER_MODEL || "openrouter/free").trim();
    const strictModel = String(env.OPENROUTER_MODEL_STRICT || "0") === "1";
    // Prevent common invalid model IDs (e.g., gpt5 / gpt-5.1) from breaking OpenRouter free-tier routing.
    if (!strictModel) {
      const mm = model.toLowerCase().replace(/\s+/g, "");
      if (mm === "gpt5" || mm === "gpt-5.1" || mm === "gpt-5" || mm.startsWith("openai:gpt-5")) model = "openrouter/free";
    }
    const maxTokens = clampMaxTokensForProvider("openrouter", env, 128000);
    const autoContinue = String(env.AUTO_CONTINUE || "1") === "1";
    const maxRounds = Math.max(1, Math.min(6, Number(env.AUTO_CONTINUE_MAX_ROUNDS || 6)));
    const continuePrompt = String(env.AUTO_CONTINUE_PROMPT || "Continue from exactly where you stopped. Do not repeat. If any required numbered sections are missing, complete them with full detail.").trim();
    const tailChars = Math.max(500, Math.min(20000, Number(env.AUTO_CONTINUE_TAIL_CHARS || 6000)));
    const minChars = Math.max(500, Math.min(80000, Number(env.AUTO_CONTINUE_MIN_CHARS || 9000)));
    const sysText = (messages.find(m => m.role === "system") || {}).content || "";

    async function once(apiKey, msgs, tokenBudget = maxTokens) {
      const r = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: msgs,
          temperature: 0,
          max_tokens: tokenBudget,
        }),
      }, Math.max(5000, Math.min(300000, Number(env.TEXT_TIMEOUT_MS || TIMEOUT_TEXT_MS))));

      const j = await r.json().catch(() => null);
      const errMsg = String(j?.error?.message || j?.error?.type || "");
      if (r.status === 400 && tokenBudget > 4096 && /max_?tokens|max completion tokens|context length|maximum/i.test(errMsg)) {
        const retryMax = Math.max(4096, Math.floor(tokenBudget / 2));
        return once(apiKey, msgs, retryMax);
      }
      const out = String(j?.choices?.[0]?.message?.content || "");
      const finish = String(j?.choices?.[0]?.finish_reason || "");
      return { status: r.status, json: j, text: out, finish_reason: finish, errMsg };
    }

    let lastStatus = 0;
    let lastBody = null;

    for (const apiKey of keys) {
      const first = await once(apiKey, messages, maxTokens);
      lastStatus = first.status;
      lastBody = first.json;

      if (!first.text || !String(first.text).trim()) {
        // If key is rate-limited / quota / transient error: roll to the next key.
        if (![401, 402, 403, 429, 500, 502, 503, 504].includes(first.status) && !/rate|quota|limit/i.test(String(first.errMsg || ""))) break;
        continue;
      }

      if (!autoContinue) return first.text;

      let combined = String(first.text);
      let finish = String(first.finish_reason || "");

      if (combined.trim().length < minChars) finish = "length";
      if (String(env.AUTO_COMPLETE_SECTIONS || "1") === "1" && finish !== "length" && looksIncompleteByPrompt(combined, sysText, promptText)) {
        finish = "length";
      }

      let round = 1;
      let convo = messages.slice();

      while (round < maxRounds && finish === "length") {
        const tail = combined.slice(Math.max(0, combined.length - tailChars));
        convo = convo.concat([
          { role: "assistant", content: String(tail) },
          { role: "user", content: continuePrompt }
        ]);

        const nxt = await once(apiKey, convo, maxTokens);
        lastStatus = nxt.status;
        lastBody = nxt.json;

        if (!nxt.text || !String(nxt.text).trim()) break;

        const nxtText = String(nxt.text);
        const recent = combined.slice(Math.max(0, combined.length - Math.max(1200, tailChars)));
        if (recent && nxtText.trim() && recent.includes(nxtText.trim())) break;

        combined += nxtText;
        finish = String(nxt.finish_reason || "");

        if (combined.trim().length < minChars && round + 1 <= maxRounds) finish = "length";
        if (String(env.AUTO_COMPLETE_SECTIONS || "1") === "1" && finish !== "length" && looksIncompleteByPrompt(combined, sysText, promptText)) {
          finish = "length";
        }

        round += 1;
      }

      return combined;
    }

    throw new Error(`openrouter_failed_status_${lastStatus}` + (lastBody?.error?.message ? `:${lastBody.error.message}` : ""));
  }

  if (name === "deepseek") {
    const pool = parseApiKeyPool(env.DEEPSEEK_API_KEY, env.DEEPSEEK_API_KEYS);
    if (!pool.length) throw new Error("DEEPSEEK_API_KEY_missing");

    const promptSeed = String(seedFromPromptInput(promptInput) || "").slice(0, 64);
    const keys = providerApiKeys("deepseek", env, promptSeed);
    if (!keys.length) throw new Error("DEEPSEEK_API_KEY_missing");

    const model = String(env.DEEPSEEK_MODEL || "deepseek-reasoner");
    const maxTokens = clampMaxTokensForProvider("deepseek", env, 128000);
    const autoContinue = String(env.AUTO_CONTINUE || "1") === "1";
    const maxRounds = Math.max(1, Math.min(6, Number(env.AUTO_CONTINUE_MAX_ROUNDS || 6)));
    const continuePrompt = String(env.AUTO_CONTINUE_PROMPT || "Continue from exactly where you stopped. Do not repeat. If any required numbered sections are missing, complete them with full detail.").trim();
    const tailChars = Math.max(500, Math.min(20000, Number(env.AUTO_CONTINUE_TAIL_CHARS || 6000)));
    const minChars = Math.max(500, Math.min(80000, Number(env.AUTO_CONTINUE_MIN_CHARS || 9000)));
    const sysText = (messages.find(m => m.role === "system") || {}).content || "";

    async function once(apiKey, msgs, tokenBudget = maxTokens) {
      const r = await fetchWithTimeout("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: msgs,
          temperature: 0,
          max_tokens: tokenBudget,
        }),
      }, Math.max(5000, Math.min(300000, Number(env.TEXT_TIMEOUT_MS || TIMEOUT_TEXT_MS))));

      const j = await r.json().catch(() => null);
      const errMsg = String(j?.error?.message || j?.error?.type || "");
      if (r.status === 400 && tokenBudget > 4096 && /max_?tokens|max completion tokens|context length|maximum/i.test(errMsg)) {
        const retryMax = Math.max(4096, Math.floor(tokenBudget / 2));
        return once(apiKey, msgs, retryMax);
      }
      const out = String(j?.choices?.[0]?.message?.content || "");
      const finish = String(j?.choices?.[0]?.finish_reason || "");
      return { status: r.status, json: j, text: out, finish_reason: finish, errMsg };
    }

    let lastStatus = 0;
    let lastBody = null;

    for (const apiKey of keys) {
      const first = await once(apiKey, messages, maxTokens);
      lastStatus = first.status;
      lastBody = first.json;

      if (!first.text || !String(first.text).trim()) {
        if (![401, 402, 403, 429, 500, 502, 503, 504].includes(first.status) && !/rate|quota|limit/i.test(String(first.errMsg || ""))) break;
        continue;
      }
      if (!autoContinue) return first.text;

      let combined = String(first.text);
      let finish = String(first.finish_reason || "");

      if (combined.trim().length < minChars) finish = "length";
      if (String(env.AUTO_COMPLETE_SECTIONS || "1") === "1" && finish !== "length" && looksIncompleteByPrompt(combined, sysText, promptText)) {
        finish = "length";
      }

      let round = 1;
      let convo = messages.slice();

      while (round < maxRounds && finish === "length") {
        const tail = combined.slice(Math.max(0, combined.length - tailChars));
        convo = convo.concat([
          { role: "assistant", content: String(tail) },
          { role: "user", content: continuePrompt }
        ]);

        const nxt = await once(apiKey, convo, maxTokens);
        lastStatus = nxt.status;
        lastBody = nxt.json;

        if (!nxt.text || !String(nxt.text).trim()) break;

        const nxtText = String(nxt.text);
        const recent = combined.slice(Math.max(0, combined.length - Math.max(1200, tailChars)));
        if (recent && nxtText.trim() && recent.includes(nxtText.trim())) break;

        combined += nxtText;
        finish = String(nxt.finish_reason || "");
        if (combined.trim().length < minChars && round + 1 <= maxRounds) finish = "length";
        if (String(env.AUTO_COMPLETE_SECTIONS || "1") === "1" && finish !== "length" && looksIncompleteByPrompt(combined, sysText, promptText)) {
          finish = "length";
        }
        round += 1;
      }

      return combined;
    }

    throw new Error(`deepseek_failed_status_${lastStatus}` + (lastBody?.error?.message ? `:${lastBody.error.message}` : ""));
  }

  if (name === "gemini") {
    const pool = parseApiKeyPool(env.GEMINI_API_KEY, env.GEMINI_API_KEYS);
    if (!pool.length) throw new Error("GEMINI_API_KEY_missing");

    const promptSeed = String(seedFromPromptInput(promptInput) || "").slice(0, 64);
    const keys = providerApiKeys("gemini", env, promptSeed);
    if (!keys.length) throw new Error("GEMINI_API_KEY_missing");

    const model = String(env.GEMINI_MODEL || "gemini-3-flash-preview").trim();
    const maxTokens = clampMaxTokensForProvider("gemini", env, 128000);
    const autoContinue = String(env.AUTO_CONTINUE || "1") === "1";
    const maxRounds = Math.max(1, Math.min(6, Number(env.AUTO_CONTINUE_MAX_ROUNDS || 6)));
    const continuePrompt = String(env.AUTO_CONTINUE_PROMPT || "Continue from exactly where you stopped. Do not repeat. If any required numbered sections are missing, complete them with full detail.").trim();
    const tailChars = Math.max(500, Math.min(20000, Number(env.AUTO_CONTINUE_TAIL_CHARS || 6000)));
    const minChars = Math.max(500, Math.min(80000, Number(env.AUTO_CONTINUE_MIN_CHARS || 9000)));
    const sysText = (messages.find(m => m.role === "system") || {}).content || "";

    async function once(apiKey, contents, tokenBudget = maxTokens) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const r = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: 0, maxOutputTokens: tokenBudget },
        }),
      }, TIMEOUT_TEXT_MS);

      const j = await r.json().catch(() => null);
      const errMsg = String(j?.error?.message || j?.error?.status || "");
      if (r.status === 400 && tokenBudget > 4096 && /maxoutputtokens|max tokens|context|length|maximum/i.test(errMsg)) {
        const retryMax = Math.max(4096, Math.floor(tokenBudget / 2));
        return once(apiKey, contents, retryMax);
      }
      const out = String(j?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "");
      const fr = String(j?.candidates?.[0]?.finishReason || j?.candidates?.[0]?.finish_reason || "");
      const finish = /MAX_TOKENS|LENGTH/i.test(fr) ? "length" : "stop";
      return { status: r.status, json: j, text: out, finish_reason: finish, errMsg };
    }

    let lastStatus = 0;
    let lastBody = null;

    for (const apiKey of keys) {
      let contents = [{ role: "user", parts: [{ text: String(promptText || "") }] }];

      const first = await once(apiKey, contents, maxTokens);
      lastStatus = first.status;
      lastBody = first.json;

      if (!first.text || !String(first.text).trim()) {
        if (![401, 402, 403, 429, 500, 502, 503, 504].includes(first.status) && !/rate|quota|limit/i.test(String(first.errMsg || ""))) break;
        continue;
      }

      if (!autoContinue) return first.text;

      let combined = String(first.text);
      let finish = String(first.finish_reason || "");

      if (combined.trim().length < minChars) finish = "length";
      if (String(env.AUTO_COMPLETE_SECTIONS || "1") === "1" && finish !== "length" && looksIncompleteByPrompt(combined, sysText, promptText)) {
        finish = "length";
      }

      let round = 1;
      while (round < maxRounds && finish === "length") {
        const tail = combined.slice(Math.max(0, combined.length - tailChars));
        contents = contents.concat([
          { role: "model", parts: [{ text: String(tail) }] },
          { role: "user", parts: [{ text: continuePrompt }] },
        ]);

        const nxt = await once(apiKey, contents, maxTokens);
        lastStatus = nxt.status;
        lastBody = nxt.json;

        if (!nxt.text || !String(nxt.text).trim()) break;

        const nxtText = String(nxt.text);
        const recent = combined.slice(Math.max(0, combined.length - Math.max(1200, tailChars)));
        if (recent && nxtText.trim() && recent.includes(nxtText.trim())) break;

        combined += nxtText;
        finish = String(nxt.finish_reason || "");

        if (combined.trim().length < minChars && round + 1 <= maxRounds) finish = "length";
        if (String(env.AUTO_COMPLETE_SECTIONS || "1") === "1" && finish !== "length" && looksIncompleteByPrompt(combined, sysText, promptText)) {
          finish = "length";
        }
        round += 1;
      }

      return combined;
    }

    throw new Error(`gemini_failed_status_${lastStatus}` + (lastBody?.error?.message ? `:${lastBody.error.message}` : ""));
  }
  throw new Error(`unknown_text_provider:${name}`);
}

async function ensureImageCache(imageUrl, env, getCache, setCache) {
  const cur = getCache();
  if (cur?.buf && cur?.mime) return cur;

  const maxBytes = Number(env.VISION_MAX_BYTES || 900000);

  const resp = await fetchWithTimeout(imageUrl, {}, TIMEOUT_VISION_MS);

  const len = Number(resp.headers.get("content-length") || "0");
  if (len && len > maxBytes) {
    const c = { tooLarge: true, mime: "image/jpeg" };
    setCache(c);
    return c;
  }

  const mime = detectMimeFromHeaders(resp, "image/jpeg");
  const buf = await resp.arrayBuffer();

  if (buf.byteLength > maxBytes) {
    const c = { tooLarge: true, mime };
    setCache(c);
    return c;
  }

  const u8 = new Uint8Array(buf);
  const bytesArr = [...u8];
  const base64 = arrayBufferToBase64(buf);

  const c = { buf, mime, base64, bytesArr, u8, tooLarge: false };
  setCache(c);
  return c;
}

async function visionProvider(name, imageUrl, visionPrompt, env, getCache, setCache) {
  name = String(name || "").toLowerCase();


  if (name === "openai") {
    const pool = parseApiKeyPool(env.OPENAI_API_KEY, env.OPENAI_API_KEYS);
    if (!pool.length) throw new Error("OPENAI_API_KEY_missing");
    const keys = providerApiKeys("openai", env, String(imageUrl || "").slice(0, 128));
    if (!keys.length) throw new Error("OPENAI_API_KEY_missing");

    const body = {
      model: normalizeOpenAIModelName(env.OPENAI_VISION_MODEL || env.OPENAI_MODEL || "gpt-5.1"),
      messages: [{
        role: "user",
        content: [
          { type: "text", text: visionPrompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      }],
      temperature: 0,
    };

    let lastErr = "";
    for (const apiKey of keys) {
      const r = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }, TIMEOUT_VISION_MS);

      const j = await r.json().catch(() => null);
      const out = String(j?.choices?.[0]?.message?.content || "");
      if (out && out.trim()) return out;

      const errMsg = String(j?.error?.message || j?.error?.type || "");
      lastErr = errMsg || ("http_" + r.status);

      // Roll to next key on rate-limit/quota/transient errors.
      if (![401, 402, 403, 429, 500, 502, 503, 504].includes(r.status) && !/rate|quota|limit/i.test(errMsg)) break;
    }

    // Let the caller try other vision providers.
    if (lastErr) throw new Error("openai_vision_failed:" + lastErr);
    return "";
  }

  if (name === "cf") {
    if (!env.AI) throw new Error("AI_binding_missing");
    const c = await ensureImageCache(imageUrl, env, getCache, setCache);
    if (c.tooLarge) return "";
    const out = await env.AI.run("@cf/llava-hf/llava-1.5-7b-hf", { image: c.bytesArr, prompt: visionPrompt });
    return out?.description || out?.response || out?.result || "";
  }


  if (name === "gemini") {
    const pool = parseApiKeyPool(env.GEMINI_API_KEY, env.GEMINI_API_KEYS);
    if (!pool.length) throw new Error("GEMINI_API_KEY_missing");
    const keys = providerApiKeys("gemini", env, String(imageUrl || "").slice(0, 128));
    if (!keys.length) throw new Error("GEMINI_API_KEY_missing");

    const c = await ensureImageCache(imageUrl, env, getCache, setCache);
    if (c.tooLarge) return "";

    const model = String(env.GEMINI_MODEL || "gemini-3-flash-preview").trim();
    const maxOut = clampMaxTokensForProvider("gemini", env, 128000);

    let lastErr = "";
    for (const apiKey of keys) {
      const endpoint =
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const r = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: visionPrompt },
                { inlineData: { mimeType: c.mime, data: c.base64 } },
              ],
            }],
            generationConfig: { temperature: 0, maxOutputTokens: maxOut },
          }),
        },
        TIMEOUT_VISION_MS
      );

      const j = await r.json().catch(() => null);
      const out = String(j?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "");
      if (out && out.trim()) return out;

      const errMsg = String(j?.error?.message || j?.error?.status || "");
      lastErr = errMsg || ("http_" + r.status);

      if (![401, 402, 403, 429, 500, 502, 503, 504].includes(r.status) && !/rate|quota|limit/i.test(errMsg)) break;
    }

    if (lastErr) throw new Error("gemini_vision_failed:" + lastErr);
    return "";
  }


  if (name === "hf") {
    if (!env.HF_API_KEY) throw new Error("HF_API_KEY_missing");
    const model = (env.HF_VISION_MODEL || "Salesforce/blip-image-captioning-large").toString().trim();
    const c = await ensureImageCache(imageUrl, env, getCache, setCache);
    if (c.tooLarge) return "";
    const r = await fetchWithTimeout(
      `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.HF_API_KEY}`,
          "Content-Type": "application/octet-stream",
        },
        body: c.u8,
      },
      TIMEOUT_VISION_MS
    );
    const j = await r.json().catch(() => null);
    const txt = Array.isArray(j) ? j?.[0]?.generated_text : (j?.generated_text || j?.text);
    return txt ? String(txt) : "";
  }

  throw new Error(`unknown_vision_provider:${name}`);
}

 
function assetKind(symbol) {
  const s = String(symbol || "").toUpperCase();
  if (s === "XAUUSD" || s === "XAGUSD") return "metal";
  if (s.endsWith("USDT")) return "crypto";
  if (/^[A-Z]{6}$/.test(s)) return "forex";
  if (s === "DJI" || s === "NDX" || s === "SPX") return "index";
  return "unknown";
}

function providerSupportsSymbol(provider, symbol, env) {
  const kind = assetKind(symbol);
  if (provider === "binance") return kind === "crypto";
  if (provider === "nobitex") return kind === "crypto";
  if (provider === "coingecko") return kind === "crypto";
  if (provider === "twelvedata") return !!(env.TWELVEDATA_API_KEY || env.TWELVEDATA_API_KEYS) && ["crypto", "forex", "metal"].includes(kind);
  if (provider === "alphavantage") return !!(env.ALPHAVANTAGE_API_KEY || env.ALPHAVANTAGE_API_KEYS) && kind === "forex";
  if (provider === "finnhub") return !!(env.FINNHUB_API_KEY || env.FINNHUB_API_KEYS) && ["forex", "metal"].includes(kind);
  if (provider === "yahoo") return true;
  return true;
}

function parseApiKeyPool(primary, many) {
  const arr = [];
  const one = String(primary || "").trim();
  if (one) arr.push(one);

  // Accept comma/newline/semicolon-separated pools for easier env config.
  const list = String(many || "")
    .split(/[\n\r,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);

  for (const k of list) if (!arr.includes(k)) arr.push(k);
  return arr;
}

function stableHashInt(s) {
  const str = String(s || "");
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

function rotateBySeed(arr, seed) {
  if (!Array.isArray(arr) || arr.length <= 1) return Array.isArray(arr) ? arr.slice() : [];
  const i = stableHashInt(seed) % arr.length;
  return arr.slice(i).concat(arr.slice(0, i));
}

function pickApiKey(pool, seed) {
  if (!Array.isArray(pool) || !pool.length) return "";
  return pool[stableHashInt(seed) % pool.length];
}

function resolveMarketProviderChain(env, symbol, timeframe = "H4") {
  const desired = parseOrder(env.MARKET_DATA_PROVIDER_ORDER, ["binance","nobitex","coingecko","twelvedata","alphavantage","finnhub","yahoo"]);
  const filtered = desired.filter((p) => providerSupportsSymbol(p, symbol, env));
  const chain = filtered.length ? filtered : ["yahoo"];
  return rotateBySeed(chain, `${symbol}|${timeframe}`);
}

function mapTimeframeToBinance(tf) {
  const m = { M15: "15m", H1: "1h", H4: "4h", D1: "1d" };
  return m[tf] || "4h";
}
function mapTimeframeToTwelve(tf) {
  const m = { M15: "15min", H1: "1h", H4: "4h", D1: "1day" };
  return m[tf] || "4h";
}
function mapForexSymbolForTwelve(symbol) {
  if (symbol === "XAUUSD") return "XAU/USD";
  if (symbol === "XAGUSD") return "XAG/USD";
  if (/^[A-Z]{6}$/.test(symbol)) return `${symbol.slice(0,3)}/${symbol.slice(3,6)}`;
  return symbol;
}

function encodeForTwelveSymbol(sym) {
  // Some APIs don't correctly decode an encoded "/" (%2F) in query parameters for commodities/forex symbols.
  // Keep slashes unescaped (e.g., XAG/USD) while still encoding other reserved characters.
  return encodeURIComponent(String(sym || "")).replace(/%2F/gi, "/");
}


function mapTimeframeToAlphaVantage(tf) {
  const m = { M15:"15min", H1:"60min" };
  return m[tf] || "60min";
}

function toYahooSymbol(symbol) {
  if (/^[A-Z]{6}$/.test(symbol)) return `${symbol}=X`;
  if (symbol.endsWith("USDT")) return `${symbol.replace("USDT","-USD")}`;
  if (symbol === "XAUUSD") return "XAUUSD=X";
  if (symbol === "XAGUSD") return "XAGUSD=X";
  return symbol;
}

function toYahooSymbols(symbol) {
  const base = toYahooSymbol(symbol);
  const s = String(symbol || "").toUpperCase();
  // Yahoo FX spot tickers sometimes fail from the chart endpoint; futures tickers are a reliable fallback.
  if (s === "XAGUSD") return [base, "SI=F"]; // Silver futures
  if (s === "XAUUSD") return [base, "GC=F"]; // Gold futures
  return [base];
}

function yahooInterval(tf) {
  
  
  const m = { M15:"15m", H1:"60m", H4:"60m", D1:"1d" };
  return m[tf] || "60m";
}

function downsampleCandles(candles, groupSize) {
  if (!Array.isArray(candles) || candles.length === 0) return [];
  const out = [];
  for (let i = 0; i < candles.length; i += groupSize) {
    const g = candles.slice(i, i + groupSize);
    if (!g.length) continue;
    const o = g[0].o;
    const c = g[g.length - 1].c;
    let h = -Infinity, l = Infinity, v = 0;
    for (const x of g) {
      if (Number.isFinite(x.h)) h = Math.max(h, x.h);
      if (Number.isFinite(x.l)) l = Math.min(l, x.l);
      if (Number.isFinite(x.v)) v += x.v;
    }
    out.push({ t: g[0].t, o, h, l, c, v });
  }
  return out;
}

async function fetchBinanceCandles(symbol, timeframe, limit, timeoutMs) {
  if (!symbol.endsWith("USDT")) throw new Error("binance_not_crypto");
  const interval = mapTimeframeToBinance(timeframe);
  const urls = [
    `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`,
    `https://data-api.binance.vision/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`,
    `https://api.binance.us/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`,
  ];
  let lastErr = null;
  for (const url of urls) {
    try {
      const r = await fetchWithTimeout(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
      }, timeoutMs);
      if (!r.ok) throw new Error(`binance_http_${r.status}`);
      const data = await r.json();
      return data.map(k => ({
        t: k[0],
        o: Number(k[1]),
        h: Number(k[2]),
        l: Number(k[3]),
        c: Number(k[4]),
        v: Number(k[5]),
      }));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("binance_http_failed");
}


async function fetchNobitexCandles(symbol, timeframe, limit, timeoutMs) {
  
  const s = String(symbol || "").trim().toUpperCase();
  const resMap = { M15: "15", H1: "60", H4: "240", D1: "D" };
  const res = resMap[String(timeframe || "").toUpperCase()] || "60";

  const now = Math.floor(Date.now() / 1000);
  const spanSec = (res === "D") ? 86400 : (Number(res) * 60);
  const from = now - spanSec * Math.max(120, Number(limit || 200) + 20);

  const url = `https://api.nobitex.ir/market/udf/history?symbol=${encodeURIComponent(s)}&resolution=${encodeURIComponent(res)}&from=${from}&to=${now}`;
  const r = await fetchWithTimeout(url, { method: "GET" }, timeoutMs);
  if (!r.ok) throw new Error(`nobitex_http_${r.status}`);
  const j = await r.json().catch(() => null);
  if (!j || j.s !== "ok" || !Array.isArray(j.t)) throw new Error("nobitex_bad_payload");

  const out = [];
  for (let i = 0; i < j.t.length; i++) {
    const t = Number(j.t[i]);
    const o = Number(j.o?.[i]); const h = Number(j.h?.[i]); const l = Number(j.l?.[i]); const c = Number(j.c?.[i]);
    const v = Number(j.v?.[i] ?? 0);
    if (!Number.isFinite(t) || !Number.isFinite(o) || !Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(c)) continue;
    out.push({ t: t * 1000, o, h, l, c, v });
  }
  return out.slice(-limit);
}

function cgTfToDays(tf, limit) {
  const TF = String(tf || "H1").toUpperCase();
  const base = TF === "M15" ? 15*60 : TF === "H1" ? 3600 : TF === "H4" ? 14400 : 86400;
  const total = base * (Number(limit || 200) + 20);
  const days = Math.ceil(total / 86400);
  return Math.min(90, Math.max(1, days));
}

async function fetchCoinGeckoCandles(symbol, timeframe, limit, timeoutMs) {
  
  const s = String(symbol || "").trim().toUpperCase();
  const base = s.endsWith("USDT") ? s.slice(0, -4) : s;
  const coin = base.toLowerCase();
  const days = cgTfToDays(timeframe, limit);

  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coin)}/market_chart?vs_currency=usd&days=${days}`;
  const r = await fetchWithTimeout(url, { method: "GET", headers: { "Accept": "application/json" } }, timeoutMs);
  if (!r.ok) throw new Error(`coingecko_http_${r.status}`);
  const j = await r.json().catch(() => null);
  const prices = j?.prices;
  if (!Array.isArray(prices) || prices.length < 5) throw new Error("coingecko_no_prices");

  const TF = String(timeframe || "H1").toUpperCase();
  const bucketMs = TF === "M15" ? 15*60*1000 : TF === "H1" ? 60*60*1000 : TF === "H4" ? 4*60*60*1000 : 24*60*60*1000;

  const map = new Map();
  for (const row of prices) {
    const ts = Number(row?.[0]);
    const px = Number(row?.[1]);
    if (!Number.isFinite(ts) || !Number.isFinite(px)) continue;
    const t = Math.floor(ts / bucketMs) * bucketMs;
    const c = map.get(t);
    if (!c) map.set(t, { t, o: px, h: px, l: px, c: px, v: 0 });
    else {
      c.h = Math.max(c.h, px);
      c.l = Math.min(c.l, px);
      c.c = px;
    }
  }
  const out = Array.from(map.values()).sort((a, b) => a.t - b.t);
  return out.slice(-limit);
}

async function fetchTwelveDataCandles(symbol, timeframe, limit, timeoutMs, env) {
  const tdPool = parseApiKeyPool(env.TWELVEDATA_API_KEY, env.TWELVEDATA_API_KEYS);
  if (!tdPool.length) throw new Error("twelvedata_key_missing");
  const kind = assetKind(symbol);
  if (kind === "unknown") throw new Error("twelvedata_unknown_symbol");

  const interval = mapTimeframeToTwelve(timeframe);
  const sym = mapForexSymbolForTwelve(symbol);
  const tdKey = pickApiKey(tdPool, `${symbol}|${timeframe}|${Math.floor(Date.now() / 60000)}`);
  const base = `https://api.twelvedata.com/time_series?symbol=${encodeForTwelveSymbol(sym)}&interval=${encodeURIComponent(interval)}&outputsize=${limit}&apikey=${encodeURIComponent(tdKey)}`;
  const sources = [];
  if (kind === "crypto") sources.push("binance");
  if (kind === "forex" || kind === "metal") sources.push("fx");
  const urls = [base, ...sources.map((s) => `${base}&source=${encodeURIComponent(s)}`)];

  let lastErr = null;
  let j = null;
  for (const url of urls) {
    try {
      const r = await fetchWithTimeout(url, {}, timeoutMs);
      if (!r.ok) throw new Error(`twelvedata_http_${r.status}`);
      j = await r.json();
      if (j.status === "error") throw new Error(`twelvedata_err_${j.code || ""}`);
      break;
    } catch (e) {
      lastErr = e;
      j = null;
    }
  }
  if (!j) throw lastErr || new Error("twelvedata_http_failed");

  const values = Array.isArray(j.values) ? j.values : [];
  return values.reverse().map(v => ({
    t: Date.parse(v.datetime + "Z") || Date.now(),
    o: Number(v.open),
    h: Number(v.high),
    l: Number(v.low),
    c: Number(v.close),
    v: v.volume ? Number(v.volume) : null,
  }));
}

async function fetchAlphaVantageFxIntraday(symbol, timeframe, limit, timeoutMs, env) {
  const avPool = parseApiKeyPool(env.ALPHAVANTAGE_API_KEY, env.ALPHAVANTAGE_API_KEYS);
  if (!avPool.length) throw new Error("alphavantage_key_missing");
  if (!/^[A-Z]{6}$/.test(symbol) && symbol !== "XAUUSD" && symbol !== "XAGUSD") throw new Error("alphavantage_only_fx_like");

  const from = symbol.slice(0,3);
  const to = symbol.slice(3,6);
  const interval = mapTimeframeToAlphaVantage(timeframe);

  const avKey = pickApiKey(avPool, `${symbol}|${timeframe}|${Math.floor(Date.now() / 60000)}`);
  const url =
    `https://www.alphavantage.co/query?function=FX_INTRADAY` +
    `&from_symbol=${encodeURIComponent(from)}` +
    `&to_symbol=${encodeURIComponent(to)}` +
    `&interval=${encodeURIComponent(interval)}` +
    `&outputsize=compact` +
    `&apikey=${encodeURIComponent(avKey)}`;

  const r = await fetchWithTimeout(url, {}, timeoutMs);
  if (!r.ok) throw new Error(`alphavantage_http_${r.status}`);
  const j = await r.json();

  const key = Object.keys(j).find(k => k.startsWith("Time Series FX"));
  if (!key) throw new Error("alphavantage_no_timeseries");

  const ts = j[key];
  const rows = Object.entries(ts)
    .slice(0, limit)
    .map(([dt, v]) => ({
      t: Date.parse(dt + "Z") || Date.now(),
      o: Number(v["1. open"]),
      h: Number(v["2. high"]),
      l: Number(v["3. low"]),
      c: Number(v["4. close"]),
      v: null,
    }))
    .reverse();

  return rows;
}

function mapTimeframeToFinnhubResolution(tf) {
  const m = { M15:"15", H1:"60", H4:"240", D1:"D" };
  return m[tf] || "240";
}
async function fetchFinnhubForexCandles(symbol, timeframe, limit, timeoutMs, env) {
  const fhPool = parseApiKeyPool(env.FINNHUB_API_KEY, env.FINNHUB_API_KEYS);
  if (!fhPool.length) throw new Error("finnhub_key_missing");
  if (!/^[A-Z]{6}$/.test(symbol)) throw new Error("finnhub_only_forex");

  const res = mapTimeframeToFinnhubResolution(timeframe);
  const inst = `OANDA:${symbol.slice(0,3)}_${symbol.slice(3,6)}`;

  const now = Math.floor(Date.now() / 1000);
  const lookbackSec = 60 * 60 * 24 * 10;
  const from = now - lookbackSec;

  const fhKey = pickApiKey(fhPool, `${symbol}|${timeframe}|${Math.floor(Date.now() / 60000)}`);
  const url = `https://finnhub.io/api/v1/forex/candle?symbol=${encodeURIComponent(inst)}&resolution=${encodeURIComponent(res)}&from=${from}&to=${now}&token=${encodeURIComponent(fhKey)}`;

  const r = await fetchWithTimeout(url, {}, timeoutMs);
  if (!r.ok) throw new Error(`finnhub_http_${r.status}`);
  const j = await r.json();
  if (j.s !== "ok") throw new Error(`finnhub_status_${j.s}`);

  const candles = j.t.map((t, i) => ({
    t: t * 1000,
    o: Number(j.o[i]),
    h: Number(j.h[i]),
    l: Number(j.l[i]),
    c: Number(j.c[i]),
    v: j.v ? Number(j.v[i]) : null,
  }));
  return candles.slice(-limit);
}

async function fetchYahooChartCandles(symbol, timeframe, limit, timeoutMs) {
  
  
  const interval = yahooInterval(timeframe);
  const ysyms = toYahooSymbols(symbol);

  
  const baseRange = (timeframe === "D1") ? "6mo" : (timeframe === "H4" ? "30d" : "10d");

  const tryIntervals = [];
  if (interval) tryIntervals.push(interval);
  if (interval !== "60m") tryIntervals.push("60m");

  const hosts = [
    "https://query1.finance.yahoo.com",
    "https://query2.finance.yahoo.com"
  ];

  const qs = `?interval={IV}&range=${encodeURIComponent(baseRange)}&includePrePost=false&events=div%7Csplit%7Cearn&lang=en-US&region=US`;

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://finance.yahoo.com/",
    "Origin": "https://finance.yahoo.com"
  };

  let lastErr = null;

    for (const ysym of ysyms) {
  for (const iv of tryIntervals) {
      for (const host of hosts) {
        try {
          const url = `${host}/v8/finance/chart/${encodeURIComponent(ysym)}` + qs.replace("{IV}", encodeURIComponent(iv));
          const r = await fetchWithTimeout(url, { headers }, timeoutMs);
          if (!r.ok) throw new Error(`yahoo_http_${r.status}`);
          const j = await r.json();

          const result = j?.chart?.result?.[0];
          const ts = result?.timestamp || [];
          const q = result?.indicators?.quote?.[0];
          if (!ts.length || !q) throw new Error("yahoo_no_data");

          let candles = ts.map((t, i) => ({
            t: t * 1000,
            o: Number(q.open?.[i]),
            h: Number(q.high?.[i]),
            l: Number(q.low?.[i]),
            c: Number(q.close?.[i]),
            v: q.volume?.[i] != null ? Number(q.volume[i]) : null
          })).filter(x => Number.isFinite(x.c));

          if (timeframe === "H4" && iv === "60m") {
            candles = downsampleCandles(candles, 4);
          }

          return candles.slice(-limit);
        } catch (e) {
          lastErr = e;
        }
      }
    }
  
  }

throw lastErr || new Error("yahoo_no_data");
}

function marketCacheKey(symbol, timeframe) {
  return `market:${String(symbol).toUpperCase()}:${String(timeframe).toUpperCase()}`;
}

async function getMarketCache(env, key) {
  const mem = cacheGet(MARKET_CACHE, key);
  if (mem) return mem;
  const r2 = await getCachedR2Value(env.MARKET_R2, key);
  if (r2) cacheSet(MARKET_CACHE, key, r2, Number(env.MARKET_CACHE_TTL_MS || 120000));
  return r2;
}

async function getMarketCacheStale(env, key) {
  const mem = cacheGet(MARKET_CACHE, key);
  if (mem) return mem;
  const r2 = await getCachedR2ValueAllowStale(env.MARKET_R2, key);
  if (r2) cacheSet(MARKET_CACHE, key, r2, Number(env.MARKET_CACHE_TTL_MS || 120000));
  return r2;
}

async function setMarketCache(env, key, value) {
  const ttlMs = Number(env.MARKET_CACHE_TTL_MS || 120000);
  cacheSet(MARKET_CACHE, key, value, ttlMs);
  await r2PutJson(env.MARKET_R2, key, value, ttlMs);
}

async function getMarketCandlesWithFallback(env, symbol, timeframe) {
  const timeoutMs = Number(env.MARKET_DATA_TIMEOUT_MS || 12000);
  const limit = Number(env.MARKET_DATA_CANDLES_LIMIT || 200);
  const tf = String(timeframe || "H4").toUpperCase();
  const cacheKey = marketCacheKey(symbol, tf);
  const minNeed = minCandlesForTimeframe(tf);
  const cached = await getMarketCache(env, cacheKey);
  if (Array.isArray(cached) && cached.length >= Math.min(6, minNeed)) return cached;

  const chain = resolveMarketProviderChain(env, symbol, tf);
  let lastErr = null;

  for (const p of chain) {
    if (providerInCooldown(p)) continue;
    try {
      let candles = null;
      if (p === "binance") candles = await fetchBinanceCandles(symbol, tf, limit, timeoutMs);
      if (p === "nobitex") candles = await fetchNobitexCandles(symbol, tf, limit, timeoutMs);
      if (p === "coingecko") candles = await fetchCoinGeckoCandles(symbol, tf, limit, timeoutMs);
      if (p === "twelvedata") candles = await fetchTwelveDataCandles(symbol, tf, limit, timeoutMs, env);
      if (p === "alphavantage") candles = await fetchAlphaVantageFxIntraday(symbol, tf, limit, timeoutMs, env);
      if (p === "finnhub") candles = await fetchFinnhubForexCandles(symbol, tf, limit, timeoutMs, env);
      if (p === "yahoo") candles = await fetchYahooChartCandles(symbol, tf, limit, timeoutMs);
      if (Array.isArray(candles) && candles.length) {
        await setMarketCache(env, cacheKey, candles);
        markProviderSuccess(p, "market");
        if (candles.length >= minNeed) return candles;
      } else {
        markProviderFailure(p, env, "market");
      }
    } catch (e) {
      lastErr = e;
      markProviderFailure(p, env, "market");
      console.error("market provider failed:", p, e?.message || e);
    }
  }

  const stale = await getMarketCacheStale(env, cacheKey);
  if (Array.isArray(stale) && stale.length) return stale;

  
  const altTimeframes = {
    M15: ["M5", "M1"],
    H1: ["M15", "M5"],
    H4: ["H1", "M15"],
    D1: ["H4", "H1"],
  };
  const candidates = altTimeframes[tf] || [];
  for (const altTf of candidates) {
    try {
      const altCandles = await getMarketCandlesWithFallbackRaw(env, symbol, altTf, timeoutMs, limit * 8);
      const mapped = aggregateCandlesToTimeframe(altCandles, altTf, tf).slice(-limit);
      if (Array.isArray(mapped) && mapped.length) {
        await setMarketCache(env, cacheKey, mapped);
        if (mapped.length >= Math.min(8, minNeed)) return mapped;
      }
    } catch (e) {
      lastErr = e;
    }
  }

  
  const remapped = await getAnyTimeframeMarketCache(env, symbol, tf, limit);
  if (Array.isArray(remapped) && remapped.length) {
    await setMarketCache(env, cacheKey, remapped.slice(-limit));
    return remapped.slice(-limit);
  }

  throw lastErr || new Error("market_data_all_failed");
}

async function getAnyTimeframeMarketCache(env, symbol, targetTf, limit) {
  const tfs = ["M15", "H1", "H4", "D1"];
  for (const sourceTf of tfs) {
    const cacheKey = marketCacheKey(symbol, sourceTf);
    const cached = await getMarketCacheStale(env, cacheKey);
    if (!Array.isArray(cached) || !cached.length) continue;
    const mapped = aggregateCandlesToTimeframe(cached, sourceTf, targetTf);
    if (Array.isArray(mapped) && mapped.length) return mapped.slice(-limit);
    if (String(sourceTf) === String(targetTf)) return cached.slice(-limit);
  }
  return [];
}

async function getMarketCandlesWithFallbackRaw(env, symbol, timeframe, timeoutMs, limit) {
  const cacheKey = marketCacheKey(symbol, timeframe);
  const cached = await getMarketCache(env, cacheKey);
  if (Array.isArray(cached) && cached.length) return cached;
  const chain = resolveMarketProviderChain(env, symbol, timeframe);
  let lastErr = null;
  for (const p of chain) {
    if (providerInCooldown(p)) continue;
    try {
      let candles = null;
      if (p === "binance") candles = await fetchBinanceCandles(symbol, timeframe, limit, timeoutMs);
      if (p === "nobitex") candles = await fetchNobitexCandles(symbol, timeframe, limit, timeoutMs);
      if (p === "coingecko") candles = await fetchCoinGeckoCandles(symbol, timeframe, limit, timeoutMs);
      if (p === "twelvedata") candles = await fetchTwelveDataCandles(symbol, timeframe, limit, timeoutMs, env);
      if (p === "alphavantage") candles = await fetchAlphaVantageFxIntraday(symbol, timeframe, limit, timeoutMs, env);
      if (p === "finnhub") candles = await fetchFinnhubForexCandles(symbol, timeframe, limit, timeoutMs, env);
      if (p === "yahoo") candles = await fetchYahooChartCandles(symbol, timeframe, limit, timeoutMs);
      if (Array.isArray(candles) && candles.length) {
        await setMarketCache(env, cacheKey, candles);
        markProviderSuccess(p, "market");
        return candles;
      }
      markProviderFailure(p, env, "market");
    } catch (e) {
      lastErr = e;
      markProviderFailure(p, env, "market");
    }
  }
  throw lastErr || new Error("market_data_alt_failed");
}

const API_RESP_CACHE = new Map();

function apiRespCacheGet(key) {
  const it = API_RESP_CACHE.get(key);
  if (!it) return null;
  if (Date.now() > it.exp) { API_RESP_CACHE.delete(key); return null; }
  return it.val;
}
function apiRespCacheSet(key, val, ttlMs) {
  API_RESP_CACHE.set(key, { val, exp: Date.now() + Math.max(500, Number(ttlMs || 10000)) });
}

async function fetchSymbolNewsFa(symbol, env) {
  const query = symbolNewsQueryFa(symbol);
  const timeoutMs = Number(env.NEWS_TIMEOUT_MS || 9000);
  const limit = Math.min(8, Math.max(3, Number(env.NEWS_ITEMS_LIMIT || 6)));

  const urlsBase = [
    "https://news.google.com/rss/search?q=" + encodeURIComponent(query) + "&hl=fa&gl=IR&ceid=IR:fa",
    "https://news.google.com/rss/search?q=" + encodeURIComponent(symbol + " market") + "&hl=fa&gl=IR&ceid=IR:fa",
    "https://www.bing.com/news/search?q=" + encodeURIComponent(query) + "&format=rss&setlang=fa",
  ];
  const ext = String(env.NEWS_FEEDS_EXTRA || "").split(",").map((x) => x.trim()).filter(Boolean);
  const urls = urlsBase.concat(ext);
  const shift = urls.length ? (Math.floor(Date.now() / 60000) + String(symbol || "").length) % urls.length : 0;
  const rolledUrls = urls.slice(shift).concat(urls.slice(0, shift));

  let lastErr = null;
  for (const u of rolledUrls) {
    try {
      const r = await fetchWithTimeout(u, { headers: { "User-Agent": "Mozilla/5.0" } }, timeoutMs);
      if (!r.ok) throw new Error("news_http_" + r.status);
      const xml = await r.text();
      const items = parseRssItems(xml, limit);
      if (items.length) return items;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("news_failed");
}

function symbolNewsQueryFa(symbol) {
  const map = {
    BTCUSDT: "بیت کوین", ETHUSDT: "اتریوم", BNBUSDT: "بایننس کوین", SOLUSDT: "سولانا",
    XRPUSDT: "ریپل", ADAUSDT: "کاردانو", DOGEUSDT: "دوج کوین", AVAXUSDT: "آوالانچ",
    EURUSD: "یورو دلار", GBPUSD: "پوند دلار", USDJPY: "دلار ین", AUDUSD: "دلار استرالیا",
    XAUUSD: "طلا", XAGUSD: "نقره", DJI: "داوجونز", NDX: "نزدک", SPX: "اس اند پی 500"
  };
  return (map[symbol] || symbol) + " بازار مالی";
}

function stripTags(s) {
  return String(s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeXmlEntities(s) {
  return String(s || "")
    .split("&amp;").join("&")
    .split("&lt;").join("<")
    .split("&gt;").join(">")
    .split("&quot;").join('"')
    .split("&#39;").join("'");
}

function parseRssItems(xml, limit) {
  const raw = String(xml || "");
  const blocks = raw.match(/<item>[\s\S]*?<\/item>/g) || [];
  const out = [];
  for (const b of blocks.slice(0, limit * 2)) {
    const title = decodeXmlEntities(stripTags((b.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "")).trim();
    const link = decodeXmlEntities(((b.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || "").trim());
    const source = decodeXmlEntities(stripTags((b.match(/<source[^>]*>([\s\S]*?)<\/source>/i) || [])[1] || "")).trim();
    const pubDate = decodeXmlEntities(stripTags((b.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1] || "")).trim();
    if (!title || !link) continue;
    out.push({ title: title.slice(0, 180), url: link, source: source || "Google News", publishedAt: pubDate || "" });
    if (out.length >= limit) break;
  }
  return out;
}

async function buildNewsBlockForSymbol(symbol, env, maxItems = 4) {
  try {
    const rows = await fetchSymbolNewsFa(symbol, env);
    if (!Array.isArray(rows) || !rows.length) return "";
    return rows.slice(0, maxItems).map((x, i) => {
      const src = x?.source ? (" | " + x.source) : "";
      const dt = x?.publishedAt ? (" | " + x.publishedAt) : "";
      return (i + 1) + ") " + String(x?.title || "") + src + dt;
    }).join(String.fromCharCode(10));
  } catch {
    return "";
  }
}



function parseNewsBlockRows(newsBlock) {
  return String(newsBlock || "").split("\n").map((x) => ({ title: String(x || "").replace(/^\d+\)\s*/, "").trim() })).filter((x) => x.title);
}

async function buildNewsAnalysisSummary(symbol, articles, env) {
  const rows = Array.isArray(articles) ? articles.slice(0, 5) : [];
  if (!rows.length) return "برای این نماد خبر کافی جهت جمع‌بندی خبری در دسترس نیست.";
  const top = rows.map((a, i) => `${i + 1}) ${String(a?.title || "")}`).join(String.fromCharCode(10));
  const prompt = [
    "تحلیل‌گر خبر بازار مالی هستی.",
    `نماد: ${symbol}`,
    "از تیترهای زیر، یک جمع‌بندی کوتاه فارسی در ۳ بخش بساز:",
    "۱) احساس غالب بازار (صعودی/نزولی/خنثی)",
    "۲) ریسک خبری کوتاه‌مدت",
    "۳) اثر احتمالی روی سناریوی معاملاتی",
    "خیال‌بافی نکن و فقط بر اساس تیترها بنویس.",
    "TIERS:",
    top,
  ].join(String.fromCharCode(10));
  try {
    const out = await runTextProviders(prompt, env, env.TEXT_PROVIDER_ORDER);
    return String(out || "").trim() || "جمع‌بندی خبری تولید نشد.";
  } catch {
    return "جمع‌بندی خبری موقت: تیترها نشان‌دهنده نوسان کوتاه‌مدت هستند؛ ورود فقط با تایید تکنیکال انجام شود.";
  }
}

function timeframeMinutes(tf) {
  const map = { M1: 1, M5: 5, M15: 15, M30: 30, H1: 60, H4: 240, D1: 1440, W1: 10080 };
  return map[String(tf || "").toUpperCase()] || 0;
}

function aggregateCandlesToTimeframe(candles, fromTf, toTf) {
  if (!Array.isArray(candles) || candles.length < 2) return candles || [];
  const fromMin = timeframeMinutes(fromTf);
  const toMin = timeframeMinutes(toTf);
  if (!fromMin || !toMin || toMin <= fromMin || toMin % fromMin !== 0) return candles;
  const step = Math.max(1, Math.round(toMin / fromMin));
  const out = [];
  for (let i = 0; i < candles.length; i += step) {
    const chunk = candles.slice(i, i + step).filter((x) => Number.isFinite(x?.o) && Number.isFinite(x?.h) && Number.isFinite(x?.l) && Number.isFinite(x?.c));
    if (!chunk.length) continue;
    out.push({
      t: chunk[0].t,
      o: chunk[0].o,
      h: Math.max(...chunk.map((x) => x.h)),
      l: Math.min(...chunk.map((x) => x.l)),
      c: chunk[chunk.length - 1].c,
      v: chunk.reduce((s, x) => s + (Number(x.v) || 0), 0),
    });
  }
  return out;
}

function computeSnapshot(candles) {
  if (!candles?.length) return null;
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2] || last;

  const closes = candles.map(x => x.c);
  const sma = (arr, p) => {
    if (arr.length < p) return null;
    const s = arr.slice(-p).reduce((a,b)=>a+b,0);
    return s / p;
  };

  const sma20 = null;
  const sma50 = null;
  let trend = "نامشخص";

  const n = Math.min(50, candles.length);
  const recent = candles.slice(-n);
  const hi = Math.max(...recent.map(x => x.h));
  const lo = Math.min(...recent.map(x => x.l));

  const lastClose = last.c;
  const changePct = prev?.c ? ((lastClose - prev.c) / prev.c) * 100 : 0;

  const lb = Math.min(20, closes.length - 1);
  const past = lb > 0 ? closes[closes.length - 1 - lb] : null;
  if (past != null) {
    trend = lastClose > past ? "صعودی" : (lastClose < past ? "نزولی" : "نامشخص");
  }

  return {
    lastPrice: lastClose,
    changePct: Number(changePct.toFixed(3)),
    trend,
    range50: { hi, lo },
    sma20: sma20 ? Number(sma20.toFixed(6)) : null,
    sma50: sma50 ? Number(sma50.toFixed(6)) : null,
    lastTs: last.t,
  };
}

function candlesToCompactCSV(candles, maxRows = 80) {
  const tail = candles.slice(-maxRows);
  return tail.map(x => `${x.t},${x.o},${x.h},${x.l},${x.c}`).join(String.fromCharCode(10));
}

function minCandlesForTimeframe(tf) {
  const m = { M15: 48, H1: 36, H4: 30, D1: 20 };
  return m[String(tf || "").toUpperCase()] || 24;
}

function sanitizeFallbackReason(reason) {
  const s = String(reason || "").replace(/\s+/g, " ").trim();
  if (!s) return "text_provider_unavailable";
  const lower = s.toLowerCase();

  const m = lower.match(/(openai|openrouter|deepseek|gemini|cf|aicc)_failed_status_(\d{3})/);
  if (m) {
    const prov = m[1];
    const code = m[2];
    if (code === "429" || /quota|rate|limit/.test(lower)) return `rate_limited_${prov}`;
    if (code === "401" || code === "403") return `auth_${prov}_${code}`;
    return `provider_${prov}_${code}`;
  }

  if (/_timeout/.test(lower) || /timeout/.test(lower)) return "timeout";
  if (/quota|rate|limit|429/.test(lower)) return "rate_limited";
  if (/api_key_missing|key_missing|missing/.test(lower)) return "provider_not_configured";
  if (/unauthorized|invalid api key|401/.test(lower)) return "invalid_api_key";

  return "text_provider_unavailable";
}

function stripCandleIndices(txt){
  const s = String(txt || "");
  // Remove explicit candle/bar numbering references (fa/en)
  return s
    .replace(/(کندل|شمع)\s*#?\s*\d+/g, "$1")
    .replace(/(candle|bar)\s*#?\s*\d+/gi, (m)=>m.split(/\s+/)[0]);
}

function buildLocalFallbackAnalysis(symbol, st, candles, reason = "") {
  const tf = st?.timeframe || "H4";
  const arr = Array.isArray(candles) ? candles : [];
  const snap = computeSnapshot(arr);
  const levels = extractLevelsFromCandles(arr);
  const levelTxt = levels.length ? levels.join(" | ") : "داده کافی نیست";
  const bias = snap?.trend || "نامشخص";

  const last = arr.length ? arr[arr.length - 1] : null;
  const prev = arr.length > 1 ? arr[arr.length - 2] : null;
  const lastBody = last ? (last.c - last.o) : 0;
  const lastDir = !last ? "نامشخص" : (lastBody > 0 ? "کندل صعودی" : (lastBody < 0 ? "کندل نزولی" : "دوجی/خنثی"));
  const wickUp = last ? (last.h - Math.max(last.o, last.c)) : 0;
  const wickDn = last ? (Math.min(last.o, last.c) - last.l) : 0;
  const wickHint = last
    ? (wickUp > wickDn * 1.4 ? "سایه بالایی بلند (فشار فروش/برداشت سود)"
      : (wickDn > wickUp * 1.4 ? "سایه پایینی بلند (جمع‌آوری/دفاع خریداران)"
      : "سایه‌ها متعادل"))
    : "نامشخص";

  const risk =
    String(st?.risk || "").trim() ||
    (snap ? (Math.abs(Number(snap.changePct || 0)) > 2 ? "بالا" : "متوسط") : "نامشخص");

  const lastPrice = snap?.lastPrice ?? (last ? last.c : null);
  const rHi = snap?.range50?.hi ?? null;
  const rLo = snap?.range50?.lo ?? null;

  // Pick a couple of nearest levels for examples (not guaranteed perfect)
  const lv = levels.map(Number).filter(n => Number.isFinite(n));
  const above = lastPrice != null ? lv.filter(x => x > lastPrice).sort((a,b)=>a-b) : [];
  const below = lastPrice != null ? lv.filter(x => x < lastPrice).sort((a,b)=>b-a) : [];
  const L1 = below[0] ?? (rLo ?? "");
  const L2 = below[1] ?? "";
  const U1 = above[0] ?? (rHi ?? "");
  const U2 = above[1] ?? "";

  return [
    "۱) Market Structure (ساختار بازار)",
    `نماد ${symbol} در تایم‌فریم ${tf} با بایاس «${bias}» ارزیابی شد.`,
    (lastPrice != null ? `قیمت آخر: ${lastPrice} | تغییر اخیر: ${snap?.changePct ?? 0}%` : "قیمت لحظه‌ای معتبر در دسترس نیست."),
    (rHi != null && rLo != null ? `رِنج ۵۰ کندل اخیر: High=${rHi} | Low=${rLo}` : ""),
    "",
    "۲) Key Levels (سطوح کلیدی)",
    `سطوح پیشنهادی (auto): ${levelTxt}`,
    (L1 !== "" ? `حمایت نزدیک: ${L1}${L2 !== "" ? ` | حمایت بعدی: ${L2}` : ""}` : ""),
    (U1 !== "" ? `مقاومت نزدیک: ${U1}${U2 !== "" ? ` | مقاومت بعدی: ${U2}` : ""}` : ""),
    "",
    "۳) Candlestick Behavior (رفتار کندلی)",
    `کندل اخیر: ${lastDir} — ${wickHint}.`,
    (prev ? `کندل قبل: ${prev.c > prev.o ? "صعودی" : (prev.c < prev.o ? "نزولی" : "خنثی")}.` : ""),
    "",
    "۴) Entry Scenarios (سناریوهای ورود)",
    "سناریو A (هم‌جهت با بایاس):",
    (bias === "صعودی"
      ? `- ورود روی پولبک به حمایت/زون (${L1 || "سطح معتبر"}). حدضرر زیر لوکال/زیر سطح. تارگت ۱: ${U1 || "مقاومت نزدیک"} | تارگت ۲: ${U2 || "بالاتر"}.`
      : (bias === "نزولی"
        ? `- ورود روی پولبک به مقاومت/زون (${U1 || "سطح معتبر"}). حدضرر بالای های لوکال/بالای سطح. تارگت ۱: ${L1 || "حمایت نزدیک"} | تارگت ۲: ${L2 || "پایین‌تر"}.`
        : "- ورود فقط بعد از شکست معتبر + پولبک به سطح شکست (از بین سطوح بالا/پایین).")),
    "سناریو B (جایگزین/ضد بایاس):",
    "- شکست ساختار خلاف جهت + تایید بازگشت (Reclaim/Retest) و سپس ورود سبک‌تر با ریسک کمتر.",
    "",
    "۵) Bias & Scenarios (بایاس و سناریوها)",
    `سناریوی اصلی: ادامه حرکت مطابق «${bias}».`,
    "سناریوی جایگزین: شکست ساختار خلاف جهت و برگشت به محدوده‌های میانی.",
    "",
    "۶) Execution Plan (پلن اجرا)",
    `ریسک پیشنهادی: ${risk}. ورود پله‌ای، حدضرر اجباری، و حداقل RR=1:2 توصیه می‌شود.`,
    "- قبل از ورود: سطح را مشخص کن، تایید کندلی بگیر، و سپس وارد شو.",
    "- بعد از ورود: در تارگت ۱ بخشی از سود را سیو کن و استاپ را مدیریت کن.",
    "",
    "۷) وضعیت سرویس",
    `این خروجی با فالبک داخلی تولید شد (علت: ${sanitizeFallbackReason(reason)}).`,
  ].filter(Boolean).join(String.fromCharCode(10));
}


 
async function buildTextPromptForSymbol(symbol, userPrompt, st, marketBlock, env, newsBlock = "") {
  const tf = st.timeframe || "H4";
  const sp = await getStylePrompt(env, st.style);
  const needBase = String(st.promptMode || "").trim() !== "style_only";
  const baseRaw = needBase ? await getAnalysisPrompt(env) : "";
  const newsAnalysisBlock = (newsBlock && String(st.promptMode||'').trim() !== 'style_only') ? await buildNewsAnalysisSummary(symbol, parseNewsBlockRows(newsBlock), env) : "";
  const base = baseRaw
     .split("{TIMEFRAME}").join(tf)
     .split("{STYLE}").join(st.style || "")
     .split("{RISK}").join(st.risk || "")
     .split("{NEWS}").join(st.newsEnabled ? "on" : "off");

  const capital = st.capital?.enabled === false
    ? "disabled"
    : (st.profile?.capital ? (st.profile.capital + " " + (st.profile.capitalCurrency || "USDT")) : (st.capital?.amount || "unknown"));

  
  if (String(st.promptMode || "").trim() === "style_only") {
    const sym = String(symbol || "").toUpperCase();
    const capEnabled = !(st && st.capital && st.capital.enabled === false);
    const capAmount = Number((st.profile && st.profile.capital) || (st.capital && st.capital.amount) || 0) || 0;
    const capCur = String((st.profile && st.profile.capitalCurrency) || "USDT");
    
    const outputRules = [
      "OUTPUT_RULES:",
      "- ساختار دقیقاً مطابق Style Prompt (system) باشد؛ هیچ بخش اضافه‌ای خارج از آن ننویس.",
      "- متن USER_REQUEST را اصلاح/بازنویسی نکن؛ فقط به عنوان درخواست استفاده کن.",
      "- داده‌ی MARKET_DATA (و داخلش MARKET_DATA_STD) را منبع حقیقت بدان و اعداد/سطوح را از آن استخراج کن.",
      "- اگر داده محدود است، شفاف بگو «داده محدود است» اما تحلیل را ادامه بده و فقط سناریوهای مشروط/محافظه‌کارانه بده؛ هرگز ننویس «اطلاعات کافی ندارم/نمی‌توانم».",
      "- هرگز از شماره/اندیس کندل (مثل «کندل ۱۲» یا candle 12) استفاده نکن.",
      "- فقط فارسی.",
      "- هر بخش را با جزئیات زیاد بنویس؛ برای هر بخش حداقل ۶ bullet یا ۶ جمله ارائه بده و کوتاه ننویس.",
      "- در انتهای پاسخ، یک بلاک <QCJSON>...</QCJSON> اضافه کن (بدون code fence). این بلاک فقط برای رسم زون/لاین است و داخل متن اصلی به آن اشاره نکن.",
      "- QCJSON فقط JSON معتبر باشد و شامل کلیدهای زیر: supports, resistances, zones, tp, sl",
      "- supports/resistances/tp آرایه عددی باشند؛ sl یک عدد باشد یا null.",
      "- zones آرایه‌ای از آبجکت‌ها با {low:number, high:number, label:string, kind:string} و kind یکی از: demand|supply|fvg|ob|liq"
    ].join(String.fromCharCode(10));

    const detailLine =
      "IMPORTANT: پاسخ را کاملاً فارسی، خیلی کامل و با جزئیات بنویس؛ خلاصه‌نویسی نکن؛ همه بخش‌ها و bulletهای پرامپت را کامل پوشش بده.";

    const userText =
      `Symbol: ${sym}
Timeframe: ${tf}
Style: ${String(st.style || "")}
Risk: ${String(st.risk || "متوسط")}
Capital: ${capEnabled ? (capAmount + " " + capCur) : "disabled"}

MARKET_DATA:
${marketBlock || ""}

` +
      (newsBlock ? `NEWS:
${newsBlock}

` : "") +
      (userPrompt ? `USER_REQUEST:
${String(userPrompt || "")}

` : "") +
      "\n" + outputRules + "\n\n" +
      detailLine;

    return [
      { role: "system", content: (await getAnalysisPrompt(env)) + "\n\nSTYLE_PROMPT_JSON:\n" + String(sp || "") + "\n\n" + GLOBAL_MONEY_MANAGEMENT_FORMULA },
      { role: "user", content: userText },
    ];
  }
  const sym = String(symbol || "").toUpperCase();
  const capEnabled = !(st && st.capital && st.capital.enabled === false);
  const capAmount = Number((st.profile && st.profile.capital) || (st.capital && st.capital.amount) || 0) || 0;
  const capCur = String((st.profile && st.profile.capitalCurrency) || "USDT");

  const outputRules = [
    "OUTPUT_RULES:",
    "- خروجی فقط فارسی باشد.",
    "- ساختار خروجی دقیقاً مطابق Style Prompt باشد (در SYSTEM). اگر Style Prompt فارسی است، هیچ بخش اضافه‌ای خارج از آن ننویس.",
    "- از MARKET_DATA فقط به عنوان منبع حقیقت استفاده کن و عددسازی/حدس نزن.",
    "- سطوح کلیدی (Support/Resistance/Zone) را با عدد دقیق و در صورت نیاز بازه‌ای (low-high) بنویس.",
    "- اگر داده محدود است، شفاف بگو «داده محدود است» و سناریو را «مشروط» بنویس؛ سناریوی ساختگی/عددسازی نکن و هرگز ننویس «اطلاعات کافی ندارم/نمی‌توانم».",
    "- خلاصه‌نویسی نکن؛ همه بخش‌های شماره‌دار را کامل پوشش بده.",
    "- هر بخش را با جزئیات زیاد بنویس؛ برای هر بخش حداقل ۶ bullet یا ۶ جمله ارائه بده و کوتاه ننویس.",
    "- در انتهای پاسخ، یک بلاک <QCJSON>...</QCJSON> اضافه کن (بدون code fence). این بلاک فقط برای رسم زون/لاین است و داخل متن اصلی به آن اشاره نکن.",
    "- QCJSON فقط JSON معتبر باشد و شامل کلیدهای زیر: supports, resistances, zones, tp, sl",
    "- supports/resistances/tp آرایه عددی باشند؛ sl یک عدد باشد یا null.",
    "- zones آرایه‌ای از آبجکت‌ها با {low:number, high:number, label:string, kind:string} و kind یکی از: demand|supply|fvg|ob|liq"
  ].join(String.fromCharCode(10));

  const detailLine =
    "IMPORTANT: خروجی را خیلی کامل، مرحله‌ای و اجرایی بنویس و همه بخش‌های شماره‌دار را تا انتها تکمیل کن.";

  const userText =
    `Symbol: ${sym}
Timeframe: ${tf}
Style: ${String(st.style || "")}
Risk: ${String(st.risk || "متوسط")}
Capital: ${capEnabled ? (capAmount + " " + capCur) : "disabled"}

MARKET_DATA:
${marketBlock || ""}

` +
    (newsBlock ? `NEWS:
${newsBlock}

` : "") +
    (newsAnalysisBlock ? `NEWS_ANALYSIS:
${newsAnalysisBlock}

` : "") +
    (userPrompt ? `USER_REQUEST:
${String(userPrompt || "")}

` : "") +
    "\n" + outputRules + "\n\n" + detailLine;

  const sysText = (`${base}

STYLE_PROMPT:
${sp}

${GLOBAL_MONEY_MANAGEMENT_FORMULA}
`).trim();

  return [
    { role: "system", content: sysText },
    { role: "user", content: userText },
  ];
}

 
async function getWallet(env) {
  const fallback = (env.WALLET_ADDRESS || "0x7338629c4f865DD92C2c92f1c8D5410515809d85").toString().trim();
  if (!env.BOT_KV) return fallback;
  const v = await env.BOT_KV.get("settings:wallet");
  return (v || fallback).toString().trim();
}
async function setWallet(env, wallet) {
  if (!env.BOT_KV) throw new Error("BOT_KV_missing");
  await env.BOT_KV.put("settings:wallet", String(wallet || "").trim());
}

 
const QUIZ = [
  { key: "q1", text: "۱) بیشتر دنبال چی هستی؟", options: ["اسکالپ سریع", "سوئینگ چندروزه", "هولد/سرمایه‌گذاری", "نمی‌دانم"] },
  { key: "q2", text: "۲) وقتی معامله خلاف تو رفت…", options: ["فوراً می‌بندم", "صبر می‌کنم تا ساختار مشخص شود", "میانگین کم می‌کنم", "تجربه‌ای ندارم"] },
  { key: "q3", text: "۳) ابزار تحلیل‌ات؟", options: ["پرایس‌اکشن", "اندیکاتور", "اسمارت‌مانی", "هیچکدام"] },
  { key: "q4", text: "۴) تحمل ریسک؟", options: ["کم", "متوسط", "زیاد", "نمی‌دانم"] },
  { key: "q5", text: "۵) تایم آزاد برای چک کردن بازار؟", options: ["ساعتی", "چندبار در روز", "روزانه", "هفتگی/کم"] },
];

async function evaluateLevelWithAI(env, profile, quizAnswers) {
  const prompt =
`تو یک مشاور تعیین‌سطح معامله‌گری هستی. خروجی فقط JSON باشد.
ورودی:
- تجربه بازار: ${profile.marketExperience}
- بازار مورد علاقه: ${profile.preferredMarket}
- پاسخ‌های آزمون: ${JSON.stringify(quizAnswers)}

خروجی JSON با کلیدهای:
level یکی از: beginner|intermediate|pro
recommendedMarket یکی از: crypto|forex|metals|stocks
settings: { timeframe: "M15|H1|H4|D1", style: "اسکالپ|سوئینگ|اسمارت‌مانی", risk: "کم|متوسط|زیاد" }
notes: رشته کوتاه فارسی`;

  try {
    const out = await runTextProviders(prompt, env, env.TEXT_PROVIDER_ORDER);
    const json = safeExtractJson(out);
    if (json && json.settings) return json;
  } catch (e) {
    console.error("evaluateLevelWithAI failed:", e);
  }

  const risk = (quizAnswers.q4 || "").includes("کم") ? "کم" : (quizAnswers.q4 || "").includes("زیاد") ? "زیاد" : "متوسط";
  const tf = (quizAnswers.q1 || "").includes("اسکالپ") ? "M15" : (quizAnswers.q1 || "").includes("سوئینگ") ? "H4" : "H1";
  return {
    level: "beginner",
    recommendedMarket: mapPreferredMarket(profile.preferredMarket),
    settings: { timeframe: tf, style: "اسمارت‌مانی", risk },
    notes: "تنظیمات اولیه بر اساس پاسخ‌های شما چیده شد.",
  };
}

function safeExtractJson(txt) {
  const s = String(txt || "");
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

function mapPreferredMarket(s) {
  s = (s || "").toLowerCase();
  if (s.includes("کریپتو") || s.includes("crypto")) return "crypto";
  if (s.includes("فارکس") || s.includes("forex")) return "forex";
  if (s.includes("فلز") || s.includes("gold") || s.includes("xau")) return "metals";
  if (s.includes("سهام") || s.includes("stock")) return "stocks";
  return "crypto";
}

 
async function storeReferralCodeOwner(env, code, ownerUserId) {
  if (!env.BOT_KV) return;
  await env.BOT_KV.put(`ref:${code}`, String(ownerUserId));
}
async function resolveReferralOwner(env, code) {
  if (!env.BOT_KV) return "";
  const v = await env.BOT_KV.get(`ref:${code}`);
  return (v || "").toString().trim();
}

function normalizePhone(phone) {
  const raw = String(phone || "").trim();
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  // If user entered local Iranian format like 0912..., normalize to +98...
  if (digits.startsWith("0") && digits.length === 11) return "+98" + digits.slice(1);
  if (digits.startsWith("98")) return "+" + digits;
  // Default: add +
  return "+" + digits;
}


async function hashPhone(phone) {
  const norm = normalizePhone(phone);
  if (!norm) return "";
  const data = new TextEncoder().encode(norm);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}


async function getPhoneOwner(env, phone) {
  if (!env.BOT_KV) return "";
  const h = await hashPhone(phone);
  const v = await env.BOT_KV.get(`phone:${h}`);
  return (v || "").toString().trim();
}

function parseReferralTierPoints(env) {
  // Example: "6,2,1" => level1=6, level2=2, level3=1
  const raw = String(env.REFERRAL_TIER_POINTS || env.REF_MULTI_LEVEL_POINTS || env.REF_TIER_POINTS || "6").trim();
  const arr = raw
    .split(/[,|\s]+/)
    .map((x) => Number(String(x || "").trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return arr.length ? arr.slice(0, 5) : [6];
}

function proRedeemThreshold(env) {
  const n = toInt(env.PRO_REDEEM_POINTS, 1000);
  return Math.max(100, n);
}

function freeProDays(env) {
  return Math.max(1, toInt(env.FREE_PRO_DAYS, 30));
}

function premiumDailyLimit(env) {
  return Math.max(1, toInt(env.PREMIUM_DAILY_LIMIT, 50));
}

function addDaysISO(baseIso, days) {
  const base = baseIso && String(baseIso).trim() ? new Date(baseIso) : new Date();
  const start = Number.isFinite(base.getTime()) ? base : new Date();
  const d = new Date(start.getTime() + Number(days || 0) * 24 * 3600 * 1000);
  return d.toISOString();
}

function maybeRedeemFreeProFromPoints(st, env) {
  ensurePoints(st);
  const thr = proRedeemThreshold(env);
  const days = freeProDays(env);
  const daily = premiumDailyLimit(env);

  let redeemed = 0;
  while (Number(st.points.balance || 0) >= thr) {
    st.points.balance = Number(st.points.balance || 0) - thr;
    redeemed++;

    st.subscription = st.subscription || { active: false, type: "free", expiresAt: "", dailyLimit: 3 };

    const now = Date.now();
    const expMs = st.subscription.expiresAt ? Date.parse(st.subscription.expiresAt) : 0;
    const baseIso = expMs && expMs > now ? st.subscription.expiresAt : new Date().toISOString();

    // Do NOT override paid/manual plan type; just extend expiry and ensure dailyLimit.
    if (!st.subscription.active) {
      st.subscription.active = true;
      st.subscription.type = "free_pro";
    }
    st.subscription.dailyLimit = Math.max(Number(st.subscription.dailyLimit || 0), daily);
    st.subscription.expiresAt = addDaysISO(baseIso, days);
  }

  if (redeemed > 0) {
    st.referral = st.referral || {};
    st.referral.freeProRedeemed = Number(st.referral.freeProRedeemed || 0) + redeemed;
  }
  return redeemed;
}

async function isPhoneNew(env, phone) {
  if (!env.BOT_KV) return true;
  const h = await hashPhone(phone);
  const key = `phone:${h}`;
  const exists = await env.BOT_KV.get(key);
  return !exists;
}

async function markPhoneSeen(env, phone, userId) {
  if (!env.BOT_KV) return;
  const h = await hashPhone(phone);
  await env.BOT_KV.put(`phone:${h}`, String(userId));
}

async function awardReferralIfEligible(env, newUserSt) {
  
  return finalizeOnboardingRewards(env, newUserSt);
}

function futureISO(days) {
  const d = new Date(Date.now() + days * 24 * 3600 * 1000);
  return d.toISOString();
}

 
async function handleUpdate(update, env) {
  try {
    const cbq = update.callback_query;
    const msg = update.message || cbq?.message;
    if (!msg) return;

    const chatId = msg.chat?.id;
    
    const from = cbq?.from || msg.from;
    const userId = from?.id;
    if (!chatId || !userId) return;

    
    if (cbq?.id) {
      try {
        await tgApi(env, "answerCallbackQuery", { callback_query_id: cbq.id });
      } catch (e) {
        console.error("answerCallbackQuery failed:", e?.message || e);
      }
    }

    const st = await ensureUser(userId, env, from);

    if (msg.contact && msg.contact.phone_number) {
      await handleContact(env, chatId, from, st, msg.contact);
      return;
    }

    const imageFileId = extractImageFileId(msg, env);
    if (imageFileId) {
      if (!st.profile?.name || !st.profile?.phone) {
        await tgSendMessage(env, chatId, "برای استفاده از تحلیل، ابتدا نام و شماره را ثبت کن ✅", mainMenuKeyboard(env));
        await startOnboarding(env, chatId, from, st);
        return;
      }
      await handleVisionFlow(env, chatId, from, userId, st, imageFileId);
      return;
    }

    const text = String((cbq?.data ?? msg.text ?? "")).trim();

    // Admin ↔ User direct chat relay (support group)
    const supportChatId = env.SUPPORT_CHAT_ID ? Number(env.SUPPORT_CHAT_ID) : 0;
    if (supportChatId && Number(chatId) === Number(supportChatId)) {
      // Format: /to <userChatId> <message>
      if (text.startsWith("/to")) {
        if (!isStaff(from, env)) return;
        const parts = text.split(" ");
        const targetId = Number(parts[1] || 0);
        const body = parts.slice(2).join(" ").trim();
        if (!targetId || !body) {
          await tgSendMessage(env, chatId, "فرمت درست:/n /to <userChatId> <message>", kb([[BTN.HOME]]));
          return;
        }
        await tgSendMessage(env, targetId, "💬 پاسخ ادمین:/n" + body, kb([[BTN.HOME]]));
        await tgSendMessage(env, chatId, "✅ ارسال شد.", kb([[BTN.HOME]]));
        return;
      }
      // ignore other messages in support chat
      return;
    }

    if (text.startsWith("/start")) {
      const refArg = (msg.text || "").split(" ").slice(1).join(" ").trim();
      const linked = await tryHandleWebTelegramLinkFromStart(env, chatId, from, st, refArg);
      if (linked) return;
      await onStart(env, chatId, from, st, refArg);
      return;
    }

    if (text.startsWith("/setwallet")) {
      if (!isAdmin(from, env)) return tgSendMessage(env, chatId, "⛔️ فقط ادمین می‌تواند آدرس ولت را تنظیم کند.", mainMenuKeyboard(env));
      const wallet = text.split(" ").slice(1).join(" ").trim();
      if (!wallet) return tgSendMessage(env, chatId, "فرمت: /setwallet <wallet_address>", mainMenuKeyboard(env));
      await setWallet(env, wallet);
      return tgSendMessage(env, chatId, "✅ آدرس ولت ذخیره شد.", mainMenuKeyboard(env));
    }

    if (text.startsWith("/setprompt")) {
      if (!isStaff(from, env)) return tgSendMessage(env, chatId, "⛔️ فقط ادمین/اونر می‌تواند پرامپت تحلیل را تعیین کند.", mainMenuKeyboard(env));
      const p = text.split(" ").slice(1).join(" ").trim();
      if (!p) return tgSendMessage(env, chatId, "فرمت: /setprompt <prompt_text>", mainMenuKeyboard(env));
      if (!env.BOT_KV) return tgSendMessage(env, chatId, "⛔️ BOT_KV فعال نیست.", mainMenuKeyboard(env));
      await env.BOT_KV.put("settings:analysis_prompt", p);
      return tgSendMessage(env, chatId, "✅ پرامپت تحلیل ذخیره شد.", mainMenuKeyboard(env));
    }


    if (text.startsWith("/setstyleprompt")) {
      if (!isStaff(from, env)) return tgSendMessage(env, chatId, "⛔️ فقط ادمین/اونر می‌تواند پرامپت هر سبک را تعیین کند.", mainMenuKeyboard(env));
      const rest = text.replace("/setstyleprompt", "").trim();
      const sp = rest.split(" ");
      const style = (sp.shift() || "").trim();
      const prompt = sp.join(" ").trim();
      if (!style || !prompt) {
        return tgSendMessage(env, chatId, "فرمت: /setstyleprompt <style> <prompt_text>", mainMenuKeyboard(env));
      }
      if (!env.BOT_KV) return tgSendMessage(env, chatId, "⛔️ BOT_KV فعال نیست.", mainMenuKeyboard(env));
      await setStylePrompt(env, style, prompt);
      return tgSendMessage(env, chatId, `✅ پرامپت سبک «${style}» ذخیره شد.`, mainMenuKeyboard(env));
    }

    if (text.startsWith("/getstyleprompt")) {
      if (!isStaff(from, env)) return tgSendMessage(env, chatId, "⛔️ فقط ادمین/اونر.", mainMenuKeyboard(env));
      const style = text.replace("/getstyleprompt", "").trim();
      if (!style) return tgSendMessage(env, chatId, "فرمت: /getstyleprompt <style>", mainMenuKeyboard(env));
      const p = await getStylePrompt(env, style);
      return tgSendMessage(env, chatId, p ? `🎯 ${style}\n\n${p}` : "برای این سبک چیزی ثبت نشده.", mainMenuKeyboard(env));
    }


    if (text === "/signals" || text === "/signal" || text === BTN.SIGNAL) {
      if (!st.profile?.name || !st.profile?.phone) {
        await tgSendMessage(env, chatId, "برای شروع تحلیل، ابتدا پروفایل را کامل کن ✅", mainMenuKeyboard(env));
        await startOnboarding(env, chatId, from, st);
        return;
      }
      st.state = "choose_symbol";
      st.selectedSymbol = "";
      await saveUser(userId, st, env);
      return tgSendMessage(env, chatId, "📈 دسته‌بندی سیگنال‌ها:", signalMenuKeyboard());
    }

    if (text === "/settings" || text === BTN.SETTINGS) {
      if (!st.profile?.name || !st.profile?.phone) {
        await tgSendMessage(env, chatId, "برای تنظیمات، ابتدا پروفایل را کامل کن ✅", mainMenuKeyboard(env));
        await startOnboarding(env, chatId, from, st);
        return;
      }
      return sendSettingsSummary(env, chatId, st, from);
    }


    if (text === "/subscription" || text === "/subscribe" || text === "/buy" || text === BTN.SUBSCRIPTION) {
      const wallet = await getWallet(env);
      const planName = `${st.profile?.username || "marketiq"}  PRO`;
      const txt =
        `💎 اشتراک ویژه

پلن: ${planName}
مدت: ۳۰ روز
قیمت: ۲۵ USDT (BEP20)

` +
        (wallet ? `🏦 آدرس ولت پرداخت:
${wallet}

` : "") +
        `برای خرید/فعال‌سازی، دکمه زیر را بزن و از تب «اشتراک» پرداخت را ثبت کن.`;
      const kbInline = await miniappInlineKeyboardTab(env, st, from, "subscription", "💎 خرید اشتراک");
      return tgSendMessage(env, chatId, txt, kbInline || mainMenuKeyboard(env));
    }

    if (text === "/wallet" || text === BTN.WALLET) {
      const wallet = await getWallet(env);
      const txs = Array.isArray(st.wallet?.transactions) ? st.wallet.transactions.slice(-5).reverse() : [];
      const txHistory = txs.length
        ? txs.map((t, i) => `${i + 1}) ${t.txHash || "-"} | ${t.amount || "-"} USDT | ${String(t.createdAt || "").slice(0, 16).replace("T", " ")}`).join(String.fromCharCode(10))
        : "—";
      const planName = `${st.profile?.username || "marketiq"}  PRO`;
      const txt =
        `💳 ولت

` +
        `پلن: ${planName}
با ارزش ۲۵ USDT

` +
        `📜 تاریخچه تراکنشات
${txHistory}

` +
        (wallet ? `🏦 آدرس ولت:
${wallet}

` : "") +
        `«واریزی فقط به آدرس  این ولت  ممکن است
در  زیر باید بعد از واریز هش واریزی را ارسال کنید.»`;
      return tgSendMessage(env, chatId, txt, walletMenuKeyboard());
    }

    if (text === BTN.WALLET_BALANCE) {
      const bal = Number(st.wallet?.balance || 0);
      return tgSendMessage(env, chatId, `💰 موجودی فعلی: ${bal}`, walletMenuKeyboard());
    }

    if (text === BTN.WALLET_DEPOSIT) {
      const wallet = await getWallet(env);
      const memo = `U${st.userId}`;
      st.state = "wallet_deposit_txid";
      await saveUser(userId, st, env);
      const txt =
        `➕ واریز

` +
        (wallet ? `آدرس ولت:
${wallet}
` : "") +
        `
Memo/Tag: ${memo}

` +
        `«واریزی فقط به آدرس ولت درگاه ممکن است
در  زیر باید از واریز هش واریزی را ارسال کنید.»

hash پرداخت را همینجا بفرست (در صورت نیاز: <hash> <amount>).`;
      return tgSendMessage(env, chatId, txt, kb([[BTN.BACK, BTN.HOME]]));
    }

    if (text === BTN.WALLET_WITHDRAW) {
      st.state = "wallet_withdraw";
      await saveUser(userId, st, env);
      return tgSendMessage(env, chatId, "➖ برداشت\n\nفرمت را بفرست:\n<amount> <address>", kb([[BTN.HOME]]));
    }


    if (text === "/profile" || text === BTN.PROFILE) {
      return tgSendMessage(env, chatId, profileText(st, from, env), mainMenuKeyboard(env));
    }

    if (text === "/invite" || text === BTN.INVITE) {
      const { link, share } = inviteShareText(st, env);
      if (!link) return tgSendMessage(env, chatId, "لینک دعوت آماده نیست. بعداً دوباره تلاش کن.", mainMenuKeyboard(env));
            const inv = Number(st.referral?.successfulInvites || 0);
      const pts = Number(st?.points?.balance || 0);
      const cost = Number(env.ANALYSIS_POINTS_COST || 2);
      const thr = proRedeemThreshold(env);
      const toPro = thr ? ((thr - (pts % thr)) % thr) : 0;
      const txt =
        `🤝 دعوت دوستان

` +
        `دعوت موفق: ${inv}
` +
        `امتیاز شما: ${pts}
` +
        (thr ? `تا پرو رایگان بعدی: ${toPro} امتیاز
` : "") +
        `
` +
        `🔗 لینک رفرال قابل کپی: <code>${escapeHtml(link)}</code>
` +
        `لینک رفرال: <a href="${escapeHtml(link)}">باز کردن لینک دعوت</a>

` +
        (share ? `اشتراک‌گذاری سریع: <a href="${escapeHtml(share)}">ارسال لینک</a>

` : "") +
        `قوانین امتیازدهی:
- هر تحلیل: ${cost} امتیاز
- هر دعوت موفق (شماره جدید): +۶ امتیاز
- هر ${thr} امتیاز: ۳۰ روز اشتراک پرو رایگان`;
      return tgSendMessageHtml(env, chatId, txt, mainMenuKeyboard(env));
    }


    if (text === "/education" || text === BTN.EDUCATION) {
      return tgSendMessage(env, chatId, "📚 آموزش و مفاهیم بازار\n\nبه‌زودی محتوای آموزشی اضافه می‌شود.", mainMenuKeyboard(env));
    }

    if (text === "/support" || text === BTN.SUPPORT) {
      const handle = env.SUPPORT_HANDLE || "@support";
      const wallet = await getWallet(env);
      const walletLine = wallet ? `\n\n💳 آدرس ولت جهت پرداخت:\n${wallet}` : "";
      return tgSendMessage(
        env,
        chatId,
        `🆘 پشتیبانی

برای ارتباط مستقیم با ادمین از دکمه «${BTN.SUPPORT_CHAT}» استفاده کن.

برای سوالات آماده یا ارسال تیکت هم می‌تونی از دکمه‌ها استفاده کنی.${walletLine}`, 
        kb([[BTN.SUPPORT_CHAT], [BTN.SUPPORT_FAQ, BTN.SUPPORT_TICKET], [BTN.SUPPORT_CUSTOM_PROMPT], [BTN.HOME]])
      );
    }


    if (text === "/quote" || text === BTN.QUOTE) {
      const symbol = String(st.selectedSymbol || "BTCUSDT").toUpperCase();
      const tf = String(st.timeframe || "H4").toUpperCase();
      try {
        const candles = await getMarketCandlesWithFallback(env, symbol, tf);
        const snap = computeSnapshot(candles || []);
        if (!snap) throw new Error("quote_unavailable");
        const msgQ = `💹 قیمت لحظه‌ای

نماد: ${symbol}
TF: ${tf}
قیمت: ${snap.lastPrice}
تغییر: ${snap.changePct}%
روند: ${snap.trend || "نامشخص"}`;
        return tgSendMessage(env, chatId, msgQ, mainMenuKeyboard(env));
      } catch (e) {
        return tgSendMessage(env, chatId, "⚠️ قیمت لحظه‌ای در دسترس نیست. کمی بعد دوباره تلاش کن.", mainMenuKeyboard(env));
      }
    }

    if (text === "/news" || text === BTN.NEWS) {
      const symbol = String(st.selectedSymbol || "BTCUSDT").toUpperCase();
      try {
        const rows = await fetchSymbolNewsFa(symbol, env);
        const lines = (rows || []).slice(0, 5).map((x, i) => `${i + 1}) ${x.title || "-"}`).join("\n");
        return tgSendMessage(env, chatId, `📰 اخبار ${symbol}

${lines || "خبری پیدا نشد."}`, mainMenuKeyboard(env));
      } catch (e) {
        return tgSendMessage(env, chatId, "⚠️ خبر مرتبط در دسترس نیست.", mainMenuKeyboard(env));
      }
    }

    if (text === "/newsanalyze" || text === BTN.NEWS_ANALYSIS) {
      const symbol = String(st.selectedSymbol || "BTCUSDT").toUpperCase();
      try {
        const rows = await fetchSymbolNewsFa(symbol, env);
        const summary = await buildNewsAnalysisSummary(symbol, rows || [], env);
        return tgSendMessage(env, chatId, `🧠 تحلیل خبر ${symbol}

${summary || "تحلیل خبری در دسترس نیست."}`, mainMenuKeyboard(env));
      } catch (e) {
        return tgSendMessage(env, chatId, "⚠️ تحلیل خبر در دسترس نیست.", mainMenuKeyboard(env));
      }
    }

    if (text === "/miniapp" || text === BTN.MINIAPP) {
      const url = getMiniappUrl(env);
      if (!url) {
        return tgSendMessage(env, chatId, `⚠️ لینک مینی‌اپ تنظیم نشده.

در Wrangler / داشبورد یک متغیر ENV به نام MINIAPP_URL یا PUBLIC_BASE_URL بگذار (مثلاً https://<your-worker-domain>/ ) و دوباره Deploy کن.`, mainMenuKeyboard(env));
      }
      const token = await issueMiniappToken(env, st.userId, from);
      const finalUrl = token ? appendQuery(url, { miniToken: token }) : url;
      const kbInline = { inline_keyboard: [[{ text: BTN.MINIAPP, web_app: { url: finalUrl } }]] };
      return tgSendMessage(env, chatId, `🧩 مینی‌اپ فعال شد.

از دکمه زیر وارد شوید. اگر دکمه باز نشد، این لینک را مستقیم باز کنید:
${finalUrl}\n\nچک‌لیست سریع اتصال:
${MINIAPP_EXEC_CHECKLIST_TEXT}`, kbInline);
    }


    if (text === "/users") {
      if (!isStaff(from, env)) return tgSendMessage(env, chatId, "⛔️ فقط ادمین/اونر می‌تواند لیست کاربران را ببیند.", mainMenuKeyboard(env));
      return sendUsersList(env, chatId);
    }


    if (text === BTN.LEVELING || text === "/level") {
      if (!st.profile?.name || !st.profile?.phone) {
        await tgSendMessage(env, chatId, "برای تعیین سطح، ابتدا پروفایل را کامل کن ✅", mainMenuKeyboard(env));
        await startOnboarding(env, chatId, from, st);
        return;
      }
      await startLeveling(env, chatId, from, st);
      return;
    }
    if (text === BTN.SET_CAPITAL) {
      st.state = "set_capital";
      await saveUser(userId, st, env);
      return tgSendMessage(env, chatId, "💼 لطفاً سرمایه قابل معامله‌ات را به عدد وارد کن (مثال: 1000)", kb([[BTN.BACK, BTN.HOME]]));
    }

    if (text === BTN.REQUEST_CUSTOM_PROMPT) {
      st.state = "request_custom_prompt";
      await saveUser(userId, st, env);
      return tgSendMessage(env, chatId, "🧠 درخواستت برای پرامپت اختصاصی را بنویس (سبک، بازار، هدف).", kb([[BTN.BACK, BTN.HOME]]));
    }

    if (text === BTN.SUPPORT_FAQ || text === "/faq") {
      st.state = "support_faq";
      await saveUser(userId, st, env);
      const faq = getSupportFaq();
      const list = faq.map((f, i) => `${i + 1}) ${f.q}`).join(String.fromCharCode(10));
      return tgSendMessage(env, chatId, `❓ سوالات آماده\n\n${list}\n\nعدد سوال را ارسال کن تا پاسخ را ببینی.`, kb([[BTN.BACK, BTN.HOME]]));
    }

    if (text === BTN.HOME) {
      st.state = "idle";
      st.selectedSymbol = "";
      await saveUser(userId, st, env);
      return tgSendMessage(env, chatId, "🏠 منوی اصلی:", mainMenuKeyboard(env));
    }

    if (text === BTN.BACK) {
      if (st.state.startsWith("quiz_")) {
        st.state = "idle";
        await saveUser(userId, st, env);
        return tgSendMessage(env, chatId, "🏠 برگشتی به منوی اصلی.", mainMenuKeyboard(env));
      }
      if (st.state === "await_prompt") {
        st.state = "choose_symbol";
        st.selectedSymbol = "";
        await saveUser(userId, st, env);
        return tgSendMessage(env, chatId, "📈 دسته‌بندی سیگنال‌ها:", signalMenuKeyboard());
      }
      if (st.state.startsWith("set_")) {
        st.state = "idle";
        await saveUser(userId, st, env);
        return sendSettingsSummary(env, chatId, st, from);
      }
      return tgSendMessage(env, chatId, "🏠 منوی اصلی:", mainMenuKeyboard(env));
    }

    if (st.state === "onb_name") {
      const name = text.replace(/\s+/g, " ").trim();
      if (!name || name.length < 2) return tgSendMessage(env, chatId, "نام را درست وارد کن (حداقل ۲ حرف).", contactKeyboard());
      st.profile.name = name;
      st.state = "onb_contact";
      await saveUser(userId, st, env);
      return tgSendMessage(env, chatId, "عالی ✅ حالا لطفاً شماره تماس را با دکمه زیر ارسال کن:", contactKeyboard());
    }

    if (st.state === "onb_contact") {
      const raw = String(text || "").trim();
      const cleaned = raw.replace(/[^\d+]/g, "");
      const digits = cleaned.replace(/\D/g, "");

      // Accept manual phone entry when share-contact is not available (Telegram Web/Desktop).
      if (digits.length >= 9 && digits.length <= 15) {
        let phone = cleaned;
        if (!phone.startsWith("+")) {
          // Normalize common IR format 09xxxxxxxxx -> +98xxxxxxxxxx
          if (digits.startsWith("0") && digits.length === 11) phone = "+98" + digits.slice(1);
          else if (digits.startsWith("98")) phone = "+" + digits;
          else phone = "+" + digits;
        } else {
          phone = "+" + digits;
        }
        const owner = await getPhoneOwner(env, phone);
if (owner && String(owner) !== String(st.userId)) {
  st.profile.phone = phone;
  st.profile.phoneDuplicate = true;
  st.profile.onboardingDone = true;
  st.state = "idle";
  applyLocaleDefaults(st, env);
  await saveUser(userId, st, env);
  return tgSendMessage(env, chatId, "⚠️ این شماره قبلاً ثبت شده است. آنبوردینگ پایان یافت.", mainMenuKeyboard(env));
}

st.profile.phone = phone;
st.profile.phoneDuplicate = false;
st.profile.onboardingDone = false;
applyLocaleDefaults(st, env);
if (!owner) await markPhoneSeen(env, phone, st.userId);

try { await finalizeOnboardingRewards(env, st, { notify: true }); } catch (e) {}

st.state = "onb_experience";
await saveUser(userId, st, env);
await tgSendMessage(env, chatId, "✅ شماره ثبت شد. ممنون!", mainMenuKeyboard(env));
return startOnboarding(env, chatId, from, st);
      }

      return tgSendMessage(env, chatId, "📱 لطفاً شماره تماس را با دکمه ارسال کن یا دستی وارد کن (مثال: +98912xxxxxxx).", contactKeyboard());
    }


    if (st.state === "onb_experience") {
      st.profile.marketExperience = text;
      st.state = "onb_market";
      await saveUser(userId, st, env);
      return tgSendMessage(env, chatId, "بازار مورد علاقه‌ات کدام است؟", optionsKeyboard(["کریپتو", "فارکس", "فلزات", "سهام"]));
    }

    if (st.state === "onb_market") {
      st.profile.preferredMarket = text;
      st.state = "onb_style";
      await saveUser(userId, st, env);
      return tgSendMessage(env, chatId, "🎯 سبک ترجیحی‌ات را انتخاب کن:", optionsKeyboard(ALLOWED_STYLE_LIST));
    }

    if (st.state === "onb_style") {
      const style = ALLOWED_STYLE_LIST.includes(text) ? text : "پرایس اکشن";
      st.profile.preferredStyle = style;
      st.style = style;
      await saveUser(userId, st, env);
      await startOnboarding(env, chatId, from, st);
      return;
    }

    if (st.state.startsWith("quiz_")) {
      const idx = Number(st.state.split("_")[1] || "0");
      if (!Number.isFinite(idx)) return;
      const q = QUIZ[idx];
      if (!q) return;

      st.profile.quizAnswers = st.profile.quizAnswers || {};
      st.profile.quizAnswers[q.key] = text;

      const nextIdx = idx + 1;
      if (nextIdx < QUIZ.length) {
        st.state = `quiz_${nextIdx}`;
        await saveUser(userId, st, env);
        const nq = QUIZ[nextIdx];
        return tgSendMessage(env, chatId, nq.text, optionsKeyboard(nq.options));
      }

      try {
        const _u = st?.profile?.username ? ("@" + String(st.profile.username).replace(/^@/, "")) : String(st.userId);
        const _supportChatId = env.SUPPORT_CHAT_ID ? Number(env.SUPPORT_CHAT_ID) : 0;
        if (_supportChatId) {
          await tgSendMessage(env, _supportChatId, `🏧 درخواست برداشت جدید (pending)\nشناسه: ${wid}\nکاربر: ${_u}\nChatID: ${chatId}\nمبلغ: ${amount}\nآدرس: ${address}`);
        }
      } catch (e) {}

      st.state = "idle";
      await saveUser(userId, st, env);

      await tgSendMessage(env, chatId, "⏳ در حال تحلیل پاسخ‌های آزمون و تنظیم خودکار پروفایل…", kb([[BTN.HOME]]));

      const result = await evaluateLevelWithAI(env, st.profile, st.profile.quizAnswers || {});
      st.profile.level = result.level || "";
      st.profile.levelNotes = result.notes || "";
      st.timeframe = result.settings?.timeframe || st.timeframe;
      st.style = result.settings?.style || st.style;
      st.risk = result.settings?.risk || st.risk;
      st.profile.onboardingDone = true;
      applyLocaleDefaults(st, env);
      await finalizeOnboardingRewards(env, st);

      await saveUser(userId, st, env);

      const marketFa = ({crypto:"کریپتو", forex:"فارکس", metals:"فلزات", stocks:"سهام"})[result.recommendedMarket] || "کریپتو";
      await tgSendMessage(
        env,
        chatId,
        `✅ تعیین سطح انجام شد.

سطح: ${st.profile.level}
پیشنهاد بازار: ${marketFa}

تنظیمات پیشنهادی:
⏱ ${st.timeframe} | 🎯 ${st.style} | ⚠️ ${st.risk}

یادداشت:
${st.profile.levelNotes || "—"}

اگر می‌خوای دوباره تعیین‌سطح انجام بدی یا تنظیماتت تغییر کنه، به پشتیبانی پیام بده (ادمین بررسی می‌کند).`,
        mainMenuKeyboard(env)
      );
      const teaserSymbol = st.profile?.preferredMarket?.includes("فارکس") ? "EURUSD" : (st.profile?.preferredMarket?.includes("فلز") ? "XAUUSD" : (st.profile?.preferredMarket?.includes("سهام") ? "US500" : "BTCUSDT"));
      const teaser = `📌 یک تحلیل کوتاه ویژه پروفایل شما:
${teaserSymbol} در ${st.timeframe} با ریسک ${st.risk} → در صورت تثبیت بالای ناحیه حمایتی اخیر، سناریوی ادامه‌دار صعودی فعال می‌شود؛ در غیر این صورت پولبک عمیق‌تر محتمل است.

برای تحلیل کامل از منوی سیگنال استفاده کن 🚀`;
      return tgSendMessage(env, chatId, teaser, mainMenuKeyboard(env));
    }

    if (text === BTN.CAT_MAJORS) return tgSendMessage(env, chatId, "💱 ماجورها:", listKeyboard(MAJORS));
    if (text === BTN.CAT_METALS) return tgSendMessage(env, chatId, "🪙 فلزات:", listKeyboard(METALS));
    if (text === BTN.CAT_INDICES) return tgSendMessage(env, chatId, "📊 شاخص‌ها:", listKeyboard(INDICES));
    if (text === BTN.CAT_CRYPTO) return tgSendMessage(env, chatId, "₿ کریپتو:", listKeyboard(CRYPTOS));

    if (text === BTN.SET_TF) {
      st.state = "set_tf";
      await saveUser(userId, st, env);
      return tgSendMessage(env, chatId, "⏱ تایم‌فریم:", optionsKeyboard(["M15","H1","H4","D1"]));
    }
    if (text === BTN.SET_STYLE) {
      st.state = "set_style";
      await saveUser(userId, st, env);
      return tgSendMessage(env, chatId, "🎯 سبک:", optionsKeyboard(ALLOWED_STYLE_LIST));
    }
    if (text === BTN.SET_RISK) {
      st.state = "set_risk";
      await saveUser(userId, st, env);
      return tgSendMessage(env, chatId, "⚠️ ریسک:", optionsKeyboard(["کم","متوسط","زیاد"]));
    }
    if (text === BTN.SET_NEWS) {
      st.state = "set_news";
      await saveUser(userId, st, env);
      return tgSendMessage(env, chatId, "📰 خبر:", optionsKeyboard(["روشن ✅","خاموش ❌"]));
    }
    if (text === BTN.SET_CAPITAL) {
      const flags = await getAdminFlags(env);
      if (!flags.capitalModeEnabled) return tgSendMessage(env, chatId, "⚠️ مدیریت سرمایه توسط ادمین غیرفعال است.", settingsMenuKeyboard());
      st.state = "set_capital";
      await saveUser(userId, st, env);
      return tgSendMessage(env, chatId, "💼 سرمایه را وارد کن (عدد).", kb([[BTN.BACK, BTN.HOME]]));
    }

    if (text === BTN.SUPPORT_CHAT) {
      st.state = "support_chat";
      if (env.BOT_KV) await saveUser(userId, st, env);
      return tgSendMessage(env, chatId, "💬 پیام خود را برای ادمین بنویس و ارسال کن.\n\nبرای لغو: «⬅️ برگشت»", kb([[BTN.BACK, BTN.HOME]]));
    }

    if (text === BTN.SUPPORT_FAQ) {
      st.state = "support_faq";
      await saveUser(userId, st, env);
      const faq = getSupportFaq();
      const list = faq.map((f, i) => `${i + 1}) ${f.q}`).join(String.fromCharCode(10));
      return tgSendMessage(env, chatId, `❓ سوالات آماده\n\n${list}\n\nعدد سوال را ارسال کن تا پاسخ را ببینی.`, kb([[BTN.BACK, BTN.HOME]]));
    }

    if (text === BTN.SUPPORT_TICKET) {
      st.state = "support_ticket";
      await saveUser(userId, st, env);
      return tgSendMessage(env, chatId, "✉️ متن تیکت را بنویس (حداکثر ۳۰۰ کاراکتر):", kb([[BTN.BACK, BTN.HOME]]));
    }

    if (text === BTN.SUPPORT_CUSTOM_PROMPT) {
      st.state = "support_custom_prompt";
      await saveUser(userId, st, env);
      return tgSendMessage(env, chatId, "🧠 نیازت را برای پرامپت اختصاصی بنویس (حداکثر ۴۰۰ کاراکتر).", kb([[BTN.BACK, BTN.HOME]]));
    }

    if (st.state === "set_tf") { st.timeframe = text; st.state = "idle"; await saveUser(userId, st, env); return tgSendMessage(env, chatId, `✅ تایم‌فریم: ${st.timeframe}`, mainMenuKeyboard(env)); }
    if (st.state === "set_style") {
      st.style = ALLOWED_STYLE_LIST.includes(text) ? text : st.style;
      st.profile = st.profile || {};
      st.profile.preferredStyle = st.style;
      st.state = "idle";
      await saveUser(userId, st, env);
      return tgSendMessage(env, chatId, `✅ سبک: ${st.style}`, mainMenuKeyboard(env));
    }
    if (st.state === "set_risk") { st.risk = text; st.state = "idle"; await saveUser(userId, st, env); return tgSendMessage(env, chatId, `✅ ریسک: ${st.risk}`, mainMenuKeyboard(env)); }
    if (st.state === "set_news") { st.newsEnabled = text.includes("روشن"); st.state = "idle"; await saveUser(userId, st, env); return tgSendMessage(env, chatId, `✅ خبر: ${st.newsEnabled ? "روشن ✅" : "خاموش ❌"}`, mainMenuKeyboard(env)); }
    if (st.state === "set_capital" || st.state === "onb_capital") {

      const cap = Number(String(text || "").replace(/[, ]+/g, "").trim());
      if (!Number.isFinite(cap) || cap <= 0) return tgSendMessage(env, chatId, "عدد سرمایه معتبر نیست. مثال: 1500", kb([[BTN.BACK, BTN.HOME]]));
      st.profile = st.profile || {};
      st.profile.capital = cap;
      st.profile.capitalCurrency = st.profile.capitalCurrency || "USDT";
      st.capital = st.capital || { amount: 0, enabled: true };
      st.capital.amount = cap;
      st.capital.enabled = true;
      const wasOnb = st.state === "onb_capital";
      st.state = "idle";
      await saveUser(userId, st, env);
      if (wasOnb) return startLeveling(env, chatId, from, st);

      return tgSendMessage(env, chatId, `✅ سرمایه ثبت شد: ${cap} ${st.profile.capitalCurrency || "USDT"}`, settingsMenuKeyboard());
    }

    if (st.state === "request_custom_prompt") {
      const req = String(text || "").trim();
      if (req.length < 8) {
        return tgSendMessage(env, chatId, "متن درخواست خیلی کوتاه است.", kb([[BTN.BACK, BTN.HOME]]));
      }
      const reqId = `cpr_${Date.now()}_${st.userId}`;
      const item = { id: reqId, userId: String(st.userId), username: st.profile?.username || "", text: req, status: "pending", createdAt: new Date().toISOString() };
      await storeCustomPromptRequest(env, item);
      const supportChatId = env.SUPPORT_CHAT_ID ? Number(env.SUPPORT_CHAT_ID) : 0;
      if (supportChatId) {
        await tgSendMessage(env, supportChatId, `🧠 درخواست پرامپت اختصاصی جدید #${reqId}
کاربر: ${item.username ? '@'+item.username : item.userId}
متن:
${req}`);
      }
      st.state = "idle";
      await saveUser(userId, st, env);
      return tgSendMessage(env, chatId, "✅ درخواست ثبت شد. بعد از تایید ادمین فعال می‌شود.", settingsMenuKeyboard());
    }

    if (st.state === "support_faq") {
      const idx = Number(text.trim());
      const faq = getSupportFaq();
      const item = Number.isFinite(idx) ? faq[idx - 1] : null;
      st.state = "idle";
      await saveUser(userId, st, env);
      if (!item) return tgSendMessage(env, chatId, "عدد معتبر نیست. دوباره تلاش کن.", kb([[BTN.SUPPORT_FAQ, BTN.HOME]]));
      return tgSendMessage(env, chatId, `✅ پاسخ:\n${item.a}`, kb([[BTN.SUPPORT_FAQ, BTN.HOME]]));
    }
    if (st.state === "support_chat") {
      const textClean = String(text || "").trim();
      if (!textClean || textClean.length < 2) {
        return tgSendMessage(env, chatId, "لطفاً پیام معتبر ارسال کن.", kb([[BTN.BACK, BTN.HOME]]));
      }

      try {
        const _u = st?.profile?.username ? ("@" + String(st.profile.username).replace(/^@/, "")) : String(st.userId);
        const _supportChatId = env.SUPPORT_CHAT_ID ? Number(env.SUPPORT_CHAT_ID) : 0;
        if (_supportChatId) {
          await tgSendMessage(env, _supportChatId, `🏧 درخواست برداشت جدید (pending)\nشناسه: ${wid}\nکاربر: ${_u}\nChatID: ${chatId}\nمبلغ: ${amount}\nآدرس: ${address}`);
        }
      } catch (e) {}

      st.state = "idle";
      if (env.BOT_KV) await saveUser(userId, st, env);

      const supportChatId = env.SUPPORT_CHAT_ID ? Number(env.SUPPORT_CHAT_ID) : 0;
      if (supportChatId) {
        await tgSendMessage(
          env,
          supportChatId,
          `💬 پیام مستقیم کاربر
کاربر: ${st.profile?.username ? "@"+st.profile.username : st.userId}
ID: ${chatId}
متن:
${textClean}

برای پاسخ (در همین چت): /to ${chatId} پیام شما...`
        );
      }

      return tgSendMessage(env, chatId, "✅ پیام شما برای ادمین ارسال شد.", mainMenuKeyboard(env));
    }

    if (st.state === "support_ticket") {
      const textClean = String(text || "").trim();
      if (!textClean || textClean.length < 4) {
        return tgSendMessage(env, chatId, "متن تیکت کوتاه است. لطفاً توضیح بیشتری بده.", kb([[BTN.BACK, BTN.HOME]]));
      }
      st.state = "idle";
      await saveUser(userId, st, env);
      const ticket = { id: `t_${Date.now()}_${st.userId}`, userId: String(st.userId), username: st.profile?.username || "", phone: st.profile?.phone || "", text: textClean, kind: "general", status: "pending", createdAt: new Date().toISOString() };
      await storeSupportTicket(env, ticket);

      const supportChatId = env.SUPPORT_CHAT_ID ? Number(env.SUPPORT_CHAT_ID) : 0;
      if (supportChatId) {
        await tgSendMessage(env, supportChatId, `📩 تیکت جدید
شناسه: ${ticket.id}
کاربر: ${st.profile?.username ? "@"+st.profile.username : "-"}
ChatID: ${st.userId}
شماره: ${st.profile?.phone || "-"}
متن:
${textClean}`);
      }
      return tgSendMessage(env, chatId, "✅ تیکت شما ثبت شد و در صف بررسی ادمین است.", mainMenuKeyboard(env));
    }

    if (st.state === "support_custom_prompt") {
      const textClean = String(text || "").trim();
      if (!textClean || textClean.length < 8) {
        return tgSendMessage(env, chatId, "برای درخواست پرامپت اختصاصی، توضیح کامل‌تری ارسال کن.", kb([[BTN.BACK, BTN.HOME]]));
      }
      st.state = "idle";
      const req = {
        id: `cpr_${Date.now()}_${st.userId}`,
        userId: String(st.userId),
        username: st.profile?.username || "",
        text: textClean,
        status: "pending",
        promptId: "",
        createdAt: new Date().toISOString(),
      };
      st.pendingCustomPromptRequestId = req.id;
      await saveUser(userId, st, env);
      await storeCustomPromptRequest(env, req);
      const supportChatId = env.SUPPORT_CHAT_ID ? Number(env.SUPPORT_CHAT_ID) : 0;
      if (supportChatId) {
        await tgSendMessage(env, supportChatId, `🧠 درخواست پرامپت اختصاصی
شناسه: ${req.id}
کاربر: ${st.profile?.username ? "@"+st.profile.username : st.userId}
متن:
${textClean}`);
      }
      return tgSendMessage(env, chatId, "✅ درخواست شما ثبت شد. بعد از تایید ادمین، پرامپت اختصاصی فعال می‌شود.", mainMenuKeyboard(env));
    }


if (isSymbol(text)) {
  if (!st.profile?.name || !st.profile?.phone) {
    await tgSendMessage(env, chatId, "برای شروع تحلیل، ابتدا پروفایل را کامل کن ✅", mainMenuKeyboard(env));
    await startOnboarding(env, chatId, from, st);
    return;
  }

  st.selectedSymbol = String(text || "").trim().toUpperCase();

  // Auto-start analysis when a valid symbol is received (message or button).
  const queued = await enqueueAnalysisJob(env, chatId, userId, from, st, st.selectedSymbol, "");
  if (queued) {
    st.state = "idle";
    st.selectedSymbol = "";
  }
  if (env.BOT_KV) await saveUser(userId, st, env);
  return;
}

    if (st.state === "await_prompt" && st.selectedSymbol) {
      if (env.BOT_KV && !canAnalyzeToday(st, from, env)) {
        return tgSendMessage(env, chatId, `⛔️ سهمیه امروزت تموم شده (${dailyLimit(env, st)} تحلیل در روز).`, mainMenuKeyboard(env));
      }

      const symbol = st.selectedSymbol;
      const isAnalyzeCmd = text === BTN.ANALYZE || text.replace(/\s+/g, "") === "تحلیلکن";
      if (!isAnalyzeCmd) return tgSendMessage(env, chatId, `برای شروع تحلیل روی «${BTN.ANALYZE}» بزن ✅`, kb([[BTN.ANALYZE], [BTN.BACK, BTN.HOME]]));

      const queued = await enqueueAnalysisJob(env, chatId, userId, from, st, symbol, "");
      
      if (queued) {
        st.state = "idle";
        st.selectedSymbol = "";
      }

      
      if (env.BOT_KV) {
        await saveUser(userId, st, env);
      }
      return;
    }


    if (st.state === "wallet_deposit_txid") {
      const parts = String(text || "").trim().split(/\s+/).filter(Boolean);
      const txid = String(parts[0] || "").trim();
      const amount = Number(parts[1] || 0);
      if (!txid || txid.length < 8) {
        return tgSendMessage(env, chatId, "hash نامعتبر است. دوباره ارسال کن.", kb([[BTN.BACK, BTN.HOME]]));
      }
      const payment = { id: `dep_${Date.now()}_${st.userId}`, userId: String(st.userId), username: st.profile?.username || "", amount: Number.isFinite(amount) ? amount : 0, txHash: txid, status: "pending", createdAt: new Date().toISOString(), source: "bot_txid" };
      await storePayment(env, payment);
      const supportChatId = env.SUPPORT_CHAT_ID ? Number(env.SUPPORT_CHAT_ID) : 0;
      if (supportChatId) {
        await tgSendMessage(env, supportChatId, `💳 درخواست واریز جدید
کاربر: ${st.profile?.username ? "@"+st.profile.username : st.userId}
TxID: ${txid}

${Number.isFinite(payment.amount) && payment.amount > 0 ? `مبلغ: ${payment.amount}` : ""}`);
      }
      st.state = "idle";
      await saveUser(userId, st, env);
      return tgSendMessage(env, chatId, "✅ درخواست واریز ثبت شد و پس از بررسی تایید می‌شود.", walletMenuKeyboard());
    }

    if (st.state === "wallet_withdraw") {
      const parts = text.split(/\s+/).filter(Boolean);
      if (parts.length < 2) {
        return tgSendMessage(env, chatId, "فرمت درست نیست. مثال: 10 TRXxxxxxxxx", kb([[BTN.HOME]]));
      }
      const amount = Number(parts[0]);
      const address = parts.slice(1).join(" ");
      if (!Number.isFinite(amount) || amount <= 0) {
        return tgSendMessage(env, chatId, "مقدار نامعتبر است.", kb([[BTN.HOME]]));
      }

      const wid = `w_${Date.now()}_${st.userId}`;
      const createdAt = new Date().toISOString();

      
      if (env.BOT_DB) {
        await env.BOT_DB.prepare(
          "INSERT INTO withdrawals (id, userId, createdAt, amount, address, status) VALUES (?1, ?2, ?3, ?4, ?5, 'pending')"
        ).bind(wid, String(st.userId), createdAt, amount, address).run();
      } else if (env.BOT_KV) {
        await env.BOT_KV.put(`withdraw:${wid}`, JSON.stringify({ id: wid, userId: st.userId, createdAt, amount, address, status: "pending" }));
      }

      try {
        const _u = st?.profile?.username ? ("@" + String(st.profile.username).replace(/^@/, "")) : String(st.userId);
        const _supportChatId = env.SUPPORT_CHAT_ID ? Number(env.SUPPORT_CHAT_ID) : 0;
        if (_supportChatId) {
          await tgSendMessage(env, _supportChatId, `🏧 درخواست برداشت جدید (pending)\nشناسه: ${wid}\nکاربر: ${_u}\nChatID: ${chatId}\nمبلغ: ${amount}\nآدرس: ${address}`);
        }
      } catch (e) {}

      st.state = "idle";
      await saveUser(userId, st, env);
      return tgSendMessage(env, chatId, "✅ درخواست برداشت ثبت شد و در انتظار بررسی است.", walletMenuKeyboard());
    }

    return tgSendMessage(env, chatId, "از منوی پایین استفاده کن ✅", mainMenuKeyboard(env));
  } catch (e) {
    console.error("handleUpdate error:", e);
  }
}

 
async function onStart(env, chatId, from, st, refArg) {
  st.state = "idle";
  st.selectedSymbol = "";
  st.profile.username = from?.username ? String(from.username) : st.profile.username;
  st.profile.lastEntryAt = new Date().toISOString();
  st.profile.lastEntryVia = "bot";

  if (env.BOT_KV) {
    for (const c of st.referral.codes || []) {
      await storeReferralCodeOwner(env, c, st.userId);
    }
  }

  if (refArg && refArg.startsWith("ref_") && !st.referral.referredBy) {
    const code = refArg.replace(/^ref_/, "").trim();
    const ownerId = await resolveReferralOwner(env, code);
    if (ownerId && String(ownerId) !== String(st.userId)) {
      st.referral.referredBy = String(ownerId);
      st.referral.referredByCode = code;
      st.profile.entrySource = `referral:${code}`;
    }
  } else if (!st.profile.entrySource) {
    st.profile.entrySource = refArg ? `start_arg:${refArg}` : "direct";
  }

  await saveUser(st.userId, st, env);

  await tgSendMessage(env, chatId, await getBotWelcomeText(env), mainMenuKeyboard(env));

  

  if (!st.profile?.name || !st.profile?.phone) {
    await startOnboarding(env, chatId, from, st);
  }
}

async function startOnboarding(env, chatId, from, st) {
  if (!st.profile?.name) {
    st.state = "onb_name";
    await saveUser(st.userId, st, env);
    return tgSendMessage(env, chatId, "👤 لطفاً نام خود را وارد کنید:", kb([[BTN.HOME]]));
  }
  if (!st.profile?.phone) {
    st.state = "onb_contact";
    await saveUser(st.userId, st, env);
    return tgSendMessage(env, chatId, "📱 برای فعال‌سازی، شماره تماس را ارسال کنید (Share Contact):", contactKeyboard());
  }
  if (!st.profile?.marketExperience) {
    st.state = "onb_experience";
    await saveUser(st.userId, st, env);
    return tgSendMessage(env, chatId, "سطح آشنایی/تجربه‌ات در بازار چقدر است؟", optionsKeyboard(["تازه‌کار","کمتر از ۶ ماه","۶ تا ۲۴ ماه","بیشتر از ۲ سال"]));
  }
  if (!st.profile?.preferredMarket) {
    st.state = "onb_market";
    await saveUser(st.userId, st, env);
    return tgSendMessage(env, chatId, "بازار مورد علاقه‌ات کدام است؟", optionsKeyboard(["کریپتو", "فارکس", "فلزات", "سهام"]));
  }
  if (!st.profile?.preferredStyle) {
    st.state = "onb_style";
    await saveUser(st.userId, st, env);
    return tgSendMessage(env, chatId, "🎯 سبک ترجیحی‌ات را انتخاب کن:", optionsKeyboard(ALLOWED_STYLE_LIST));
  }
  if (!Number(st.profile?.capital || 0)) {
    st.state = "onb_capital";
    await saveUser(st.userId, st, env);
    return tgSendMessage(env, chatId, "💼 سرمایه تقریبی‌ات را وارد کن (عدد). مثال: 1000", kb([[BTN.BACK, BTN.HOME]]));
  }
  await startLeveling(env, chatId, from, st);
}

async function handleContact(env, chatId, from, st, contact) {
  if (contact.user_id && String(contact.user_id) !== String(st.userId)) {
    return tgSendMessage(env, chatId, "⚠️ لطفاً فقط شماره خودت را با دکمه ارسال کن.", contactKeyboard());
  }

  const phone = normalizePhone(String(contact.phone_number || "").trim());
  if (!phone) return tgSendMessage(env, chatId, "⚠️ شماره نامعتبر است. دوباره با دکمه ارسال شماره تلاش کن.", contactKeyboard());

  const owner = await getPhoneOwner(env, phone);
  // If this phone is already used by another account => finish onboarding (no referral rewards)
  if (owner && String(owner) !== String(st.userId)) {
    st.profile.phone = phone;
    st.profile.phoneDuplicate = true;
    st.profile.onboardingDone = true;
    st.state = "idle";
    applyLocaleDefaults(st, env);
    await saveUser(st.userId, st, env);
    return tgSendMessage(env, chatId, "⚠️ این شماره قبلاً ثبت شده است. آنبوردینگ پایان یافت.", mainMenuKeyboard(env));
  }

  st.profile.phone = phone;
  st.profile.phoneDuplicate = false;
  st.profile.onboardingDone = false;
  applyLocaleDefaults(st, env);

  // Mark phone as seen (first time)
  if (!owner) await markPhoneSeen(env, phone, st.userId);

  // If user came via referral and phone is NEW => reward inviter chain
  try { await finalizeOnboardingRewards(env, st, { notify: true }); } catch (e) {}

  if (st.state === "onb_contact") st.state = "onb_experience";
  await saveUser(st.userId, st, env);

  await tgSendMessage(env, chatId, "✅ شماره ثبت شد. ممنون!", mainMenuKeyboard(env));
  return startOnboarding(env, chatId, from, st);
}

async function startLeveling(env, chatId, from, st) {
  st.profile.quizAnswers = {};
  st.state = "quiz_0";
  await saveUser(st.userId, st, env);
  return tgSendMessage(env, chatId, QUIZ[0].text, optionsKeyboard(QUIZ[0].options));
}

 
async function sendUsersList(env, chatId) {
  if (!env.BOT_KV || typeof env.BOT_KV.list !== "function") {
    return tgSendMessage(env, chatId, "⛔️ KV list در دسترس نیست. (BOT_KV را درست بایند کن)", mainMenuKeyboard(env));
  }

  const res = await env.BOT_KV.list({ prefix: "u:", limit: 20 });
  const keys = res?.keys || [];
  if (!keys.length) return tgSendMessage(env, chatId, "هیچ کاربری ثبت نشده.", mainMenuKeyboard(env));

  const users = [];
  for (const k of keys) {
    const raw = await env.BOT_KV.get(k.name);
    if (!raw) continue;
    try {
      const u = JSON.parse(raw);
      users.push(u);
    } catch {}
  }

  const lines = users.map(u => {
    const name = u?.profile?.name || "-";
    const phone = u?.profile?.phone ? maskPhone(u.profile.phone) : "-";
    const username = u?.profile?.username ? ("@" + u.profile.username) : "-";
    const used = `${u.dailyUsed || 0}/${dailyLimit(env, u)}`;
    const pts = Number(u?.points?.balance || 0);
    const inv = u?.referral?.successfulInvites || 0;
    return `• ${name} | ${username} | ${phone} | استفاده: ${used} | امتیاز: ${pts} | دعوت: ${inv}`;
  });

  return tgSendMessage(env, chatId, "👥 کاربران (۲۰ تای اول):\n\n" + lines.join(String.fromCharCode(10)), mainMenuKeyboard(env));
}

function maskPhone(p) {
  const s = String(p);
  if (s.length <= 6) return s;
  return s.slice(0, 3) + "****" + s.slice(-3);
}

 
function isSymbol(t) {
  const s = String(t || "").trim().toUpperCase();
  return MAJORS.includes(s) || METALS.includes(s) || INDICES.includes(s) || CRYPTOS.includes(s);
}

 
function getSupportFaq() {
  return [
    { q: "چطور سهمیه روزانه شارژ می‌شود؟", a: "سهمیه هر روز (Tehran) صفر می‌شود و مجدداً قابل استفاده است." },
    { q: "چرا تحلیل ناموفق شد؟", a: "اتصال دیتا یا مدل ممکن است موقتاً قطع باشد. چند دقیقه بعد دوباره تلاش کن." },
    { q: "چطور اشتراک فعال کنم؟", a: "پرداخت را انجام بده و هش تراکنش را برای ادمین ارسال کن تا تأیید و فعال شود." },
    { q: "چطور رفرال کار می‌کند؟", a: "هر دعوت موفق با شماره جدید ۶ امتیاز دارد. هر تحلیل ۲ امتیاز است. هر ۱۰۰۰ امتیاز = ۳۰ روز اشتراک پرو رایگان." },
  ];
}

async function sendSettingsSummary(env, chatId, st, from) {
  const ptsBal = Number(st.points?.balance || 0);
        const apCost = Number(env.ANALYSIS_POINTS_COST || 2);
        const analysesLeft = Math.max(0, Math.floor(ptsBal / (apCost || 2)));
        const quota = `0/${analysesLeft}`;
  const txt =
    `⚙️ تنظیمات:

` +
    `⏱ تایم‌فریم: ${st.timeframe}
` +
    `🎯 سبک: ${st.style}
` +
    `🧩 پرامپت اختصاصی: ${st.customPromptId || "پیش‌فرض"}
` +
    `⚠️ ریسک: ${st.risk}
` +
    `📰 خبر: ${st.newsEnabled ? "روشن ✅" : "خاموش ❌"}

` +
    `امتیاز: ${ptsBal} | تحلیل باقی‌مانده: ${analysesLeft}`;
  return tgSendMessage(env, chatId, txt, settingsMenuKeyboard());
}

function profileText(st, from, env) {
  const ptsBal = Number(st.points?.balance || 0);
        const apCost = Number(env.ANALYSIS_POINTS_COST || 2);
        const analysesLeft = Math.max(0, Math.floor(ptsBal / (apCost || 2)));
        const quota = `0/${analysesLeft}`;
  const adminTag = isStaff(from, env) ? "✅ ادمین/اونر" : "👤 کاربر";
  const level = st.profile?.level ? `\nسطح: ${st.profile.level}` : "";
  const pts = Number(st?.points?.balance || 0);
  const inv = Number(st?.referral?.successfulInvites || 0);
  const cost = Number(env.ANALYSIS_POINTS_COST || 2);
  const thr = proRedeemThreshold(env);

  const botUser = env.BOT_USERNAME ? String(env.BOT_USERNAME).replace(/^@/, "") : "";
  const code = (st.referral?.codes || [])[0] || "";
  const deep = code ? (botUser ? `https://t.me/${botUser}?start=ref_${code}` : `ref_${code}`) : "-";

  const untilPro = thr ? ((thr - (pts % thr)) % thr) : 0;
  const untilProLine = thr ? `\nتا پرو رایگان بعدی: ${untilPro} امتیاز` : "";

  return `👤 پروفایل\n\nوضعیت: ${adminTag}\n🆔 ID: ${st.userId}\nنام: ${st.profile?.name || "-"}\nیوزرنیم: ${st.profile?.username ? "@"+st.profile.username : "-"}\nشماره: ${st.profile?.phone ? maskPhone(st.profile.phone) : "-"}${level}\n\n📅 امروز(Tehran): ${kyivDateString()}\nتحلیل باقی‌مانده: ${Math.max(0, Math.floor(pts / (cost || 2)))}\n\n🎁 امتیاز: ${pts}${untilProLine}\n👥 دعوت موفق: ${inv}\n\n🔗 لینک رفرال اختصاصی:\n${deep}\n\nℹ️ هر تحلیل: ${cost} امتیاز\nهر دعوت موفق (شماره جدید): +۶ امتیاز\nهر ${thr} امتیاز: ۳۰ روز اشتراک پرو رایگان`;
}

function inviteShareText(st, env) {
  const botUser = env.BOT_USERNAME ? String(env.BOT_USERNAME).replace(/^@/, "") : "";
  const code = (st.referral?.codes || [])[0] || "";
  const link = code ? (botUser ? `https://t.me/${botUser}?start=ref_${code}` : `ref_${code}`) : "";
  const share = link ? `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("لینک من: عضو شو تا امتیاز رفرال بگیرم ✅")}` : "";
  return { link, share };
}

 






function buildQcAnnotations(items, levels = [], qcSpec = null) {
  const ann = [];

  const addLine = (value, label, color, dash = [6, 4], width = 1.6) => {
    const v = Number(value);
    if (!Number.isFinite(v) || v <= 0) return;
    ann.push({
      type: "line",
      scaleID: "y",
      value: v,
      borderColor: color,
      borderWidth: width,
      borderDash: dash,
      label: { enabled: true, content: label },
    });
  };

  const minX = items?.length ? items[0].x : undefined;
  const maxX = items?.length ? items[items.length - 1].x : undefined;

  const addZone = (low, high, label, kind) => {
    const yMin = Number(low);
    const yMax = Number(high);
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax) || yMin <= 0 || yMax <= 0) return;
    const lo = Math.min(yMin, yMax);
    const hi = Math.max(yMin, yMax);
    ann.push({
      type: "box",
      xMin: minX,
      xMax: maxX,
      yMin: lo,
      yMax: hi,
      backgroundColor: kind === "supply" ? "rgba(255,77,77,0.10)" : "rgba(47,227,165,0.10)",
      borderColor: kind === "supply" ? "rgba(255,77,77,0.35)" : "rgba(47,227,165,0.35)",
      borderWidth: 1,
      label: { enabled: !!label, content: label || "" },
    });
  };

  
  (Array.isArray(levels) ? levels : []).slice(0, 8).forEach((lvl, idx) => {
    addLine(lvl, `L${idx + 1}`, idx % 2 === 0 ? "#00d1ff" : "#ff8a65");
  });

  if (qcSpec && typeof qcSpec === "object") {
    const supports = Array.isArray(qcSpec.supports) ? qcSpec.supports : [];
    const resistances = Array.isArray(qcSpec.resistances) ? qcSpec.resistances : [];
    const tp = Array.isArray(qcSpec.tp) ? qcSpec.tp : [];
    const sl = Number(qcSpec.sl || 0);
    const zones = Array.isArray(qcSpec.zones) ? qcSpec.zones : [];

    supports.slice(0, 6).forEach((v, i) => addLine(v, `S${i + 1}`, "#00d1ff"));
    resistances.slice(0, 6).forEach((v, i) => addLine(v, `R${i + 1}`, "#ff8a65"));
    tp.slice(0, 4).forEach((v, i) => addLine(v, `TP${i + 1}`, "#f7c948", [2, 0], 2));
    if (Number.isFinite(sl) && sl > 0) addLine(sl, "SL", "#FF4D4D", [2, 0], 2);

    zones.slice(0, 6).forEach((z, i) => addZone(z.low, z.high, z.label || `Z${i + 1}`, (z.kind || "").includes("supply") ? "supply" : "demand"));
  }

  return ann;
}

function buildQuickChartSpec(candles, symbol, tf, levels = [], qcSpec = null) {
  const items = (candles || []).slice(-80).map((c) => ({
    x: Number(c.t || c.time || c.ts || c.timestamp || Date.now()),
    o: Number(c.o),
    h: Number(c.h),
    l: Number(c.l),
    c: Number(c.c),
  })).filter((x) => Number.isFinite(x.x) && Number.isFinite(x.o) && Number.isFinite(x.h) && Number.isFinite(x.l) && Number.isFinite(x.c));

  const annotations = buildQcAnnotations(items, levels, qcSpec);

  return {
    type: "candlestick",
    data: {
      datasets: [
        {
          label: `${symbol} ${tf}`,
          data: items,
          color: { up: "#2FE3A5", down: "#FF4D4D", unchanged: "#888" },
        },
      ],
    },
    options: {
      parsing: false,
      plugins: {
        legend: { display: false },
        title: { display: true, text: `${symbol} · ${tf}` },
        annotation: { annotations },
      },
      scales: { x: { ticks: { maxRotation: 0, autoSkip: true } } },
    },
  };
}

function buildQuickChartCandlestickUrl(candles, symbol, tf, levels = [], qcSpec = null) {
  const cfg = buildQuickChartSpec(candles, symbol, tf, levels, qcSpec);
  const encoded = encodeURIComponent(JSON.stringify(cfg));
  return `https://quickchart.io/chart?version=4&format=png&w=900&h=450&devicePixelRatio=2&plugins=chartjs-chart-financial,chartjs-plugin-annotation&c=${encoded}`;
}


function buildQuickChartLevelsOnlyUrl(symbol, tf, levels = []) {
  const lv = levels.map(Number).filter(Number.isFinite).slice(0, 12);
  const labels = lv.map((_, i) => `L${i + 1}`);
  const cfg = {
    type: "line",
    data: {
      labels,
      datasets: [{ label: `${symbol} ${tf} levels`, data: lv, borderColor: "#22d3ee", backgroundColor: "rgba(34,211,238,.15)", fill: true, tension: 0.2 }],
    },
    options: {
      plugins: { legend: { display: true }, title: { display: true, text: `${symbol} · ${tf} · levels` } },
      scales: { y: { grid: { color: "rgba(148,163,184,.25)" } }, x: { grid: { color: "rgba(148,163,184,.15)" } } },
    },
  };
  const encoded = encodeURIComponent(JSON.stringify(cfg));
  return `https://quickchart.io/chart?version=4&format=png&w=900&h=450&devicePixelRatio=2&c=${encoded}`;
}

function stripHiddenModelOutput(text) {
  let s = String(text || "");

  // Remove hidden QCJSON/QJSON blocks used for internal rendering
  s = s.replace(/<\s*QCJSON\s*>[\s\S]*?<\s*\/\s*QCJSON\s*>/gi, "");
  s = s.replace(/<\s*QJSON\s*>[\s\S]*?<\s*\/\s*QJSON\s*>/gi, "");
  s = s.replace(/```\s*(?:qcjson|qjson)\s*[\s\S]*?```/gi, "");
  // Remove inline markers like "qcjson:" or "qjson:" followed by a JSON block (conservative)
  s = s.replace(/\b(?:qcjson|qjson)\s*:\s*\{[\s\S]*?\}\s*$/gim, "");

  // Replace common refusal phrases with a neutral "data limited" note (Telegram/UI friendly)
  s = s.replace(/^.*(متاسفانه|متأسفانه).*(اطلاعات\s*کافی|داده\s*کافی).*(ارائه|ادامه|تحلیل).*(\n|$)/gmi, "⚠️ داده محدود است؛ تحلیل بر اساس داده موجود ارائه می‌شود.\n");
  s = s.replace(/^.*(به\s*همین\s*دلیل|بنابراین).*(نمی\s*توانم|نمی\s*تونم).*(\n|$)/gmi, "");

  // Normalize excessive blank lines
  s = s.replace(/\r/g, "");
  s = s.replace(/\n{3,}/g, "\n\n").trim();

  return s;
}


function buildAdminReportLines(users, payments, withdrawals, tickets) {
  const u = Array.isArray(users) ? users : [];
  const p = Array.isArray(payments) ? payments : [];
  const w = Array.isArray(withdrawals) ? withdrawals : [];
  const t = Array.isArray(tickets) ? tickets : [];
  const head = [
    `Admin Report | ${new Date().toISOString()}`,
    `users=${u.length} payments=${p.length} withdrawals=${w.length} tickets=${t.length}`,
    "------------------------------------------------------------",
  ];
  const usersBlock = u.slice(0, 80).map((x) => {
    const user = x?.profile?.username ? `@${String(x.profile.username).replace(/^@/, "")}` : x?.userId;
    return `USER ${user || "-"} | analyses=${x?.stats?.successfulAnalyses || 0} | used=${x?.dailyUsed || 0}/${dailyLimit({}, x || {})} | sub=${x?.subscription?.type || "free"}`;
  });
  const payBlock = p.slice(0, 60).map((x) => `PAY ${x.username || x.userId || "-"} | amount=${x.amount || 0} | status=${x.status || "-"} | tx=${x.txHash || "-"}`);
  const wdBlock = w.slice(0, 60).map((x) => `WD ${x.userId || "-"} | amount=${x.amount || 0} | status=${x.status || "pending"} | addr=${x.address || "-"}`);
  const tkBlock = t.slice(0, 60).map((x) => `TICKET ${x.id || "-"} | ${x.username || x.userId || "-"} | ${x.status || "pending"} | ${String(x.text || "").slice(0, 80)}`);
  return [
    ...head,
    "USERS", ...(usersBlock.length ? usersBlock : ["-"]),
    "",
    "PAYMENTS", ...(payBlock.length ? payBlock : ["-"]),
    "",
    "WITHDRAWALS", ...(wdBlock.length ? wdBlock : ["-"]),
    "",
    "TICKETS", ...(tkBlock.length ? tkBlock : ["-"]),
  ];
}

function buildSimplePdfFromText(text) {
  const content = String(text || "").replace(/\r/g, "");
  const lines = content.split("\n").slice(0, 500);
  const escaped = lines.map((l) => String(l || "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^	\x20-\x7E]/g, " "));
  const streamLines = ["BT", "/F1 10 Tf", "36 800 Td", "12 TL"];
  for (let i = 0; i < escaped.length; i++) {
    if (i === 0) streamLines.push(`(${escaped[i]}) Tj`);
    else streamLines.push(`T* (${escaped[i]}) Tj`);
  }
  streamLines.push("ET");
  const stream = streamLines.join(String.fromCharCode(10));

  const objects = [];
  objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n");
  objects.push("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n");
  objects.push("3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n");
  objects.push("4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj\n");
  objects.push(`5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj\n`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}


function tvSymbolFromAppSymbol(sym){
  const s0 = String(sym||"").trim().toUpperCase();
  if (!s0) return "BINANCE:BTCUSDT";
  if (s0.includes(":")) return s0;
  if (/^[A-Z0-9]{3,12}USDT$/.test(s0)) return "BINANCE:" + s0;
  if (s0 === "XAUUSD" || s0 === "XAGUSD") return "OANDA:" + s0;
  if (/^[A-Z]{6}$/.test(s0)) return "OANDA:" + s0;
  return "FX_IDC:" + s0.replace(/[^A-Z0-9]/g, "");
}

function tvIntervalFromTf(tf){
  const x = String(tf||"H4").toUpperCase();
  if (x === "M15") return "15";
  if (x === "H1") return "60";
  if (x === "H4") return "240";
  if (x === "D1") return "D";
  return "240";
}

function tvChartLink(sym, tf){
  const s = encodeURIComponent(tvSymbolFromAppSymbol(sym));
  const i = encodeURIComponent(tvIntervalFromTf(tf));
  return "https://www.tradingview.com/chart/?symbol=" + s + "&interval=" + i;
}


async function runSignalTextFlow(env, chatId, from, st, symbol, userPrompt) {
  const uid = String(st?.userId || from?.id || chatId || "");
  const thinkingMsgId = await loadThinkingMsgId(env, uid);

  const t = stopToken();
  const typingTask = typingLoop(env, chatId, t);

  try {
    
    const flowTimeoutMs = Math.max(15000, Math.min(300000, Number(env.SIGNAL_FLOW_TIMEOUT_MS || 300000)));
    
    const bundle = await Promise.race([
      runSignalTextFlowReturnBundle(env, from, st, symbol, userPrompt),
      timeoutPromise(flowTimeoutMs, "signal_text_flow_timeout"),
    ]);
    let result = bundle?.text || "";
    result = stripCandleIndices(result);
    result = stripHiddenModelOutput(result);


    
    if (String(env.QUICKCHART || "1") !== "0") {
      try {
        let candles = [];
        try {
          candles = await getMarketCandlesWithFallback(env, symbol, st.timeframe || "H4");
        } catch (e) {
          console.error("market provider failed (all)", e?.message || e);
          candles = [];
        }
        if (!Array.isArray(candles) || candles.length === 0) {
          const cacheKey = marketCacheKey(symbol, st.timeframe || "H4");
          candles = await getMarketCacheStale(env, cacheKey);
        }
        if (!Array.isArray(candles) || candles.length === 0) {
          
          await tgSendMessage(env, chatId, "⚠️ برای این نماد در این تایم‌فریم دیتای کافی پیدا نشد؛ چارت ارسال نشد.", kb([[BTN.HOME]]));
        } else {
          const levels = (bundle && Array.isArray(bundle.levels) ? bundle.levels : extractLevels(result));
          const qcSpec = (bundle && bundle.qcSpec) ? bundle.qcSpec : null;
          const chartUrl = buildQuickChartCandlestickUrl(candles, symbol, st.timeframe || "H4", levels, qcSpec);
          const tv = tvChartLink(symbol, st.timeframe || "H4");
          const caption = (candles.length < 5
            ? `📈 چارت ${symbol} (${st.timeframe || "H4"}) — داده محدود`
            : `📈 چارت ${symbol} (${st.timeframe || "H4"})`) + `
🔗 TradingView: ${tv}`;
          const pj = await tgSendPhotoSmart(env, chatId, chartUrl, caption, kb([[BTN.HOME]]));
          if (!pj || !pj.ok) {
            console.error("chart send failed:", pj);
            if (String(env.RENDER_ZONES || "") === "1") {
              const svg = buildZonesSvgFromAnalysis(result, symbol, st.timeframe || "H4");
              await tgSendSvgDocument(env, chatId, svg, "zones.svg", `🖼️ نقشه زون‌ها: ${symbol} (${st.timeframe || "H4"})`);
            } else {
              await tgSendMessage(env, chatId, "⚠️ ارسال چارت ناموفق بود.", kb([[BTN.HOME]]));
            }
          }
}
      } catch (e) {
        console.error("quickchart error:", e);
      }
    }

    if (String(env.RENDER_ZONES || "") === "1") {
      const svg = buildZonesSvgFromAnalysis(result, symbol, st.timeframe || "H4");
      await tgSendSvgDocument(env, chatId, svg, "zones.svg", `🖼️ نقشه زون‌ها: ${symbol} (${st.timeframe || "H4"})`);
    }

    t.stop = true;
    await Promise.race([typingTask, sleep(10)]).catch(() => {});
    await tgSendLongMessageHtml(env, chatId, formatModelOutputBoldHeadingsHtml(result), mainMenuKeyboard(env));
    await tgDeleteMessage(env, chatId, thinkingMsgId);
    await clearThinkingMsgId(env, uid);
    return true;
  } catch (e) {
    console.error("runSignalTextFlow error:", e);
    t.stop = true;
    const msg = String(e?.message || e || "");
    if (msg.includes("timeout") || msg.includes("text_")) {
      let candles = [];
      try { candles = await getMarketCandlesWithFallback(env, symbol, st.timeframe || "H4"); } catch {}
      const fallback = buildLocalFallbackAnalysis(symbol, st, candles, msg || "signal_timeout");
      await tgSendLongMessageHtml(env, chatId, formatModelOutputBoldHeadingsHtml(fallback), kb([[BTN.HOME]]));
      await tgDeleteMessage(env, chatId, thinkingMsgId);
      await clearThinkingMsgId(env, uid);
      return false;
    }
    await tgSendMessage(env, chatId, "⚠️ فعلاً امکان انجام این عملیات نیست. لطفاً بعداً دوباره تلاش کن.", mainMenuKeyboard(env));
    await tgDeleteMessage(env, chatId, thinkingMsgId);
    await clearThinkingMsgId(env, uid);
    return false;
  }
}


 




function analysisLockKey(userId) {
  return `lock:analysis:${String(userId)}`;
}

async function tryAcquireAnalysisLock(env, userId, ttlSec) {
  if (!env.BOT_KV) return true;
  const key = analysisLockKey(userId);
  const existing = await env.BOT_KV.get(key);
  if (existing) return false;
  const ttl = Math.max(30, Math.min(3600, Number(ttlSec || 300)));
  await env.BOT_KV.put(key, "1", { expirationTtl: ttl });
  return true;
}

async function releaseAnalysisLock(env, userId) {
  if (!env.BOT_KV) return;
  try { await env.BOT_KV.delete(analysisLockKey(userId)); } catch {}
}

async function enqueueAnalysisJob(env, chatId, userId, from, st, symbol, userPrompt) {
  if (!env.ANALYSIS_QUEUE) {
    await tgSendMessage(env, chatId, "⚠️ صف تحلیل فعال نیست. در Cloudflare یک Queue بساز و به Worker با نام ANALYSIS_QUEUE Bind کن.", kb([[BTN.HOME]]));
    return false;
  }

  const pc = canSpendAnalysisPoints(st, from, env);
  if (!pc.ok) {
    const { link } = inviteShareText(st, env);
    const cost = Number(pc.cost || env.ANALYSIS_POINTS_COST || 2);
    const bal = Number(pc.balance || st?.points?.balance || 0);
    const thr = proRedeemThreshold(env);
    const msg =
      `⛔️ امتیاز کافی نیست.\n\nامتیاز فعلی: ${bal}\nهزینه هر تحلیل: ${cost}\n\nبرای کسب امتیاز از «دعوت دوستان» استفاده کن.\nهر دعوت موفق (شماره جدید): +۶ امتیاز\nهر ${thr} امتیاز: ۳۰ روز اشتراک پرو رایگان\n\nلینک دعوت شما:\n${link || "—"}`;
    await tgSendMessage(env, chatId, msg, mainMenuKeyboard(env));
    return false;
  }

  const flowTimeoutMs  = Math.max(15000, Math.min(300000, Number(env.SIGNAL_FLOW_TIMEOUT_MS || 300000)));
  const ttlSec = Math.ceil(flowTimeoutMs / 1000) + 30;

const locked = await tryAcquireAnalysisLock(env, userId, ttlSec);
if (!locked) {
  // lock is already held — stash request in KV and auto-kick after current analysis finishes
  try {
    const fromSafe2 = {
      id: Number(from?.id || userId || chatId || 0),
      username: from?.username ? String(from.username) : String(st?.profile?.username || ""),
    };
    const pendingMsg = {
      kind: "analysis_v1",
      chatId: Number(chatId),
      userId: String(userId),
      symbol: String(symbol || "").toUpperCase(),
      userPrompt: String(userPrompt || ""),
      from: fromSafe2,
      enqueuedAt: Date.now(),
    };
    await pushMiniappPendingAnalysis(env, userId, pendingMsg, Math.max(1800, ttlSec));
    await tgSendMessage(env, chatId, "⏳ یک تحلیل دیگر در حال پردازش است؛ درخواست شما در صف قرار گرفت ✅", kb([[BTN.HOME]]));
    return true;
  } catch (e) {
    await tgSendMessage(env, chatId, "⏳ یک تحلیل دیگر هنوز در حال پردازش است. لطفاً کمی صبر کن.", kb([[BTN.HOME]]));
    return false;
  }
}


  const fromSafe = {
    id: Number(from?.id || userId || chatId || 0),
    username: from?.username ? String(from.username) : String(st?.profile?.username || ""),
  };

  
  try {
    await env.ANALYSIS_QUEUE.send({
      kind: "analysis_v1",
      chatId: Number(chatId),
      userId: String(userId),
      symbol: String(symbol || "").toUpperCase(),
      userPrompt: String(userPrompt || ""),
      from: fromSafe,
      enqueuedAt: Date.now(),
    });
  } catch (e) {
    console.error("queue send failed:", e);
    
    await releaseAnalysisLock(env, userId);
    await tgSendMessage(
      env,
      chatId,
      "⚠️ ارسال به صف ناموفق بود. Binding صف (ANALYSIS_QUEUE) و دسترسی Consumer را در داشبورد Cloudflare چک کن و دوباره تلاش کن.",
      kb([[BTN.HOME]])
    );
    return false;
  }

  const thinking = await tgSendThinking(env, chatId, kb([[BTN.HOME]]));
  const thinkingMsgId = thinking?.result?.message_id || 0;
  await saveThinkingMsgId(env, userId, thinkingMsgId, ttlSec);

  return true;
}



function miniappAnalysisJobKey(jobId) {
  return `miniapp:analysis:job:${String(jobId || "")}`;
}

async function loadMiniappAnalysisJob(env, jobId) {
  if (!env.BOT_KV) return null;
  const raw = await env.BOT_KV.get(miniappAnalysisJobKey(jobId));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function saveMiniappAnalysisJob(env, jobId, job, ttlSec) {
  if (!env.BOT_KV) return;
  const ttl = Math.max(60, Number(ttlSec || 900));
  await env.BOT_KV.put(miniappAnalysisJobKey(jobId), JSON.stringify(job || {}), { expirationTtl: ttl });
}

function buildMiniappAnalysisJobStub(body) {
  return {
    kind: "miniapp_analysis_v1",
    jobId: String(body?.jobId || ""),
    userId: String(body?.userId || ""),
    symbol: String(body?.symbol || ""),
    status: "queued",
    enqueuedAt: new Date().toISOString(),
  };
}

async function enqueueMiniappAnalysisJob(env, origin, userId, fromLike, st, symbol, userPrompt) {
  if (!env.ANALYSIS_QUEUE) return { ok: false, reason: "queue_not_configured", status: 500 };
  if (!env.BOT_KV) return { ok: false, reason: "kv_required", status: 500 };

  const pc = canSpendAnalysisPoints(st, fromLike, env);
  if (!pc.ok) {
    const { link } = inviteShareText(st, env);
    return { ok: false, reason: pc.reason || "insufficient_points", status: 402, cost: pc.cost, balance: pc.balance, referralLink: link || "" };
  }

  const flowTimeoutMs = Math.max(15000, Math.min(300000, Number(env.SIGNAL_FLOW_TIMEOUT_MS || 300000)));
  const ttlSec = Math.max(120, Math.ceil((flowTimeoutMs + 30000) / 1000));
  const jobTtlSec = Math.max(ttlSec, 60 * 60); // keep job records long enough to be polled

  const lockOk = await tryAcquireAnalysisLock(env, userId, ttlSec);

  const jobId = `job_${Date.now()}_${String(userId)}_${randomCode(6)}`;
  const job = {
    kind: "miniapp_analysis_v1",
    jobId,
    userId: String(userId),
    symbol,
    status: "queued",
    origin,
    enqueuedAt: new Date().toISOString(),
    state: st || {},
    delayed: !lockOk,
  };
  await saveMiniappAnalysisJob(env, jobId, job, jobTtlSec);

  const msg = {
    kind: "miniapp_analysis_v1",
    jobId,
    userId: String(userId),
    from: fromLike || null,
    symbol,
    userPrompt: userPrompt || "",
    origin,
  };

  if (lockOk) {
    try {
      await env.ANALYSIS_QUEUE.send(msg);
    } catch (e) {
      await saveMiniappAnalysisJob(env, jobId, { ...job, status: "error", error: "queue_send_failed", errorMessage: String(e?.message || e) }, jobTtlSec);
      await releaseAnalysisLock(env, userId);
      return { ok: false, reason: "queue_send_failed", status: 500 };
    }
    return { ok: true, jobId, ttlSec, delayed: false };
  }

  // lock is already held (analysis in progress) — stash the job and auto-kick after current finishes
  try {
    await pushMiniappPendingAnalysis(env, userId, msg, jobTtlSec);
    return { ok: true, jobId, ttlSec, delayed: true };
  } catch (e) {
    await saveMiniappAnalysisJob(env, jobId, { ...job, status: "error", error: "pending_queue_failed", errorMessage: String(e?.message || e) }, jobTtlSec);
    return { ok: false, reason: "pending_queue_failed", status: 500 };
  }
}


function miniappPendingKey(userId) {
  return `miniapp_pending:${String(userId)}`;
}
async function pushMiniappPendingAnalysis(env, userId, msg, ttlSec) {
  if (!env.BOT_KV) throw new Error("kv_required");
  const key = miniappPendingKey(userId);
  const raw = await env.BOT_KV.get(key);
  let arr = [];
  try { arr = raw ? JSON.parse(raw) : []; } catch (e) { arr = []; }
  if (!Array.isArray(arr)) arr = [];
  arr.push(msg);
  // keep the queue bounded (avoid KV bloat)
  if (arr.length > 10) arr = arr.slice(arr.length - 10);
  await env.BOT_KV.put(key, JSON.stringify(arr), { expirationTtl: Math.max(300, Number(ttlSec || 1800)) });
}
async function popMiniappPendingAnalysis(env, userId) {
  if (!env.BOT_KV) return null;
  const key = miniappPendingKey(userId);
  const raw = await env.BOT_KV.get(key);
  if (!raw) return null;
  let arr = [];
  try { arr = JSON.parse(raw); } catch (e) { arr = []; }
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const msg = arr.shift();
  if (arr.length) {
    await env.BOT_KV.put(key, JSON.stringify(arr), { expirationTtl: 60 * 60 });
  } else {
    // no more pending
    try { await env.BOT_KV.delete(key); } catch (e) {}
  }
  return msg || null;
}
async function kickMiniappPendingAnalysis(env, userId) {
  if (!env.ANALYSIS_QUEUE || !env.BOT_KV) return;
  const key = miniappPendingKey(userId);
  const raw = await env.BOT_KV.get(key);
  if (!raw || raw === "[]") return;

  const flowTimeoutMs = Math.max(15000, Math.min(300000, Number(env.SIGNAL_FLOW_TIMEOUT_MS || 300000)));
  const ttlSec = Math.max(120, Math.ceil((flowTimeoutMs + 30000) / 1000));

  const lockOk = await tryAcquireAnalysisLock(env, userId, ttlSec);
  if (!lockOk) return;

  const msg = await popMiniappPendingAnalysis(env, userId);
  if (!msg) {
    await releaseAnalysisLock(env, userId);
    return;
  }

  try {
    await env.ANALYSIS_QUEUE.send(msg);
  } catch (e) {
    const jobId = String(msg?.jobId || "");
    if (jobId) {
      const job = await loadMiniappAnalysisJob(env, jobId);
      if (job) {
        await saveMiniappAnalysisJob(env, jobId, { ...job, status: "error", error: "queue_send_failed", errorMessage: String(e?.message || e) }, 60 * 60);
      }
    }
    await releaseAnalysisLock(env, userId);
  }
}



async function processMiniappAnalysisQueueMessage(env, body) {
  const jobId = String(body?.jobId || "");
  const userId = String(body?.userId || "");
  const symbol = String(body?.symbol || "");
  const origin = String(body?.origin || "");
  const fromLike = body?.from || null;
  const userPrompt = String(body?.userPrompt || "");

  const flowTimeoutMs = Math.max(15000, Math.min(300000, Number(env.SIGNAL_FLOW_TIMEOUT_MS || 300000)));
  const ttlSec = Math.max(120, Math.ceil((flowTimeoutMs + 30000) / 1000));

  let job = await loadMiniappAnalysisJob(env, jobId);
  if (!job) job = buildMiniappAnalysisJobStub(body);

  job.status = "running";
  job.startedAt = new Date().toISOString();
  await saveMiniappAnalysisJob(env, jobId, job, ttlSec);

  try {
    const st = await ensureUser(userId, env, fromLike || {});
    // Ensure latest settings are reflected in job (UI may update settings right before enqueue)
    job.state = st;

    if (!canAnalyzeToday(st, fromLike || {}, env)) {
      job.status = "error";
      job.error = "daily_limit_exceeded";
      job.quota = `0/${Math.max(0, Math.floor(Number(st.points?.balance || 0) / (Number(env.ANALYSIS_POINTS_COST || 2) || 2)))}`;
      job.finishedAt = new Date().toISOString();
      await saveMiniappAnalysisJob(env, jobId, job, ttlSec);
      return;
    }

    const bundle = await Promise.race([
      runSignalTextFlowReturnBundle(env, fromLike || {}, st, symbol, userPrompt),
      timeoutPromise(flowTimeoutMs, "miniapp_analyze_timeout"),
    ]);

    let result = bundle?.text || "";
    result = stripCandleIndices(result);
    const qcRaw = bundle?.qcRaw || null;

    // Only count usage & spend points after successful bundle
    if (hasUserPersistence(env)) {
      consumeDaily(st, fromLike || {}, env);
      recordAnalysisSuccess(st);
      spendAnalysisPoints(st, env);
      await saveUser(userId, st, env);
    }

    const ptsBal = Number(st.points?.balance || 0);
        const apCost = Number(env.ANALYSIS_POINTS_COST || 2);
        const analysesLeft = Math.max(0, Math.floor(ptsBal / (apCost || 2)));
        const quota = `0/${analysesLeft}`;

    let chartUrl = "";
    let levels = [];
    let quickChartSpec = null;
    let zonesSvg = "";
    let chartCandlesCount = 0;
    let spotPrice = 0;
    let spotTs = 0;

    try {
      if (String(env.QUICKCHART || "") !== "0") {
        const tf = st.timeframe || "H4";
        levels = extractLevels(result);
        const qcSpec = normalizeQcSpec(qcRaw, levels);
        const candles = await getMarketCandlesWithFallback(env, symbol, tf).catch(() => []);
        chartCandlesCount = Array.isArray(candles) ? candles.length : 0;
        if (Array.isArray(candles) && candles.length) {
          const last = candles[candles.length - 1] || {};
          spotPrice = Number(last.c ?? last.close ?? 0) || 0;
          spotTs = Number(last.t ?? last.time ?? last.ts ?? last.timestamp ?? 0) || 0;
        }

        if (Array.isArray(candles) && candles.length) {
          let chartId = "";
          if (env.BOT_KV) {
            chartId = `qc|${userId}|${Date.now()}`;
            const ttl = Number(env.CHART_SPEC_TTL_SEC || 900);
            await env.BOT_KV.put(chartId, JSON.stringify(qcSpec), { expirationTtl: Math.max(60, ttl) });
          }
          if (origin) {
            chartUrl = chartId
              ? `${origin}/api/chart?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}&id=${encodeURIComponent(chartId)}`
              : `${origin}/api/chart?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}&levels=${encodeURIComponent(levels.join(","))}`;
          }
          quickChartSpec = buildQuickChartSpec(candles, symbol, tf, levels, qcSpec);
        } else if (levels.length) {
          chartUrl = buildQuickChartLevelsOnlyUrl(symbol, tf, levels);
          quickChartSpec = { fallback: "levels_only", symbol, timeframe: tf, levels };
        }
      }
    } catch (e) {
      console.error("miniapp chartUrl build error:", e?.message || e);
    }

    try {
      zonesSvg = buildZonesSvgFromAnalysis(result, symbol, st.timeframe || "H4", spotPrice);
    } catch (e) {
      console.error("miniapp zones svg build error:", e?.message || e);
    }

    const tf = st.timeframe || "H4";
    const quickchartConfig = { symbol, timeframe: tf, levels };
    const chartMeta = { timeframe: tf, candles: chartCandlesCount, zones: levels.length, spotPrice, spotTs };

    job.status = "done";
    job.result = result;
    job.quota = quota;
    job.chartUrl = chartUrl;
    job.levels = levels;
    job.quickChartSpec = quickChartSpec;
    job.quickchartConfig = quickchartConfig;
    job.chartMeta = chartMeta;
    job.zonesSvg = zonesSvg;
    job.state = st;
    job.finishedAt = new Date().toISOString();

    await saveMiniappAnalysisJob(env, jobId, job, ttlSec);
  } catch (e) {
    console.error("miniapp queue analysis job error:", e);
    const msg = String(e?.message || e || "");
    let jobNow = job;
    if (!jobNow) jobNow = buildMiniappAnalysisJobStub(body);

    // Timeout fallback: don't spend points, but do return something useful
    if (msg.includes("miniapp_analyze_timeout") || msg.includes("text_") || msg.includes("timeout")) {
      let candles = [];
      try { candles = await getMarketCandlesWithFallback(env, symbol, (jobNow?.state?.timeframe || "H4")); } catch {}
      const fallback = buildLocalFallbackAnalysis(symbol, jobNow?.state || {}, candles, msg || "analysis_timeout");
      jobNow.status = "done";
      jobNow.result = fallback;
      jobNow.fallback = true;
      jobNow.reason = msg || "timeout";
      jobNow.finishedAt = new Date().toISOString();
      await saveMiniappAnalysisJob(env, jobId, jobNow, ttlSec);
    } else {
      jobNow.status = "error";
      jobNow.error = "server_error";
      jobNow.errorMessage = msg || "server_error";
      jobNow.finishedAt = new Date().toISOString();
      await saveMiniappAnalysisJob(env, jobId, jobNow, ttlSec);
    }
  } finally {
    if (userId) await releaseAnalysisLock(env, userId);
    if (userId) await kickMiniappPendingAnalysis(env, userId);
  }
}

async function processAnalysisQueueMessage(env, body) {
  const chatId = Number(body?.chatId || 0);
  const userId = String(body?.userId || "");
  const symbol = String(body?.symbol || "").toUpperCase();
  const userPrompt = String(body?.userPrompt || "");
  const from = body?.from || { id: Number(userId) || chatId };

  if (!chatId || !userId || !symbol) return;

  if (String(env.QUEUE_DEBUG || "") === "1") {
    console.log("QUEUE_DEBUG: job received", { chatId, userId, symbol });
  }

  try {
    const st = await ensureUser(userId, env, from);
    applyLocaleFromTelegramUser(st, from || {});

    
    if (env.BOT_KV && !canAnalyzeToday(st, from, env)) {
      
      const mid = await loadThinkingMsgId(env, userId);
      await tgDeleteMessage(env, chatId, mid);
      await clearThinkingMsgId(env, userId);

      await tgSendMessage(env, chatId, `⛔️ سهمیه امروزت تموم شده (${dailyLimit(env, st)} تحلیل در روز).`, mainMenuKeyboard(env));
      return;
    }

    const ok = await runSignalTextFlow(env, chatId, from, st, symbol, userPrompt);

    if (hasUserPersistence(env)) {
      if (ok) {
        consumeDaily(st, from, env);
        recordAnalysisSuccess(st);
        spendAnalysisPoints(st, env);
      }
      await saveUser(userId, st, env);
    }
  } finally {
    await releaseAnalysisLock(env, userId);
    await kickMiniappPendingAnalysis(env, userId);
  }
}



function analysisCacheKey(symbol, st, lastTs, userPrompt) {
  const tf = st.timeframe || "H4";
  const style = st.style || "";
  const risk = st.risk || "";
  const news = st.newsEnabled ? "1" : "0";
  const ts = lastTs ? String(lastTs) : "0";
  const up = userPrompt ? hash32FNV1a(String(userPrompt).trim()) : "0";
  return `analysis:v2:${String(symbol).toUpperCase()}:${tf}:${style}:${risk}:${news}:${ts}:${up}`;
}


async function getAnalysisCache(env, key) {
  const mem = cacheGet(ANALYSIS_CACHE, key);
  if (mem) return mem;
  const r2 = await getCachedR2Value(env.MARKET_R2, key);
  if (r2) cacheSet(ANALYSIS_CACHE, key, r2, Number(env.ANALYSIS_CACHE_TTL_MS || 120000));
  return r2;
}

async function setAnalysisCache(env, key, value) {
  const ttlMs = Number(env.ANALYSIS_CACHE_TTL_MS || 120000);
  cacheSet(ANALYSIS_CACHE, key, value, ttlMs);
  await r2PutJson(env.MARKET_R2, key, value, ttlMs);
}

function normalizeTsMs(t) {
  if (t == null) return null;
  let n = Number(t);
  if (!Number.isFinite(n)) return null;
  
  if (n > 1e9 && n < 1e12) n = n * 1000;
  return Math.trunc(n);
}

function roundTo(n, d) {
  if (!Number.isFinite(n)) return null;
  const p = Math.pow(10, d);
  return Math.round(n * p) / p;
}

function inferPriceDecimalsFromCandles(candles) {
  const p = (Array.isArray(candles) && candles.length) ? Number(candles[candles.length - 1]?.c) : NaN;
  if (!Number.isFinite(p) || p === 0) return 6;
  const ap = Math.abs(p);
  if (ap >= 1000) return 2;
  if (ap >= 100) return 3;
  if (ap >= 1) return 5;
  return 7;
}










function standardizeCandles(candles, maxRows = 200) {
  if (!Array.isArray(candles) || candles.length === 0) return [];
  const norm = [];
  for (const x of candles) {
    if (!x) continue;
    const t = normalizeTsMs(x.t);
    const o = Number(x.o);
    const h0 = Number(x.h);
    const l0 = Number(x.l);
    const c = Number(x.c);
    const v0 = (x.v == null ? null : Number(x.v));
    if (![t, o, h0, l0, c].every(Number.isFinite)) continue;
    const h = Math.max(h0, o, c);
    const l = Math.min(l0, o, c);
    norm.push({ t, o, h, l, c, v: (Number.isFinite(v0) ? v0 : null) });
  }
  if (!norm.length) return [];
  norm.sort((a, b) => a.t - b.t);

  
  const dedup = [];
  for (const x of norm) {
    const prev = dedup[dedup.length - 1];
    if (prev && prev.t === x.t) dedup[dedup.length - 1] = x;
    else dedup.push(x);
  }
  if (maxRows && dedup.length > maxRows) return dedup.slice(-maxRows);
  return dedup;
}

function buildMarketTfBlock(tf, candles, maxRows) {
  const cs = standardizeCandles(candles, maxRows);
  const snap = computeSnapshot(cs);
  const dec = inferPriceDecimalsFromCandles(cs);
  const lines = cs.map(x => {
    const o = roundTo(x.o, dec);
    const h = roundTo(x.h, dec);
    const l = roundTo(x.l, dec);
    const c = roundTo(x.c, dec);
    const v = (x.v == null ? "" : roundTo(x.v, 2));
    return `${x.t},${o},${h},${l},${c},${v}`;
  }).join(String.fromCharCode(10));

  const meta = {
    tf,
    count: cs.length,
    lastTs: snap?.lastTs ?? null,
    lastIso: snap?.lastTs ? new Date(snap.lastTs).toISOString() : null,
    lastClose: snap?.lastPrice ?? null,
    changePct: snap?.changePct ?? null,
    trend: snap?.trend ?? null,
    range50: snap?.range50 ?? null,
    price_decimals: dec,
  };

  return (
    `--- TF:${tf} ---
` +
    `META_JSON:${JSON.stringify(meta)}
` +
    `OHLCV_CSV(t,o,h,l,c,v):
${lines}
`
  );
}






function buildMarketBlock(symbol, requestedTf, candlesByTf, opts = {}) {
  const tz = String(opts.tz || "UTC");
  const maxRowsPrimary = Number(opts.maxRowsPrimary || 200);
  const maxRowsH4 = Number(opts.maxRowsH4 || 160);
  const maxRowsD1 = Number(opts.maxRowsD1 || 120);

  const sym = String(symbol || "").toUpperCase();
  const tf = String(requestedTf || "H4").toUpperCase();

  const tfs = [];
  for (const x of [tf, "H4", "D1"]) {
    const up = String(x || "").toUpperCase();
    if (up && !tfs.includes(up)) tfs.push(up);
  }

  let out = `MARKET_DATA_STD(schema=marketiq.marketdata.v2, t_unit=ms, tz=${tz})
`;
  out += `Symbol=${sym}
RequestedTF=${tf}
fields=[t,o,h,l,c,v] (candles oldest→newest)

`;

  for (const x of tfs) {
    const maxRows =
      x === tf ? maxRowsPrimary :
      (x === "H4" ? maxRowsH4 : maxRowsD1);
    out += buildMarketTfBlock(x, (candlesByTf && candlesByTf[x]) ? candlesByTf[x] : [], maxRows);
    out += "";
  }
  return out.trim();
}


async function runSignalTextFlowReturnBundle(env, from, st, symbol, userPrompt) {
  const requestedTf = String(st.timeframe || "H4").toUpperCase();
  const needTfs = [];
  for (const x of [requestedTf, "H4", "D1"]) {
    const tf = String(x || "").toUpperCase();
    if (tf && !needTfs.includes(tf)) needTfs.push(tf);
  }

  
  const candlesByTf = {};
  await Promise.all(needTfs.map(async (tf) => {
    try {
      candlesByTf[tf] = await getMarketCandlesWithFallback(env, symbol, tf);
    } catch (e) {
      console.error("market provider failed", tf, e?.message || e);
      candlesByTf[tf] = [];
    }
  }));

  const candles = candlesByTf[requestedTf] || [];

  
  const lastTsPrimary = (Array.isArray(candles) && candles.length) ? (candles[candles.length - 1]?.t || "0") : "0";
  const lastTsH4 = (Array.isArray(candlesByTf["H4"]) && candlesByTf["H4"].length) ? (candlesByTf["H4"][candlesByTf["H4"].length - 1]?.t || "0") : "0";
  const lastTsD1 = (Array.isArray(candlesByTf["D1"]) && candlesByTf["D1"].length) ? (candlesByTf["D1"][candlesByTf["D1"].length - 1]?.t || "0") : "0";
  const tsBundle = `${lastTsPrimary}|H4:${lastTsH4}|D1:${lastTsD1}`;
  const cacheKey = analysisCacheKey(symbol, st, tsBundle, userPrompt);

  const useCache = !isStaff(from, env);
  if (useCache) {
    const cached = await getAnalysisCache(env, cacheKey);
    if (cached && typeof cached === 'object' && cached.text) {
      cached.text = stripHiddenModelOutput(cached.text);
      return cached;
    }
  }

  const tz = String((st && st.profile && st.profile.timezone) || env.DEFAULT_TIMEZONE || "UTC");

  const marketBlock = buildMarketBlock(symbol, requestedTf, candlesByTf, { tz, maxRowsPrimary: 200, maxRowsH4: 160, maxRowsD1: 120 });
  const newsBlock = st.newsEnabled ? (await buildNewsBlockForSymbol(symbol, env, 5)) : "";
  const prompt = await buildTextPromptForSymbol(symbol, userPrompt, st, marketBlock, env, newsBlock);

  let draft = "";
  try {
    draft = await runTextProviders(prompt, env, st.textOrder);
  } catch (e) {
    console.error("text providers failed (retry compact):", e?.message || e);
    try {
      const compactBlock = buildMarketBlock(symbol, requestedTf, candlesByTf, { tz, maxRowsPrimary: 120, maxRowsH4: 120, maxRowsD1: 90 });
      const compactPrompt = await buildTextPromptForSymbol(symbol, userPrompt, st, compactBlock, env, newsBlock);
      draft = await runTextProviders(compactPrompt, env, st.textOrder);
    } catch (e2) {
      console.error("text providers failed (fallback local):", e2?.message || e2);
      const fallback = buildLocalFallbackAnalysis(symbol, st, candles, e2?.message || "text_provider_timeout");
      const payload = { text: fallback, qcRaw: null, qcSpec: null, levels: [], candlesMeta: { lastTs: lastTsPrimary, lastTsH4, lastTsD1 } };
      if (useCache && payload.text) await setAnalysisCache(env, cacheKey, payload);
      return payload;
    }
  }

  
  const rawOut = String(draft || '');

  // Extract QCJSON for internal rendering (chart/zones) and strip it from visible text
  const tmpQc = extractQcJsonAndStrip(rawOut);
  const qcRaw = tmpQc?.qc || null;

  // Always remove hidden blocks from user-visible text (Telegram/Web) — حتی در style_only
  const cleaned = stripHiddenModelOutput(tmpQc?.cleaned || rawOut);
  const levels = extractLevels(cleaned);
  const qcSpec = normalizeQcSpec(qcRaw, levels);

  const payload = {
    text: cleaned,
    qcRaw,
    qcSpec,
    levels,
    candlesMeta: { lastTs: lastTsPrimary, lastTsH4, lastTsD1, countPrimary: Array.isArray(candles) ? candles.length : 0, countH4: (candlesByTf && Array.isArray(candlesByTf.H4) ? candlesByTf.H4.length : 0), countD1: (candlesByTf && Array.isArray(candlesByTf.D1) ? candlesByTf.D1.length : 0) },
  };

  if (useCache && payload.text) await setAnalysisCache(env, cacheKey, payload);
  return payload;
}

async function runSignalTextFlowReturnText(env, from, st, symbol, userPrompt) {
  const bundle = await runSignalTextFlowReturnBundle(env, from, st, symbol, userPrompt);
  return bundle?.text || "";
}


async function handleVisionFlow(env, chatId, from, userId, st, fileId) {
  if (env.BOT_KV && !canAnalyzeToday(st, from, env)) {
    await tgSendMessage(env, chatId, `⛔️ سهمیه امروزت تموم شده (${dailyLimit(env, st)} تحلیل در روز).`, mainMenuKeyboard(env));
    return;
  }

  await tgSendThinking(env, chatId, kb([[BTN.HOME]]));

  const t = stopToken();
  const typingTask = typingLoop(env, chatId, t);

  try {
    const filePath = await tgGetFilePath(env, fileId);
    if (!filePath) throw new Error("no_file_path");
    const imageUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`;

    const vPrompt = await buildVisionPrompt(st, env);
    const visionRaw = await runVisionProviders(imageUrl, vPrompt, env, st.visionOrder);

    const tf = st.timeframe || "H4";
    const baseRaw = await getAnalysisPrompt(env);
    const base = baseRaw .split("{TIMEFRAME}").join(tf);

    const finalPrompt =
      `${base}\n\n` +
      `ورودی ویژن (مشاهدات تصویر):\n${visionRaw}\n\n` +
      `وظیفه: بر اساس همین مشاهده‌ها خروجی دقیق ۱ تا ۵ بده. سطح‌ها را مشخص کن.\n` +
      `قوانین: فقط فارسی، لحن افشاگر، خیال‌بافی نکن.\n` ;

    const draft = await runTextProviders(finalPrompt, env, st.textOrder);
    let polished = draft;
    if (String(st.promptMode || '').trim() !== 'style_only') {
      polished = await runPolishProviders(draft, env, st.polishOrder);
    }

    if (String(env.RENDER_ZONES || "") === "1") {
      const svg = buildZonesSvgFromAnalysis(polished, "CHART", tf);
      await tgSendSvgDocument(env, chatId, svg, "zones.svg", `🖼️ نقشه زون‌ها (${tf})`);
    }

    t.stop = true;
    await Promise.race([typingTask, sleep(10)]).catch(() => {});

    const visible = stripHiddenModelOutput(polished);
    await tgSendLongMessageHtml(env, chatId, formatModelOutputBoldHeadingsHtml(visible), mainMenuKeyboard(env));
    if (env.BOT_KV) {
      consumeDaily(st, from, env);
      recordAnalysisSuccess(st);
      await saveUser(userId, st, env);
    }
  } catch (e) {
    console.error("handleVisionFlow error:", e);
    t.stop = true;
    await tgSendMessage(env, chatId, "⚠️ فعلاً امکان تحلیل تصویر نیست. لطفاً بعداً دوباره تلاش کن.", mainMenuKeyboard(env));
  }
}

 


async function renderQuickChartPng(env, candles, symbol, tf, levels = [], qcSpec = null) {
  const chartUrl = buildQuickChartCandlestickUrl(candles, symbol, tf, levels, qcSpec);
  const r = await fetch(chartUrl, { cf: { cacheTtl: 5, cacheEverything: true } });
  if (!r.ok) throw new Error(`quickchart_fetch_failed_${r.status}`);
  return await r.arrayBuffer();
}

function buildLevelsOnlySvg(symbol, timeframe, levels = []) {
  const clean = (Array.isArray(levels) ? levels : []).filter((x) => Number.isFinite(Number(x))).map(Number).slice(0, 8);
  const rows = clean.length ? clean : [0, 1, 2];
  const width = 1200;
  const height = 700;
  const pad = 70;
  const innerH = height - pad * 2;
  const sorted = [...rows].sort((a, b) => b - a);
  const max = Math.max(...sorted, 1);
  const min = Math.min(...sorted, 0);
  const den = Math.max(1e-9, max - min);
  const yFor = (p) => pad + ((max - p) / den) * innerH;
  const lines = sorted.map((p, i) => {
    const y = yFor(p);
    const c = i % 2 === 0 ? "#2FE3A5" : "#FFB020";
    return `<line x1="${pad}" y1="${y}" x2="${width-pad}" y2="${y}" stroke="${c}" stroke-width="2" stroke-dasharray="6 6"/><text x="${width-pad-8}" y="${y-6}" fill="${c}" font-size="22" text-anchor="end">${p}</text>`;
  }).join(String.fromCharCode(10));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#0B0F17"/>
  <text x="${pad}" y="42" fill="#E6F0FF" font-size="30" font-family="Arial">${escapeXml(symbol)} - ${escapeXml(timeframe)} (Internal Fallback)</text>
  <rect x="${pad}" y="${pad}" width="${width-pad*2}" height="${innerH}" rx="14" fill="#101827" stroke="#223047"/>
  ${lines}
</svg>`;
}

function extractLevels(text) {
  const src = String(text || "");
  const lines = src.split(/\r?\n/);
  const weighted = [];
  const plain = [];

  const scoreLine = (ln) => {
    const l = ln.toLowerCase();
    let score = 0;
    if (/زون|zone|support|resistance|sr|flip|entry|tp|sl|target/.test(l)) score += 4;
    if (/\d/.test(l)) score += 1;
    return score;
  };

  for (const ln of lines) {
    const nums = (ln.match(/\b\d{1,6}(?:\.\d{1,8})?\b/g) || [])
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!nums.length) continue;
    const sc = scoreLine(ln);
    for (const n of nums) {
      if (sc >= 4) weighted.push(n);
      else plain.push(n);
    }
  }

  const all = [...weighted, ...plain]
    .filter((n) => Number.isFinite(n))
    .filter((n) => n >= 0.00001 && n <= 1_000_000)
    .sort((a, b) => a - b);

  const dedup = [];
  for (const n of all) {
    const prev = dedup[dedup.length - 1];
    if (prev == null || Math.abs(prev - n) > Math.max(1e-6, Math.abs(prev) * 0.0005)) {
      dedup.push(Number(n.toFixed(6)));
    }
  }
  return dedup.slice(0, 8);
}

function extractQcJsonAndStrip(text) {
  const src = String(text || "");
  const re = /<QCJSON>\s*([\s\S]*?)\s*<\/QCJSON>/i;
  const m = src.match(re);
  if (!m) return { cleaned: src.trim(), qc: null };

  const raw = String(m[1] || "").trim();
  let qc = null;
  try {
    qc = JSON.parse(raw);
  } catch {
    qc = null;
  }

  const cleaned = src.replace(re, "").replace(/\n{3,}/g, "\n\n").trim();
  return { cleaned, qc };
}

function normalizeQcSpec(qc, levelsFallback = []) {
  const out = { zones: [], supports: [], resistances: [], tp: [], sl: 0 };
  if (!qc || typeof qc !== "object") {
    return { ...out, supports: levelsFallback, resistances: [], tp: [], sl: 0 };
  }
  const numArr = (a) => (Array.isArray(a) ? a.map(Number).filter((n) => Number.isFinite(n) && n > 0) : []);
  out.supports = numArr(qc.supports || qc.support || qc.s);
  out.resistances = numArr(qc.resistances || qc.resistance || qc.r);
  out.tp = numArr(qc.tp || qc.targets || qc.takeProfit);
  out.sl = Number(qc.sl || qc.stopLoss || 0);
  if (!Number.isFinite(out.sl)) out.sl = 0;

  const zones = Array.isArray(qc.zones) ? qc.zones : [];
  out.zones = zones.map((z) => ({
    low: Number(z?.low),
    high: Number(z?.high),
    label: String(z?.label || "").slice(0, 24),
    kind: String(z?.kind || z?.type || "").toLowerCase(),
  })).filter((z) => Number.isFinite(z.low) && Number.isFinite(z.high) && z.low > 0 && z.high > 0 && z.high !== z.low)
    .map((z) => ({ ...z, low: Math.min(z.low, z.high), high: Math.max(z.low, z.high) }))
    .slice(0, 6);

  
  const fallback = numArr(levelsFallback);
  if (!out.supports.length && !out.resistances.length) out.supports = fallback.slice(0, 6);
  return out;
}


function extractLevelsFromCandles(candles) {
  if (!Array.isArray(candles) || !candles.length) return [];
  const tail = candles.slice(-60);
  const highs = tail.map((x) => Number(x?.h)).filter((n) => Number.isFinite(n));
  const lows = tail.map((x) => Number(x?.l)).filter((n) => Number.isFinite(n));
  if (!highs.length || !lows.length) return [];
  const hi = Math.max(...highs);
  const lo = Math.min(...lows);
  const mid = (hi + lo) / 2;
  const q1 = lo + (hi - lo) * 0.25;
  const q3 = lo + (hi - lo) * 0.75;
  return [lo, q1, mid, q3, hi].map((n) => Number(n.toFixed(6)));
}

function buildZonesSvgFromAnalysis(analysisText, symbol, timeframe, spotPrice = 0) {
  const levels = extractLevels(analysisText);
  const W = 900, H = 520;
  const pad = 60;

  const plotX = pad + 30;
  const plotY = pad + 30;
  const plotW = W - 2 * pad - 60;
  const plotH = H - 2 * pad - 80;

  const sp = Number(spotPrice || 0);
  const fmt = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    const a = Math.abs(n);
    const d = a < 10 ? 5 : (a < 1000 ? 2 : 0);
    const s = n.toFixed(d);
    return s.replace(/\.?0+$/, "");
  };

  const bg = `
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0B0F17"/>
        <stop offset="100%" stop-color="#090D14"/>
      </linearGradient>
      <linearGradient id="a" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#6D5EF6" stop-opacity="0.65"/>
        <stop offset="100%" stop-color="#00D1FF" stop-opacity="0.35"/>
      </linearGradient>
      <style>
        .t{ font: 700 20px ui-sans-serif,system-ui; fill:#ffffff; }
        .s{ font: 500 14px ui-sans-serif,system-ui; fill:rgba(255,255,255,.75); }
        .grid{ stroke: rgba(255,255,255,.08); stroke-width: 1; }
        .l{ stroke: rgba(255,255,255,.22); stroke-width: 2; }
        .z{ fill:url(#a); opacity:0.16; }
        .p{ font: 700 13px ui-monospace,monospace; fill: rgba(255,255,255,.92); }
        .now{ stroke: rgba(247,201,72,.95); stroke-width: 2.4; stroke-dasharray: 5 4; }
        .nowt{ font: 800 13px ui-monospace,monospace; fill: rgba(247,201,72,.95); }
      </style>
    </defs>
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#g)"/>
    <rect x="${pad}" y="${pad}" width="${W-2*pad}" height="${H-2*pad}" rx="24" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.10)"/>
  `;

  const header = `
    <text class="t" x="${pad}" y="${pad-18}">MarketiQ • Zones</text>
    <text class="s" x="${pad}" y="${pad-0}">${escapeXml(symbol)} — ${escapeXml(timeframe)} — (auto)</text>
  `;

  // Determine range from levels + spotPrice (if present)
  const pts = (Array.isArray(levels) ? levels : []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (Number.isFinite(sp) && sp > 0) pts.push(sp);

  if (pts.length < 2) {
    const msg = pts.length === 1
      ? `Only one level found: ${fmt(pts[0])}`
      : `Level یافت نشد. برای رندر بهتر، خروجی مدل باید شامل چند عدد سطح باشد.`;
    const body = `<text class="s" x="${plotX}" y="${plotY+30}">${escapeXml(msg)}</text>`;
    const footer = `<text class="s" x="${pad}" y="${H-18}">Generated by MarketiQ (SVG) — Educational use only</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${bg}${header}${body}${footer}</svg>`;
  }

  let min = Math.min(...pts);
  let max = Math.max(...pts);
  const baseRange = Math.max(1e-9, max - min);
  const extra = Math.max(baseRange * 0.08, Math.abs(max) * 0.002);
  min -= extra;
  max += extra;

  const toY = (v) => plotY + plotH - ((Number(v) - min) / (max - min || 1)) * plotH;

  // Soft grid lines
  let grid = "";
  for (let i = 0; i <= 4; i++) {
    const y = plotY + (plotH * i) / 4;
    grid += `<line class="grid" x1="${plotX}" y1="${y}" x2="${plotX+plotW}" y2="${y}"/>`;
  }

  // Boxes between adjacent levels (zones)
  let zones = "";
  const lv = pts.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  const uniq = [];
  for (const n of lv) {
    const prev = uniq[uniq.length - 1];
    if (prev == null || Math.abs(prev - n) > Math.max(1e-6, Math.abs(prev) * 0.0005)) uniq.push(n);
  }
  for (let i = 0; i < Math.min(uniq.length - 1, 7); i++) {
    const y1 = toY(uniq[i]);
    const y2 = toY(uniq[i + 1]);
    const top = Math.min(y1, y2);
    const h = Math.abs(y2 - y1);
    if (h >= 6) zones += `<rect class="z" x="${plotX}" y="${top}" width="${plotW}" height="${h}" rx="14"/>`;
  }

  // Lines + labels for each level
  let lines = "";
  const colors = ["rgba(0,209,255,.85)", "rgba(255,138,101,.85)", "rgba(47,227,165,.85)", "rgba(247,201,72,.85)"];
  for (let i = 0; i < Math.min(uniq.length, 8); i++) {
    const v = uniq[i];
    const y = toY(v);
    const c = colors[i % colors.length];
    lines += `<line class="l" x1="${plotX}" y1="${y}" x2="${plotX+plotW}" y2="${y}" stroke="${c}"/>`;
    lines += `<text class="p" x="${plotX+plotW+10}" y="${y+5}" fill="${c}">${fmt(v)}</text>`;
  }

  // Spot price line (NOW)
  let now = "";
  if (Number.isFinite(sp) && sp > 0) {
    const y = toY(sp);
    now += `<line class="now" x1="${plotX}" y1="${y}" x2="${plotX+plotW}" y2="${y}"/>`;
    now += `<text class="nowt" x="${plotX+plotW+10}" y="${y-8}">NOW</text>`;
    now += `<text class="nowt" x="${plotX+plotW+10}" y="${y+10}">${fmt(sp)}</text>`;
  }

  const footer = `
    <text class="s" x="${pad}" y="${H-18}">Generated by MarketiQ (SVG) — Educational use only</text>
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${bg}${header}${grid}${zones}${lines}${now}${footer}</svg>`;
}


function escapeXml(s) {
  return String(s || "")
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;")
    .split("'").join("&apos;");
}
function escapeHtml(s) {
  return String(s || "")
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;");
}

 

function detectLang(request, url){
  try{
    const qp = String(url.searchParams.get("lang") || "").toLowerCase();
    if (qp === "fa" || qp === "en") return qp;
  } catch {}
  try{
    const cookie = String(request.headers.get("cookie") || "");
    const m = cookie.match(/(?:^|;\s*)lang=(fa|en)\b/i);
    if (m) return String(m[1] || "").toLowerCase();
  } catch {}
  const al = String(request.headers.get("accept-language") || "").toLowerCase();
  if (al.includes("fa") || al.includes("ir") || al.includes("persian")) return "fa";
  return "en";
}

function injectLangHtml(html, lang){
  const l = (lang === "en") ? "en" : "fa";
  const dir = (l === "en") ? "ltr" : "rtl";
  let out = String(html || "");
  out = out.replace(/<html\s+lang="[^"]*"\s+dir="[^"]*">/i, `<html lang="${l}" dir="${dir}">`);
  // set lang cookie + expose to JS
  if (!out.includes("window.__LANG__")) {
    out = out.replace(/<head>/i, `<head>\n<script>window.__LANG__=${JSON.stringify(l)};try{localStorage.setItem("iq_lang",${JSON.stringify(l)});}catch{}</script>`);
  }
  return out;
}

function renderHomeHtml({ origin, lang, isMobileUA }){
  const l = (lang === "en") ? "en" : "fa";
  const dir = (l === "en") ? "ltr" : "rtl";
  return HOME_HTML
    .replaceAll("__LANG__", l)
    .replaceAll("__DIR__", dir);
}

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function decodeWebAsset(s){
  // WEB_APP_* templates are stored with escaped quotes/backticks to avoid breaking the Worker source.
  // Decode them before sending to the browser.
  return String(s ?? "")
    .replace(/\\`/g, "`")
    .replace(/\\\$\{/g, "${")
    .replace(/\\"/g, '"');
}

function jsResponse(js, status = 200) {
  return new Response(js, {
    status,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

function pathEndsWith(pathname, suffix) {
  const p = String(pathname || "");
  const s = String(suffix || "");
  return p === s || p.endsWith(s);
}
function pathIncludes(pathname, needle) {
  const p = String(pathname || "");
  const n = String(needle || "");
  return !!n && p.includes(n);
}


function miniappGuestEnabled(env) {
  const v = String(env.MINIAPP_GUEST_READONLY || "1").trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "no");
}

async function buildMiniappGuestPayload(env, authReason = "") {
  const st = defaultUser("guest");
  const symbols = [...MAJORS, ...METALS, ...INDICES, ...CRYPTOS];
  const styles = await getStyleList(env);
  return {
    ok: true,
    guest: true,
    authReason: String(authReason || ""),
    welcome: await getMiniappWelcomeText(env),
    state: st,
    quota: "guest",
    symbols,
    styles,
    offerBanner: await getOfferBanner(env),
    customPrompts: await getCustomPrompts(env),
    role: "user",
    isStaff: false,
    wallet: "",
  };
}

async function issueMiniappToken(env, userId, fromLike = {}) {
  if (!env.BOT_KV) return "";
  const raw = crypto.getRandomValues(new Uint8Array(24));
  const token = Array.from(raw).map((b) => b.toString(16).padStart(2, "0")).join("");
  const payload = {
    userId: String(userId || ""),
    username: String(fromLike?.username || ""),
    createdAt: Date.now(),
  };
  await env.BOT_KV.put(`miniapp_token:${token}`, JSON.stringify(payload), { expirationTtl: Math.max(300, Number(env.MINIAPP_TOKEN_TTL_SEC || 86400)) });
  return token;
}

async function verifyMiniappToken(token, env) {
  if (!env.BOT_KV || !token) return { ok: false, reason: "token_missing" };
  const raw = await env.BOT_KV.get(`miniapp_token:${String(token).trim()}`);
  if (!raw) return { ok: false, reason: "token_invalid" };
  try {
    const j = JSON.parse(raw);
    const userId = String(j?.userId || "").trim();
    if (!userId) return { ok: false, reason: "token_user_missing" };
    return { ok: true, userId, fromLike: { username: String(j?.username || "") }, via: "mini_token" };
  } catch {
    return { ok: false, reason: "token_bad_json" };
  }
}

async function verifyMiniappAuth(body, env) {
  try {
  
  const webToken = String(body?.webToken || "").trim();
  if (webToken) {
    const ownerTok = String(env.WEB_OWNER_TOKEN || "").trim();
    const adminTok = String(env.WEB_ADMIN_TOKEN || "").trim();
    if (ownerTok && timingSafeEqual(webToken, ownerTok)) {
      const username = firstHandleFromCsv(env.OWNER_HANDLES) || "owner";
      return { ok: true, userId: 999000001, fromLike: { username, roleHint: "owner" }, roleHint: "owner", via: "web_owner_token" };
    }
    if (adminTok && timingSafeEqual(webToken, adminTok)) {
      const username = firstHandleFromCsv(env.ADMIN_HANDLES) || firstHandleFromCsv(env.OWNER_HANDLES) || "admin";
      return { ok: true, userId: 999000002, fromLike: { username, roleHint: "admin" }, roleHint: "admin", via: "web_admin_token" };
    }
  }

  
  const initData = body?.initData || body?.tgWebAppData || body?.tgwebappdata;
  const v = await verifyTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN, env.INITDATA_MAX_AGE_SEC, env.MINIAPP_AUTH_LENIENT);
  if (v.ok) return v;

  
  const token = String(body?.miniToken || "").trim();
  if (!token) return v;
  const tv = await verifyMiniappToken(token, env);
  if (tv.ok) return tv;
  return v;

  } catch (e) {
    console.error("verifyMiniappAuth failed:", e?.message || e);
    return { ok: false, reason: "auth_error" };
  }
}


 
async function verifyTelegramInitData(initData, botToken, maxAgeSecRaw, lenientRaw) {
  if (!initData || typeof initData !== "string") return { ok: false, reason: "initData_missing" };
  const lenient = String(lenientRaw || "").trim() === "1" || String(lenientRaw || "").toLowerCase() === "true";
  const initRaw = String(initData || "").trim();
  if (lenient && initRaw.startsWith("dev:")) {
    const devId = Number(initRaw.split(":")[1] || "0") || 999001;
    return { ok: true, userId: devId, fromLike: { username: "dev_user" } };
  }
  if (!botToken && !lenient) return { ok: false, reason: "bot_token_missing" };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash && !lenient) return { ok: false, reason: "hash_missing" };
  params.delete("hash");

  const authDate = Number(params.get("auth_date") || "0");
  if ((!Number.isFinite(authDate) || authDate <= 0) && !lenient) return { ok: false, reason: "auth_date_invalid" };
  const now = Math.floor(Date.now() / 1000);
  const maxAgeSec = Math.max(60, Number(maxAgeSecRaw || 0) || (7 * 24 * 60 * 60));
  if (Number.isFinite(authDate) && authDate > 0 && (now - authDate > maxAgeSec) && !lenient) return { ok: false, reason: "initData_expired" };

  const pairs = [];
  params.forEach((v, k) => pairs.push([k, v]));
  pairs.sort((a, b) => a[0].localeCompare(b[0]));
  const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join(String.fromCharCode(10));

  const secretKey = await hmacSha256Raw(utf8("WebAppData"), utf8(botToken));
  const sigHex = await hmacSha256Hex(secretKey, utf8(dataCheckString));

  if (hash && !timingSafeEqualHex(sigHex, hash) && !lenient) return { ok: false, reason: "hash_mismatch" };

  const user = safeJsonParse(params.get("user") || "") || {};
  const userId = user?.id || Number(params.get("user_id") || "0");
  if (!userId) return { ok: false, reason: "user_missing" };

  const fromLike = { username: user?.username || "", first_name: user?.first_name || "", last_name: user?.last_name || "", language_code: user?.language_code || "" };
  const startParam = String(params.get("start_param") || "").trim();
  return { ok: true, userId, fromLike, startParam };
}

function safeJsonParse(s) { try { return JSON.parse(s); } catch { return null; } }
function utf8(s) { return new TextEncoder().encode(String(s)); }

async function hmacSha256Raw(keyBytes, msgBytes) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, msgBytes);
  return new Uint8Array(sig);
}
async function hmacSha256Hex(keyBytes, msgBytes) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, msgBytes);
  return toHex(new Uint8Array(sig));
}
function toHex(u8) { let out=""; for (const b of u8) out += b.toString(16).padStart(2,"0"); return out; }
function timingSafeEqual(a, b) {
  a = String(a || "");
  b = String(b || "");
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}


function isWebDebug(request, env) {
  const h = request?.headers?.get?.("x-iqm-debug");
  if (h === "1" || h === "true") return true;
  if (String(env?.WEB_DISABLE_RL || "") === "1") return true;
  return false;
}

async function kvRateLimit(env, key, windowSec) {
  const kv = env.BOT_KV;
  if (!kv) return true;
  const now = Date.now();
  const raw = await kv.get(key);
  if (raw) {
    try {
      const rec = JSON.parse(raw);
      if (rec && rec.ts && (now - rec.ts) < windowSec * 1000) return false;
    } catch {}
  }
  // Cloudflare KV requires expirationTtl >= 60 seconds
  await kv.put(key, JSON.stringify({ ts: now }), { expirationTtl: 60 });
  return true;
}

function timingSafeEqualHex(a, b) {
  a = String(a || "").toLowerCase();
  b = String(b || "").toLowerCase();
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

 
const MINI_APP_HTML = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>MarketiQ Mini App</title>
  <meta name="color-scheme" content="dark light" />
  <style>
    :root{
      --bg: #0B0F17;
      --card: rgba(255,255,255,.06);
      --text: rgba(255,255,255,.92);
      --muted: rgba(255,255,255,.62);
      --good:#2FE3A5;
      --warn:#FFB020;
      --bad:#FF4D4D;
      --shadow: 0 10px 30px rgba(0,0,0,.35);
      --radius: 18px;
      --font: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans";
    }
    *{ box-sizing:border-box; }
    body{
      margin:0;
      font-family: var(--font);
      color: var(--text);
      background:
        radial-gradient(900px 500px at 25% -10%, rgba(109,94,246,.35), transparent 60%),
        radial-gradient(800px 500px at 90% 0%, rgba(0,209,255,.20), transparent 60%),
        linear-gradient(180deg, #070A10 0%, #0B0F17 60%, #090D14 100%);
      padding: 12px 12px calc(14px + env(safe-area-inset-bottom));
    }
    .shell{ max-width: 760px; margin: 0 auto; }
    .topbar{
      position: sticky; top: 0; z-index: 50;
      backdrop-filter: blur(10px);
      background: rgba(11,15,23,.65);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 20px;
      padding: 12px;
      box-shadow: var(--shadow);
      display:flex; align-items:center; justify-content:space-between;
      gap: 10px;
      margin-bottom: 12px;
    }
    .brand{ display:flex; align-items:center; gap:10px; min-width: 0; }
    .logo{
      width: 38px; height: 38px; border-radius: 14px;
      background: linear-gradient(135deg, rgba(109,94,246,1), rgba(0,209,255,1));
      box-shadow: 0 10px 22px rgba(109,94,246,.25);
      display:flex; align-items:center; justify-content:center;
      font-weight: 900;
    }
    .titlewrap{ min-width: 0; }
    .title{ font-size: 15px; font-weight: 900; white-space: nowrap; overflow:hidden; text-overflow: ellipsis; }
    .subtitle{ font-size: 12px; color: var(--muted); white-space: nowrap; overflow:hidden; text-overflow: ellipsis; }
    .pill{
      display:inline-flex; align-items:center; gap:7px;
      padding: 9px 10px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.10);
      background: rgba(255,255,255,.06);
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
    }
    .dot{ width: 8px; height: 8px; border-radius: 99px; background: var(--good); box-shadow: 0 0 0 3px rgba(47,227,165,.12); }
    .grid{ display:grid; grid-template-columns: 1fr; gap: 12px; }
    .card{
      background: var(--card);
      border: 1px solid rgba(255,255,255,.10);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      overflow:hidden;
    }
    .card-h{
      padding: 12px 14px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      border-bottom: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.03);
    }
    .card-h strong{ font-size: 13px; }
    .card-h span{ font-size: 12px; color: var(--muted); }
    .card-b{ padding: 14px; }
    .row{ display:flex; gap:10px; flex-wrap: wrap; align-items:center; }
    .field{ display:flex; flex-direction: column; gap:8px; min-width: 140px; flex:1; }
    .label{ font-size: 12px; color: var(--muted); }
    .control{
      width:100%;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.06);
      color: var(--text);
      padding: 12px 12px;
      font-size: 14px;
      outline:none;
    }
    .chips{ display:flex; gap:8px; flex-wrap: wrap; }
    .chip{
      border:1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.06);
      color: var(--muted);
      padding: 9px 12px;
      border-radius: 999px;
      font-size: 13px;
      cursor:pointer;
      user-select:none;
    }
    .chip.on{
      color: rgba(255,255,255,.92);
      border-color: rgba(109,94,246,.55);
      background: rgba(109,94,246,.16);
      box-shadow: 0 8px 20px rgba(109,94,246,.15);
    }
    .actions{ display:flex; gap:10px; flex-wrap:wrap; }
    .btn{
      border: 1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.06);
      color: var(--text);
      padding: 12px 12px;
      border-radius: 16px;
      font-size: 14px;
      cursor:pointer;
      display:inline-flex; align-items:center; justify-content:center; gap:8px;
      min-width: 120px;
      flex: 1;
    }
    .btn.primary{
      border-color: rgba(109,94,246,.65);
      background: linear-gradient(135deg, rgba(109,94,246,.92), rgba(0,209,255,.55));
      box-shadow: 0 12px 30px rgba(109,94,246,.20);
      font-weight: 900;
    }
    .btn.ghost{ color: var(--muted); }
    .out{
      padding: 14px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace;
      font-size: 13px;
      line-height: 1.75;
      white-space: pre-wrap;
      background: rgba(0,0,0,.20);
      border-top: 1px solid rgba(255,255,255,.08);
      min-height: 240px;
    }
    .toast{
      position: fixed;
      left: 12px; right: 12px;
      bottom: calc(12px + env(safe-area-inset-bottom));
      max-width: 760px;
      margin: 0 auto;
      background: rgba(20,25,36,.92);
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 16px;
      padding: 12px 12px;
      box-shadow: var(--shadow);
      display:none;
      gap: 10px;
      align-items: center;
      z-index: 100;
    }
    .toast.show{ display:flex; }
    .toast .t{ font-size: 13px; color: var(--text); }
    .toast .s{ font-size: 12px; color: var(--muted); }
    .toast .badge{
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 12px;
      border: 1px solid rgba(255,255,255,.10);
      background: rgba(255,255,255,.06);
      color: var(--muted);
      white-space: nowrap;
    }
    .spin{
      width: 16px; height: 16px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,.25);
      border-top-color: rgba(255,255,255,.85);
      animation: spin .8s linear infinite;
    }
    @keyframes spin{ to { transform: rotate(360deg); } }
    .muted{ color: var(--muted); }
    .offer{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 12px;
      padding: 16px;
      border-radius: 20px;
      background: linear-gradient(135deg, rgba(109,94,246,.24), rgba(0,209,255,.12));
      border: 1px solid rgba(109,94,246,.35);
    }
    .offer h3{ margin:0; font-size: 15px; }
    .offer p{ margin:6px 0 0; font-size: 12px; color: var(--muted); }
    .offer-media{ margin-top:10px; border-radius:14px; overflow:hidden; border:1px solid rgba(255,255,255,.12); display:none; }
    .offer-media.show{ display:block; }
    .offer-media img{ display:block; width:100%; max-height:160px; object-fit:cover; }
    .offer .tag{
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 12px;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(255,255,255,.08);
    }
    .offer .offer-media{ width:72px; height:72px; border-radius:14px; object-fit:cover; border:1px solid rgba(255,255,255,.2); display:none; }
    .tabs{ display:flex; gap:8px; overflow:auto; margin: 10px 0 14px; }
    .tab-btn{ border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.04); color:var(--muted); border-radius:999px; padding:8px 12px; font-size:12px; cursor:pointer; white-space:nowrap; }
    .tab-btn.active{ background: linear-gradient(135deg, rgba(109,94,246,.85), rgba(0,209,255,.35)); color:#fff; border-color: rgba(109,94,246,.7); }
    .tab-section{ display:none; }
    .tab-section.active{ display:block; }
    .admin-card{ display:none; }
    .admin-card.show{ display:block; }
    .owner-hide.hidden{ display:none; }
    .admin-grid{ display:grid; gap: 10px; }
    .admin-tab.hidden{ display:none !important; }
    .admin-row{ display:flex; gap:8px; flex-wrap:wrap; }
    .admin-row .control{ flex:1; min-width: 140px; }
    .toggle{ display:flex; align-items:center; gap:8px; padding: 8px 10px; border: 1px solid rgba(255,255,255,.12); border-radius: 12px; }
    .toggle input{ width:18px; height:18px; }
    textarea.control{ min-height: 120px; resize: vertical; }
    .mini-list{ font-size: 12px; color: var(--muted); white-space: pre-wrap; }
    .quote-grid{ display:grid; grid-template-columns: repeat(auto-fit,minmax(160px,1fr)); gap:10px; }
    .quote-item{ border:1px solid rgba(255,255,255,.12); border-radius:14px; padding:10px; background:rgba(255,255,255,.04); }
    .quote-item .k{ font-size:11px; color:var(--muted); }
    .quote-item .v{ font-size:16px; font-weight:800; margin-top:4px; }
    .q-up{ color: var(--good); }
    .q-down{ color: var(--bad); }
    .q-flat{ color: var(--warn); }
    .tabs{ display:flex; gap:8px; overflow:auto; padding-bottom:4px; margin-bottom:10px; }
    .tab-btn{ border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.06); color:var(--text); border-radius:999px; padding:8px 12px; font-size:12px; cursor:pointer; white-space:nowrap; }
    .tab-btn.active{ background:linear-gradient(135deg,var(--primary),var(--accent)); border-color:transparent; color:#fff; }
    .tab-panel{ display:none; }
    .tab-panel.active{ display:block; }
    .energy{ display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:12px; color:var(--muted); margin-top:8px; }
    .energy-bar{ height:8px; width:100%; border-radius:999px; background:rgba(255,255,255,.08); overflow:hidden; }
    .energy-fill{ height:100%; width:0%; background:linear-gradient(90deg,var(--accent),var(--primary)); transition:width .25s ease; }
    .offer-media{ margin-top:10px; border-radius:16px; overflow:hidden; border:1px solid rgba(255,255,255,.12); display:none; }
    .offer-media.show{ display:block; }
    .offer-media img{ width:100%; display:block; }
  
        .progressWrap{display:none;margin:10px 0 12px;padding:10px 12px;border:1px solid rgba(148,163,184,.18);border-radius:14px;background:rgba(15,23,42,.45)}
        .progressHead{display:flex;justify-content:space-between;gap:10px;margin-bottom:8px;font-size:12px;color:rgba(230,237,245,.92)}
        .progressBar{height:10px;border-radius:999px;background:rgba(148,163,184,.12);overflow:hidden}
        .progressFill{height:100%;width:0%;border-radius:999px;background:linear-gradient(90deg, rgba(52,211,153,.95), rgba(96,165,250,.95));transition:width .25s ease}

</style>
</head>
<body>
  <div class="shell">
    <div class="topbar">
      <div class="brand">
        <div class="logo">MQ</div>
        <div class="titlewrap">
          <div class="title">MarketiQ Mini App</div>
          <div class="subtitle" id="sub">اتصال…</div>
        </div>
      </div>
      <div class="pill"><span class="dot"></span><span id="pillTxt">Online</span></div>
    </div>

    <div class="tabs" id="mainTabs">
      <button class="tab-btn active" data-tab="dashboard">داشبورد</button>
      <button class="tab-btn" data-tab="analysis">تحلیل</button>
      <button class="tab-btn" data-tab="news">اخبار</button>
      <button class="tab-btn" data-tab="support">پشتیبانی</button>
      <button class="tab-btn" data-tab="subscription">💎 اشتراک</button>
      <button class="tab-btn" data-tab="admin">پنل مدیریت</button>
      <button class="tab-btn" data-tab="owner">پنل اونر</button>
    </div>

    <div class="grid">
      <div class="card tab-section active" data-tab-section="dashboard">
        <div class="card-b offer" id="offerCard">
          <div>
            <h3>🎁 پیشنهاد ویژه</h3>
            <p id="offerText">فعال‌سازی اشتراک ویژه با تخفیف محدود.</p>
            <div class="offer-media" id="offerMedia"><img id="offerImg" alt="offer" /></div>
          </div>
          <img id="offerImage" class="offer-media" alt="offer" />
          <div class="tag" id="offerTag">Special</div>
          <div class="offer-media" id="offerMedia"><img id="offerImg" alt="offer" /></div>
        </div>
      </div>
      <div class="card tab-section active" id="quoteCard" data-tab-section="dashboard">
        <div class="card-h">
          <strong>داشبورد قیمت لحظه‌ای</strong>
          <span id="quoteStamp">—</span>
        </div>
        <div class="card-b">
          <div id="tvQuoteWidget" style="min-height:120px; border-radius:16px; overflow:hidden; background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.08);"></div>
          <div class="quote-grid" style="display:none">
            <div class="quote-item"><div class="k">نماد</div><div class="v" id="quoteSymbol">—</div></div>
            <div class="quote-item"><div class="k">قیمت</div><div class="v" id="quotePrice">—</div></div>
            <div class="quote-item"><div class="k">تغییر</div><div class="v" id="quoteChange">—</div></div>
            <div class="quote-item"><div class="k">روند</div><div class="v" id="quoteTrend">—</div></div>
          </div>
          <div class="muted" style="font-size:12px; margin-top:8px;" id="quoteMeta">در حال دریافت داده…</div>
        </div>
      </div>

      
      <div class="card tab-section active" id="liveChartCard" data-tab-section="dashboard">
        <div class="card-h">
          <strong>📈 چارت لحظه‌ای</strong>
          <button id="refreshLiveChartBtn" class="btn ghost" style="min-width:unset; padding:6px 10px;">بروزرسانی</button>
        </div>
        <div class="card-b">
          <div class="row">
            <div class="field" style="flex:1;">
              <div class="label">نماد</div>
              <select id="dashSymbol" class="control"></select>
            </div>
          </div>

          <div class="label" style="margin-top:10px;">تایم‌فریم</div>
          <div class="chips" id="dashTfChips" style="margin-top:8px;">
            <div class="chip" data-tf="M15">M15</div>
            <div class="chip" data-tf="H1">H1</div>
            <div class="chip on" data-tf="H4">H4</div>
            <div class="chip" data-tf="D1">D1</div>
          </div>
          <select id="dashTimeframe" class="control" style="display:none;">
            <option value="H4" selected>H4</option>
            <option value="M15">M15</option>
            <option value="H1">H1</option>
            <option value="D1">D1</option>
          </select>

          <div class="muted" id="liveChartMeta" style="margin-top:10px; font-size:12px;">—</div>
          <div id="liveChartBox" style="height:320px; width:100%; margin-top:10px; border-radius:18px; overflow:hidden; background:rgba(255,255,255,.02);"></div>
          <div class="muted" id="liveChartHint" style="margin-top:8px; font-size:12px; line-height:1.6;">—</div>
        </div>
      </div>

<div class="card tab-section" id="newsCard" data-tab-section="news">
        <div class="card-h">
          <strong>📰 اخبار فارسی نماد</strong>
          <button id="refreshNews" class="btn ghost" style="min-width:unset; padding:6px 10px;">بروزرسانی</button>
        </div>
        <div class="card-b">
          <div class="row">
            <div class="field" style="flex:1;">
              <div class="label">نماد اخبار</div>
              <select id="newsSymbol" class="control"></select>
            </div>
          </div>


          <div class="mini-list" id="newsList">در حال دریافت خبر…</div>
          <div class="muted" style="margin-top:10px; font-size:12px;">تحلیل خبری:</div>
          <div class="mini-list" id="newsAnalysis">در حال تولید تحلیل خبری…</div>
        </div>
      </div>
      
      <div class="card tab-section" id="subscriptionCard" data-tab-section="subscription">
        <div class="card-h">
          <strong>💎 اشتراک و پرداخت</strong>
          <span id="subMeta">—</span>
        </div>
        <div class="card-b">
          <div class="row" style="gap:10px; flex-wrap:wrap;">
            <div class="kv">
              <div class="k">وضعیت</div>
              <div class="v" id="subStatusText">—</div>
            </div>
            <div class="kv">
              <div class="k">امتیاز</div>
              <div class="v" id="pointsText">—</div>
            </div>
            <div class="kv">
              <div class="k">تحلیل باقی‌مانده (Free)</div>
              <div class="v" id="freeAnalysesLeft">—</div>
            </div>
          </div>

          <div class="muted" style="font-size:12px; line-height:1.9; margin-top:8px;">
            پلن <b>Free</b> بر اساس امتیاز است. هر تحلیل <b>۲ امتیاز</b> کم می‌کند.
          </div>

          <div style="height:10px;"></div>

          <div class="row" style="gap:10px; align-items:center;">
            <select id="subPlanSelect" class="control" style="flex:1;"></select>
          </div>

          <div style="height:8px;"></div>

          <div class="row" style="gap:10px; align-items:center;">
            <input id="subWallet" class="control" style="flex:1;" readonly />
            <button id="copySubWallet" class="btn ghost" type="button">کپی آدرس</button>
          </div>

          <div style="height:8px;"></div>

          <div class="row" style="gap:10px; align-items:center;">
            <input id="subTxHash" class="control" style="flex:1;" placeholder="TxHash تراکنش (BEP20) مثل 0x..." />
            <button id="submitSubPurchase" class="btn primary" type="button">ثبت و بررسی</button>
          </div>

          <div class="muted" id="subMsg" style="font-size:12px; line-height:1.9; margin-top:8px;"></div>
        </div>
      </div>

      <div class="card tab-section" id="analysisCard" data-tab-section="analysis">
        <div class="card-h">
          <strong>تحلیل سریع</strong>
          <span id="meta">—</span>
        </div>
        <div class="card-b">
          <div class="row">
            <div class="field" style="flex:1.4">
              <div class="label">جستجوی نماد</div>
              <input id="q" class="control" placeholder="مثلاً BTC یا EUR یا XAU…" />
            </div>
            <div class="field" style="flex:1">
              <div class="label">نماد</div>
              <select id="symbol" class="control"></select>
            </div>
          </div>

          <div style="height:10px"></div>

          <div class="row">
            <div class="field">
              <div class="label">تایم‌فریم</div>
              <div class="chips" id="tfChips">
                <div class="chip" data-tf="M15">M15</div>
                <div class="chip" data-tf="H1">H1</div>
                <div class="chip on" data-tf="H4">H4</div>
                <div class="chip" data-tf="D1">D1</div>
              </div>
              <select id="timeframe" class="control" style="display:none">
                <option value="M15">M15</option>
                <option value="H1">H1</option>
                <option value="H4" selected>H4</option>
                <option value="D1">D1</option>
              </select>
            </div>
            <div class="field">
              <div class="label">سبک</div>
              <select id="style" class="control"></select>
            </div>
            <div class="field">
              <div class="label">پرامپت اختصاصی</div>
              <select id="customPrompt" class="control"></select>
            </div>
            <div class="field">
              <div class="label">ریسک</div>
              <select id="risk" class="control">
                <option value="کم">کم</option>
                <option value="متوسط" selected>متوسط</option>
                <option value="زیاد">زیاد</option>
              </select>
            </div>
            <div class="field">
              <div class="label">خبر</div>
              <select id="newsEnabled" class="control">
                <option value="true" selected>روشن ✅</option>
                <option value="false">خاموش ❌</option>
              </select>
            </div>
            <div class="field">
              <div class="label">حالت پرامپت</div>
              <select id="promptMode" class="control">
                <option value="style_plus_custom" selected>سبک + اختصاصی</option>
                <option value="style_only">فقط سبک</option>
                <option value="custom_only">فقط اختصاصی</option>
                <option value="combined_all">ترکیب همه سبک‌ها</option>
              </select>
            </div>
          </div>

          <div style="height:12px"></div>

          <div class="actions">
            <button id="save" class="btn">💾 ذخیره</button>
            <button id="analyze" class="btn primary">⚡ تحلیل</button>
            <button id="reconnect" class="btn ghost">🔄 اتصال مجدد</button>
            <button id="close" class="btn ghost">✖ بستن</button>
          </div>

          <div style="height:10px"></div>
          <div class="muted" style="font-size:12px; line-height:1.6;" id="welcome"></div>
          <div class="energy">
            <span id="energyText">انرژی: —</span>
            <span id="remainingText">تحلیل باقی‌مانده: —</span>
          </div>
          <div class="energy-bar"><div class="energy-fill" id="energyFill"></div></div>
        </div>

        <div class="progressWrap" id="jobProg" style="display:none;"><div class="progressHead"><span id="jobProgLabel">در صف…</span><span id="jobProgPct">0%</span></div><div class="progressBar"><div class="progressFill" id="jobProgFill"></div></div></div>

        <div class="out" id="out">آماده…</div>

        <div class="card" id="chartCard" style="display:none; margin-top:12px;">
          <div class="card-h">
            <strong>چارت</strong>
            <span class="muted" id="chartMeta">QuickChart</span>
          </div>
          <div class="card-b">
            <div id="tvAnalysisChart" style="height:420px; width:100%; border-radius:16px; overflow:hidden; background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.08);"></div>
            <div class="muted" style="margin-top:10px; font-size:12px;">زون‌ها (Levels):</div>
            <div class="mini-list" id="zonesList">—</div>
            <div class="actions" style="margin-top:10px;">
              <a id="openTvLink" class="btn ghost" target="_blank" rel="noopener noreferrer">باز کردن در TradingView</a>
            </div>
          </div>
        </div>
      </div>

      

      <div class="card tab-section" id="supportSection" data-tab-section="support">
        <div class="card-h">
          <strong>پشتیبانی</strong>
          <span class="muted">چت مستقیم با ادمین</span>
        </div>
        <div class="card-b">
          <div class="field">
            <div class="label">پیام</div>
            <textarea id="supportTicketText" class="control" placeholder="پیام خود را بنویسید..." maxlength="300"></textarea>
            <div class="muted" style="font-size:12px;">حداکثر ۳۰۰ کاراکتر</div>
          </div>
          <div class="actions">
            <button id="sendSupportTicketBtn" class="btn primary">💬 ارسال پیام</button>
            <button id="refreshMyTicketsBtn" class="btn">🔄 بروزرسانی</button>
          </div>
          <div style="height:10px"></div>
          <div class="mini-list" id="myTicketsList">—</div>
        </div>
      </div>


<div class="card admin-card tab-section" id="adminCard" data-tab-section="admin">
        <div class="card-h">
          <strong id="adminTitle">پنل ادمین</strong>
          <span>مدیریت پرداخت، برداشت و تیکت‌ها</span>
        </div>
        <div class="card-b admin-grid">
          <div class="chips" id="adminTabs">
            <button type="button" class="chip on" data-tab="overview">مرور</button>
            <button type="button" class="chip" data-tab="content">محتوا</button>
            <button type="button" class="chip" data-tab="operations">عملیات</button>
            <button type="button" class="chip" data-tab="support">پشتیبانی</button>
            <button type="button" class="chip" data-tab="reports">گزارش</button>
            <button type="button" class="chip" data-tab="points">امتیاز</button>
          </div>

                                        <div class="field">
            <div class="label">کمیسیون دعوت</div>
            <div class="admin-row">
              <input id="globalCommission" class="control" placeholder="درصد کمیسیون کلی (مثلاً 5)" />
              <button id="saveGlobalCommission" class="btn">ذخیره کلی</button>
            </div>
            <div class="admin-row">
              <input id="commissionUser" class="control" placeholder="یوزرنیم خاص (@user)" />
              <input id="commissionPercent" class="control" placeholder="درصد برای کاربر خاص" />
              <button id="saveUserCommission" class="btn">ذخیره کاربر</button>
            </div>
            <div class="mini-list" id="commissionList">—</div>
          </div>

          <div class="field">
            <div class="label">سهمیه رایگان روزانه</div>
            <div class="admin-row">
              <input id="freeDailyLimit" class="control" placeholder="مثلاً 3" />
              <button id="saveFreeLimit" class="btn">ذخیره سهمیه</button>
            </div>
          </div>

          <div class="field">
            <div class="label">امتیاز پایه کاربران</div>
            <div class="admin-row">
              <input id="basePoints" class="control" placeholder="مثلاً 100" />
              <button id="saveBasePoints" class="btn">ذخیره امتیاز پایه</button>
            </div>
          </div>

          
          <div class="field">
            <div class="label">جستجوی کاربر</div>
            <div class="admin-row">
              <input id="userSearchQ" class="control" placeholder="آیدی، @username، ایمیل یا نام..." />
              <button id="userSearchBtn" class="btn">جستجو</button>
            </div>
            <div class="mini-list" id="userSearchResults">—</div>
            <div class="hint">روی «انتخاب» بزن تا آیدی کاربر داخل بخش شارژ قرار بگیرد.</div>
          </div>

          <div class="field">
            <div class="label">لیست کاربران</div>
            <div class="admin-row">
              <select id="userListSort" class="control">
                <option value="recent">جدیدترین</option>
                <option value="points_desc">امتیاز بیشتر</option>
                <option value="analyses_desc">تحلیل بیشتر</option>
                <option value="lastAnalysis_desc">آخرین تحلیل</option>
              </select>
              <select id="userListLimit" class="control">
                <option value="25">25</option>
                <option value="50" selected>50</option>
                <option value="100">100</option>
              </select>
              <button id="loadUsersBtn" class="btn">بارگذاری</button>
            </div>
            <div class="admin-row" style="gap:10px; align-items:center; justify-content:space-between;">
              <button type="button" id="usersPrevBtn" class="btn sm ghost">⬅ قبلی</button>
              <div class="muted" id="usersPageInfo" style="font-size:12px; text-align:center; flex:1;">—</div>
              <button type="button" id="usersNextBtn" class="btn sm ghost">بعدی ➡</button>
            </div>
            <div class="mini-list" id="usersList">—</div>
            <div class="hint">برای شارژ، روی «انتخاب» بزن تا آیدی کاربر وارد بخش شارژ شود.</div>
          </div>


<div class="field admin-tab" data-tab="points">
            <div class="label">تغییر امتیاز کاربر</div>
            <div class="hint">برای کم‌کردن امتیاز، عدد منفی وارد کن (مثلاً -20).</div>
            <div class="admin-row">
              <input id="creditTarget" class="control" placeholder="آیدی عددی یا @username" />
              <input id="creditAmount" class="control" placeholder="مثلاً 50" />
              <input id="creditNote" class="control" placeholder="توضیح (اختیاری)" />
              <button id="creditUserBtn" class="btn">شارژ</button>
            </div>
            <div class="chips" id="creditQuick" style="margin-top:8px;">
              <button type="button" class="chip" data-amt="50">+50</button>
              <button type="button" class="chip" data-amt="100">+100</button>
              <button type="button" class="chip" data-amt="250">+250</button>
              <button type="button" class="chip" data-amt="500">+500</button>
              <button type="button" class="chip" data-amt="1000">+1000</button>
            </div>
            <div class="hint">برای کم کردن امتیاز، مقدار منفی وارد کن (مثلاً -20).</div>
          </div>


                    <div class="field">
            <div class="label">تأیید پرداخت و فعال‌سازی اشتراک</div>
            <div class="admin-row">
              <input id="payUsername" class="control" placeholder="یوزرنیم خریدار" />
              <input id="payAmount" class="control" placeholder="مبلغ" />
              <input id="payDays" class="control" placeholder="روزهای اشتراک" />
              <input id="payDailyLimit" class="control" placeholder="سهمیه روزانه اشتراک" />
            </div>
            <div class="admin-row">
              <input id="payTx" class="control" placeholder="هش تراکنش" />
              <button id="approvePayment" class="btn primary">تأیید و فعال‌سازی</button>
              <button id="checkPayment" class="btn ghost">چک بلاک‌چین</button>
              <button id="activateSubscription" class="btn">فعال‌سازی دستی</button>
            </div>
            <div class="muted" style="font-size:12px; line-height:1.8;">برای استفاده ساده: فقط یوزرنیم + مبلغ + یکی از پلن‌ها را انتخاب کنید. TxHash اختیاری است.</div>
            <div class="chips" id="paymentPresets">
              <button type="button" class="chip" data-days="7" data-amount="9">پلن شروع ۷ روزه</button>
              <button type="button" class="chip" data-days="30" data-amount="19">پلن ماهانه</button>
              <button type="button" class="chip" data-days="90" data-amount="49">پلن حرفه‌ای ۹۰ روزه</button>
            </div>

            <div class="label" style="margin-top:10px;font-size:12px;">پلن‌های اشتراک (قیمت/شرایط)</div>
            <div class="mini-list" id="adminSubPlansList">—</div>

            <div class="label" style="margin-top:10px;font-size:12px;">پرداخت‌های ثبت‌شده (انتخاب و تایید/رد)</div>
            <div class="admin-row">
              <select id="paymentDecisionSelect" class="control"></select>
              <button id="paymentDecisionApprove" class="btn primary">تایید</button>
              <button id="paymentDecisionReject" class="btn ghost">رد</button>
              <button id="paymentDecisionRefresh" class="btn">ریفرش</button>
            </div>
            <div class="mini-list" id="paymentDecisionInfo">—</div>

            <div class="mini-list" id="paymentList">—</div>
          </div>

          
          <div class="field admin-tab" data-tab="content">
            <div class="label">بنر پیشنهاد (نمایش داخل مینی‌اپ)</div>
            <textarea id="offerBannerInput" class="control" placeholder="متن بنر پیشنهاد..."></textarea>
            <input id="offerImageFile" type="file" accept="image/*" class="control" />
            <div class="muted" style="font-size:12px;">برای حذف تصویر، فایل را خالی بگذار و ذخیره کن.</div>
            <div class="actions">
              <button id="saveOfferBanner" class="btn">ذخیره بنر</button>
            </div>
            <div class="admin-row">
              <input id="offerBannerImageUrlInput" class="control" placeholder="یا لینک تصویر بنر..." />
              <button id="clearOfferImage" class="btn ghost">حذف تصویر</button>
            </div>
          </div>

          <div class="field admin-tab" data-tab="content">
            <div class="label">متن خوش‌آمدگویی (قابل تنظیم از پنل)</div>
            <textarea id="welcomeBotInput" class="control" placeholder="متن خوش‌آمدگویی بات..."></textarea>
            <textarea id="welcomeMiniappInput" class="control" placeholder="متن خوش‌آمدگویی مینی‌اپ..."></textarea>
            <div class="actions">
              <button id="saveWelcomeTexts" class="btn">ذخیره متن خوش‌آمدگویی</button>
            </div>
          </div>

          <div class="field owner-hide admin-tab" data-tab="operations" id="featureFlagsBlock">
            <div class="label">ویژگی‌ها (فقط اونر)</div>
            <div class="admin-row">
              <label class="toggle">
                <input type="checkbox" id="flagCapitalMode" />
                <span>حالت سرمایه (Capital Mode)</span>
              </label>
              <label class="toggle">
                <input type="checkbox" id="flagProfileTips" />
                <span>نوتیف پیشنهاد روزانه</span>
              </label>
              <button id="saveFeatureFlags" class="btn">ذخیره</button>
            </div>
            <div class="muted" style="font-size:12px; line-height:1.6;">این تنظیمات روی همه کاربران اثر دارد.</div>
          </div>

          <div class="field owner-hide admin-tab" data-tab="operations" id="walletSettingsBlock">
            <div class="label">تنظیم آدرس ولت (فقط اونر)</div>
            <textarea id="walletAddressInput" class="control" placeholder="آدرس ولت جهت پرداخت (مثلاً TRC20)..."></textarea>
            <div class="actions">
              <button id="saveWallet" class="btn">ذخیره آدرس</button>
            </div>
          </div>

          <div class="field owner-hide admin-tab" data-tab="operations" id="subPlansSettingsBlock">
            <div class="label">تنظیم پلن‌های اشتراک (فقط اونر)</div>
            <div class="muted" style="font-size:12px; line-height:1.6;">فرمت: JSON آرایه‌ای از پلن‌ها. فیلدها: id, title, amount, days, dailyLimit, currency, network</div>
            <textarea id="subPlansJson" class="control" placeholder='[{"id":"pro_30","title":"PRO 30 روز","amount":25,"days":30,"dailyLimit":50,"currency":"USDT","network":"BEP20"}]'></textarea>
            <div class="actions">
              <button id="loadSubPlansAdmin" class="btn secondary">بارگذاری فعلی</button>
              <button id="saveSubPlansAdmin" class="btn">ذخیره پلن‌ها</button>
            </div>
            <div class="mini-list" id="subPlansAdminMsg">—</div>
          </div>

          <div class="field admin-tab" data-tab="support">
            <div class="label">مدیریت تیکت‌ها</div>
            <div class="actions">
              <button id="refreshTickets" class="btn">بروزرسانی</button>
              <button id="ticketQuickPending" class="btn ghost">فقط pending</button>
              <button id="ticketQuickAnswered" class="btn ghost">فقط answered</button>
            </div>
            <select id="ticketSelect" class="control"></select>
            <select id="ticketReplyTemplate" class="control">
              <option value="">تمپلیت پاسخ…</option>
              <option value="درخواست شما ثبت شد و در حال بررسی تیم پشتیبانی است. نتیجه به‌زودی ارسال می‌شود.">در حال بررسی</option>
              <option value="مشکل اتصال مینی‌اپ برطرف شد. لطفاً یک‌بار اپ را ببندید و دوباره باز کنید.">حل مشکل اتصال</option>
              <option value="برای این مورد به اطلاعات بیشتری نیاز داریم. لطفاً اسکرین‌شات و زمان دقیق خطا را ارسال کنید.">نیاز به اطلاعات بیشتر</option>
              <option value="درخواست شما انجام شد و تیکت بسته می‌شود. در صورت نیاز تیکت جدید ثبت کنید.">بستن با موفقیت</option>
            </select>
            <textarea id="ticketReply" class="control" placeholder="پاسخ به کاربر (اختیاری)"></textarea>
            <div class="admin-row">
              <select id="ticketStatus" class="control">
                <option value="pending">pending</option>
                <option value="answered">answered</option>
                <option value="closed">closed</option>
              </select>
              <button id="updateTicket" class="btn primary">ثبت وضعیت / ارسال پاسخ</button>
            </div>
            <div class="mini-list" id="ticketsList">—</div>
          </div>

          <div class="field admin-tab" data-tab="operations">
            <div class="label">مدیریت برداشت‌ها</div>
            <div class="actions">
              <button id="refreshWithdrawals" class="btn">بروزرسانی</button>
            </div>
            <select id="withdrawSelect" class="control"></select>
            <div class="admin-row">
              <select id="withdrawDecision" class="control">
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
              </select>
              <input id="withdrawTxHash" class="control" placeholder="TxHash (برای approved)" />
              <button id="reviewWithdrawalBtn" class="btn primary">ثبت</button>
            </div>
            <div class="mini-list" id="withdrawalsList">—</div>
          </div>

          <div class="field admin-tab" data-tab="operations">
            <div class="label">درخواست‌های پرامپت اختصاصی</div>
            <div class="actions">
              <button id="refreshPromptReqs" class="btn">بروزرسانی</button>
            </div>
            <select id="promptReqSelect" class="control"></select>
            <div class="admin-row">
              <input id="promptReqPromptId" class="control" placeholder="Prompt ID برای فعال‌سازی (در صورت approve)" />
              <select id="promptReqDecision" class="control">
                <option value="approved">approve</option>
                <option value="rejected">reject</option>
              </select>
              <button id="decidePromptReqBtn" class="btn primary">ثبت</button>
            </div>
            <div class="mini-list" id="promptReqList">—</div>
          </div>

          <div class="field admin-tab" data-tab="operations">
            <div class="label">فعال/غیرفعال کردن سرمایه برای کاربر</div>
            <div class="admin-row">
              <input id="capitalToggleUser" class="control" placeholder="یوزرنیم (@user)" />
              <select id="capitalToggleEnabled" class="control">
                <option value="true">enabled</option>
                <option value="false">disabled</option>
              </select>
              <button id="saveCapitalToggle" class="btn">ثبت</button>
            </div>
          </div>
<div class="field owner-hide admin-tab" data-tab="reports" id="reportBlock">
            <div class="label">گزارش کامل کاربران (فقط اونر)</div>
            <div class="actions">
              <button id="loadUsers" class="btn">دریافت گزارش</button>
              <button id="downloadReportPdf" class="btn primary">دانلود PDF</button>
            </div>
            <div class="mini-list" id="usersReport">—</div>
          </div>
        </div>
      </div>

      <div class="toast" id="toast">
        <div class="spin" id="spin" style="display:none"></div>
        <div style="min-width:0; flex:1;">
          <div class="t" id="toastT">—</div>
          <div class="s" id="toastS">—</div>
        </div>
        <div class="badge" id="toastB">—</div>
      </div>

      

      <script src="app.js"></script>
</body>
</html>`;
const MINI_APP_JS = String.raw`const getTg = () => ((window.Telegram)==null?undefined:(window.Telegram).WebApp);
let tg = getTg();
if (tg) tg.ready();
if (((tg)==null?undefined:(tg).expand)) tg.expand();

const out = document.getElementById("out");

const progWrap = document.getElementById("jobProg");
const progFill = document.getElementById("jobProgFill");
const progLabel = document.getElementById("jobProgLabel");
const progPct = document.getElementById("jobProgPct");

function setMiniProgress(status, step){
  if (!progWrap || !progFill || !progLabel || !progPct) return;
  const s = String(status||"").toLowerCase();
  let pct=0, txt="در صف…";
  if (s==="queued"){ pct = 18 + Math.min(22, Number(step||0)*2); txt="در صف…"; }
  else if (s==="running"||s==="processing"){ pct = 55 + Math.min(35, Number(step||0)*0.6); txt="در حال تحلیل…"; }
  else if (s==="done"||s==="success"||s==="completed"){ pct=100; txt="تکمیل شد ✅"; }
  else if (s==="error"||s==="failed"){ pct=100; txt="خطا ❌"; }
  else { pct=40; txt="در حال پردازش…"; }
  progWrap.style.display = (s==="done"||s==="success"||s==="completed") ? "block" : "block";
  progFill.style.width = pct.toFixed(0)+"%";
  progLabel.textContent = txt;
  progPct.textContent = pct.toFixed(0)+"%";
  if (s==="done"||s==="success"||s==="completed"){ setTimeout(()=>{ try{progWrap.style.display="none";}catch{} }, 1200); }
}
const meta = document.getElementById("meta");
const sub = document.getElementById("sub");
const pillTxt = document.getElementById("pillTxt");
const welcome = document.getElementById("welcome");
const offerText = document.getElementById("offerText");
const offerTag = document.getElementById("offerTag");
const offerImage = document.getElementById("offerImage");
const adminCard = document.getElementById("adminCard");
const adminTitle = document.getElementById("adminTitle");
const reportBlock = document.getElementById("reportBlock");
const roleLabel = document.getElementById("roleLabel");
const energyToday = document.getElementById("energyToday");
const remainingAnalyses = document.getElementById("remainingAnalyses");
const remainingText = document.getElementById("remainingText");
const energyText = document.getElementById("energyText");
const energyFill = document.getElementById("energyFill");
const offerMedia = document.getElementById("offerMedia");
const offerImg = document.getElementById("offerImg");

function el(id){ return document.getElementById(id); }
function val(id){ return el(id).value; }
function setVal(id, v){ el(id).value = v; }

const toast = el("toast");
const toastT = el("toastT");
const toastS = el("toastS");
const toastB = el("toastB");
const spin = el("spin");

let ALL_SYMBOLS = [];
let INIT_DATA = "";
let MINI_TOKEN = "";
let IS_STAFF = false;
let IS_OWNER = false;
let IS_GUEST = false;
let OFFLINE_MODE = false;

let __mi_tmp = null;
function lsGet(key, fallback = "") { try { const v = localStorage.getItem(key); return (v == null ? fallback : v); } catch (e) { return fallback; } }
function toEnDigits(str){
  const map = {"۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9","٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9"};
  return String(str || "").replace(/[۰-۹٠-٩]/g, (d)=>map[d]||d);
}
function parseNum(x, fallback=0){
  const v = toEnDigits(String(x||"")).replace(/,/g,"").trim();
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function lsSet(key, value) { try { localStorage.setItem(key, String(value)); } catch (e) {} }
function lsRemove(key) { try { localStorage.removeItem(key); } catch (e) {} }


const LOCAL_KEYS = {
  initData: "miniapp_init_data",
  miniToken: "miniapp_auth_token",
  webToken: "miniapp_web_token_v1",
  userState: "miniapp_cached_user_state_v1",
  quoteCache: "miniapp_quote_cache_v1",
  newsCache: "miniapp_news_cache_v1",
  newsAnalysisCache: "miniapp_news_analysis_cache_v1",
  analyzeCache: "miniapp_analyze_cache_v1",
};
const ORIGIN = window.location.origin;
const ROOT_PREFIX = (() => {
  const p0 = window.location.pathname || "";
  const p = p0.endsWith("/") ? p0.slice(0, -1) : p0;
  const marker = "/miniapp";
  const i = p.indexOf(marker);
  if (i >= 0) return p.slice(0, i);
  return "";
})();
function apiUrl(path) {
  let p = String(path || "");
  if (!p.startsWith("/")) p = "/" + p;
  return ORIGIN + ROOT_PREFIX + p;
}
let ADMIN_TICKETS = [];
let ADMIN_TICKETS_ALL = [];
let ADMIN_WITHDRAWALS = [];
let ADMIN_PAYMENTS = [];
let ADMIN_PROMPT_REQS = [];
let QUOTE_TIMER = null;
let LAST_TV_QUOTE_SYMBOL = "";
let QUOTE_BUSY = false;
let NEWS_TIMER = null;
const CONNECTION_HINT = "مینی‌اپ را داخل تلگرام باز کنید. در صورت خطا، یک‌بار ببندید و دوباره اجرا کنید.";
const MINIAPP_EXEC_CHECKLIST = [
  "1) مینی‌اپ را فقط از داخل تلگرام باز کنید.",
  "2) تاریخ/ساعت گوشی را روی حالت خودکار بگذارید.",
  "3) VPN/Proxy را یک‌بار خاموش/روشن و دوباره تست کنید.",
  "4) اپ تلگرام را آپدیت کنید و Mini App cache را پاک کنید.",
  "5) اگر خطای 401 بود، اپ را کامل ببندید و از دکمه /miniapp دوباره وارد شوید.",
  "6) اگر هنوز وصل نشد، لاگ /health و پاسخ /api/user را برای پشتیبانی ارسال کنید."
].join("\n");
const MINIAPP_EXEC_CHECKLIST_TEXT = MINIAPP_EXEC_CHECKLIST;


function getFreshInitData() {
  const _tg = getTg();
  if (_tg) tg = _tg;
  const latestTg = (((_tg)==null?undefined:(_tg).initData) || "").trim();

  // Telegram also passes initData in tgWebAppData query param in many clients.
  const qsTg = String(getParamEverywhere("tgWebAppData") || getParamEverywhere("initData") || "").trim();
  const latest = latestTg || qsTg || "";

  if (latest) {
    INIT_DATA = latest;
    try { lsSet(LOCAL_KEYS.initData, latest); } catch (e) {}
  }
  return INIT_DATA || latest || "";
}


function buildAuthBody(extra) {
  extra = extra || {};
  const webTokenParam = getParamEverywhere("access") || getParamEverywhere("webToken") || "";
  if (webTokenParam) { try { lsSet(LOCAL_KEYS.webToken, webTokenParam); } catch (e) {} }
  const storedWebToken = lsGet(LOCAL_KEYS.webToken, "");
  const webToken = webTokenParam || storedWebToken || "";
  const storedMiniToken = lsGet(LOCAL_KEYS.miniToken, "");
  const body = {
    initData: getFreshInitData(),
    miniToken: MINI_TOKEN || storedMiniToken || "",
    webToken: webToken || "",
  };
  if (!body.miniToken) delete body.miniToken;
  if (!body.webToken) delete body.webToken;

  // Pass start_param (startapp) for entry tracking / referral in backend.
  const sp = (String((tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || getParamEverywhere("tgWebAppStartParam") || getParamEverywhere("startapp") || "")).trim();
  if (sp) body.startParam = sp;
  for (const k in extra) {
    try { body[k] = extra[k]; } catch (e) {}
  }
  // Default guest mode when Telegram auth is not available (read-only).
  if (!body.initData && !body.miniToken && !body.webToken && body.allowGuest == null) body.allowGuest = true;
  return body;
}

function parseMiniTokenStartParam(raw) {
  const v = String(raw || "").trim();
  if (!v) return "";
  try {
    const qp = new URLSearchParams(v);
    const t = String(qp.get("miniToken") || qp.get("token") || "").trim();
    if (t) return t;
  } catch (e) {}
  const m = v.match(/(?:^|[?&])(?:miniToken|token)=([^&]+)/i);
  if (((m)==null?undefined:(m)[1])) {
    try { return decodeURIComponent(m[1]).trim(); } catch (e) { return String(m[1] || "").trim(); }
  }
  if (/^[a-f0-9]{24,96}$/i.test(v)) return v;
  return "";
}

function getParamEverywhere(name) {
  const n = String(name || "").trim();
  if (!n) return "";
  const q = new URLSearchParams(window.location.search).get(n) || "";
  if (q) return q;
  const hash = String(window.location.hash || "").replace(/^#/, "");
  const h = new URLSearchParams(hash).get(n) || "";
  return h || "";
}

function showToast(title, subline = "", badge = "", loading = false){
  if (!toast || !toastT || !toastS || !toastB || !spin) return;
  toastT.textContent = title || "";
  toastS.textContent = subline || "";
  toastB.textContent = badge || "";
  spin.style.display = loading ? "inline-block" : "none";
  toast.classList.add("show");
}
function hideToast(){ if (toast) toast.classList.remove("show"); }


function applyTab(tab){
  const raw = tab || "dashboard";
  const section = (raw === "owner") ? "admin" : raw;

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === raw);
  });
  document.querySelectorAll(".tab-section").forEach((sec) => {
    sec.classList.toggle("active", sec.dataset.tabSection === section);
  });


  if (raw === "subscription") {
    try { loadSubscriptionPlans(); } catch (e) {}
  }

  // If owner opens the owner panel, force admin card to present owner view.
  if (raw === "owner" && adminTitle) adminTitle.textContent = "پنل اونر";
  if (raw === "admin" && adminTitle) adminTitle.textContent = IS_OWNER ? "پنل اونر" : "پنل ادمین";
}

function setupTabs(){
  const tabs = el("mainTabs");
  if (!tabs) return;
  tabs.addEventListener("click", (e) => {
    const b = (e && e.target && typeof e.target.closest === "function") ? e.target.closest(".tab-btn") : null;
    if (!b) return;
    applyTab(b.dataset.tab || "dashboard");
  });
}

async function fileToDataUrl(file){
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("file_read_failed"));
    r.readAsDataURL(file);
  });
}

function setSymbolAll(sym){
  const s = String(sym || "").trim().toUpperCase();
  if (!s) return;
  for (const id of ["symbol","dashSymbol","newsSymbol"]) {
    const e = el(id);
    if (e && "value" in e) e.value = s;
  }
}

function fillSymbols(list){
  ALL_SYMBOLS = Array.isArray(list) ? list.map((x)=>String(x||"").toUpperCase()) : [];
  const sels = [el("symbol"), el("dashSymbol"), el("newsSymbol")].filter(Boolean);
  const curMain = sels[0] ? String(sels[0].value || "").toUpperCase() : "";
  for (const sel of sels) {
    const cur = String(sel.value || curMain || "").toUpperCase();
    sel.innerHTML = "";
    for (const s of ALL_SYMBOLS) {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      sel.appendChild(opt);
    }
    if (cur && ALL_SYMBOLS.includes(cur)) sel.value = cur;
  }
}

function fillStyles(list){
  const styles = Array.isArray(list) ? list.slice() : [];
  const sel = el("style");
  const cur = sel.value;
  sel.innerHTML = "";
  for (const s of styles) {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  }
  if (cur && styles.includes(cur)) sel.value = cur;
}

function fillCustomPrompts(list){
  const prompts = Array.isArray(list) ? list.slice() : [];
  const sel = el("customPrompt");
  const cur = sel.value;
  sel.innerHTML = "";
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "پیش‌فرض";
  sel.appendChild(defaultOpt);
  for (const p of prompts) {
    const opt = document.createElement("option");
    opt.value = String(((p)==null?undefined:(p).id) || "");
    opt.textContent =((p)==null?undefined:(p).title) ? String(p.title) : String(((p)==null?undefined:(p).id) || "");
    sel.appendChild(opt);
  }
  if (cur) sel.value = cur;
}

function filterSymbols(q){
  q = (q || "").trim().toUpperCase();
  const sel = el("symbol");
  const cur = sel.value;
  sel.innerHTML = "";

  const list = !q ? ALL_SYMBOLS : ALL_SYMBOLS.filter(s => s.includes(q));
  for (const s of list) {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  }
  if (cur && list.includes(cur)) sel.value = cur;
}

function setTf(tf){
  setVal("timeframe", tf);
  const tfChips = el("tfChips");
  const chips = tfChips ? tfChips.querySelectorAll(".chip") : [];
  for (const c of chips) c.classList.toggle("on", c.dataset.tf === tf);
}

async function api(path, body){
  let lastErr = null;
  const quickBoot = path === "/api/user" && !!((body)==null?undefined:(body).allowGuest);
  const attempts = quickBoot ? 2 : 2;
  for (let i = 0; i < attempts; i++) {
    try {
      const ac = new AbortController();
      const quickMs = i === 0 ? 4500 : 9000;
      const tm = setTimeout(() => ac.abort("timeout"), quickBoot ? quickMs : (12000 + (i * 4000)));
      const r = await fetch(apiUrl(path), {        method: "POST",
        headers: {"content-type":"application/json"},
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      clearTimeout(tm);
      const j = await r.json().catch(() => null);
      return { status: r.status, json: j };
    } catch (e) {
      lastErr = e;
      await new Promise((res) => setTimeout(res, 350 * (i + 1)));
    }
  }
  return { status: 599, json: { ok: false, error: String(((lastErr)==null?undefined:(lastErr).message) || lastErr || "network_error") } };
}


async function pollAnalyzeJob(jobId){
  const started = Date.now();
  const maxMs = 360000; // hard cap for Mini App waiting
  while (Date.now() - started < maxMs) {
    await new Promise((res)=>setTimeout(res, 1500));
    const { status, json } = await api("/api/admin/analyze/status", buildAuthBody({ jobId }));
    if (!json || !json.ok) return { ok: false, status, json };
    const job = json.job;
    try{ setMiniProgress(job?.status || "queued", Math.floor((Date.now()-started)/1500)); }catch{}
    if (!job) return { ok: false, status: 500, json: { ok: false, error: "bad_job" } };
    if (job.status === "done") { try{ setMiniProgress("done", 999); }catch{}; return { ok: true, job }; }
    if (job.status === "error") { try{ setMiniProgress("error", 999); }catch{}; return { ok: false, status: 500, json: { ok: false, error: job.error || "error" } }; }
  }
  return { ok: false, status: 408, json: { ok: false, error: "timeout" } };
}

async function adminApi(path, body){
  if (!IS_STAFF) return { status: 403, json: { ok: false, error: "forbidden" } };
  return api(path, buildAuthBody(body));
}

function prettyErr(j, status){
  const e =((j)==null?undefined:(j).error) || "نامشخص";
  if (status === 429 && String(e).startsWith("quota_exceeded")) return "سهمیه امروز تمام شد.";
  if (status === 403 && String(e) === "onboarding_required") return "لطفاً آنبوردینگ را کامل کن: نام، شماره، سرمایه، تعیین‌سطح و سبک.";
  if (status === 403 && String(e) === "forbidden") return "دسترسی این بخش برای نقش فعلی شما مجاز نیست.";
  if (status === 402 && String(e) === "insufficient_points") {
    const bal = Number(((j)==null?undefined:(j).balance) || 0);
    const cost = Number(((j)==null?undefined:(j).cost) || 2);
    const link = String(((j)==null?undefined:(j).referralLink) || "");
    let msg = "امتیاز کافی نیست.\n\nامتیاز فعلی: " + bal + "\nهزینه هر تحلیل: " + cost;
    if (link) msg += "\n\nلینک دعوت شما:\n" + link;
    return msg;
  }
  if (status === 401) {
    if (String(e).includes("initData")) return "اتصال مینی‌اپ منقضی شده؛ اپ را مجدد از داخل تلگرام باز کنید.";
    return "احراز هویت تلگرام ناموفق است.\n\n" + MINIAPP_EXEC_CHECKLIST_TEXT;
  }
  return "مشکلی پیش آمد. لطفاً دوباره تلاش کنید.";
}

function fmtPrice(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const digits = n >= 1000 ? 2 : (n >= 1 ? 4 : 6);
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function setQuoteUi(data, errMsg = ""){
  const qSym = el("quoteSymbol");
  const qPrice = el("quotePrice");
  const qChange = el("quoteChange");
  const qTrend = el("quoteTrend");
  const qStamp = el("quoteStamp");
  const qMeta = el("quoteMeta");
  if (!qSym || !qPrice || !qChange || !qTrend || !qStamp || !qMeta) return;

  if (!((data)==null?undefined:(data).ok)) {
    qMeta.textContent = errMsg || "داده قیمت در دسترس نیست.";
    qStamp.textContent = "—";
    return;
  }

  const cp = Number(data.changePct || 0);
  qSym.textContent = data.symbol || "—";
  qPrice.textContent = fmtPrice(data.price);
  qChange.textContent = (cp > 0 ? "+" : "") + cp.toFixed(3) + "%";  qTrend.textContent = data.trend || "نامشخص";

  qChange.classList.remove("q-up","q-down","q-flat");
  qChange.classList.add(data.status === "up" ? "q-up" : (data.status === "down" ? "q-down" : "q-flat"));
  const dt = data.lastTs ? new Date(Number(data.lastTs)) : new Date();
  qStamp.textContent = dt.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  qMeta.textContent = "TF: " + (data.timeframe || "-") + " | candles: " + (data.candles || 0) + " | کیفیت: " + (data.quality === "full" ? "کامل" : "محدود");}

async function refreshLiveQuote(force = false){
  if (QUOTE_BUSY) return;
  if (!force && document.hidden) return;
  QUOTE_BUSY = true;
  try {
    const symbol = val("symbol") || "";
    try { if (symbol && symbol !== LAST_TV_QUOTE_SYMBOL) { renderTvSingleQuote(symbol); LAST_TV_QUOTE_SYMBOL = symbol; } } catch (e) {}
    const timeframe = val("timeframe") || "H4";
    if (!symbol) return;
    const ck = quoteCacheKey(symbol, timeframe);

    if (OFFLINE_MODE) {
      const cached = readByKey(LOCAL_KEYS.quoteCache, ck);
      setQuoteUi(cached, "قیمت لحظه‌ای از کش محلی");
      return;
    }

    const { json } = await api("/api/quote", buildAuthBody({ symbol, timeframe, allowGuest: true }));
    if (((json)==null?undefined:(json).ok)) {
      cacheByKey(LOCAL_KEYS.quoteCache, ck, json);
      setQuoteUi(json, "");
      return;
    }
    const cached = readByKey(LOCAL_KEYS.quoteCache, ck);
    setQuoteUi(cached || json, cached ? "قیمت از کش نمایش داده شد" : "خطا در دریافت قیمت لحظه‌ای");
  } finally {
    QUOTE_BUSY = false;
  }
}

function setupLiveQuotePolling(){
  if (QUOTE_TIMER) clearInterval(QUOTE_TIMER);
  refreshLiveQuote(true);
  QUOTE_TIMER = setInterval(() => { refreshLiveQuote(false); }, 12000);
}

let CHART = null;
let CHART_SERIES = null;
let CHART_TIMER = null;
let DASH_TF = "M15";
let LAST_CANDLE_TS = 0;

// ─────────────────────────────────────────────────────────────────────────────
// TradingView Widgets (official embeds) — replaces Lightweight Charts in Mini App
// Note: Embeds show the chart; automatic drawing of custom zones inside the widget
// requires TradingView Charting Library (licensed). Here we display zones as a list
// and provide an "Open in TradingView" link for manual drawing.
// ─────────────────────────────────────────────────────────────────────────────

function tfToTvInterval(tf){
  const x = String(tf||"H4").toUpperCase();
  if (x === "M15") return "15";
  if (x === "H1") return "60";
  if (x === "H4") return "240";
  if (x === "D1") return "D";
  return "240";
}

function appSymbolToTvSymbol(sym){
  const s0 = String(sym||"").trim().toUpperCase();
  if (!s0) return "BINANCE:BTCUSDT";
  if (s0.includes(":")) return s0; // already TradingView format
  // Crypto pairs like BTCUSDT
  if (/^[A-Z0-9]{3,12}USDT$/.test(s0)) return "BINANCE:" + s0;
  // Metals
  if (s0 === "XAUUSD" || s0 === "XAGUSD") return "OANDA:" + s0;
  // Forex 6-letter pairs (EURUSD)
  if (/^[A-Z]{6}$/.test(s0)) return "OANDA:" + s0;
  // Fallback
  return "FX_IDC:" + s0.replace(/[^A-Z0-9]/g, "");
}

function buildTvChartLink(tvSymbol, interval){
  const s = encodeURIComponent(String(tvSymbol||""));
  const i = encodeURIComponent(String(interval||"240"));
  return "https://www.tradingview.com/chart/?symbol=" + s + "&interval=" + i;
}

function mountTvWidget(container, widgetSrc, config){
  if (!container) return;
  try {
    container.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "tradingview-widget-container";
    wrap.style.width = "100%";
    wrap.style.height = "100%";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.width = "100%";
    widget.style.height = "100%";
    wrap.appendChild(widget);

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src = widgetSrc;
    script.textContent = JSON.stringify(config || {});
    wrap.appendChild(script);

    container.appendChild(wrap);
  } catch (e) {
    console.warn("mountTvWidget failed:", e?.message || e);
  }
}

function renderTvSingleQuote(sym){
  const box = el("tvQuoteWidget");
  if (!box) return;
  const tvSym = appSymbolToTvSymbol(sym);
  mountTvWidget(box, "https://s3.tradingview.com/external-embedding/embed-widget-single-quote.js", {
    symbol: tvSym,
    width: "100%",
    colorTheme: "dark",
    isTransparent: true,
    locale: "fa"
  });
}

function renderTvAdvancedChart(containerId, sym, interval){
  const box = (typeof containerId === "string") ? el(containerId) : containerId;
  if (!box) return;
  const tvSym = appSymbolToTvSymbol(sym);
  const iv = String(interval || "240");
  mountTvWidget(box, "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js", {
    autosize: true,
    symbol: tvSym,
    interval: iv,
    timezone: "Asia/Tehran",
    theme: "dark",
    style: "1",
    locale: "fa",
    withdateranges: true,
    hide_side_toolbar: false,
    allow_symbol_change: true,
    calendar: false,
    support_host: "https://www.tradingview.com"
  });
  const link = el("openTvLink");
  if (link && box.id === "tvAnalysisChart") {
    link.href = buildTvChartLink(tvSym, iv);
  }
}

function renderZonesList(levels){
  const z = el("zonesList");
  if (!z) return;
  const arr = Array.isArray(levels) ? levels : [];
  if (!arr.length) { z.textContent = "—"; return; }
  z.innerHTML = "";
  for (const lv of arr.slice(0, 24)) {
    const it = document.createElement("div");
    it.className = "mini-item";
    const t = document.createElement("div");
    t.className = "t";
    t.textContent = "Zone";
    const b = document.createElement("div");
    b.className = "b";
    b.textContent = String(lv);
    it.appendChild(t);
    it.appendChild(b);
    z.appendChild(it);
  }
}


function initLiveChart(){
  const box = el("liveChartBox");
  if (!box) return;
  if (!window.LightweightCharts) return;
  if (CHART) return;

  CHART = window.LightweightCharts.createChart(box, {
    width: box.clientWidth || 600,
    height: box.clientHeight || 320,
    layout: { background: { type: "solid", color: "transparent" }, textColor: "rgba(255,255,255,.85)" },
    grid: { vertLines: { color: "rgba(255,255,255,.06)" }, horzLines: { color: "rgba(255,255,255,.06)" } },
    timeScale: { timeVisible: true, secondsVisible: false },
    rightPriceScale: { borderColor: "rgba(255,255,255,.08)" },
    crosshair: { mode: 0 },
  });
  const seriesOpts = {
    upColor: "rgba(46, 204, 113, 1)",
    downColor: "rgba(231, 76, 60, 1)",
    borderVisible: false,
    wickUpColor: "rgba(46, 204, 113, 1)",
    wickDownColor: "rgba(231, 76, 60, 1)",
  };
  if (typeof CHART.addCandlestickSeries === "function") {
    CHART_SERIES = CHART.addCandlestickSeries(seriesOpts);
  } else if (typeof CHART.addSeries === "function" && window.LightweightCharts && window.LightweightCharts.CandlestickSeries) {
    // Compatibility with newer Lightweight Charts versions
    CHART_SERIES = CHART.addSeries(window.LightweightCharts.CandlestickSeries, seriesOpts);
  } else {
    console.warn("LightweightCharts API mismatch: candlestick series method not found");
    return;
  }

  window.addEventListener("resize", () => {
    if (!CHART) return;
    const w = box.clientWidth || 600;
    const h = box.clientHeight || 320;
    CHART.applyOptions({ width: w, height: h });
  });
}

function setDashTf(tf){
  DASH_TF = String(tf || "M15").toUpperCase();
  const chips = el("dashTfChips");
  if (chips) {
    for (const c of chips.querySelectorAll(".chip")) {
      c.classList.toggle("on", String(c.getAttribute("data-tf")||"").toUpperCase() === DASH_TF);
    }
  }
  const sel = el("dashTimeframe");
  if (sel) sel.value = DASH_TF;
}

async function refreshLiveChart(silent){
  const box = el("liveChartBox");
  const metaEl = el("liveChartMeta");
  const hintEl = el("liveChartHint");
  if (!box) return;

  const sym = (val("symbol") || val("dashSymbol") || "BTCUSDT").toUpperCase();
  const interval = tfToTvInterval(DASH_TF);

  // TradingView widget updates itself; we re-mount only on symbol/tf change or manual refresh.
  renderTvAdvancedChart(box, sym, interval);

  if (metaEl) metaEl.textContent = appSymbolToTvSymbol(sym) + " | " + DASH_TF;
  if (hintEl) hintEl.textContent = "نمودار از TradingView (بروزرسانی خودکار)";
  if (!silent) showToast("آپدیت شد ✅", sym + " / " + DASH_TF, "CHART", false);
}

function setupLiveChartPolling(){
  if (CHART_TIMER) { clearInterval(CHART_TIMER); CHART_TIMER = null; }
  refreshLiveChart(true);
}


function renderNewsList(json){
  const target = el("newsList");
  if (!target) return;
  if (!((json)==null?undefined:(json).ok) || !Array.isArray(json.articles) || !json.articles.length) {
    target.textContent = "فعلاً خبر مرتبطی پیدا نشد.";
    return;
  }
  target.innerHTML = "";
  for (const a of json.articles.slice(0, 6)) {
    const row = document.createElement("div");
    const title = document.createElement("a");
    title.href = a.url || "#";
    title.target = "_blank";
    title.rel = "noopener noreferrer";
    title.textContent = "• " + String(a.title || "بدون عنوان");
    title.style.color = "#c7d2fe";
    title.style.textDecoration = "none";
    const meta = document.createElement("div");
    meta.className = "muted";
    meta.style.fontSize = "11px";
    meta.textContent = (a.source || "") + (a.publishedAt ? (" | " + a.publishedAt) : "");
    row.appendChild(title);
    row.appendChild(meta);
    row.style.marginBottom = "8px";
    target.appendChild(row);
  }
}

async function refreshSymbolNews(force = false){
  if (!force && document.hidden) return;
  const symbol = val("symbol") || "";
  if (!symbol) return;
  const target = el("newsList");
  if (target && force) target.textContent = "در حال دریافت خبر…";
  const ck = newsCacheKey(symbol);

  if (OFFLINE_MODE) {
    const cached = readByKey(LOCAL_KEYS.newsCache, ck);
    renderNewsList(cached || { ok: false, articles: [] });
    return;
  }

  const { json } = await api("/api/news", buildAuthBody({ symbol, allowGuest: true }));
  if (((json)==null?undefined:(json).ok)) {
    cacheByKey(LOCAL_KEYS.newsCache, ck, json);
    renderNewsList(json);
    return;
  }
  const cached = readByKey(LOCAL_KEYS.newsCache, ck);
  renderNewsList(cached || json);
}

async function refreshNewsAnalysis(force = false){
  if (!force && document.hidden) return;
  const symbol = val("symbol") || "";
  if (!symbol) return;
  const target = el("newsAnalysis");
  if (target && force) target.textContent = "در حال تحلیل خبر…";
  const ck = newsCacheKey(symbol);

  if (OFFLINE_MODE) {
    const cached = readByKey(LOCAL_KEYS.newsAnalysisCache, ck);
    if (target) target.textContent =((cached)==null?undefined:(cached).summary) || "تحلیل خبری آفلاین موجود نیست.";
    return;
  }

  const { json } = await api("/api/news/analyze", buildAuthBody({ symbol, allowGuest: true }));
  if (!target) return;
  if (((json)==null?undefined:(json).ok)) {
    cacheByKey(LOCAL_KEYS.newsAnalysisCache, ck, json);
    target.textContent = json.summary || "—";
    return;
  }
  const cached = readByKey(LOCAL_KEYS.newsAnalysisCache, ck);
  target.textContent =((cached)==null?undefined:(cached).summary) || "تحلیل خبری در دسترس نیست.";
}

function refreshNews(force = false){
  try { refreshSymbolNews(force); } catch (e) {}
  try { refreshNewsAnalysis(force); } catch (e) {}
}

function setupNewsPolling(){
  if (NEWS_TIMER) clearInterval(NEWS_TIMER);
  refreshSymbolNews(true);
  refreshNewsAnalysis(true);
  NEWS_TIMER = setInterval(() => { refreshSymbolNews(false); refreshNewsAnalysis(false); }, 60000);
}
function renderChartFallbackSvg(svgText){
  const chartCard = el("chartCard");
  const chartImg = el("chartImg");
  if (!chartCard || !chartImg || !svgText) return;
  const svgUrl = "data:image/svg+xml;utf8," + encodeURIComponent(svgText);
  chartImg.src = svgUrl;
  chartCard.style.display = "block";
  const cm = el("chartMeta");
  if (cm) cm.textContent = "Internal Zones Renderer";
}

function pickTicketReplyTemplate(){
  const tpl =((el("ticketReplyTemplate"))==null?undefined:(el("ticketReplyTemplate")).value) || "";
  if (!tpl) return;
  const input = el("ticketReply");
  if (!input) return;
  if (!input.value.trim()) input.value = tpl;
}

function updateMeta(state, quota){
  const qRaw = String(quota || "-");
  let energy = "—";
  let remainTxt = "0";
  const parts = qRaw.split("/");
  const m = (parts.length === 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) ? parts : null;
  if (m) {
    const used = Number(m[0] || 0);
    const limRaw = Number(String(m[1] || "").trim());
const lim = (Number.isFinite(limRaw) && limRaw > 0) ? limRaw : 0;
    const remain = lim > 0 ? Math.max(0, lim - used) : 0;
    const pct = lim > 0 ? Math.max(0, Math.min(100, Math.round((remain / lim) * 100))) : 0;
    energy = pct + "%";
    remainTxt = String(remain);
  }
  meta.textContent = "انرژی: " + energy + " | تحلیل باقی‌مانده: " + remainTxt + " | سهمیه: " + qRaw;
  sub.textContent = "ID: " + (((state)==null?undefined:(state).userId) || "-") + " | امروز(Tehran): " + (((state)==null?undefined:(state).dailyDate) || "-");
  const q = String(quota || "");
  let used = 0;
  let limit = 0;
  {
    const parts = String(q || "").split("/");
    if (parts.length === 2) {
      const a = Number(String(parts[0]).trim());
      const b = Number(String(parts[1]).trim());
      if (isFinite(a) && isFinite(b)) { used = a; limit = b; }
    }
  }
  const remaining = Math.max(0, limit - used);
  const pct = limit > 0 ? Math.max(0, Math.min(100, Math.round((remaining / limit) * 100))) : 0;
  if (remainingText) remainingText.textContent = "تحلیل باقی‌مانده: " + String(Math.max(0, remaining));
  if (energyText) energyText.textContent = "انرژی: " + (limit > 0 ? (pct + "%") : "0%");
  if (energyFill) energyFill.style.width = (limit > 0 ? pct : 0) + "%";
}

function updateDashboardStats(role, quota){
  const raw = String(quota || "0/0");
  let used = 0, limit = 0;
  if (raw.includes("/")) {
    const [u, l] = raw.split("/");
    used = Number(u) || 0;
    limit = Number(l) || 0;
  }
    const remain = (Number.isFinite(limit) && limit >= 0) ? Math.max(0, limit - used) : 0;
  if (roleLabel) roleLabel.textContent = role || "user";
  if (energyToday) energyToday.textContent = String(used);
  if (remainingAnalyses) remainingAnalyses.textContent = String(remain);
}

function setOfferImage(url){
  const clean = String(url || "").trim();
  if (!offerMedia || !offerImg) return;
  if (!clean) {
    offerImg.removeAttribute("src");
    offerMedia.classList.remove("show");
    return;
  }
  offerImg.src = clean;
  offerMedia.classList.add("show");
}

function renderStyleList(styles){
  const target = el("styleList");
  if (!target) return;
  target.textContent = Array.isArray(styles) && styles.length ? styles.join(" • ") : "—";
}

function renderCommissionList(commission){
  const target = el("commissionList");
  if (!target) return;
  const global =((commission)==null?undefined:(commission).globalPercent) || 0;
  const overrides =((commission)==null?undefined:(commission).overrides) || {};
  const lines = ["کلی: " + global + "%"];
  for (const [k, v] of Object.entries(overrides)) lines.push(String(k) + ": " + String(v) + "%");
  target.textContent = lines.join("\\n");
}

function getPaymentById(id){
  id = String(id || "").trim();
  if (!id) return null;
  return ADMIN_PAYMENTS.find((p) => String((p && p.id) || "") === id) || null;
}

function updatePaymentDecisionInfo(){
  const sel = el("paymentDecisionSelect");
  const info = el("paymentDecisionInfo");
  if (!sel || !info) return;

  const p = getPaymentById(sel.value);
  if (!p) { info.textContent = "—"; return; }

  const who = p.username ? ("@" + String(p.username).replace(/^@/,"")) : (p.userId || "-");
  const lines = [
    "ID: " + (p.id || "-"),
    "User: " + who,
    "Plan: " + (p.planId || "-"),
    "Amount: " + (p.amount || "-"),
    "Days: " + (p.days || "-"),
    "DailyLimit: " + (p.dailyLimit || "-"),
    "Status: " + (p.status || "-"),
    "Tx: " + (p.txHash || "-"),
    "CreatedAt: " + (p.createdAt || "-"),
  ];
  info.textContent = lines.join("\n");
// Auto-fill manual form for convenience
  if (el("payUsername") && p.username) el("payUsername").value = String(p.username).replace(/^@/,"");
  if (el("payAmount") && p.amount != null) el("payAmount").value = String(p.amount);
  if (el("payDays") && p.days != null) el("payDays").value = String(p.days);
  if (el("payDailyLimit") && p.dailyLimit != null) el("payDailyLimit").value = String(p.dailyLimit);
  if (el("payTx") && p.txHash) el("payTx").value = String(p.txHash);
}

function renderPayments(list){
  ADMIN_PAYMENTS = Array.isArray(list) ? list.slice() : [];
  const target = el("paymentList");
  const sel = el("paymentDecisionSelect");
  const info = el("paymentDecisionInfo");

  if (sel) sel.innerHTML = "";
  if (!ADMIN_PAYMENTS.length) {
    if (target) target.textContent = "—";
    if (sel) {
      const o = document.createElement("option");
      o.value = "";
      o.textContent = "—";
      sel.appendChild(o);
    }
    if (info) info.textContent = "—";
    return;
  }

  const items = ADMIN_PAYMENTS.slice().sort((a,b) => String((b && b.createdAt) || "").localeCompare(String((a && a.createdAt) || "")));

  if (target) {
    target.textContent = items.slice(0, 25).map((p) => {
      const who = p.username ? ("@" + String(p.username).replace(/^@/,"")) : (p.userId || "-");
      const plan = p.planId || "-";
      return "• " + who
        + " | " + (p.amount || 0)
        + " | " + (p.status || "pending")
        + " | plan:" + plan
        + " | days:" + (p.days || "-")
        + " | limit:" + (p.dailyLimit || "-")
        + " | " + (p.txHash || "—");
    }).join("\n");
  }

  if (sel) {
    const pending = items.filter(p => String(p.status || "pending") === "pending");
    const rest = items.filter(p => String(p.status || "pending") !== "pending");
    const ordered = pending.concat(rest);

    for (const p of ordered.slice(0, 200)) {
      const o = document.createElement("option");
      o.value = p.id || "";
      const who = p.username ? ("@" + String(p.username).replace(/^@/,"")) : (p.userId || "-");
      o.textContent = String(p.id || "-") + " | " + who + " | " + (p.planId || "-") + " | " + (p.amount || 0) + " | " + (p.status || "pending");
      sel.appendChild(o);
    }
    if (!sel.value && sel.options.length) sel.value = sel.options[0].value;
    sel.onchange = () => updatePaymentDecisionInfo();
    updatePaymentDecisionInfo();
  }
}

function renderAdminSubPlans(plans){
  const target = el("adminSubPlansList");
  const chips = el("paymentPresets");
  const arr = Array.isArray(plans) ? plans.slice() : [];

  if (target) {
    if (!arr.length) {
      target.textContent = "—";
    } else {
      target.textContent = arr.map((p) => {
        return "• " + (p.id || "-")
          + " | " + (p.title || "-")
          + " | " + (p.amount || 0) + " " + (p.currency || "USDT")
          + " | " + (p.days || 0) + " روز"
          + " | سهمیه " + (p.dailyLimit || 0) + "/روز"
          + " | " + (p.network || "");
      }).join("\n");
    }
  }

  if (chips && arr.length) {
    chips.innerHTML = "";
    for (const p of arr) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.setAttribute("data-days", String(p.days || 0));
      b.setAttribute("data-amount", String(p.amount || 0));
      b.setAttribute("data-daily", String(p.dailyLimit || 0));
      b.textContent = String(p.title || p.id || "پلن");
      chips.appendChild(b);
    }
  }
}


function shortText(s, n = 80){
  s = String(s || "").replace(/\s+/g, " ").trim();
  return s.length > n ? (s.slice(0, n) + "…") : s;
}

function renderTickets(list, keepMaster = false){
  ADMIN_TICKETS = Array.isArray(list) ? list.slice() : [];
  if (!keepMaster) ADMIN_TICKETS_ALL = ADMIN_TICKETS.slice();
  const sel = el("ticketSelect");
  const target = el("ticketsList");
  if (sel) sel.innerHTML = "";
  if (!ADMIN_TICKETS.length){
    if (sel){
      const o = document.createElement("option");
      o.value = "";
      o.textContent = "—";
      sel.appendChild(o);
    }
    if (target) target.textContent = "—";
    return;
  }

  const items = ADMIN_TICKETS.slice().sort((a,b) => String(((b)==null?undefined:(b).createdAt)||"").localeCompare(String(((a)==null?undefined:(a).createdAt)||"")));
  if (sel){
    for (const t of items){
      const o = document.createElement("option");
      o.value = t.id || "";
      const who = t.username ? ("@"+String(t.username).replace(/^@/,"")) : (t.userId || "-");
      o.textContent = String(t.id || "-") + " | " + who + " | " + String(t.status || "pending");
      sel.appendChild(o);
    }
  }
  if (target){
    target.textContent = items.slice(0, 25).map((t) => {
      const who = t.username ? ("@"+String(t.username).replace(/^@/,"")) : (t.userId || "-");
      return "• " + t.id + " | " + who + " | " + (t.status || "pending") + " | " + shortText(t.text, 80);
    }).join(String.fromCharCode(10));
  }
}

function renderWithdrawals(list){
  ADMIN_WITHDRAWALS = Array.isArray(list) ? list.slice() : [];
  const sel = el("withdrawSelect");
  const target = el("withdrawalsList");
  if (sel) sel.innerHTML = "";
  if (!ADMIN_WITHDRAWALS.length){
    if (sel){
      const o = document.createElement("option");
      o.value = "";
      o.textContent = "—";
      sel.appendChild(o);
    }
    if (target) target.textContent = "—";
    return;
  }
  const items = ADMIN_WITHDRAWALS.slice().sort((a,b) => String(((b)==null?undefined:(b).createdAt)||"").localeCompare(String(((a)==null?undefined:(a).createdAt)||"")));
  if (sel){
    for (const w of items){
      const o = document.createElement("option");
      o.value = w.id || "";
      o.textContent = String(w.id || "-") + " | " + String(w.userId || "-") + " | " + String(w.amount || 0) + " | " + String(w.status || "pending");
      sel.appendChild(o);
    }
  }
  if (target){
    target.textContent = items.slice(0, 25).map((w) => {
      return "• " + w.id + " | " + (w.userId || "-") + " | " + (w.amount || 0) + " | " + (w.status || "pending") + " | " + shortText(w.address, 32);
    }).join(String.fromCharCode(10));
  }
}

function renderPromptReqs(list){
  ADMIN_PROMPT_REQS = Array.isArray(list) ? list.slice() : [];
  const sel = el("promptReqSelect");
  const target = el("promptReqList");
  if (sel) sel.innerHTML = "";
  if (!ADMIN_PROMPT_REQS.length){
    if (sel){
      const o = document.createElement("option");
      o.value = "";
      o.textContent = "—";
      sel.appendChild(o);
    }
    if (target) target.textContent = "—";
    return;
  }
  const items = ADMIN_PROMPT_REQS.slice().sort((a,b) => String(((b)==null?undefined:(b).createdAt)||"").localeCompare(String(((a)==null?undefined:(a).createdAt)||"")));
  if (sel){
    for (const r of items){
      const o = document.createElement("option");
      o.value = r.id || "";
      const who = r.username ? ("@"+String(r.username).replace(/^@/,"")) : (r.userId || "-");
      o.textContent = String(r.id || "-") + " | " + who + " | " + String(r.status || "pending");
      sel.appendChild(o);
    }
  }
  if (target){
    target.textContent = items.slice(0, 25).map((r) => {
      const who = r.username ? ("@"+String(r.username).replace(/^@/,"")) : (r.userId || "-");
      const pid = r.promptId ? (" | prompt:" + r.promptId) : "";
      return "• " + r.id + " | " + who + " | " + (r.status || "pending") + pid;
    }).join(String.fromCharCode(10));
  }
}

async function refreshTickets(){
  const { json } = await adminApi("/api/admin/tickets/list", { limit: 100 });
  if (((json)==null?undefined:(json).ok)) renderTickets(json.tickets || []);
}

function applyTicketFilter(status){
  if (!status) return renderTickets(ADMIN_TICKETS_ALL || [], true);
  const filtered = (ADMIN_TICKETS_ALL || []).filter((x) => String(((x)==null?undefined:(x).status) || "pending") === status);
  renderTickets(filtered, true);
}

function setAdminTab(tab){
  const tabs = Array.from(document.querySelectorAll('#adminTabs .chip'));
  const panes = Array.from(document.querySelectorAll('.admin-tab'));
  for (const t of tabs) t.classList.toggle('on', t.dataset.tab === tab);
  for (const p of panes) {
    const pt = p.dataset.tab || 'overview';
    p.classList.toggle('hidden', pt !== tab);
  }
}
function setupAdminTabs(){
  const wrap = el("adminTabs");
  if (!wrap || typeof wrap.addEventListener !== "function") return;
  wrap.addEventListener("click", (e) => {
    const b = (e && e.target && typeof e.target.closest === "function") ? e.target.closest(".chip") : null;
    if (!b) return;
    setAdminTab(b.dataset.tab || "overview");
  });
}



async function refreshWithdrawals(){
  const { json } = await adminApi("/api/admin/withdrawals/list", {});
  if (((json)==null?undefined:(json).ok)) renderWithdrawals(json.withdrawals || []);
}

async function refreshPromptReqs(){
  const { json } = await adminApi("/api/admin/custom-prompts/requests", {});
  if (((json)==null?undefined:(json).ok)) renderPromptReqs(json.requests || []);
}


function renderUsers(list){
  const target = el("usersReport");
  if (!target) return;
  if (!Array.isArray(list) || !list.length) { target.textContent = "—"; return; }
  target.textContent = list.map((u) => {
    const user = u.username ? ("@" + u.username.replace(/^@/, "")) : u.userId;
    return "• " + user + " | تلفن: " + (u.phone || "—") + " | مدت: " + u.usageDays + " روز | تحلیل موفق: " + u.totalAnalyses + " | آخرین تحلیل: " + (u.lastAnalysisAt || "—") + " | پرداخت: " + u.paymentCount + " (" + (u.paymentTotal || 0) + ") | اشتراک: " + (u.subscriptionType || "free") + " | انقضا: " + (u.subscriptionExpiresAt || "—") + " | سهمیه: " + u.dailyUsed + "/" + u.dailyLimit + " | رفرال: " + u.referralInvites + " | TX: " + (u.lastTxHash || "—") + " | پرامپت: " + (u.customPromptId || "—");
  }).join("\\n");
}

function renderFullAdminReport(users, payments, withdrawals, tickets) {
  const target = el("usersReport");
  if (!target) return;

  const u = Array.isArray(users) ? users : [];
  const p = Array.isArray(payments) ? payments : [];
  const w = Array.isArray(withdrawals) ? withdrawals : [];
  const t = Array.isArray(tickets) ? tickets : [];

  const head = [
    "📊 گزارش کامل ادمین (Asia/Tehran)",
    "کاربران: " + u.length + " | پرداخت‌ها: " + p.length + " | برداشت‌ها: " + w.length + " | تیکت‌ها: " + t.length,
    "────────────────────",
  ];

  const usersBlock = u.slice(0, 80).map((x) => {
    const user = x.username ? ("@" + x.username.replace(/^@/, "")) : x.userId;
    return "• " + user + " | تحلیل موفق: " + (x.totalAnalyses || 0) + " | سهمیه: " + (x.dailyUsed || 0) + "/" + (x.dailyLimit || 0) + " | اشتراک: " + (x.subscriptionType || "free") + " | TX: " + (x.lastTxHash || "—");
  });

  const payBlock = p.slice(0, 40).map((x) => "• " + (x.username || x.userId) + " | " + (x.amount || 0) + " | " + (x.status || "-") + " | " + (x.txHash || "—"));
  const wdBlock = w.slice(0, 40).map((x) => "• " + (x.userId || "-") + " | " + (x.amount || 0) + " | " + (x.status || "pending") + " | " + (x.address || "—"));
  const tkBlock = t.slice(0, 40).map((x) => "• " + (x.username || x.userId || "-") + " | " + (x.status || "pending") + " | " + String(x.text || "").slice(0, 80));

  target.textContent = [
    ...head,
    "👥 کاربران:", ...(usersBlock.length ? usersBlock : ["—"]),
    "",
    "💳 پرداخت‌ها:", ...(payBlock.length ? payBlock : ["—"]),
    "",
    "➖ برداشت‌ها:", ...(wdBlock.length ? wdBlock : ["—"]),
    "",
    "🎫 تیکت‌ها:", ...(tkBlock.length ? tkBlock : ["—"]),
  ].join(String.fromCharCode(10));
}

function safeJsonParse(text, fallback) {
  try { return JSON.parse(text); } catch (e) { return fallback; }
}

function cacheUserSnapshot(json) {
  try {
    const data = {
      welcome:((json)==null?undefined:(json).welcome) || "",
      state:((json)==null?undefined:(json).state) || {},
      quota:((json)==null?undefined:(json).quota) || "",
      symbols:((json)==null?undefined:(json).symbols) || [],
      styles:((json)==null?undefined:(json).styles) || [],
      customPrompts:((json)==null?undefined:(json).customPrompts) || [],
      offerBanner:((json)==null?undefined:(json).offerBanner) || "",
      offerBannerImage:((json)==null?undefined:(json).offerBannerImage) || "",
      role:((json)==null?undefined:(json).role) || "user",
      isStaff: !!((json)==null?undefined:(json).isStaff),
      wallet:((json)==null?undefined:(json).wallet) || "",
      cachedAt: Date.now(),
    };
    localStorage.setItem(LOCAL_KEYS.userState, JSON.stringify(data));
  } catch (e) {}
}

function readCachedUserSnapshot() {
  try {
    return safeJsonParse(localStorage.getItem(LOCAL_KEYS.userState) || "", null);
  } catch (e) {
    return null;
  }
}

function applyUserState(json) {
  welcome.textContent = json.welcome || "";
  fillSymbols(json.symbols || []);
  const styleList = json.styles || [];
  fillStyles(styleList);
  fillCustomPrompts(json.customPrompts || []);
  if (((json.state)==null?undefined:(json.state).timeframe)) setTf(json.state.timeframe);
  if (((json.state)==null?undefined:(json.state).style) && styleList.includes(json.state.style)) {
    setVal("style", json.state.style);
  } else if (styleList.length) {
    setVal("style", styleList[0]);
  }
  if (((json.state)==null?undefined:(json.state).risk)) setVal("risk", json.state.risk);
  if (json && json.state && typeof json.state.customPromptId === "string") setVal("customPrompt", json.state.customPromptId);
  setVal("newsEnabled", String(!!((json.state)==null?undefined:(json.state).newsEnabled)));
  setVal("promptMode",((json.state)==null?undefined:(json.state).promptMode) || "style_plus_custom");

  if (json.state && json.state.selectedSymbol && (json.symbols || []).includes(json.state.selectedSymbol)) {
    setSymbolAll(json.state.selectedSymbol);
  } else if ((json.symbols || []).length) {
    setSymbolAll(json.symbols[0]);
  }
  if (offerText) offerText.textContent = json.offerBanner || "فعال‌سازی اشتراک ویژه با تخفیف محدود.";
  if (offerTag) offerTag.textContent = json.role === "owner" ? "Owner" : "Special";
  if (offerImage) {
    const img = String(json.offerBannerImage || "").trim();
    offerImage.style.display = img ? "block" : "none";
    if (img) offerImage.src = img;
  }

  updateMeta(json.state, json.quota);
  try { renderSubscription(json); } catch (e) {}
}


function storageGetObj(key, fallback = {}) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : fallback;
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
}

function storageSetObj(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value || {})); } catch (e) {}
}

function cacheByKey(key, itemKey, value) {
  const bag = storageGetObj(key, {});
  bag[itemKey] = { ...(value || {}), cachedAt: Date.now() };
  storageSetObj(key, bag);
}

function readByKey(key, itemKey) {
  const bag = storageGetObj(key, {});
  return bag[itemKey] || null;
}

function quoteCacheKey(symbol, timeframe) {
  return String(symbol || "").toUpperCase() + "|" + String(timeframe || "H4").toUpperCase();
}

function newsCacheKey(symbol) {
  return String(symbol || "").toUpperCase();
}

function analyzeCacheKey(symbol) {
  return String(symbol || "").toUpperCase();
}

async function boot(){
  out.textContent = "⏳ در حال آماده‌سازی…";
  pillTxt.textContent = "Connecting…";
  showToast("در حال اتصال…", "دریافت پروفایل و تنظیمات", "API", true);

  const preCached = readCachedUserSnapshot();
  if (preCached) {
    IS_STAFF = !!preCached.isStaff;
    IS_OWNER = preCached.role === "owner";
    IS_GUEST = !!preCached.guest || preCached.quota === "guest" || preCached.role === "guest";
    applyUserState(preCached);
    out.textContent = "⏳ در حال همگام‌سازی با سرور…";
    pillTxt.textContent = "Syncing…";
    setupLiveQuotePolling();
    setupNewsPolling();
    setupLiveChartPolling();
  }

  const isTelegramRuntime = !!((window.Telegram)==null?undefined:(window.Telegram).WebApp) || !!(window.Telegram);
  tg = getTg() || tg;
  const qsInitData = getParamEverywhere("tgWebAppData") || getParamEverywhere("initData") || "";
    const savedInitData = lsGet(LOCAL_KEYS.initData, "");
  const qsMiniToken = getParamEverywhere("miniToken") || getParamEverywhere("token") || "";
  const startParamRaw = ((((tg)==null?undefined:(tg).initDataUnsafe))==null?undefined:(((tg)==null?undefined:(tg).initDataUnsafe)).start_param) || getParamEverywhere("tgWebAppStartParam") || getParamEverywhere("startapp") || "";
    const startParamToken = parseMiniTokenStartParam(startParamRaw || "");
    const savedMiniToken = lsGet(LOCAL_KEYS.miniToken, "");
  const resolvedMiniToken = qsMiniToken || startParamToken || savedMiniToken || "";
  if (resolvedMiniToken) {
    MINI_TOKEN = resolvedMiniToken;
    try { lsSet(LOCAL_KEYS.miniToken, resolvedMiniToken); } catch (e) {}
  }
  let initData = (((tg)==null?undefined:(tg).initData) || "").trim();

  // Telegram WebApp may populate initData with a slight delay.
  if (isTelegramRuntime && !initData) {
    for (let t = 0; t < 8 && !initData; t++) {
      await new Promise((r) => setTimeout(r, 250));
      tg = getTg() || tg;
      initData = (((tg)==null?undefined:(tg).initData) || "").trim();
    }
  }

  if (initData) {
    INIT_DATA = initData;
    lsSet(LOCAL_KEYS.initData, initData);
  } else if (qsInitData) {
    INIT_DATA = qsInitData;
    lsSet(LOCAL_KEYS.initData, qsInitData);
  } else if (savedInitData && !isTelegramRuntime) {
    INIT_DATA = savedInitData;
  } else if (!isTelegramRuntime) {
    // In normal browser runtime, Telegram initData is unavailable.
    // We rely on guest mode (if enabled) or webToken (admin/owner) for access.
    INIT_DATA = "";
  } else {
    INIT_DATA = "";
    showToast("حالت مهمان", "اتصال احراز نشده؛ اجرای محدود با داده عمومی", "GUEST", false);
  }
  let {status, json} = await api("/api/user", buildAuthBody({ allowGuest: true }));

  if (!((json)==null?undefined:(json).ok) && status === 401 && (MINI_TOKEN || lsGet(LOCAL_KEYS.miniToken, ""))) {
    const initBackup = INIT_DATA;
    INIT_DATA = "";
    const retry = await api("/api/user", buildAuthBody({ allowGuest: true }));
    status = retry.status;
    json = retry.json;
    if (!((json)==null?undefined:(json).ok)) INIT_DATA = initBackup;
  }


  // If running outside Telegram and not authorized, ask for webToken (owner/admin) to unlock panels.
  if (!((json)==null?undefined:(json).ok) && status === 401 && !isTelegramRuntime) {
    const hasWebTok = !!(getParamEverywhere("access") || getParamEverywhere("webToken") || lsGet(LOCAL_KEYS.webToken, ""));
    if (!hasWebTok) {
      try {
        const entered = prompt("توکن وب (WEB_OWNER_TOKEN / WEB_ADMIN_TOKEN) را وارد کنید:\n\nاگر ندارید، صفحه را با ?access=TOKEN باز کنید.");
        const tok = String(entered || "").trim();
        if (tok) {
          try { lsSet(LOCAL_KEYS.webToken, tok); } catch (e) {}
          const retry2 = await api("/api/user", buildAuthBody({ allowGuest: true }));
          status = retry2.status;
          json = retry2.json;
        }
      } catch (e) {}
    }
  }

  if (!((json)==null?undefined:(json).ok)) {
    if (status === 401 && isTelegramRuntime) {
      const reason = String((((json)==null?undefined:(json).error) || ((json)==null?undefined:(json).reason) || "unauthorized"));
      showToast("احراز ناموفق", "401: " + reason + " — TELEGRAM_BOT_TOKEN/InitData را بررسی کنید.", "AUTH", false);
    }
    if (status === 401) {
      try { lsRemove(LOCAL_KEYS.initData); } catch (e) {}
    }
    const cached = readCachedUserSnapshot();
    if (!cached) {
      const fallback = {
        welcome: "نسخه محدود مینی‌اپ فعال شد.",
        state: { timeframe: "H4", style: "پرایس اکشن", risk: "متوسط", newsEnabled: true, promptMode: "style_plus_custom", selectedSymbol: "BTCUSDT" },
        quota: "guest",
        symbols: ["BTCUSDT","ETHUSDT","XAUUSD","EURUSD"],
        styles: ["پرایس اکشن","ICT","ATR"],
        offerBanner: "اتصال محدود؛ برخی امکانات نیازمند احراز تلگرام است.",
        offerBannerImage: "",
        role: "user",
        isStaff: false,
        customPrompts: [],
      };
      OFFLINE_MODE = true;
      IS_GUEST = true;
      applyUserState(fallback);
      pillTxt.textContent = "Offline (Guest)";
      out.textContent = "حالت محدود فعال شد ✅ داده‌های پایه بارگذاری شدند.";
      showToast("حالت محدود", "برای همه امکانات، مینی‌اپ را از داخل تلگرام باز کنید.", "GUEST", false);
      if (status === 401) out.textContent = "اتصال کامل برقرار نشد.\n\n" ;
      setupLiveQuotePolling();
      setupNewsPolling();
      return;
    }
    OFFLINE_MODE = !navigator.onLine;
    IS_GUEST = true;
    applyUserState(cached);
    out.textContent = OFFLINE_MODE
      ? "حالت آفلاین فعال شد ✅ امکانات از کش محلی بارگذاری می‌شود."
      : "حالت محدود فعال شد ✅ داده‌های ذخیره‌شده بارگذاری شد و اتصال خواندنی در حال تلاش است.";
    pillTxt.textContent = OFFLINE_MODE ? "Offline (Cached)" : "Limited (Guest)";
    hideToast();
    showToast(OFFLINE_MODE ? "آفلاین" : "حالت محدود", OFFLINE_MODE ? "داده‌های ذخیره‌شده بارگذاری شد" : "اتصال خواندنی مهمان فعال شد", OFFLINE_MODE ? "CACHE" : "GUEST", false);
    setupLiveQuotePolling();
    setupNewsPolling();
    setupLiveChartPolling();
    if (!IS_GUEST) setupMyTicketsPolling();
    return;
  }

  OFFLINE_MODE = false;
  if (((json)==null?undefined:(json).miniToken)) {
    MINI_TOKEN = String(json.miniToken || "").trim();
    try { lsSet(LOCAL_KEYS.miniToken, MINI_TOKEN); } catch (e) {}
  }
  IS_STAFF = !!json.isStaff;
  IS_OWNER = json.role === "owner";
  IS_GUEST = !!json.guest;

  cacheUserSnapshot(json);
  applyUserState(json);
  out.textContent = "آماده ✅";
  pillTxt.textContent = "Online";
  hideToast();
  setupLiveQuotePolling();
  setupNewsPolling();
  setupLiveChartPolling();
  if (!IS_GUEST) setupMyTicketsPolling();

  const adminTabBtn = document.querySelector('.tab-btn[data-tab="admin"]');
  const ownerTabBtn = document.querySelector('.tab-btn[data-tab="owner"]');
  if (adminTabBtn) adminTabBtn.style.display = IS_STAFF ? "inline-flex" : "none";
  if (ownerTabBtn) ownerTabBtn.style.display = IS_OWNER ? "inline-flex" : "none";

  if (IS_STAFF && adminCard) {
    adminCard.classList.add("show");
    setAdminTab("overview");
    if (adminTitle) adminTitle.textContent = IS_OWNER ? "پنل اونر" : "پنل ادمین";

    // Owner-only blocks
    document.querySelectorAll(".owner-hide").forEach((x) => {
      x.classList.toggle("hidden", !IS_OWNER);
    });

    if (el("offerBannerInput")) el("offerBannerInput").value = json.offerBanner || "";
    if (el("offerBannerImageUrlInput")) el("offerBannerImageUrlInput").value = json.offerBannerImage || "";
    if (IS_OWNER && el("walletAddressInput")) el("walletAddressInput").value = json.wallet || "";

    await loadAdminBootstrap();
  } else {
    applyTab("dashboard");
  }
}

async function loadAdminBootstrap(){
  const { json } = await adminApi("/api/admin/bootstrap", {});
  if (!((json)==null?undefined:(json).ok)) return;

  if (el("adminPrompt")) el("adminPrompt").value = json.prompt || "";
  if (el("stylePromptJson")) el("stylePromptJson").value = JSON.stringify(json.stylePrompts || {}, null, 2);
  if (el("customPromptsJson")) el("customPromptsJson").value = JSON.stringify(json.customPrompts || [], null, 2);
  if (el("freeDailyLimit")) el("freeDailyLimit").value = String(json.freeDailyLimit || "");
  if (el("basePoints")) el("basePoints").value = String(json.basePoints || "");
  if (el("offerBannerInput")) el("offerBannerInput").value = json.offerBanner || "";
  if (el("offerBannerImageUrlInput")) el("offerBannerImageUrlInput").value = json.offerBannerImage || "";
  if (el("welcomeBotInput")) el("welcomeBotInput").value = json.welcomeBot || "";
  if (el("welcomeMiniappInput")) el("welcomeMiniappInput").value = json.welcomeMiniapp || "";
  if (IS_OWNER && el("walletAddressInput") && typeof json.wallet === "string") el("walletAddressInput").value = json.wallet || "";
  if (IS_OWNER && el("subPlansJson")) {
    try { el("subPlansJson").value = JSON.stringify(json.subscriptionPlans || [], null, 2); } catch {}
  }

  if (json.adminFlags) {
    if (el("flagCapitalMode")) el("flagCapitalMode").checked = !!json.adminFlags.capitalModeEnabled;
    if (el("flagProfileTips")) el("flagProfileTips").checked = !!json.adminFlags.profileTipsEnabled;
  }

  renderStyleList(json.styles || []);
  renderCommissionList(json.commission || {});
  renderAdminSubPlans(json.subscriptionPlans || []);
  renderPayments(json.payments || []);
  renderTickets(json.tickets || []);
  renderWithdrawals(json.withdrawals || []);
  if (offerText) offerText.textContent = json.offerBanner || (offerText.textContent || "");
  if (offerImage) {
    const img = String(json.offerBannerImage || "").trim();
    offerImage.style.display = img ? "block" : "none";
    if (img) offerImage.src = img;
  }

  // load prompt requests
  if (el("promptReqSelect")) await refreshPromptReqs();
}

setupTabs();
setupAdminTabs();
applyTab("dashboard");

el("q").addEventListener("input", (e) => filterSymbols(e.target.value));
__mi_tmp = el("symbol"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("change", () => { const s = val("symbol"); setSymbolAll(s); refreshLiveQuote(true); refreshLiveChart(true); refreshNews(true); });
__mi_tmp = el("timeframe"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("change", () => refreshLiveQuote(true));
__mi_tmp = el("refreshNews"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", () => { refreshSymbolNews(true); refreshNewsAnalysis(true); });
el("tfChips").addEventListener("click", (e) => {
  const chip = (e && e.target && typeof e.target.closest === "function") ? e.target.closest(".chip") : null;
  const tf =((((chip)==null?undefined:(chip).dataset))==null?undefined:(((chip)==null?undefined:(chip).dataset)).tf);
  if (!tf) return;
  setTf(tf);
  refreshLiveQuote(true);
});

el("save").addEventListener("click", async () => {
  if (OFFLINE_MODE || IS_GUEST) {
    showToast("محدود", "در حالت آفلاین/مهمان ذخیره روی سرور ممکن نیست.", "SET", false);
    return;
  }
  showToast("در حال ذخیره…", "تنظیمات ذخیره می‌شود", "SET", true);
  out.textContent = "⏳ ذخیره تنظیمات…";

  const payload = buildAuthBody({
    timeframe: val("timeframe"),
    style: val("style"),
    risk: val("risk"),
    newsEnabled: val("newsEnabled") === "true",
    promptMode: val("promptMode") || "style_plus_custom",
    selectedSymbol: val("symbol") || "",
    customPromptId: val("customPrompt") || "",
  });

  const {status, json} = await api("/api/settings", payload);
  if (!((json)==null?undefined:(json).ok)) {
    out.textContent = "⚠️ خطا: " + prettyErr(json, status);
    showToast("خطا", prettyErr(json, status), "SET", false);
    return;
  }

  out.textContent = "✅ تنظیمات ذخیره شد.";
  updateMeta(json.state, json.quota);
  showToast("ذخیره شد ✅", "تنظیمات اعمال شد", "OK", false);
  setTimeout(hideToast, 1200);
});

el("analyze").addEventListener("click", async () => {
  if (OFFLINE_MODE || IS_GUEST) {
    const symbol = val("symbol") || "";
    const cached = readByKey(LOCAL_KEYS.analyzeCache, analyzeCacheKey(symbol));
    if (((cached)==null?undefined:(cached).result)) {
      out.textContent = cached.result;
      if (((cached)==null?undefined:(cached).zonesSvg)) renderChartFallbackSvg(cached.zonesSvg);
      showToast("آفلاین", "آخرین تحلیل ذخیره‌شده نمایش داده شد.", "AI", false);
    } else {
      out.textContent = "⚠️ تحلیل آنلاین در حالت آفلاین/مهمان غیرفعال است. برای ادامه از داخل تلگرام متصل شوید.";
      showToast("محدود", "تحلیل نیاز به اتصال و احراز تلگرام دارد.", "AI", false);
    }
    return;
  }
  showToast("در حال تحلیل…", "جمع‌آوری دیتا + تولید خروجی", "AI", true);
  out.textContent = "⏳ در حال تحلیل…";

  const payload = buildAuthBody({
    symbol: val("symbol"),
    userPrompt: "",
    timeframe: val("timeframe"),
    style: val("style"),
    risk: val("risk"),
    newsEnabled: (val("newsEnabled") === "true"),
    promptMode: val("promptMode"),
    customPromptId: val("customPrompt"),
    selectedSymbol: val("symbol"),
  });

  const resp = await api("/api/admin/analyze", payload);
  let status = resp.status;
  let json = resp.json;

  if (json && json.ok && json.queued && json.jobId) {
    // Queue mode: poll for result
    out.textContent = "⏳ درخواست در صف قرار گرفت…";
    try{ setMiniProgress("queued",0); }catch{}
    const waited = await pollAnalyzeJob(json.jobId);
    if (!waited.ok) {
      status = waited.status;
      json = waited.json;
    } else {
      const job = waited.job || {};
      json = {
        ok: true,
        result: job.result || job.text || "",
        chartUrl: job.chartUrl || "",
        zonesSvg: job.zonesSvg || "",
        state: job.state || {},
        quota: job.quota || "",
        levels: Array.isArray(job.levels) ? job.levels : [],
        quickchartConfig: job.quickchartConfig || {},
        chartMeta: job.chartMeta || {},
        quickChartSpec: job.quickChartSpec || null,
      };
      status = 200;
    }
  }

  if (!((json)==null?undefined:(json).ok)) {
    const msg = prettyErr(json, status);
    out.textContent = "⚠️ " + msg;
    showToast("خطا", msg, status === 429 ? "Quota" : "AI", false);
    return;
  }

  out.textContent = json.result || "⚠️ بدون خروجی";
  cacheByKey(LOCAL_KEYS.analyzeCache, analyzeCacheKey(val("symbol") || ""), {
    result: json.result || "",
    chartUrl: json.chartUrl || "",
    zonesSvg: json.zonesSvg || "",
    state: json.state || {},
    quota: json.quota || "",
  });
  await refreshLiveQuote(true);
  await refreshSymbolNews(true);
  // Render chart (TradingView) + zones list
  const chartCard = el("chartCard");
  const tvBox = el("tvAnalysisChart");
  const cm = el("chartMeta");
  if (chartCard && tvBox) {
    chartCard.style.display = "block";
    const sym = (val("symbol") || "BTCUSDT").toUpperCase();
    const tf = (val("timeframe") || "H4").toUpperCase();
    const interval = tfToTvInterval(tf);
    renderTvAdvancedChart("tvAnalysisChart", sym, interval);
    const levels = Array.isArray(json.levels) ? json.levels : [];
    renderZonesList(levels);
    if (cm) cm.textContent = "TradingView | " + appSymbolToTvSymbol(sym) + " | TF: " + tf + " | zones: " + levels.length;
  } else if (chartCard) {
    chartCard.style.display = "none";
  }
  updateMeta(json.state, json.quota);
  showToast("آماده ✅", "خروجی دریافت شد", "OK", false);
  setTimeout(hideToast, 1200);
});

async function refreshMyTickets(silent){
  const listEl = el("myTicketsList");
  if (!listEl) return;
  if (!silent) showToast("در حال دریافت تیکت‌ها…", "پشتیبانی", "SUP", true);

  const payload = buildAuthBody({ limit: 50 });
  const {status, json} = await api("/api/support/tickets/list", payload);
  if (!((json)==null?undefined:(json).ok)) {
    listEl.textContent = "⚠️ خطا: " + prettyErr(json, status);
    if (!silent) showToast("خطا", prettyErr(json, status), "SUP", false);
    return;
  }
  renderMyTickets(Array.isArray(json.tickets) ? json.tickets : []);
  if (!silent) showToast("آپدیت شد", "لیست تیکت‌ها بروزرسانی شد", "SUP", false);
}

function renderMyTickets(tickets){
  const listEl = el("myTicketsList");
  if (!listEl) return;
  if (!tickets.length) { listEl.textContent = "—"; return; }

  listEl.innerHTML = "";
  const sorted = tickets.slice().sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
  for (const t of sorted) {
    const wrap = document.createElement("div");
    wrap.className = "mini-item";
    const title = document.createElement("div");
    title.className = "t";
    const id = String(t.id||"").slice(0,8);
    const st = String(t.status||"open").toUpperCase();
    title.textContent = "#" + id + " • " + st;

    const body = document.createElement("div");
    body.className = "s";
    const txt = String(t.text||"");
    const rep = String(t.reply||"");
    const when = t.createdAt ? new Date(t.createdAt).toLocaleString() : "";
    body.textContent = (when ? ("🗓 " + when + "\n") : "") + "📝 " + txt + (rep ? ("\n✅ پاسخ: " + rep) : "\n⏳ هنوز پاسخی ثبت نشده");

    wrap.appendChild(title);
    wrap.appendChild(body);
    listEl.appendChild(wrap);
  }
}

let MY_TICKETS_TIMER = null;
function setupMyTicketsPolling(){
  if (MY_TICKETS_TIMER) clearInterval(MY_TICKETS_TIMER);
  refreshMyTickets(true);
  MY_TICKETS_TIMER = setInterval(() => refreshMyTickets(true), 45000);
}

__mi_tmp = el("sendSupportTicketBtn"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  if (OFFLINE_MODE || IS_GUEST) {
    showToast("محدود", "ارسال پیام در حالت آفلاین/مهمان ممکن نیست.", "SUP", false);
    return;
  }
  const text = (((el("supportTicketText"))==null?undefined:(el("supportTicketText")).value) || "").trim();
  if (!text || text.length < 4) {
    showToast("خطا", "متن پیام خیلی کوتاه است.", "SUP", false);
    return;
  }
  if (text.length > 300) {
    showToast("خطا", "حداکثر ۳۰۰ کاراکتر مجاز است.", "SUP", false);
    return;
  }
  showToast("در حال ارسال…", "پیام در حال ارسال است", "SUP", true);
  const { status, json } = await api("/api/support/ticket", buildAuthBody({ text }));
  if (!((json)==null?undefined:(json).ok)) {
    const msg =((json)==null?undefined:(json).error) === "support_unavailable"
      ? "پشتیبانی در دسترس نیست."
      : "ارسال پیام ناموفق بود.";
    showToast("خطا", msg, "SUP", false);
    return;
  }
  if (el("supportTicketText")) el("supportTicketText").value = "";
  showToast("ارسال شد ✅", "پیام شما برای ادمین ارسال شد", "SUP", false);
  setTimeout(hideToast, 1200);
});

el("close").addEventListener("click", () => { try { if (tg && typeof tg.close === "function") tg.close(); } catch (e) {} });

__mi_tmp = el("savePrompt"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const prompt =((el("adminPrompt"))==null?undefined:(el("adminPrompt")).value) || "";
  const { json } = await adminApi("/api/admin/prompt", { prompt });
  if (((json)==null?undefined:(json).ok)) showToast("ذخیره شد ✅", "پرامپت بروزرسانی شد", "ADM", false);
});

__mi_tmp = el("saveStylePrompts"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const raw =((el("stylePromptJson"))==null?undefined:(el("stylePromptJson")).value) || "{}";
  const stylePrompts = safeJsonParse(raw, {});
  const { json } = await adminApi("/api/admin/style-prompts", { stylePrompts });
  if (((json)==null?undefined:(json).ok)) showToast("ذخیره شد ✅", "JSON سبک‌ها بروزرسانی شد", "ADM", false);
});

__mi_tmp = el("addStyle"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const style =((el("newStyle"))==null?undefined:(el("newStyle")).value) || "";
  const { json } = await adminApi("/api/admin/styles", { action: "add", style });
  if (((json)==null?undefined:(json).ok)) {
    renderStyleList(json.styles || []);
    fillStyles(json.styles || []);
  }
});

__mi_tmp = el("removeStyle"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const style =((el("removeStyleName"))==null?undefined:(el("removeStyleName")).value) || "";
  const { json } = await adminApi("/api/admin/styles", { action: "remove", style });
  if (((json)==null?undefined:(json).ok)) {
    renderStyleList(json.styles || []);
    fillStyles(json.styles || []);
  }
});

__mi_tmp = el("saveGlobalCommission"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const percent = Number(((el("globalCommission"))==null?undefined:(el("globalCommission")).value) || 0);
  const { json } = await adminApi("/api/admin/commissions", { action: "setGlobal", percent });
  if (((json)==null?undefined:(json).ok)) renderCommissionList(json.commission || {});
});

__mi_tmp = el("saveUserCommission"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const username =((el("commissionUser"))==null?undefined:(el("commissionUser")).value) || "";
  const percent = Number(((el("commissionPercent"))==null?undefined:(el("commissionPercent")).value) || 0);
  const { json } = await adminApi("/api/admin/commissions", { action: "setOverride", username, percent });
  if (((json)==null?undefined:(json).ok)) renderCommissionList(json.commission || {});
});

__mi_tmp = el("saveFreeLimit"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const limit = Number(((el("freeDailyLimit"))==null?undefined:(el("freeDailyLimit")).value) || 3);
  const { json } = await adminApi("/api/admin/free-limit", { limit });
  if (((json)==null?undefined:(json).ok)) showToast("ذخیره شد ✅", "سهمیه رایگان بروزرسانی شد", "ADM", false);
});


__mi_tmp = el("saveBasePoints"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const basePoints = parseNum(((el("basePoints"))==null?undefined:(el("basePoints")).value), 0);
  const { json } = await adminApi("/api/admin/points/base", { basePoints });
  if (((json)==null?undefined:(json).ok)) showToast("ذخیره شد ✅", "امتیاز پایه بروزرسانی شد", "ADM", false);
});


__mi_tmp = el("userSearchBtn"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const q = String(((el("userSearchQ"))==null?undefined:(el("userSearchQ")).value) || "").trim();
  const box = el("userSearchResults");
  if (box) box.textContent = "در حال جستجو...";
  const { status, json } = await adminApi("/api/admin/users/search", { q, limit: 25 });
  if (!((json)==null?undefined:(json).ok)) {
    if (box) box.textContent = "خطا: " + prettyErr(json, status);
    return;
  }
  const users = Array.isArray(json.users) ? json.users : [];
  if (!users.length) { if (box) box.textContent = "نتیجه‌ای پیدا نشد."; return; }
  if (!box) return;
  box.innerHTML = users.map((u) => {
    const uid = String(u.userId || "");
    const uname = String(u.username || "").replace(/^@/, "");
    const show = uname ? ("@" + uname) : uid;
    const plan = String(u.plan || "");
    const pts = Number(u.points || 0);
    const sub = u.proActive ? "Pro" : (u.isStaff ? "Staff" : "Free");
    return '<div class="mini-item" style="align-items:center; justify-content:space-between; gap:10px;">' +
      '<div style="flex:1; min-width:0">' +
        '<div style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + escapeHtml(show) + ' <span style="opacity:.7; font-weight:500">(' + escapeHtml(uid) + ')</span></div>' +
        '<div style="opacity:.8; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + escapeHtml(sub) + (plan ? (' • ' + escapeHtml(plan)) : '') + ' • امتیاز: ' + String(pts) + '</div>' +
      '</div>' +
      '<button type="button" class="btn sm" data-pick-user="' + escapeHtml(uid) + '">انتخاب</button>' +
    '</div>';
  }).join("");
  box.querySelectorAll("[data-pick-user]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const uid = String(btn.getAttribute("data-pick-user") || "").trim();
      const tgt = el("creditTarget");
      if (tgt) tgt.value = uid;
      showToast("انتخاب شد ✅", "کاربر برای شارژ انتخاب شد", "ADM", false);
    });
  });
});

__mi_tmp = el("creditUserBtn"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const targetRaw = String(((el("creditTarget"))==null?undefined:(el("creditTarget")).value) || "").trim();
  const amount = parseNum(((el("creditAmount"))==null?undefined:(el("creditAmount")).value), 0);
  const note = String(((el("creditNote"))==null?undefined:(el("creditNote")).value) || "").trim();
  if (!targetRaw) { showToast("خطا", "هدف را وارد کن (آیدی عددی یا @username).", "ADM", true); return; }
  if (!amount) { showToast("خطا", "مقدار امتیاز را وارد کن.", "ADM", true); return; }

  let userId = "";
  let username = "";
  if (/^\d+$/.test(targetRaw)) userId = targetRaw;
  else username = targetRaw;

  const { status, json } = await adminApi("/api/admin/points/credit", { userId, username, amount, note });
  if (((json)==null?undefined:(json).ok)) {
    showToast("انجام شد ✅", "امتیاز جدید: " + String(((json)==null?undefined:(json).balance) ?? ""), "ADM", false);
  } else {
    showToast("خطا", prettyErr(json, status), "ADM", true);
  }
});
// Quick credit amount chips
try {
  const q = el("creditQuick");
  if (q) {
    q.querySelectorAll("[data-amt]").forEach((b) => {
      b.addEventListener("click", () => {
        const amt = String(b.getAttribute("data-amt") || "").trim();
        if (el("creditAmount")) el("creditAmount").value = amt;
        if (el("creditNote")) el("creditNote").focus();
      });
    });
  }
} catch (e) {}

// Paged user list (admin)
let ADMIN_USERS_PAGE = 0;

function renderUsersList(users, meta) {
  const box = el("usersList");
  if (!box) return;
  if (!Array.isArray(users) || !users.length) { box.textContent = "کاربری پیدا نشد."; return; }

  box.innerHTML = users.map((u) => {
    const uid = String(u.userId || "");
    const uname = String(u.username || "").replace(/^@/, "");
    const show = uname ? ("@" + uname) : uid;
    const pts = Number(u.points || 0);
    const sub = u.proActive ? "Pro" : (u.isStaff ? "Staff" : "Free");
    const createdAt = String(u.createdAt || "");
    const last = String(u.lastAnalysisAt || "");
    return '<div class="mini-item" style="align-items:center; justify-content:space-between; gap:10px;">' +
      '<div style="flex:1; min-width:0">' +
        '<div style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + escapeHtml(show) + ' <span style="opacity:.7; font-weight:500">(' + escapeHtml(uid) + ')</span></div>' +
        '<div style="opacity:.8; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + escapeHtml(sub) + ' • امتیاز: ' + String(pts) + (createdAt ? (' • ' + escapeHtml(createdAt.slice(0,10))) : '') + (last ? (' • آخرین: ' + escapeHtml(last.slice(0,10))) : '') + '</div>' +
      '</div>' +
      '<button type="button" class="btn sm" data-pick-user="' + escapeHtml(uid) + '">انتخاب</button>' +
    '</div>';
  }).join("");

  box.querySelectorAll("[data-pick-user]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const uid = String(btn.getAttribute("data-pick-user") || "").trim();
      const tgt = el("creditTarget");
      if (tgt) tgt.value = uid;
      showToast("انتخاب شد ✅", "کاربر برای شارژ انتخاب شد", "ADM", false);
    });
  });

  const info = el("usersPageInfo");
  if (info) {
    const p = Number(meta?.page || 0) + 1;
    const pages = Number(meta?.pages || 0) || 1;
    const total = Number(meta?.total || 0);
    const trunc = meta?.truncated ? " (لیست محدود شده)" : "";
    info.textContent = "صفحه " + String(p) + " از " + String(pages) + " • کل: " + String(total) + String(trunc);
  }

  const prevBtn = el("usersPrevBtn");
  const nextBtn = el("usersNextBtn");
  if (prevBtn) prevBtn.disabled = (ADMIN_USERS_PAGE <= 0);
  if (nextBtn) nextBtn.disabled = (Number(meta?.pages || 0) ? (ADMIN_USERS_PAGE >= Number(meta.pages) - 1) : false);
}

async function loadUsers(reset) {
  const sort = String(((el("userListSort"))==null?undefined:(el("userListSort")).value) || "recent").trim();
  const limit = parseNum(((el("userListLimit"))==null?undefined:(el("userListLimit")).value), 50) || 50;
  if (reset) ADMIN_USERS_PAGE = 0;
  const box = el("usersList");
  if (box) box.textContent = "در حال دریافت...";
  const { status, json } = await adminApi("/api/admin/users", { limit, page: ADMIN_USERS_PAGE, sort });
  if (!((json)==null?undefined:(json).ok)) {
    if (box) box.textContent = "خطا: " + prettyErr(json, status);
    return;
  }
  renderUsersList(json.users || [], json.meta || {});
}

__mi_tmp = el("loadUsersBtn"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", () => loadUsers(true));
__mi_tmp = el("usersPrevBtn"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", () => { if (ADMIN_USERS_PAGE > 0) { ADMIN_USERS_PAGE--; loadUsers(false); } });
__mi_tmp = el("usersNextBtn"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", () => { ADMIN_USERS_PAGE++; loadUsers(false); });

try {
  const sortSel = el("userListSort");
  if (sortSel) sortSel.addEventListener("change", () => loadUsers(true));
  const limSel = el("userListLimit");
  if (limSel) limSel.addEventListener("change", () => loadUsers(true));
} catch (e) {}




__mi_tmp = el("saveOfferBanner"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const offerBanner =((el("offerBannerInput"))==null?undefined:(el("offerBannerInput")).value) || "";
  let offerBannerImage = undefined;
  const file =((((el("offerImageFile"))==null?undefined:(el("offerImageFile")).files))==null?undefined:(((el("offerImageFile"))==null?undefined:(el("offerImageFile")).files))[0]);
  const imageUrl = String(((el("offerBannerImageUrlInput"))==null?undefined:(el("offerBannerImageUrlInput")).value) || "").trim();
  if (file) {
    offerBannerImage = await fileToDataUrl(file);
  } else if (imageUrl) {
    offerBannerImage = imageUrl;
  }
  const { json } = await adminApi("/api/admin/offer", { offerBanner, offerBannerImage });
  if (((json)==null?undefined:(json).ok)) {
    if (offerText) offerText.textContent = json.offerBanner || offerBanner;
    if (offerImage) {
      const img = String(json.offerBannerImage || "").trim();
      offerImage.style.display = img ? "block" : "none";
      if (img) offerImage.src = img;
    }
    showToast("ذخیره شد ✅", "بنر بروزرسانی شد", "ADM", false);
    setTimeout(hideToast, 1200);
  } else {
    showToast("خطا", "ذخیره بنر ناموفق بود", "ADM", false);
  }
});

__mi_tmp = el("offerImageFile"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("change", async (ev) => {
  const file =((((((ev)==null?undefined:(ev).target))==null?undefined:(((ev)==null?undefined:(ev).target)).files))==null?undefined:(((((ev)==null?undefined:(ev).target))==null?undefined:(((ev)==null?undefined:(ev).target)).files))[0]);
  if (!file) return;
  if (file.size > 1024 * 1024) {
    showToast("خطا", "حجم تصویر باید کمتر از 1MB باشد", "ADM", false);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = typeof reader.result === "string" ? reader.result : "";
    if (el("offerBannerImageUrlInput")) el("offerBannerImageUrlInput").value = dataUrl;
    if (offerImg) offerImg.src = dataUrl;
    if (offerMedia) offerMedia.classList.toggle("show", !!dataUrl);
  };
  reader.readAsDataURL(file);
});

__mi_tmp = el("clearOfferImage"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const offerBanner =((el("offerBannerInput"))==null?undefined:(el("offerBannerInput")).value) || "";
  const { json } = await adminApi("/api/admin/offer", { offerBanner, clearOfferBannerImage: true });
  if (el("offerBannerImageUrlInput")) el("offerBannerImageUrlInput").value = "";
  if (el("offerImageFile")) el("offerImageFile").value = "";
  if (offerImg) offerImg.src = "";
  if (offerMedia) offerMedia.classList.remove("show");
  if (((json)==null?undefined:(json).ok)) showToast("انجام شد ✅", "تصویر بنر حذف شد", "ADM", false);
});

__mi_tmp = el("saveWelcomeTexts"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const welcomeBot =((el("welcomeBotInput"))==null?undefined:(el("welcomeBotInput")).value) || "";
  const welcomeMiniapp =((el("welcomeMiniappInput"))==null?undefined:(el("welcomeMiniappInput")).value) || "";
  const { json } = await adminApi("/api/admin/welcome", { welcomeBot, welcomeMiniapp });
  if (((json)==null?undefined:(json).ok)) {
    if (el("welcomeBotInput")) el("welcomeBotInput").value = json.welcomeBot || welcomeBot;
    if (el("welcomeMiniappInput")) el("welcomeMiniappInput").value = json.welcomeMiniapp || welcomeMiniapp;
    if (welcome) welcome.textContent = json.welcomeMiniapp || welcome.textContent;
    showToast("ذخیره شد ✅", "متن خوش‌آمدگویی بروزرسانی شد", "ADM", false);
    setTimeout(hideToast, 1200);
  } else {
    showToast("خطا", "ذخیره متن خوش‌آمدگویی ناموفق بود", "ADM", false);
  }
});

__mi_tmp = el("saveFeatureFlags"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const capitalModeEnabled = !!((el("flagCapitalMode"))==null?undefined:(el("flagCapitalMode")).checked);
  const profileTipsEnabled = !!((el("flagProfileTips"))==null?undefined:(el("flagProfileTips")).checked);
  const { json } = await adminApi("/api/admin/features", { capitalModeEnabled, profileTipsEnabled });
  if (((json)==null?undefined:(json).ok)) {
    showToast("ذخیره شد ✅", "ویژگی‌ها بروزرسانی شد", "OWN", false);
    setTimeout(hideToast, 1200);
  } else {
    showToast("خطا", "ذخیره ویژگی‌ها ناموفق بود", "OWN", false);
  }
});

__mi_tmp = el("saveWallet"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const wallet =((el("walletAddressInput"))==null?undefined:(el("walletAddressInput")).value) || "";
  const { json } = await adminApi("/api/admin/wallet", { wallet });
  if (((json)==null?undefined:(json).ok)) {
    showToast("ذخیره شد ✅", "آدرس ولت بروزرسانی شد", "OWN", false);
    setTimeout(hideToast, 1200);
  } else {
    showToast("خطا", "ذخیره آدرس ولت ناموفق بود", "OWN", false);
  }
});


__mi_tmp = el("loadSubPlansAdmin"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const { json } = await adminApi("/api/admin/subscription/plans", {});
  if (((json)==null?undefined:(json).ok)) {
    if (el("subPlansJson")) { try{ el("subPlansJson").value = JSON.stringify(json.plans || [], null, 2); }catch{} }
    if (el("subPlansAdminMsg")) el("subPlansAdminMsg").textContent = "✅ بارگذاری شد (" + ((json.plans||[]).length) + " پلن)";
    renderAdminSubPlans(json.plans || []);
    showToast("بارگذاری شد ✅", "پلن‌ها دریافت شد", "OWN", false);
  } else {
    if (el("subPlansAdminMsg")) el("subPlansAdminMsg").textContent = "⚠️ خطا در بارگذاری";
    showToast("خطا", "بارگذاری پلن‌ها ناموفق بود", "OWN", false);
  }
});

__mi_tmp = el("saveSubPlansAdmin"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  if (!IS_OWNER) { showToast("خطا", "فقط اونر", "OWN", false); return; }
  let plans = [];
  try{
    const raw = (((el("subPlansJson"))==null?undefined:(el("subPlansJson")).value) || "").trim();
    plans = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(plans)) throw new Error("JSON باید آرایه باشد");
  }catch(e){
    if (el("subPlansAdminMsg")) el("subPlansAdminMsg").textContent = "⚠️ JSON نامعتبر: " + String(e && e.message ? e.message : e);
    showToast("خطا", "JSON نامعتبر است", "OWN", false);
    return;
  }

  const { json } = await adminApi("/api/admin/subscription/plans", { action: "set", plans });
  if (((json)==null?undefined:(json).ok)) {
    if (el("subPlansAdminMsg")) el("subPlansAdminMsg").textContent = "✅ ذخیره شد";
    renderAdminSubPlans(json.plans || []);
    showToast("ذخیره شد ✅", "پلن‌ها بروزرسانی شد", "OWN", false);
  } else {
    if (el("subPlansAdminMsg")) el("subPlansAdminMsg").textContent = "⚠️ ذخیره ناموفق";
    showToast("خطا", "ذخیره پلن‌ها ناموفق بود", "OWN", false);
  }
});


__mi_tmp = el("refreshTickets"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  showToast("در حال دریافت…", "لیست تیکت‌ها", "TICKET", true);
  await refreshTickets();
  showToast("آماده ✅", "تیکت‌ها بروزرسانی شد", "TICKET", false);
  setTimeout(hideToast, 1000);
});

__mi_tmp = el("updateTicket"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const id =((el("ticketSelect"))==null?undefined:(el("ticketSelect")).value) || "";
  const status =((el("ticketStatus"))==null?undefined:(el("ticketStatus")).value) || "pending";
  const reply = (((el("ticketReply"))==null?undefined:(el("ticketReply")).value) || "").trim();
  if (!id) { showToast("خطا", "یک تیکت انتخاب کنید.", "TICKET", false); return; }
  showToast("در حال ثبت…", "بروزرسانی تیکت", "TICKET", true);
  const { json } = await adminApi("/api/admin/tickets/update", { id, status, reply });
  if (((json)==null?undefined:(json).ok)) {
    if (el("ticketReply")) el("ticketReply").value = "";
    await refreshTickets();
    showToast("ثبت شد ✅", "تیکت بروزرسانی شد", "TICKET", false);
    setTimeout(hideToast, 1200);
  } else {
    showToast("خطا", "ثبت تیکت ناموفق بود", "TICKET", false);
  }
});

__mi_tmp = el("ticketSelect"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("change", () => {
  const id =((el("ticketSelect"))==null?undefined:(el("ticketSelect")).value) || "";
  const t = ADMIN_TICKETS.find((x) => x.id === id);
  if (t && el("ticketStatus")) el("ticketStatus").value = t.status || "pending";
});

__mi_tmp = el("ticketReplyTemplate"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("change", pickTicketReplyTemplate);
__mi_tmp = el("ticketQuickPending"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", () => applyTicketFilter("pending"));
__mi_tmp = el("ticketQuickAnswered"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", () => applyTicketFilter("answered"));

__mi_tmp = el("refreshWithdrawals"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  showToast("در حال دریافت…", "لیست برداشت‌ها", "WD", true);
  await refreshWithdrawals();
  showToast("آماده ✅", "برداشت‌ها بروزرسانی شد", "WD", false);
  setTimeout(hideToast, 1000);
});

__mi_tmp = el("reviewWithdrawalBtn"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const id =((el("withdrawSelect"))==null?undefined:(el("withdrawSelect")).value) || "";
  const decision =((el("withdrawDecision"))==null?undefined:(el("withdrawDecision")).value) || "rejected";
  const txHash = (((el("withdrawTxHash"))==null?undefined:(el("withdrawTxHash")).value) || "").trim();
  if (!id) { showToast("خطا", "یک برداشت انتخاب کنید.", "WD", false); return; }
  showToast("در حال ثبت…", "بررسی برداشت", "WD", true);
  const { json } = await adminApi("/api/admin/withdrawals/review", { id, decision, txHash });
  if (((json)==null?undefined:(json).ok)) {
    if (el("withdrawTxHash")) el("withdrawTxHash").value = "";
    await refreshWithdrawals();
    showToast("ثبت شد ✅", "برداشت بروزرسانی شد", "WD", false);
    setTimeout(hideToast, 1200);
  } else {
    showToast("خطا", "ثبت برداشت ناموفق بود", "WD", false);
  }
});

__mi_tmp = el("refreshPromptReqs"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  showToast("در حال دریافت…", "درخواست‌های پرامپت", "PR", true);
  await refreshPromptReqs();
  showToast("آماده ✅", "لیست بروزرسانی شد", "PR", false);
  setTimeout(hideToast, 1000);
});

__mi_tmp = el("decidePromptReqBtn"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const requestId =((el("promptReqSelect"))==null?undefined:(el("promptReqSelect")).value) || "";
  const status =((el("promptReqDecision"))==null?undefined:(el("promptReqDecision")).value) || "rejected";
  const promptId = (((el("promptReqPromptId"))==null?undefined:(el("promptReqPromptId")).value) || "").trim();
  if (!requestId) { showToast("خطا", "یک درخواست را انتخاب کنید.", "PR", false); return; }
  if (status === "approved" && !promptId) {
    showToast("خطا", "برای تایید باید Prompt ID وارد کنید.", "PR", false);
    return;
  }
  showToast("در حال ثبت…", "بررسی درخواست", "PR", true);
  const { json } = await adminApi("/api/admin/custom-prompts/requests", { action: "decide", requestId, status, promptId });
  if (((json)==null?undefined:(json).ok)) {
    await refreshPromptReqs();
    showToast("ثبت شد ✅", "درخواست بروزرسانی شد", "PR", false);
    setTimeout(hideToast, 1200);
  } else {
    showToast("خطا", "ثبت درخواست ناموفق بود", "PR", false);
  }
});

__mi_tmp = el("promptReqSelect"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("change", () => {
  const id =((el("promptReqSelect"))==null?undefined:(el("promptReqSelect")).value) || "";
  const r = ADMIN_PROMPT_REQS.find((x) => x.id === id);
  if (r && el("promptReqPromptId")) el("promptReqPromptId").value = r.promptId || "";
  if (r && el("promptReqDecision")) el("promptReqDecision").value = (r.status === "approved" ? "approved" : (r.status === "rejected" ? "rejected" : "rejected"));
});

__mi_tmp = el("saveCapitalToggle"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const username = (((el("capitalToggleUser"))==null?undefined:(el("capitalToggleUser")).value) || "").trim();
  const enabled = (((el("capitalToggleEnabled"))==null?undefined:(el("capitalToggleEnabled")).value) || "true") === "true";
  if (!username) { showToast("خطا", "یوزرنیم را وارد کنید.", "CAP", false); return; }
  const { json } = await adminApi("/api/admin/capital/toggle", { username, enabled });
  if (((json)==null?undefined:(json).ok)) {
    showToast("ثبت شد ✅", "تنظیم سرمایه بروزرسانی شد", "CAP", false);
    setTimeout(hideToast, 1200);
  } else {
    showToast("خطا", "ثبت ناموفق بود", "CAP", false);
  }
});


__mi_tmp = el("customPromptsJsonFile"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("change", async (ev) => {
  const file =((((((ev)==null?undefined:(ev).target))==null?undefined:(((ev)==null?undefined:(ev).target)).files))==null?undefined:(((((ev)==null?undefined:(ev).target))==null?undefined:(((ev)==null?undefined:(ev).target)).files))[0]);
  if (!file) return;
  try {
    const txt = await file.text();
    const parsed = safeJsonParse(txt, null);
    if (!Array.isArray(parsed)) {
      showToast("خطا", "فایل JSON باید آرایه باشد", "ADM", false);
      return;
    }
    if (el("customPromptsJson")) el("customPromptsJson").value = JSON.stringify(parsed, null, 2);
    showToast("بارگذاری شد ✅", "JSON پرامپت آماده ذخیره است", "ADM", false);
  } catch (e) {
    showToast("خطا", "خواندن فایل JSON ناموفق بود", "ADM", false);
  }
});

__mi_tmp = el("saveCustomPrompts"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const raw =((el("customPromptsJson"))==null?undefined:(el("customPromptsJson")).value) || "[]";
  const customPrompts = safeJsonParse(raw, []);
  const { json } = await adminApi("/api/admin/custom-prompts", { customPrompts });
  if (((json)==null?undefined:(json).ok)) {
    showToast("ذخیره شد ✅", "پرامپت‌های اختصاصی بروزرسانی شد", "ADM", false);
    fillCustomPrompts(json.customPrompts || []);
  }
});

__mi_tmp = el("sendCustomPrompt"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const username =((el("customPromptUser"))==null?undefined:(el("customPromptUser")).value) || "";
  const promptId =((el("customPromptId"))==null?undefined:(el("customPromptId")).value) || "";
  const { json } = await adminApi("/api/admin/custom-prompts/send", { username, promptId });
  if (((json)==null?undefined:(json).ok)) showToast("ارسال شد ✅", "پرامپت برای کاربر ارسال شد", "ADM", false);
});

__mi_tmp = el("approvePayment"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const payload = {
    username: (((el("payUsername"))==null?undefined:(el("payUsername")).value) || "").trim(),
    amount: Number(((el("payAmount"))==null?undefined:(el("payAmount")).value) || 0),
    days: Number(((el("payDays"))==null?undefined:(el("payDays")).value) || 30),
    txHash: (((el("payTx"))==null?undefined:(el("payTx")).value) || "").trim(),
  };
  if (!payload.username || !Number.isFinite(payload.amount) || payload.amount <= 0) {
    showToast("خطا", "یوزرنیم و مبلغ معتبر را وارد کنید.", "PAY", false);
    return;
  }
  if (!Number.isFinite(payload.days) || payload.days <= 0) payload.days = 30;
  const { json } = await adminApi("/api/admin/payments/approve", payload);
  if (((json)==null?undefined:(json).ok)) {
    showToast("پرداخت تایید شد ✅", "اشتراک فعال شد", "PAY", false);
    renderPayments([json.payment].filter(Boolean));
  } else {
    showToast("خطا", "تایید پرداخت ناموفق بود", "PAY", false);
  }
});

__mi_tmp = el("paymentDecisionRefresh"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const { json } = await adminApi("/api/admin/payments/list", {});
  if (((json)==null?undefined:(json).ok)) {
    renderPayments(json.payments || []);
    showToast("ریفرش شد ✅", "لیست پرداخت‌ها بروزرسانی شد", "PAY", false);
  } else {
    showToast("خطا", "ریفرش پرداخت‌ها ناموفق بود", "PAY", false);
  }
});

async function decideSelectedPayment(status){
  const sel = el("paymentDecisionSelect");
  if (!sel) { showToast("خطا", "لیست پرداخت‌ها پیدا نشد", "PAY", false); return; }
  const paymentId = String(sel.value || "").trim();
  if (!paymentId) { showToast("خطا", "یک پرداخت را انتخاب کنید", "PAY", false); return; }

  const { json } = await adminApi("/api/admin/payments/decision", { paymentId, status });
  if (((json)==null?undefined:(json).ok)) {
    showToast(status === "approved" ? "تایید شد ✅" : "رد شد ✅", "وضعیت پرداخت بروزرسانی شد", "PAY", false);
    const { json: lj } = await adminApi("/api/admin/payments/list", {});
    if (((lj)==null?undefined:(lj).ok)) renderPayments(lj.payments || []);
  } else {
    showToast("خطا", "عملیات ناموفق بود", "PAY", false);
  }
}

__mi_tmp = el("paymentDecisionApprove"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => decideSelectedPayment("approved"));
__mi_tmp = el("paymentDecisionReject"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => decideSelectedPayment("rejected"));

__mi_tmp = el("checkPayment"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const payload = {
    txHash:((el("payTx"))==null?undefined:(el("payTx")).value) || "",
    amount: Number(((el("payAmount"))==null?undefined:(el("payAmount")).value) || 0),
    address: "",
  };
  const { json } = await adminApi("/api/admin/payments/check", payload);
  if (((json)==null?undefined:(json).ok)) showToast("نتیجه بلاک‌چین", JSON.stringify(json.result || {}), "CHAIN", false);
});

__mi_tmp = el("activateSubscription"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const payload = {
    username:((el("payUsername"))==null?undefined:(el("payUsername")).value) || "",
    days: Number(((el("payDays"))==null?undefined:(el("payDays")).value) || 30),
    dailyLimit: Number(((el("payDailyLimit"))==null?undefined:(el("payDailyLimit")).value) || 50),
  };
  const { json } = await adminApi("/api/admin/subscription/activate", payload);
  if (((json)==null?undefined:(json).ok)) showToast("اشتراک فعال شد ✅", "فعال‌سازی دستی انجام شد", "ADM", false);
});

__mi_tmp = el("loadUsers"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const [{ json: usersJson }, { json: bootJson }] = await Promise.all([
    adminApi("/api/admin/users", { limit: 200 }),
    adminApi("/api/admin/bootstrap", {}),
  ]);
  if (((usersJson)==null?undefined:(usersJson).ok) &&((bootJson)==null?undefined:(bootJson).ok)) {
    renderFullAdminReport(usersJson.users || [], bootJson.payments || [], bootJson.withdrawals || [], bootJson.tickets || []);
  } else if (((usersJson)==null?undefined:(usersJson).ok)) {
    renderUsers(usersJson.users || []);
  }
});

__mi_tmp = el("downloadReportPdf"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  try {
    showToast("در حال ساخت PDF…", "گزارش کامل", "PDF", true);
    const r = await fetch(apiUrl("/api/admin/report/pdf"), {      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildAuthBody({ limit: 250 })),
    });
    if (!r.ok) throw new Error("http_" + r.status);
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "admin-report-" + Date.now() + ".pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("دانلود شد ✅", "گزارش PDF آماده است", "PDF", false);
    setTimeout(hideToast, 1200);
  } catch (e) {
    showToast("خطا", "ساخت PDF ناموفق بود", "PDF", false);
  }
});


__mi_tmp = el("reconnect"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  OFFLINE_MODE = false;
  await boot();
});

window.addEventListener("online", () => {
  if (pillTxt && pillTxt.textContent.toLowerCase().includes("offline")) pillTxt.textContent = "Online";
});

window.addEventListener("offline", () => {
  if (pillTxt) pillTxt.textContent = "Offline";
});

__mi_tmp = el("paymentPresets"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", (e) => {
  const btn = (e && e.target && typeof e.target.closest === "function") ? e.target.closest("[data-days]") : null;
  if (!btn) return;
  const days = Number(btn.getAttribute("data-days") || 30);
  const amount = Number(btn.getAttribute("data-amount") || 0);
  const daily = Number(btn.getAttribute("data-daily") || btn.getAttribute("data-dailylimit") || 0);
  if (el("payDays")) el("payDays").value = String(days);
  if (el("payAmount")) el("payAmount").value = String(amount);
  if (el("payDailyLimit")) el("payDailyLimit").value = String(daily || 50);
  showToast("پلن انتخاب شد ✅", "روز: " + days + " | مبلغ: " + amount + (daily ? (" | سهمیه: " + daily) : ""), "PAY", false);
});


function isoToFaDate(iso){
  try{
    const d = new Date(iso || "");
    if (!iso || !Number.isFinite(d.getTime())) return "—";
    return d.toLocaleDateString("fa-IR");
  }catch(e){
    return "—";
  }
}

function copyText(text){
  const t = String(text || "");
  if (!t) return false;
  try{
    if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === "function"){
      navigator.clipboard.writeText(t);
      return true;
    }
  }catch(e){}
  try{
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return !!ok;
  }catch(e){}
  return false;
}

let __SUB_PLANS = [];

async function loadSubscriptionPlans(){
  const sel = el("subPlanSelect");
  if (!sel) return;
  const msg = el("subMsg");
  try{
    sel.innerHTML = "";
    if (msg) msg.textContent = "⏳ در حال دریافت پلن‌ها…";
    const { json } = await api("/api/subscription/plans", buildAuthBody({}));
    if (!json || !json.ok){
      if (msg) msg.textContent = "⚠️ دریافت پلن‌ها ناموفق بود.";
      return;
    }
    __SUB_PLANS = Array.isArray(json.plans) ? json.plans : [];
    const w = String(json.wallet || "");
    const wEl = el("subWallet");
    if (wEl) wEl.value = w;
    if (!__SUB_PLANS.length){
      if (msg) msg.textContent = "پلنی برای خرید موجود نیست.";
      return;
    }
    __SUB_PLANS.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = String(p.title || p.id) + " | " + Number(p.days || 0) + " روز | " + Number(p.amount || 0) + " USDT | " + Number(p.dailyLimit || 0) + " تحلیل/روز";
      sel.appendChild(opt);
    });
    if (msg) msg.textContent = "پلن را انتخاب کن و TxHash را وارد کن.";
  }catch(e){
    if (msg) msg.textContent = "⚠️ خطا در دریافت پلن‌ها.";
  }
}

function renderSubscription(json){
  const st = (json && json.state) ? json.state : {};
  const sub = st.subscription || {};
  const cost = Number(json && json.analysisPointsCost ? json.analysisPointsCost : 2);
  const pts = Number(st && st.points && st.points.balance ? st.points.balance : 0);
  const left = Math.floor(pts / (cost || 2));

  const statusEl = el("subStatusText");
  const metaEl = el("subMeta");
  const ptsEl = el("pointsText");
  const leftEl = el("freeAnalysesLeft");

  if (metaEl) metaEl.textContent = "هزینه هر تحلیل: " + cost + " امتیاز | شبکه: BEP20";
  if (ptsEl) ptsEl.textContent = String(pts) + " امتیاز";
  if (leftEl) leftEl.textContent = String(left) + " تحلیل";

  const eFill = el("energyFill");
  const maxUi = 20;
  const pct = Math.max(0, Math.min(100, (pts / (maxUi || 20)) * 100));
  if (eFill) eFill.style.width = pct.toFixed(0) + "%";


  const active = !!sub.active;
  const exp = sub.expiresAt ? isoToFaDate(sub.expiresAt) : "—";
  const dl = Number(sub.dailyLimit || st.freeDailyLimit || 3);
  const used = Number(st.dailyUsed || 0);

  if (statusEl){
    if (active){
      statusEl.textContent = "فعال ✅ | " + String(sub.type || "pro") + " | انقضا: " + exp + " | امروز: " + used + " / " + dl;
    }else{
      statusEl.textContent = "Free (امتیازی) ✅ | امروز: " + used + " / " + dl;
    }
  }

  const wEl = el("subWallet");
  if (wEl && json && typeof json.wallet === "string" && json.wallet) wEl.value = json.wallet;
}

async function refreshUserState(){
  const { json } = await api("/api/user", buildAuthBody({ allowGuest: true }));
  if (json && json.ok){
    applyUserState(json);
    try { cacheUserSnapshot(json); } catch(e) {}
  }
}

__mi_tmp = el("copySubWallet"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const w = (el("subWallet") && el("subWallet").value) ? el("subWallet").value : "";
  const ok = copyText(w);
  if (ok) showToast("کپی شد ✅", "آدرس ولت کپی شد", "COPY", false);
  else showToast("ناموفق", "نتونستم کپی کنم", "COPY", false);
});

__mi_tmp = el("subPlanSelect"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("change", () => {
  const sel = el("subPlanSelect");
  const msg = el("subMsg");
  if (!sel || !msg) return;
  const pid = String(sel.value || "");
  const p = (__SUB_PLANS || []).find((x) => x && x.id === pid);
  if (p){
    msg.textContent = "پلن انتخاب شد ✅ " + String(p.title || p.id) + " | " + Number(p.days || 0) + " روز | " + Number(p.amount || 0) + " USDT | " + Number(p.dailyLimit || 0) + " تحلیل/روز";
  }
});

__mi_tmp = el("submitSubPurchase"); if (__mi_tmp && __mi_tmp.addEventListener) __mi_tmp.addEventListener("click", async () => {
  const sel = el("subPlanSelect");
  const txEl = el("subTxHash");
  const msg = el("subMsg");
  if (!sel || !txEl) return;
  const planId = String(sel.value || "").trim();
  const txHash = String(txEl.value || "").trim();
  if (!planId || !txHash){
    if (msg) msg.textContent = "⚠️ پلن و TxHash را کامل وارد کن.";
    return;
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)){
    if (msg) msg.textContent = "⚠️ TxHash معتبر نیست (باید 0x + 64 کاراکتر باشد).";
    return;
  }
  if (msg) msg.textContent = "⏳ در حال بررسی بلاکچین…";
  const { json } = await api("/api/subscription/purchase", buildAuthBody({ planId, txHash }));
  if (!json || !json.ok){
    if (msg) msg.textContent = "⚠️ ثبت/بررسی ناموفق بود: " + String((json && (json.error || json.reason)) || "unknown");
    return;
  }
  if (json.activated){
    if (msg) msg.textContent = "اشتراک فعال شد ✅";
    showToast("✅ فعال شد", "اشتراک Pro فعال شد", "SUB", false);
    await refreshUserState();
  }else{
    const reason = (json.result && (json.result.reason || json.result.error)) ? String(json.result.reason || json.result.error) : "";
    if (msg) msg.textContent = "⏳ ثبت شد. نتیجه چک: " + (reason || "pending") + " (اگر خودکار تایید نشد، ادمین تایید می‌کند).";
    showToast("⏳ ثبت شد", "در انتظار تایید/بررسی", "SUB", false);
  }
});




if (el("dashSymbol")) {
  el("dashSymbol").addEventListener("change", () => {
    const s = val("dashSymbol");
    setSymbolAll(s);
    refreshLiveQuote(true);
    refreshLiveChart(true);
    refreshNews(true);
  });
}
if (el("newsSymbol")) {
  el("newsSymbol").addEventListener("change", () => {
    const s = val("newsSymbol");
    setSymbolAll(s);
    refreshNews(true);
  });
}
if (el("symbol")) {
  el("symbol").addEventListener("change", () => {
    const s = val("symbol");
    setSymbolAll(s);
    refreshLiveQuote(true);
    refreshLiveChart(true);
    refreshNews(true);
  });
}
if (el("dashTfChips")) {
  el("dashTfChips").addEventListener("click", (ev) => {
    const t = ev.target;
    const tf = t && t.getAttribute ? t.getAttribute("data-tf") : null;
    if (!tf) return;
    setDashTf(tf);
    refreshLiveChart(true);
  });
}
if (el("refreshLiveChartBtn")) {
  el("refreshLiveChartBtn").addEventListener("click", () => refreshLiveChart(false));
}
if (el("refreshMyTicketsBtn")) {
  el("refreshMyTicketsBtn").addEventListener("click", () => refreshMyTickets(false));
}

boot();`;



async function runDailySuggestions(env) {
  if (!env.BOT_KV) return;
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Kyiv", hour: "2-digit", hour12: false }).format(new Date()));
  
  if (![9, 18].includes(hour)) return;
  const users = await listUsers(env, 400);
  for (const u of users) {
    if (!u?.userId || !u?.profile?.phone) continue;
    const market = u.profile?.preferredMarket || "بازار";
    const style = u.style || "پرایس اکشن";
    const symbol = String(u?.selectedSymbol || u?.profile?.preferredSymbol || "BTCUSDT").toUpperCase();
    const cap = u.capital?.enabled === false ? "" : (u.capital?.amount ? (" | سرمایه: " + u.capital.amount) : "");
    const articles = await fetchSymbolNewsFa(symbol, env).catch(() => []);
    const newsBlock = Array.isArray(articles) && articles.length
      ? articles.slice(0, 2).map((x, i) => `${i + 1}) ${x?.title || ""}` ).join(String.fromCharCode(10))
      : "";
    const newsLine = newsBlock
      ? ("\n\n📰 خبر مرتبط " + symbol + ":\n" + newsBlock)
      : "\n\n📰 فعلاً خبر مرتبطی برای این نماد پیدا نشد.";
    const newsSummary = await buildNewsAnalysisSummary(symbol, articles, env);
    const msg =
      "🔔 نوتیف تحلیلی روزانه (۱/۲ یا ۲/۲)\n" +
      "بر اساس پروفایل شما (" + market + " / " + style + cap + ")، برای " + symbol + " امروز ۲ تحلیل برنامه‌ریزی کن: یکی روندی، یکی برگشتی." +
      newsLine +
      "\n\n🧠 جمع‌بندی خبری:\n" + String(newsSummary || "-");
    await tgSendMessage(env, Number(u.userId), msg, mainMenuKeyboard(env));
  }
}


/* =============================================================================
   WEB APP (/web) — Independent browser UI + Email OTP
   - Does NOT touch existing /api/* logic
   - Telegram MiniApp is blocked from normal browsers (forced to /web)
============================================================================= */

function isTelegramWebView(request) {
  const ua = String(request?.headers?.get("user-agent") || "");
  if (!ua) return false;
  // Telegram in-app webview usually contains "Telegram"
  if (/Telegram/i.test(ua)) return true;
  // Some Telegram clients may include these hints:
  if (/TelegramBot/i.test(ua)) return true;
  return false;
}

async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}
function isValidEmail(email) {
  // simple, practical validator
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}
function randomOtp6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isoDayKey(){
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth()+1).padStart(2,"0");
  const da = String(d.getUTCDate()).padStart(2,"0");
  return `${y}${m}${da}`;
}

async function webFingerprint(request){
  const ua = String(request.headers.get("user-agent") || "");
  const ip = String(request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "");
  const raw = `${ip}|${ua}`;
  return await sha256Hex(raw);
}

async function sha256Hex(str) {
  const data = new TextEncoder().encode(String(str || ""));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function webUserIdFromEmail(email, env) {
  // Avoid leaking email in userId; keep it stable.
  const pepper = String(env.WEB_USERID_PEPPER || env.WEB_OTP_PEPPER || "iqm").trim();
  const h = await sha256Hex(`${email}|${pepper}`);
  return `web:${h.slice(0, 24)}`; // 96-bit
}

async function sendOtpEmail(env, email, code) {
  const html = `
    <div style="font-family:ui-sans-serif,system-ui;line-height:1.8">
      <h2>ورود به IQ Market</h2>
      <p>کد یکبارمصرف شما:</p>
      <div style="font-size:28px;font-weight:800;letter-spacing:4px">${code}</div>
      <p style="color:#666">اعتبار کد: ۱۰ دقیقه</p>
    </div>
  `;

  // Provider 1: Resend (recommended)
  if (env.RESEND_API_KEY && env.RESEND_FROM) {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM,
        to: [email],
        subject: "کد ورود IQ Market",
        html,
      }),
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      throw new Error(`RESEND_FAILED:${resp.status} ${t}`);
    }
    return;
  }

  // Provider 2: MailChannels (Cloudflare-friendly)
  if (env.MAILCHANNELS_FROM) {
    const resp = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: env.MAILCHANNELS_FROM, name: "IQ Market" },
        subject: "کد ورود IQ Market",
        content: [{ type: "text/html", value: html }],
      }),
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      throw new Error(`MAILCHANNELS_FAILED:${resp.status} ${t}`);
    }
    return;
  }

  throw new Error("NO_EMAIL_PROVIDER");
}

async function handleWebOtpRequest(request, env) {
  if (!env.BOT_KV) return jsonResponse({ ok: false, error: "kv_not_bound" }, 500);

  const body = await readJson(request);
  if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) return jsonResponse({ ok: false, error: "invalid_email" }, 400);

  // Rate limit: 1 request per 30s per email
  const rlKey = `web:otp:rl:${email}`;
  const rlOk = isWebDebug(request, env) ? true : await kvRateLimit(env, rlKey, 30);
  if (!rlOk) return jsonResponse({ ok: false, error: "too_many_requests" }, 429);

  const code = randomOtp6();
  const pepper = String(env.WEB_OTP_PEPPER || "otp").trim();
  const hash = await sha256Hex(`${email}|${code}|${pepper}`);

  const otpKey = `web:otp:${email}`;
  await env.BOT_KV.put(
    otpKey,
    JSON.stringify({ hash, tries: 0, exp: Date.now() + 10 * 60 * 1000 }),
    { expirationTtl: 60 * 60 }
  );

  const debug = String(env.WEB_OTP_DEBUG || "") === "1";
  if (debug) {
    // For local/dev; DO NOT enable in production.
    return jsonResponse({ ok: true, debugCode: code });
  }

  await sendOtpEmail(env, email, code);
  return jsonResponse({ ok: true });
}

async function handleWebOtpVerify(request, env) {
  if (!env.BOT_KV) return jsonResponse({ ok: false, error: "kv_not_bound" }, 500);

  const body = await readJson(request);
  if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

  const email = normalizeEmail(body.email);
  const code = String(body.code || "").trim();

  if (!isValidEmail(email)) return jsonResponse({ ok: false, error: "invalid_email" }, 400);
  if (!/^\d{6}$/.test(code)) return jsonResponse({ ok: false, error: "invalid_code" }, 400);

  const otpKey = `web:otp:${email}`;
  const raw = await env.BOT_KV.get(otpKey);
  if (!raw) return jsonResponse({ ok: false, error: "otp_expired" }, 400);

  let rec = null;
  try { rec = JSON.parse(raw); } catch {}
  if (!rec?.hash) return jsonResponse({ ok: false, error: "otp_invalid" }, 400);

  if (Number(rec.tries || 0) >= 5) return jsonResponse({ ok: false, error: "otp_locked" }, 429);

  const pepper = String(env.WEB_OTP_PEPPER || "otp").trim();
  const hash = await sha256Hex(`${email}|${code}|${pepper}`);

  if (!timingSafeEqual(hash, rec.hash)) {
    rec.tries = Number(rec.tries || 0) + 1;
    await env.BOT_KV.put(otpKey, JSON.stringify(rec), { expirationTtl: 60 * 60 });
    return jsonResponse({ ok: false, error: "otp_wrong" }, 400);
  }

  // success
  await env.BOT_KV.delete(otpKey);

  const userId = await webUserIdFromEmail(email, env);
  const username = email.split("@")[0].replace(/[^a-z0-9_.]/gi, "_").slice(0, 24);
  const fromLike = { username, first_name: username };

  const st = await ensureUser(userId, env, fromLike);
  st.profile = st.profile || {};
  st.profile.email = email;
  st.profile.lastEntryVia = "web";
  st.profile.lastEntryAt = new Date().toISOString();
  if (env.BOT_KV) await saveUser(userId, st, env);

  const miniToken = await issueMiniappToken(env, userId, fromLike);

  return jsonResponse({ ok: true, miniToken, userId });
}


// ─────────────────────────────────────────────────────────
// Web Accounts (username/password) + Email/Telegram verify
// ─────────────────────────────────────────────────────────

function normalizeUsername(u) {
  return String(u || "").trim().toLowerCase();
}
function isValidUsername(u) {
  const s = String(u || "").trim();
  // Latin only (safe for URLs/DB). 3..24
  return /^[a-zA-Z0-9_.]{3,24}$/.test(s);
}
function normalizeTelegramUsername(u) {
  const s = String(u || "").trim().replace(/^@+/, "");
  return s ? s.toLowerCase() : "";
}

function randomHex(bytesLen = 16) {
  const u8 = crypto.getRandomValues(new Uint8Array(bytesLen));
  return Array.from(u8).map(b => b.toString(16).padStart(2, "0")).join("");
}
const __B64ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const __B64LOOKUP = (() => {
  const t = new Uint8Array(256);
  t.fill(255);
  for (let i = 0; i < __B64ABC.length; i++) t[__B64ABC.charCodeAt(i)] = i;
  t["=".charCodeAt(0)] = 0;
  return t;
})();

function __bytesToBase64(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const t = (a << 16) | (b << 8) | c;
    out += __B64ABC[(t >> 18) & 63];
    out += __B64ABC[(t >> 12) & 63];
    out += i + 1 < bytes.length ? __B64ABC[(t >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? __B64ABC[t & 63] : "=";
  }
  return out;
}

function __base64ToBytes(b64) {
  const s = String(b64 || "").replace(/\s+/g, "");
  if (!s) return new Uint8Array(0);
  if (s.length % 4 !== 0) throw new Error("bad_base64");
  let padding = 0;
  if (s.endsWith("==")) padding = 2;
  else if (s.endsWith("=")) padding = 1;
  const out = new Uint8Array((s.length / 4) * 3 - padding);
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const n0 = __B64LOOKUP[s.charCodeAt(i)];
    const n1 = __B64LOOKUP[s.charCodeAt(i + 1)];
    const n2 = __B64LOOKUP[s.charCodeAt(i + 2)];
    const n3 = __B64LOOKUP[s.charCodeAt(i + 3)];
    if ((n0 | n1 | n2 | n3) === 255) throw new Error("bad_base64");
    const t = (n0 << 18) | (n1 << 12) | (n2 << 6) | n3;
    if (o < out.length) out[o++] = (t >> 16) & 255;
    if (o < out.length) out[o++] = (t >> 8) & 255;
    if (o < out.length) out[o++] = t & 255;
  }
  return out;
}

function u8ToB64(u8) {
  if (typeof btoa === "function") {
    let s = "";
    for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return btoa(s);
  }
  return __bytesToBase64(u8);
}
function b64ToU8Simple(b64) {
  if (typeof atob === "function") {
    const bin = atob(String(b64 || ""));
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }
  return __base64ToBytes(b64);
}

const PBKDF2_MIN_ITERS = 60000;
const PBKDF2_MAX_ITERS = 100000;
const PBKDF2_DEFAULT_ITERS = 100000;

function clampPbkdf2Iters(n) {
  n = Number(n || PBKDF2_DEFAULT_ITERS);
  if (!Number.isFinite(n)) n = PBKDF2_DEFAULT_ITERS;
  n = Math.floor(n);
  if (n < PBKDF2_MIN_ITERS) n = PBKDF2_MIN_ITERS;
  if (n > PBKDF2_MAX_ITERS) n = PBKDF2_MAX_ITERS;
  return n;
}

async function pbkdf2(password, saltU8, iterations, lengthBytes) {
  const enc = new TextEncoder();
  const iters = clampPbkdf2Iters(iterations);
  const key = await crypto.subtle.importKey("raw", enc.encode(String(password || "")), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltU8, iterations: iters, hash: "SHA-256" },
    key,
    Number(lengthBytes || 32) * 8
  );
  return new Uint8Array(bits);
}

async function hashPassword(password, opts = {}) {
  const iters = clampPbkdf2Iters(opts.iterations);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, iters, 32);
  return { saltB64: u8ToB64(salt), hashB64: u8ToB64(hash), iters };
}

async function verifyPassword(password, saltB64, hashB64, iters) {
  const salt = b64ToU8Simple(saltB64);
  const got = await pbkdf2(password, salt, clampPbkdf2Iters(iters), 32);
  const gotB64 = u8ToB64(got);
  return timingSafeEqual(String(gotB64), String(hashB64));
}

let __webAccountsInitPromise = null;

async function initWebAccountsTable(env) {
  if (!env.BOT_DB) throw new Error("db_not_bound");
  if (__webAccountsInitPromise) return __webAccountsInitPromise;

  __webAccountsInitPromise = (async () => {
    // Keep as TEXT for portability across tools.
    await env.BOT_DB.prepare(`CREATE TABLE IF NOT EXISTS web_accounts (
      userId TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      usernameNorm TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      emailNorm TEXT NOT NULL UNIQUE,
      emailVerified INTEGER NOT NULL DEFAULT 0,
      telegramUsername TEXT,
      telegramUsernameNorm TEXT,
      telegramChatId TEXT,
      telegramVerified INTEGER NOT NULL DEFAULT 0,
      passSaltB64 TEXT NOT NULL,
      passHashB64 TEXT NOT NULL,
      passIters INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )`).run();
    await env.BOT_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_web_accounts_emailNorm ON web_accounts(emailNorm)`).run();
    await env.BOT_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_web_accounts_tgChatId ON web_accounts(telegramChatId)`).run();
  })().catch((e) => {
    __webAccountsInitPromise = null;
    throw e;
  });

  return __webAccountsInitPromise;
}

async function dbWebGetByUserId(env, userId) {
  await initWebAccountsTable(env);
  return await env.BOT_DB.prepare(`SELECT * FROM web_accounts WHERE userId=?1`).bind(String(userId)).first();
}
async function dbWebGetByUsernameNorm(env, usernameNorm) {
  await initWebAccountsTable(env);
  return await env.BOT_DB.prepare(`SELECT * FROM web_accounts WHERE usernameNorm=?1`).bind(String(usernameNorm)).first();
}
async function dbWebGetByEmailNorm(env, emailNorm) {
  await initWebAccountsTable(env);
  return await env.BOT_DB.prepare(`SELECT * FROM web_accounts WHERE emailNorm=?1`).bind(String(emailNorm)).first();
}
async function dbWebGetByTelegramChatId(env, chatId) {
  await initWebAccountsTable(env);
  return await env.BOT_DB.prepare(`SELECT * FROM web_accounts WHERE telegramChatId=?1`).bind(String(chatId)).first();
}
async function dbWebInsert(env, row) {
  await initWebAccountsTable(env);
  const now = Date.now();
  const createdAt = Number(row.createdAt || now);
  const updatedAt = Number(row.updatedAt || now);
  await env.BOT_DB.prepare(`
    INSERT INTO web_accounts
      (userId, username, usernameNorm, email, emailNorm, emailVerified,
       telegramUsername, telegramUsernameNorm, telegramChatId, telegramVerified,
       passSaltB64, passHashB64, passIters, createdAt, updatedAt)
    VALUES
      (?1, ?2, ?3, ?4, ?5, ?6,
       ?7, ?8, ?9, ?10,
       ?11, ?12, ?13, ?14, ?15)
  `).bind(
    String(row.userId),
    String(row.username),
    String(row.usernameNorm),
    String(row.email),
    String(row.emailNorm),
    Number(row.emailVerified || 0),
    row.telegramUsername ? String(row.telegramUsername) : null,
    row.telegramUsernameNorm ? String(row.telegramUsernameNorm) : null,
    row.telegramChatId ? String(row.telegramChatId) : null,
    Number(row.telegramVerified || 0),
    String(row.passSaltB64),
    String(row.passHashB64),
    Number(row.passIters || 120000),
    createdAt,
    updatedAt
  ).run();
}

async function dbWebSetEmailVerified(env, userId, verified) {
  await initWebAccountsTable(env);
  await env.BOT_DB.prepare(`UPDATE web_accounts SET emailVerified=?1, updatedAt=?2 WHERE userId=?3`)
    .bind(Number(verified ? 1 : 0), Date.now(), String(userId)).run();
}
async function dbWebSetTelegramLink(env, userId, chatId, tgUsername) {
  await initWebAccountsTable(env);
  const tn = normalizeTelegramUsername(tgUsername);
  await env.BOT_DB.prepare(`
    UPDATE web_accounts
    SET telegramChatId=?1, telegramUsername=?2, telegramUsernameNorm=?3, updatedAt=?4
    WHERE userId=?5
  `).bind(String(chatId), tn || null, tn || null, Date.now(), String(userId)).run();
}
async function dbWebSetTelegramVerified(env, userId, verified) {
  await initWebAccountsTable(env);
  await env.BOT_DB.prepare(`UPDATE web_accounts SET telegramVerified=?1, updatedAt=?2 WHERE userId=?3`)
    .bind(Number(verified ? 1 : 0), Date.now(), String(userId)).run();
}


async function dbWebUpdatePassword(env, userId, pw) {
  await initWebAccountsTable(env);
  await env.BOT_DB.prepare(`UPDATE web_accounts
    SET passSaltB64=?1, passHashB64=?2, passIters=?3, updatedAt=?4
    WHERE userId=?5`)
    .bind(
      String(pw.saltB64 || ""),
      String(pw.hashB64 || ""),
      Number(pw.iters || PBKDF2_DEFAULT_ITERS),
      Date.now(),
      String(userId)
    )
    .run();
}

function stripSecretFields(acc) {
  if (!acc) return null;
  return {
    userId: String(acc.userId),
    username: String(acc.username),
    email: String(acc.email),
    emailVerified: Number(acc.emailVerified || 0) === 1,
    telegramUsername: acc.telegramUsername ? String(acc.telegramUsername) : "",
    telegramChatId: acc.telegramChatId ? String(acc.telegramChatId) : "",
    telegramVerified: Number(acc.telegramVerified || 0) === 1,
    createdAt: Number(acc.createdAt || 0),
    updatedAt: Number(acc.updatedAt || 0),
  };
}

function clientIpFromReq(request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    ""
  ).split(",")[0].trim();
}

async function sendEmailVerification(env, email, code) {
  const html = `
    <div style="font-family:ui-sans-serif,system-ui;line-height:1.8">
      <h2>تأیید ایمیل — IQ Market</h2>
      <p>کد تأیید:</p>
      <div style="font-size:28px;font-weight:800;letter-spacing:4px">${code}</div>
      <p style="color:#666">اعتبار کد: ۱۰ دقیقه</p>
    </div>
  `;

  if (env.RESEND_API_KEY && env.RESEND_FROM) {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM,
        to: [email],
        subject: "کد تایید ایمیل IQ Market",
        html,
      }),
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      throw new Error(`RESEND_FAILED:${resp.status} ${t}`);
    }
    return;
  }

  if (env.MAILCHANNELS_FROM) {
    const resp = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: env.MAILCHANNELS_FROM, name: "IQ Market" },
        subject: "کد تایید ایمیل IQ Market",
        content: [{ type: "text/html", value: html }],
      }),
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      throw new Error(`MAILCHANNELS_FAILED:${resp.status} ${t}`);
    }
    return;
  }

  throw new Error("NO_EMAIL_PROVIDER");
}


async function sendPasswordResetEmail(env, email, code) {
  const html = `
    <div style="font-family:ui-sans-serif,system-ui;line-height:1.8">
      <h2>بازیابی رمز عبور — IQ Market</h2>
      <p>کد بازیابی:</p>
      <div style="font-size:28px;font-weight:800;letter-spacing:4px">${code}</div>
      <p style="color:#666">اعتبار کد: ۱۰ دقیقه</p>
      <p style="color:#666">اگر شما درخواست این کد را نداده‌اید، این پیام را نادیده بگیرید.</p>
    </div>
  `;

  if (env.RESEND_API_KEY && env.RESEND_FROM) {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM,
        to: [email],
        subject: "کد بازیابی رمز عبور — IQ Market",
        html,
      }),
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      throw new Error(`RESEND_FAILED:${resp.status} ${t}`);
    }
    return;
  }

  if (env.MAILCHANNELS_FROM) {
    const resp = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: env.MAILCHANNELS_FROM, name: "IQ Market" },
        subject: "کد بازیابی رمز عبور — IQ Market",
        content: [{ type: "text/html", value: html }],
      }),
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      throw new Error(`MAILCHANNELS_FAILED:${resp.status} ${t}`);
    }
    return;
  }

  throw new Error("NO_EMAIL_PROVIDER");
}


async function webVerifyHash(userId, code, purpose, env) {
  const pepper = String(env.WEB_VERIFY_PEPPER || env.WEB_OTP_PEPPER || "otp").trim();
  return await sha256Hex(`${String(userId)}|${String(code)}|${String(purpose)}|${pepper}`);
}

async function handleWebSignup(request, env) {
  if (!env.BOT_DB) return jsonResponse({ ok: false, error: "db_not_bound" }, 500);
  if (!env.BOT_KV) return jsonResponse({ ok: false, error: "kv_not_bound" }, 500);

  const body = await readJson(request);
  if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

  const email = normalizeEmail(body.email);
  const username = String(body.username || "").trim();
  const usernameNorm = normalizeUsername(username);
  const password = String(body.password || "");
  const telegramUsername = normalizeTelegramUsername(body.telegramUsername);

  if (!isValidEmail(email)) return jsonResponse({ ok: false, error: "invalid_email" }, 400);
  if (!isValidUsername(username)) return jsonResponse({ ok: false, error: "invalid_username" }, 400);
  if (password.length < 8) return jsonResponse({ ok: false, error: "weak_password" }, 400);

  // Simple RL: per IP (60s)
  const ip = clientIpFromReq(request);
  const rlKey = `web:signup:rl:${ip || "na"}`;
  if (!isWebDebug(request, env) && ip) {
    const rlOk = await kvRateLimit(env, rlKey, 20);
    if (!rlOk) return jsonResponse({ ok: false, error: "too_many_requests" }, 429);
  }

  const emailNorm = normalizeEmail(email);

  const existingU = await dbWebGetByUsernameNorm(env, usernameNorm);
  if (existingU) return jsonResponse({ ok: false, error: "username_taken" }, 409);

  const existingE = await dbWebGetByEmailNorm(env, emailNorm);
  if (existingE) return jsonResponse({ ok: false, error: "email_taken" }, 409);

  const pw = await hashPassword(password);

    const rid = (typeof crypto?.randomUUID === "function") ? crypto.randomUUID() : randomHex(16);
  const userId = `web:${rid}`;
  await dbWebInsert(env, {
    userId,
    username,
    usernameNorm,
    email,
    emailNorm,
    emailVerified: 0,
    telegramUsername: telegramUsername || null,
    telegramUsernameNorm: telegramUsername || null,
    telegramChatId: null,
    telegramVerified: 0,
    passSaltB64: pw.saltB64,
    passHashB64: pw.hashB64,
    passIters: pw.iters,
  });

  const fromLike = { username: usernameNorm, first_name: username };
  const st = await ensureUser(userId, env, fromLike);
  st.profile = st.profile || {};
  st.profile.email = email;
  if (telegramUsername) st.profile.telegramUsername = telegramUsername;
  st.profile.lastEntryVia = "web";
  st.profile.lastEntryAt = new Date().toISOString();
  if (env.BOT_KV) await saveUser(userId, st, env);

  const miniToken = await issueMiniappToken(env, userId, fromLike);
  return jsonResponse({ ok: true, miniToken, userId });
}

async function handleWebLogin(request, env) {
  if (!env.BOT_DB) return jsonResponse({ ok: false, error: "db_not_bound" }, 500);
  if (!env.BOT_KV) return jsonResponse({ ok: false, error: "kv_not_bound" }, 500);

  const body = await readJson(request);
  if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

  const usernameOrEmail = String(body.usernameOrEmail || "").trim();
  const password = String(body.password || "");

  if (!usernameOrEmail || password.length < 1) return jsonResponse({ ok: false, error: "missing_fields" }, 400);

  const ip = clientIpFromReq(request);
  const keyNorm = normalizeUsername(usernameOrEmail);
  const rlKey = `web:login:rl:${ip || "na"}:${keyNorm.slice(0, 24)}`;
  const rlOk = isWebDebug(request, env) ? true : await kvRateLimit(env, rlKey, 2);
  if (!rlOk) return jsonResponse({ ok: false, error: "too_many_requests" }, 429);

  const isEmail = isValidEmail(usernameOrEmail);
  const acc = isEmail
    ? await dbWebGetByEmailNorm(env, normalizeEmail(usernameOrEmail))
    : await dbWebGetByUsernameNorm(env, normalizeUsername(usernameOrEmail));

  if (!acc) return jsonResponse({ ok: false, error: "invalid_credentials" }, 401);

  const passOk = await verifyPassword(password, acc.passSaltB64, acc.passHashB64, acc.passIters);
  if (!passOk) return jsonResponse({ ok: false, error: "invalid_credentials" }, 401);

  const userId = String(acc.userId);
  const fromLike = { username: String(acc.usernameNorm || acc.username || "web_user"), first_name: String(acc.username || "web") };
  const st = await ensureUser(userId, env, fromLike);
  st.profile = st.profile || {};
  st.profile.email = String(acc.email || "");
  if (acc.telegramUsername) st.profile.telegramUsername = String(acc.telegramUsername);
  st.profile.lastEntryVia = "web";
  st.profile.lastEntryAt = new Date().toISOString();
  if (env.BOT_KV) await saveUser(userId, st, env);

  const miniToken = await issueMiniappToken(env, userId, fromLike);
  return jsonResponse({ ok: true, miniToken, userId });
}


async function handleWebPasswordResetRequest(request, env) {
  if (!env.BOT_DB) return jsonResponse({ ok: false, error: "db_not_bound" }, 500);
  if (!env.BOT_KV) return jsonResponse({ ok: false, error: "kv_not_bound" }, 500);

  const body = await readJson(request);
  if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

  const usernameOrEmail = String(body.usernameOrEmail || "").trim();
  const channel = String(body.channel || "email").toLowerCase(); // email | telegram
  if (!usernameOrEmail) return jsonResponse({ ok: false, error: "missing_fields" }, 400);

  const ip = clientIpFromReq(request);
  const norm = normalizeUsername(usernameOrEmail).slice(0, 24);
  const rlKey = `web:pwreset:req:rl:${ip || "na"}:${norm}`;
  const rlOk = isWebDebug(request, env) ? true : await kvRateLimit(env, rlKey, 30);
  if (!rlOk) return jsonResponse({ ok: false, error: "too_many_requests" }, 429);

  const isEmail = isValidEmail(usernameOrEmail);
  const acc = isEmail
    ? await dbWebGetByEmailNorm(env, normalizeEmail(usernameOrEmail))
    : await dbWebGetByUsernameNorm(env, normalizeUsername(usernameOrEmail));

  if (!acc) return jsonResponse({ ok: false, error: "account_not_found" }, 404);

  const userId = String(acc.userId);
  const code = randomOtp6();
  const hash = await webVerifyHash(userId, code, "pwreset", env);
  const k = `web:pwreset:${userId}`;
  await env.BOT_KV.put(k, JSON.stringify({ hash, tries: 0, exp: Date.now() + 10 * 60 * 1000 }), { expirationTtl: 60 * 60 });

  const debug = String(env.WEB_OTP_DEBUG || "") === "1";

  if (!debug) {
    if (channel === "telegram") {
      const chatId = String(acc.telegramChatId || "");
      if (!chatId) return jsonResponse({ ok: false, error: "telegram_not_linked" }, 400);
      await tgSendMessage(env, chatId, `🔐 کد بازیابی رمز عبور وب:\n\n${code}\n\nاعتبار: ۱۰ دقیقه`, kb([[BTN.HOME]]));
    } else {
      const email = String(acc.email || "");
      if (!isValidEmail(email)) return jsonResponse({ ok: false, error: "invalid_email" }, 400);
      await sendPasswordResetEmail(env, email, code);
    }
  }

  return jsonResponse({ ok: true, ...(debug ? { debugCode: code } : {}) });
}

async function handleWebPasswordResetConfirm(request, env) {
  if (!env.BOT_DB) return jsonResponse({ ok: false, error: "db_not_bound" }, 500);
  if (!env.BOT_KV) return jsonResponse({ ok: false, error: "kv_not_bound" }, 500);

  const body = await readJson(request);
  if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

  const usernameOrEmail = String(body.usernameOrEmail || "").trim();
  const code = String(body.code || "").trim();
  const newPassword = String(body.newPassword || "");

  if (!usernameOrEmail || !code || !newPassword) return jsonResponse({ ok: false, error: "missing_fields" }, 400);
  if (!/^\d{6}$/.test(code)) return jsonResponse({ ok: false, error: "invalid_code" }, 400);
  if (newPassword.length < 8) return jsonResponse({ ok: false, error: "weak_password" }, 400);

  const isEmail = isValidEmail(usernameOrEmail);
  const acc = isEmail
    ? await dbWebGetByEmailNorm(env, normalizeEmail(usernameOrEmail))
    : await dbWebGetByUsernameNorm(env, normalizeUsername(usernameOrEmail));

  if (!acc) return jsonResponse({ ok: false, error: "account_not_found" }, 404);

  const userId = String(acc.userId);
  const k = `web:pwreset:${userId}`;
  const raw = await env.BOT_KV.get(k);
  if (!raw) return jsonResponse({ ok: false, error: "otp_expired" }, 400);

  let rec = null;
  try { rec = JSON.parse(raw); } catch {}
  if (!rec?.hash) return jsonResponse({ ok: false, error: "otp_invalid" }, 400);
  if (Number(rec.tries || 0) >= 5) return jsonResponse({ ok: false, error: "otp_locked" }, 429);
  if (rec.exp && Date.now() > Number(rec.exp)) return jsonResponse({ ok: false, error: "otp_expired" }, 400);

  const want = await webVerifyHash(userId, code, "pwreset", env);
  if (!timingSafeEqual(want, rec.hash)) {
    rec.tries = Number(rec.tries || 0) + 1;
    await env.BOT_KV.put(k, JSON.stringify(rec), { expirationTtl: 60 * 60 });
    return jsonResponse({ ok: false, error: "otp_wrong" }, 401);
  }

  await env.BOT_KV.delete(k).catch(() => {});

  const pw = await hashPassword(newPassword, { iterations: PBKDF2_DEFAULT_ITERS });
  await dbWebUpdatePassword(env, userId, pw);

  const fromLike = { username: String(acc.usernameNorm || acc.username || "web_user"), first_name: String(acc.username || "web") };
  const miniToken = await issueMiniappToken(env, userId, fromLike);

  return jsonResponse({ ok: true, miniToken, userId });
}

async function handleWebPasswordChange(request, env) {
  if (!env.BOT_DB) return jsonResponse({ ok: false, error: "db_not_bound" }, 500);

  const body = await readJson(request);
  if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

  const v = await verifyMiniappAuth(body, env);
  if (!v.ok) return jsonResponse({ ok: false, error: v.reason }, 401);

  const oldPassword = String(body.oldPassword || "");
  const newPassword = String(body.newPassword || "");
  if (!oldPassword || !newPassword) return jsonResponse({ ok: false, error: "missing_fields" }, 400);
  if (newPassword.length < 8) return jsonResponse({ ok: false, error: "weak_password" }, 400);

  const acc = await dbWebGetByUserId(env, v.userId);
  if (!acc) return jsonResponse({ ok: false, error: "account_not_found" }, 404);

  const passOk = await verifyPassword(oldPassword, acc.passSaltB64, acc.passHashB64, acc.passIters);
  if (!passOk) return jsonResponse({ ok: false, error: "invalid_credentials" }, 401);

  const pw = await hashPassword(newPassword, { iterations: PBKDF2_DEFAULT_ITERS });
  await dbWebUpdatePassword(env, String(v.userId), pw);

  return jsonResponse({ ok: true });
}

async function handleWebAccountGet(request, env) {
  if (!env.BOT_DB) return jsonResponse({ ok: false, error: "db_not_bound" }, 500);
  const body = await readJson(request);
  if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

  const v = await verifyMiniappAuth(body, env);
  if (!v.ok) return jsonResponse({ ok: false, error: v.reason }, 401);

  const acc = await dbWebGetByUserId(env, v.userId);
  if (!acc) return jsonResponse({ ok: false, error: "account_not_found" }, 404);
  return jsonResponse({ ok: true, account: stripSecretFields(acc) });
}

async function handleWebEmailVerifyRequest(request, env) {
  if (!env.BOT_DB) return jsonResponse({ ok: false, error: "db_not_bound" }, 500);
  if (!env.BOT_KV) return jsonResponse({ ok: false, error: "kv_not_bound" }, 500);

  const body = await readJson(request);
  if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

  const v = await verifyMiniappAuth(body, env);
  if (!v.ok) return jsonResponse({ ok: false, error: v.reason }, 401);

  const acc = await dbWebGetByUserId(env, v.userId);
  if (!acc) return jsonResponse({ ok: false, error: "account_not_found" }, 404);
  if (Number(acc.emailVerified || 0) === 1) return jsonResponse({ ok: true, already: true });

  // Rate limit: 1 req / 30s / user
  const rlKey = `web:emailv:rl:${String(v.userId)}`;
  const rlOk = isWebDebug(request, env) ? true : await kvRateLimit(env, rlKey, 30);
  if (!rlOk) return jsonResponse({ ok: false, error: "too_many_requests" }, 429);

  const code = randomOtp6();
  const hash = await webVerifyHash(v.userId, code, "email", env);
  const k = `web:verify:email:${String(v.userId)}`;
  await env.BOT_KV.put(k, JSON.stringify({ hash, tries: 0, exp: Date.now() + 10 * 60 * 1000 }), { expirationTtl: 60 * 60 });

  const debug = String(env.WEB_OTP_DEBUG || "") === "1";
  if (debug) return jsonResponse({ ok: true, debugCode: code });

  await sendEmailVerification(env, String(acc.email), code);
  return jsonResponse({ ok: true });
}

async function handleWebEmailVerifyConfirm(request, env) {
  if (!env.BOT_DB) return jsonResponse({ ok: false, error: "db_not_bound" }, 500);
  if (!env.BOT_KV) return jsonResponse({ ok: false, error: "kv_not_bound" }, 500);

  const body = await readJson(request);
  if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

  const v = await verifyMiniappAuth(body, env);
  if (!v.ok) return jsonResponse({ ok: false, error: v.reason }, 401);

  const code = String(body.code || "").trim();
  if (!/^\d{6}$/.test(code)) return jsonResponse({ ok: false, error: "invalid_code" }, 400);

  const k = `web:verify:email:${String(v.userId)}`;
  const raw = await env.BOT_KV.get(k);
  if (!raw) return jsonResponse({ ok: false, error: "otp_expired" }, 400);

  let rec = null;
  try { rec = JSON.parse(raw); } catch {}
  if (!rec?.hash) return jsonResponse({ ok: false, error: "otp_invalid" }, 400);
  if (Number(rec.tries || 0) >= 5) return jsonResponse({ ok: false, error: "otp_locked" }, 429);

  const hash = await webVerifyHash(v.userId, code, "email", env);
  if (!timingSafeEqual(hash, rec.hash)) {
    rec.tries = Number(rec.tries || 0) + 1;
    await env.BOT_KV.put(k, JSON.stringify(rec), { expirationTtl: 60 * 60 });
    return jsonResponse({ ok: false, error: "otp_wrong" }, 400);
  }

  await env.BOT_KV.delete(k);
  await dbWebSetEmailVerified(env, v.userId, true);
  return jsonResponse({ ok: true });
}

function randomLinkCode() {
  const raw = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(raw).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function handleWebTelegramLink(request, env) {
  if (!env.BOT_KV) return jsonResponse({ ok: false, error: "kv_not_bound" }, 500);

  const body = await readJson(request);
  if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

  const v = await verifyMiniappAuth(body, env);
  if (!v.ok) return jsonResponse({ ok: false, error: v.reason }, 401);

  const code = randomLinkCode();
  const key = `web:tg_link:${code}`;
  await env.BOT_KV.put(key, JSON.stringify({ userId: String(v.userId), exp: Date.now() + 20 * 60 * 1000 }), { expirationTtl: 60 * 60 });

  const botUser = String(env.TELEGRAM_BOT_USERNAME || "marketiq_ai_bot").replace(/^@+/, "");
  const url = `https://t.me/${botUser}?start=wv_${code}`;
  return jsonResponse({ ok: true, url, code });
}

async function consumeWebTelegramLink(env, code) {
  if (!env.BOT_KV) return "";
  const key = `web:tg_link:${String(code || "").trim()}`;
  const raw = await env.BOT_KV.get(key);
  if (!raw) return "";
  try {
    const j = JSON.parse(raw);
    const userId = String(j?.userId || "").trim();
    await env.BOT_KV.delete(key);
    return userId;
  } catch {
    await env.BOT_KV.delete(key);
    return "";
  }
}

async function tryHandleWebTelegramLinkFromStart(env, chatId, from, st, refArg) {
  const arg = String(refArg || "").trim();
  if (!arg) return false;

  const m = arg.match(/^wv_(.+)$/);
  if (!m) return false;

  const code = String(m[1] || "").trim();
  if (!code) return true;

  const webUserId = await consumeWebTelegramLink(env, code);
  if (!webUserId) {
    await tgSendMessage(env, chatId, "⛔️ لینک اتصال وب نامعتبر یا منقضی شده است.", mainMenuKeyboard(env));
    return true;
  }

  if (!env.BOT_DB) {
    await tgSendMessage(env, chatId, "⛔️ دیتابیس فعال نیست (BOT_DB).", mainMenuKeyboard(env));
    return true;
  }

  const acc = await dbWebGetByUserId(env, webUserId);
  if (!acc) {
    await tgSendMessage(env, chatId, "⛔️ اکانت وب پیدا نشد. اول از وب ثبت‌نام کن.", mainMenuKeyboard(env));
    return true;
  }

  // Prevent linking same telegram chat to multiple web accounts
  const other = await dbWebGetByTelegramChatId(env, String(chatId));
  if (other && String(other.userId) !== String(webUserId)) {
    await tgSendMessage(env, chatId, "⛔️ این تلگرام قبلاً به یک اکانت وب دیگر متصل شده است.", mainMenuKeyboard(env));
    return true;
  }

  await dbWebSetTelegramLink(env, webUserId, String(chatId), from?.username || "");
  await tgSendMessage(
    env,
    chatId,
    "✅ اتصال اکانت وب انجام شد.\n\nحالا از داخل پنل وب می‌تونی «OTP تلگرام» بگیری و تایید کنی.",
    mainMenuKeyboard(env)
  );

  return true;
}

async function handleWebTelegramOtpRequest(request, env) {
  if (!env.BOT_DB) return jsonResponse({ ok: false, error: "db_not_bound" }, 500);
  if (!env.BOT_KV) return jsonResponse({ ok: false, error: "kv_not_bound" }, 500);

  const body = await readJson(request);
  if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

  const v = await verifyMiniappAuth(body, env);
  if (!v.ok) return jsonResponse({ ok: false, error: v.reason }, 401);

  const acc = await dbWebGetByUserId(env, v.userId);
  if (!acc) return jsonResponse({ ok: false, error: "account_not_found" }, 404);

  const chatId = String(acc.telegramChatId || "");
  if (!chatId) return jsonResponse({ ok: false, error: "telegram_not_linked" }, 400);

  // Rate limit: 1 req / 20s / user
  const rlKey = `web:tgv:rl:${String(v.userId)}`;
  const rlOk = isWebDebug(request, env) ? true : await kvRateLimit(env, rlKey, 20);
  if (!rlOk) return jsonResponse({ ok: false, error: "too_many_requests" }, 429);

  const code = randomOtp6();
  const hash = await webVerifyHash(v.userId, code, "tg", env);
  const k = `web:verify:tg:${String(v.userId)}`;
  await env.BOT_KV.put(k, JSON.stringify({ hash, tries: 0, exp: Date.now() + 10 * 60 * 1000 }), { expirationTtl: 60 * 60 });

  const debug = String(env.WEB_OTP_DEBUG || "") === "1";
  if (!debug) {
    await tgSendMessage(env, chatId, `🔐 کد تایید حساب وب:\n\n${code}\n\nاعتبار: ۱۰ دقیقه`, kb([[BTN.HOME]]));
  }
  return jsonResponse({ ok: true, ...(debug ? { debugCode: code } : {}) });
}

async function handleWebTelegramOtpConfirm(request, env) {
  if (!env.BOT_DB) return jsonResponse({ ok: false, error: "db_not_bound" }, 500);
  if (!env.BOT_KV) return jsonResponse({ ok: false, error: "kv_not_bound" }, 500);

  const body = await readJson(request);
  if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

  const v = await verifyMiniappAuth(body, env);
  if (!v.ok) return jsonResponse({ ok: false, error: v.reason }, 401);

  const code = String(body.code || "").trim();
  if (!/^\d{6}$/.test(code)) return jsonResponse({ ok: false, error: "invalid_code" }, 400);

  const k = `web:verify:tg:${String(v.userId)}`;
  const raw = await env.BOT_KV.get(k);
  if (!raw) return jsonResponse({ ok: false, error: "otp_expired" }, 400);

  let rec = null;
  try { rec = JSON.parse(raw); } catch {}
  if (!rec?.hash) return jsonResponse({ ok: false, error: "otp_invalid" }, 400);
  if (Number(rec.tries || 0) >= 5) return jsonResponse({ ok: false, error: "otp_locked" }, 429);

  const hash = await webVerifyHash(v.userId, code, "tg", env);
  if (!timingSafeEqual(hash, rec.hash)) {
    rec.tries = Number(rec.tries || 0) + 1;
    await env.BOT_KV.put(k, JSON.stringify(rec), { expirationTtl: 60 * 60 });
    return jsonResponse({ ok: false, error: "otp_wrong" }, 400);
  }

  await env.BOT_KV.delete(k);
  await dbWebSetTelegramVerified(env, v.userId, true);
  return jsonResponse({ ok: true });
}

function pickWebR2(env) {
  // use MARKET_R2 by default
  return env.MARKET_R2 || env.BOT_R2 || env.R2 || null;
}

async function serveWebLogo(env) {
  // Prefer KV branding logo if provided
  try {
    if (env.BOT_KV && env.BOT_KV.get) {
      const kvSvg = await env.BOT_KV.get("branding:logoSvg");
      if (kvSvg && String(kvSvg).trim().startsWith("<svg")) {
        return new Response(String(kvSvg), {
          status: 200,
          headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-store" },
        });
      }
    }
  } catch (e) {}
  const r2 = pickWebR2(env);
  const key = String(env.WEB_LOGO_KEY || "branding/logo.svg");
  if (r2 && r2.get) {
    try {
      const obj = await r2.get(key);
      if (obj) {
        const headers = new Headers();
        headers.set("Cache-Control", "public, max-age=300");
        headers.set("Content-Type", obj.httpMetadata?.contentType || "image/svg+xml");
        return new Response(obj.body, { headers });
      }
    } catch (e) {}
  }

  // fallback SVG
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
    <rect width="240" height="64" rx="14" fill="#0B1220"/>
    <path d="M34 46V18h8l10 14 10-14h8v28h-8V31l-10 13-10-13v15h-8z" fill="#8BE9FD"/>
    <text x="108" y="40" font-family="ui-sans-serif,system-ui" font-size="20" fill="#E5E7EB">IQ Market</text>
  </svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=300" } });
}

async function getBranding(env){
  const defaults = {
    title: "IQ Market",
    tagline: "هوش تحلیلی شما در بازارهای مالی",
    presentation: "تحلیل بازار، سیگنال، اخبار و ابزارهای مدیریت ریسک — در یک داشبورد حرفه‌ای.",
  };
  if (!env.BOT_KV) return defaults;
  try {
    const [title, tagline, presentation] = await Promise.all([
      env.BOT_KV.get("branding:title"),
      env.BOT_KV.get("branding:tagline"),
      env.BOT_KV.get("branding:presentation"),
    ]);
    return {
      title: (title && String(title).trim()) ? String(title).trim() : defaults.title,
      tagline: (tagline && String(tagline).trim()) ? String(tagline).trim() : defaults.tagline,
      presentation: (presentation && String(presentation).trim()) ? String(presentation).trim() : defaults.presentation,
    };
  } catch {
    return defaults;
  }
}

async function setBranding(env, patch){
  const b = await getBranding(env);
  if (!env.BOT_KV) return b;

  const out = {
    title: typeof patch?.title === "string" ? patch.title.trim() : b.title,
    tagline: typeof patch?.tagline === "string" ? patch.tagline.trim() : b.tagline,
    presentation: typeof patch?.presentation === "string" ? patch.presentation.trim() : b.presentation,
  };

  try {
    if (typeof patch?.title === "string") await env.BOT_KV.put("branding:title", out.title);
    if (typeof patch?.tagline === "string") await env.BOT_KV.put("branding:tagline", out.tagline);
    if (typeof patch?.presentation === "string") await env.BOT_KV.put("branding:presentation", out.presentation);

    if (typeof patch?.logoSvg === "string") {
      const svg = patch.logoSvg.trim();
      if (!svg) {
        await env.BOT_KV.delete("branding:logoSvg");
      } else if (svg.startsWith("<svg")) {
        await env.BOT_KV.put("branding:logoSvg", svg);
      } else {
        // keep previous if invalid
      }
    }
  } catch {}

  return await getBranding(env);
}

function buildUserFullReportSummary(st, payments, withdrawals, commissionWithdrawals, tickets, env){
  const username = normHandle(st?.profile?.username || "");
  const userId = Number(st?.userId || st?.id || 0) || 0;

  const pts = ensurePoints(st).points;
  const sub = st?.subscription || {};
  const now = Date.now();
  const exp = sub?.expiresAt ? Date.parse(sub.expiresAt) : 0;
  const subActive = !!sub?.active && (!exp || exp > now);

  const dailyLim = dailyLimit(env, st);
  const dailyUsed = Number(st?.dailyUsed || 0);

  const payTotal = payments.reduce((s, p) => s + Number(p?.amount || 0), 0);
  const payApproved = payments.filter((p) => String(p?.status || "pending") === "approved").length;

  const wdTotal = withdrawals.reduce((s, w) => s + Number(w?.amount || 0), 0);
  const wdApproved = withdrawals.filter((w) => String(w?.status || "pending") === "approved").length;

  const cwdTotal = commissionWithdrawals.reduce((s, w) => s + Number(w?.amount || 0), 0);
  const cwdApproved = commissionWithdrawals.filter((w) => String(w?.status || "pending") === "approved").length;

  return {
    userId,
    username,
    createdAt: st?.createdAt || "",
    lastSeenAt: st?.lastSeenAt || "",
    lastAnalysisAt: st?.stats?.lastAnalysisAt || "",
    totalAnalyses: st?.stats?.successfulAnalyses || 0,
    points: { balance: Number(pts.balance||0), spent: Number(pts.spent||0), earnedFromInvites: Number(pts.earnedFromInvites||0) },
    subscription: {
      active: subActive,
      type: sub?.type || "free",
      plan: sub?.plan || "",
      expiresAt: sub?.expiresAt || "",
      startedAt: sub?.startedAt || "",
    },
    usage: { dailyLimit: dailyLim, dailyUsed },
    referral: {
      code: st?.referral?.codes?.[0] || st?.referral?.code || "",
      referredBy: st?.referral?.referredBy || "",
      successfulInvites: st?.referral?.successfulInvites || 0,
      commissionBalance: Number(st?.referral?.commissionBalance || 0),
    },
    finance: {
      payments: { count: payments.length, approved: payApproved, total: roundMoney(payTotal), lastAt: payments?.[0]?.createdAt || "" },
      withdrawals: { count: withdrawals.length, approved: wdApproved, total: roundMoney(wdTotal), lastAt: withdrawals?.[0]?.createdAt || "" },
      commissionWithdrawals: { count: commissionWithdrawals.length, approved: cwdApproved, total: roundMoney(cwdTotal), lastAt: commissionWithdrawals?.[0]?.createdAt || "" },
    },
    tickets: { count: tickets.length, open: tickets.filter((t) => String(t?.status||"open") !== "closed").length },
  };
}



// Optional: upload logo (owner only) — expects { webToken, base64, contentType }
async function handleWebLogoUpload(request, env) {
  const r2 = pickWebR2(env);
  if (!r2 || !r2.put) return jsonResponse({ ok: false, error: "r2_not_bound" }, 500);

  const body = await readJson(request);
  if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

  const webToken = String(body.webToken || "");
  const ownerTok = String(env.WEB_OWNER_TOKEN || "").trim();
  if (!ownerTok || !timingSafeEqual(webToken, ownerTok)) {
    return jsonResponse({ ok: false, error: "forbidden" }, 403);
  }

  const contentType = String(body.contentType || "image/svg+xml");
  const b64 = String(body.base64 || "");
  const m = b64.match(/^data:.*?;base64,(.+)$/);
  const payload = m ? m[1] : b64;
  if (!payload) return jsonResponse({ ok: false, error: "empty" }, 400);

  const bytes = Uint8Array.from(atob(payload), c => c.charCodeAt(0));
  const key = String(env.WEB_LOGO_KEY || "branding/logo.svg");
  await r2.put(key, bytes, { httpMetadata: { contentType } });

  return jsonResponse({ ok: true, key });
}


const HOME_HTML = String.raw`<!doctype html>
<html lang="__LANG__" dir="__DIR__">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>IQ Market — Signal Analysis</title>
  <meta name="description" content="تحلیل سیگنال، زون‌ها و مدیریت ریسک — Signal analysis with zones & risk management." />
  <link rel="icon" href="/web/logo" />
  <style>
    :root{--bg:#070c14;--card:#0d1626;--txt:#e9eef9;--mut:#9fb0cc;--pri:#36c;--pri2:#2ad;}
    *{box-sizing:border-box} body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Arial;background:radial-gradient(900px 500px at 70% 20%,rgba(42,170,221,.25),transparent),radial-gradient(900px 500px at 20% 70%,rgba(51,102,204,.25),transparent),var(--bg);color:var(--txt)}
    a{color:inherit}
    .wrap{max-width:1080px;margin:0 auto;padding:22px}
    .top{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .brand{display:flex;align-items:center;gap:10px;text-decoration:none}
    .brand img{width:34px;height:34px;border-radius:9px}
    .lang{display:flex;gap:8px;align-items:center}
    .btn{border:0;border-radius:14px;padding:10px 14px;background:rgba(255,255,255,.08);color:var(--txt);cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:8px}
    .btn.pri{background:linear-gradient(135deg,var(--pri2),var(--pri));}
    .hero{margin-top:22px;display:grid;grid-template-columns:1.2fr .8fr;gap:16px}
    .card{background:rgba(13,22,38,.75);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:18px;box-shadow:0 10px 30px rgba(0,0,0,.35);backdrop-filter: blur(10px)}
    h1{margin:0 0 10px;font-size:26px;line-height:1.25}
    p{margin:0 0 10px;color:var(--mut)}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}
    .field label{display:block;font-size:12px;color:var(--mut);margin-bottom:6px}
    .field input,.field select{width:100%;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.25);color:var(--txt);outline:none}
    .row{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}
    .note{font-size:12px;color:var(--mut);margin-top:8px}
    .feat{display:flex;gap:10px;align-items:flex-start}
    .dot{width:10px;height:10px;border-radius:50%;background:var(--pri2);margin-top:7px}
    .faq h3{margin:0 0 8px;font-size:15px}
    .faq p{margin:0 0 14px}
    @media (max-width: 900px){
      .hero{grid-template-columns:1fr}
      .grid{grid-template-columns:1fr}
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <a class="brand" href="/">
        <img src="/web/logo" alt="IQ Market" />
        <div>
          <div style="font-weight:800;letter-spacing:.2px">IQ Market</div>
          <div style="font-size:12px;color:var(--mut)">Signals • Zones • Risk</div>
        </div>
      </a>
      <div class="lang">
        <a class="btn" href="?lang=fa">FA</a>
        <a class="btn" href="?lang=en">EN</a>
        <a class="btn" id="openAppBtn" href="#">Open App</a>
      </div>
    </div>

    <div class="hero">
      <div class="card">
        <h1 data-i18n="title">تحلیل سیگنال با داده واقعی بازار</h1>
        <p data-i18n="subtitle">ورود از گوگل بدون نیاز به تلگرام. برای استفاده از تحلیل باید با ایمیل ثبت‌نام کنید. کاربران رایگان: ۳ تحلیل در روز.</p>

        <div class="grid">
          <div class="field">
            <label data-i18n="market">بازار</label>
            <select id="marketSel">
              <option value="crypto">Crypto</option>
              <option value="forex">Forex</option>
              <option value="gold">Gold</option>
              <option value="indices">Indices</option>
            </select>
          </div>
          <div class="field">
            <label data-i18n="symbol">نماد</label>
            <input id="symbolInp" value="BTCUSDT" />
          </div>
          <div class="field">
            <label data-i18n="tf">تایم‌فریم</label>
            <select id="tfSel">
              <option>H1</option><option selected>H4</option><option>D1</option>
            </select>
          </div>
        </div>

        <div class="row">
          <a class="btn pri" id="quickAnalyzeBtn" href="#" data-i18n="quick">تحلیل سریع (محدود)</a>
          <a class="btn" id="signupBtn" href="#" data-i18n="signup">ثبت‌نام با ایمیل</a>
          <a class="btn" id="loginBtn" href="#" data-i18n="login">ورود</a>
        </div>
        <div class="note" data-i18n="limit">محدودیت کاربران رایگان: ۳ تحلیل در روز. (برای افزایش سهمیه، اشتراک تهیه کنید)</div>
      </div>

      <div class="card">
        <div class="feat"><div class="dot"></div><div><div style="font-weight:700" data-i18n="f1t">زون‌ها و سطوح کلیدی</div><p data-i18n="f1d">نمایش حمایت/مقاومت و محدوده‌های تصمیم‌گیری.</p></div></div>
        <div class="feat"><div class="dot"></div><div><div style="font-weight:700" data-i18n="f2t">مدیریت ریسک</div><p data-i18n="f2d">پیشنهاد ریسک/سرمایه و سناریوها.</p></div></div>
        <div class="feat"><div class="dot"></div><div><div style="font-weight:700" data-i18n="f3t">چارت و کندل‌ها</div><p data-i18n="f3d">نمایش کندل‌ها و مارکت دیتا در خروجی.</p></div></div>

        <div class="faq" style="margin-top:14px">
          <h3 data-i18n="faq1t">چطور زبان سایت تغییر می‌کند؟</h3>
          <p data-i18n="faq1d">با توجه به زبان مرورگر (Accept-Language) یا دکمه FA/EN.</p>
          <h3 data-i18n="faq2t">تحلیل هم دو زبانه است؟</h3>
          <p data-i18n="faq2d">در درخواست تحلیل، زبان انتخابی ارسال می‌شود تا موتور تحلیل خروجی را همان زبان تولید کند.</p>
        </div>
      </div>
    </div>

    <div style="margin-top:14px;color:var(--mut);font-size:12px">
      © IQ Market
    </div>
  </div>

<script>
(function(){
  const lang="__LANG__";
  const dict={
    fa:{
      title:"تحلیل سیگنال با داده واقعی بازار",
      subtitle:"ورود از گوگل بدون نیاز به تلگرام. برای استفاده از تحلیل باید با ایمیل ثبت‌نام کنید. کاربران رایگان: ۳ تحلیل در روز.",
      market:"بازار",symbol:"نماد",tf:"تایم‌فریم",quick:"تحلیل سریع (محدود)",signup:"ثبت‌نام با ایمیل",login:"ورود",
      limit:"محدودیت کاربران رایگان: ۳ تحلیل در روز. (برای افزایش سهمیه، اشتراک تهیه کنید)",
      f1t:"زون‌ها و سطوح کلیدی",f1d:"نمایش حمایت/مقاومت و محدوده‌های تصمیم‌گیری.",
      f2t:"مدیریت ریسک",f2d:"پیشنهاد ریسک/سرمایه و سناریوها.",
      f3t:"چارت و کندل‌ها",f3d:"نمایش کندل‌ها و مارکت دیتا در خروجی.",
      faq1t:"چطور زبان سایت تغییر می‌کند؟",faq1d:"با توجه به زبان مرورگر (Accept-Language) یا دکمه FA/EN.",
      faq2t:"تحلیل هم دو زبانه است؟",faq2d:"در درخواست تحلیل، زبان انتخابی ارسال می‌شود تا موتور تحلیل خروجی را همان زبان تولید کند.",
    },
    en:{
      title:"Signal analysis with real market data",
      subtitle:"Enter from Google without Telegram. To run analyses, sign up with email. Free users: 3 analyses per day.",
      market:"Market",symbol:"Symbol",tf:"Timeframe",quick:"Quick analysis (limited)",signup:"Sign up with email",login:"Log in",
      limit:"Free-user limit: 3 analyses per day. Upgrade for higher quota.",
      f1t:"Zones & key levels",f1d:"Support/resistance and decision areas.",
      f2t:"Risk management",f2d:"Risk/capital suggestions and scenarios.",
      f3t:"Chart & candles",f3d:"Candles and market data in the output.",
      faq1t:"How is language selected?",faq1d:"By browser language (Accept-Language) or FA/EN buttons.",
      faq2t:"Is analysis bilingual?",faq2d:"We send your selected language with the request so the analysis engine can respond in that language.",
    }
  };
  const d=dict[lang]||dict.fa;
  document.querySelectorAll("[data-i18n]").forEach(el=>{ const k=el.getAttribute("data-i18n"); if(d[k]) el.textContent=d[k]; });
  function goApp(action){
    const sym=(document.getElementById("symbolInp").value||"BTCUSDT").trim().toUpperCase();
    const tf=(document.getElementById("tfSel").value||"H4").trim().toUpperCase();
    const market=(document.getElementById("marketSel").value||"crypto").trim();
    const base=(/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent))?"/m":"/web";
    const u=new URL(location.origin+base);
    u.searchParams.set("lang", lang);
    u.searchParams.set("symbol", sym);
    u.searchParams.set("tf", tf);
    u.searchParams.set("market", market);
    if(action) u.searchParams.set("action", action);
    location.href=u.toString();
  }
  document.getElementById("openAppBtn").onclick=(e)=>{e.preventDefault();goApp("");};
  document.getElementById("quickAnalyzeBtn").onclick=(e)=>{e.preventDefault();goApp("analyze");};
  document.getElementById("signupBtn").onclick=(e)=>{e.preventDefault();goApp("signup");};
  document.getElementById("loginBtn").onclick=(e)=>{e.preventDefault();goApp("login");};
})();
</script>
</body>
</html>`;

const WEB_APP_HTML = String.raw`<!doctype html>
<html lang=\"fa\" dir=\"rtl\">
<head>
  <meta charset=\"utf-8\" />
  <meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\" />
  <title>IQ Market — Web</title>
  <meta name=\"theme-color\" content=\"#05070D\" />
  <link rel=\"preconnect\" href=\"https://s3.tradingview.com\" />
  <link rel=\"preconnect\" href=\"https://www.tradingview.com\" />
  <style>
    :root{
      --bg:#05070D;
      --bg2:#070B12;
      --surface:rgba(11,18,32,.78);
      --surface2:rgba(15,26,46,.86);
      --surface3:rgba(7,11,18,.55);
      --txt:#E6EDF5;
      --muted:#9CA3AF;
      --muted2:#7C879A;
      --b:rgba(148,163,184,.16);
      --b2:rgba(96,165,250,.35);
      --a:#60A5FA;
      --a2:#22D3EE;
      --ok:#34D399;
      --bad:#FB7185;
      --warn:#FBBF24;
      --shadow:0 14px 40px rgba(0,0,0,.40);
      --shadow2:0 26px 70px rgba(0,0,0,.55);
      --r:18px;
      --r2:14px;
      --sideW:320px;
    }
    *{box-sizing:border-box}
    html,body{height:100%}
    body{
      margin:0;
      background:
        radial-gradient(1100px 700px at 85% -10%, rgba(96,165,250,.22), transparent 55%),
        radial-gradient(900px 550px at 15% 0%, rgba(34,211,238,.14), transparent 55%),
        radial-gradient(800px 520px at 35% 110%, rgba(52,211,153,.10), transparent 60%),
        linear-gradient(180deg, var(--bg), var(--bg2));
      color:var(--txt);
      font-family:ui-sans-serif,system-ui,-apple-system,\"Segoe UI\",Roboto,\"Noto Sans Arabic\",\"Noto Sans\",Arial;
      -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;
    }
    a{color:var(--a); text-decoration:none}
    a:hover{text-decoration:underline}

    /* Scrollbar */
    ::-webkit-scrollbar{width:10px;height:10px}
    ::-webkit-scrollbar-thumb{background:rgba(148,163,184,.22);border-radius:999px;border:2px solid rgba(0,0,0,0)}
    ::-webkit-scrollbar-track{background:rgba(0,0,0,0)}

    .app{min-height:100vh; display:grid; grid-template-columns: var(--sideW) 1fr}
    @media (min-width: 981px){
      .app.side-closed{grid-template-columns:1fr}
      .app.side-closed .side{display:none}
    }
    .side{
      border-left:1px solid var(--b);
      background:linear-gradient(180deg, rgba(11,18,32,.86), rgba(11,18,32,.74));
      backdrop-filter: blur(12px);
      padding:18px;
      position:sticky; top:0; height:100vh; overflow:auto;
    }
    .brand{display:flex; gap:12px; align-items:center; padding:8px 8px 16px}
    .brand img{width:52px;height:52px;border-radius:14px;background:#0B1220;border:1px solid var(--b)}
    .brand .t1{font-size:18px;font-weight:900; letter-spacing:.2px}
    .brand .t2{font-size:12px;color:var(--muted);margin-top:2px}

    .nav{display:flex; flex-direction:column; gap:10px; margin-top:10px}
    .btn-nav{
      display:flex; align-items:center; gap:12px;
      padding:12px 12px; border-radius:16px;
      border:1px solid var(--b);
      background:linear-gradient(180deg, rgba(15,26,46,.92), rgba(11,18,32,.92));
      cursor:pointer; color:var(--txt); text-align:right;
      transition:transform .12s ease, border-color .16s ease, box-shadow .16s ease;
    }
    .btn-nav:hover{transform:translateY(-1px); border-color:rgba(96,165,250,.28)}
    .btn-nav.active{border-color:rgba(96,165,250,.55); box-shadow:0 0 0 4px rgba(96,165,250,.10)}
    .nav-ico{width:18px;height:18px;opacity:.92}
    .nav-arrow{
      width:28px;height:28px;border-radius:12px;
      display:grid;place-items:center;
      border:1px solid var(--b);
      background:rgba(7,11,18,.35);
      color:var(--muted)
    }

    .pill{
      font-size:11px;color:var(--muted);
      padding:2px 10px;border:1px solid var(--b);
      border-radius:999px; display:inline-flex; align-items:center; gap:6px
    }
    .pill.pos{border-color:rgba(52,211,153,.55); color:rgba(52,211,153,.95)}
    .pill.neg{border-color:rgba(251,113,133,.55); color:rgba(251,113,133,.95)}

    .main{padding:18px 22px 40px; min-width:0}
    .topbar{
      position:sticky; top:0; z-index:10;
      margin-bottom:14px;
      border-radius:18px;
      background:linear-gradient(180deg, rgba(15,26,46,.78), rgba(11,18,32,.78));
      border:1px solid var(--b);
      box-shadow:var(--shadow);
      backdrop-filter: blur(10px);
      padding:12px 12px;
      display:flex; gap:12px; align-items:center; justify-content:space-between;
    }
    .topL{display:flex; gap:10px; align-items:center; min-width:220px}
    .pageTitle{font-weight:950; font-size:14px}
    .pageSub{font-size:11px;color:var(--muted); margin-top:2px}
    .iconBtn{
      width:42px;height:42px;border-radius:14px;
      border:1px solid var(--b);
      background:rgba(7,11,18,.35);
      color:var(--txt); cursor:pointer;
      display:grid;place-items:center;
    }
    .iconBtn:hover{border-color:rgba(96,165,250,.35)}
    .market{
      display:flex; align-items:baseline; gap:10px;
      padding:8px 12px; border-radius:16px;
      border:1px solid var(--b);
      background:rgba(7,11,18,.25);
      min-width:260px; justify-content:center;
    }
    .mSym{font-weight:950}
    .mPx{font-weight:950; font-size:16px}
    .mCh{font-weight:900; font-size:12px}
    .mCh.pos{color:rgba(52,211,153,.98)}
    .mCh.neg{color:rgba(251,113,133,.98)}
    .controls{display:flex; align-items:center; gap:10px; flex-wrap:wrap; justify-content:flex-end}
    .app.symmenu-closed .controls{display:none}

    .field{
      display:flex; align-items:center; gap:8px;
      border:1px solid var(--b);
      background:rgba(7,11,18,.35);
      border-radius:16px;
      padding:0 10px;
      height:44px;
    }
    .field svg{opacity:.8}
    .field input{border:none; background:transparent; padding:0 6px; height:40px; outline:none; width:180px}
    .symField{gap:6px}
    .symCloseBtn{
      display:flex;
      width:34px;height:34px;
      border-radius:12px;
      border:1px solid var(--b);
      background:rgba(7,11,18,.25);
      color:var(--txt);
      cursor:pointer;
      align-items:center;
      justify-content:center;
      font-size:18px; line-height:1;
      flex:0 0 auto;
    }
    .symCloseBtn:hover{border-color:rgba(96,165,250,.28)}
    body.mobile .symCloseBtn{display:flex}

    input,select,textarea{
      background:rgba(7,11,18,.45); border:1px solid var(--b); color:var(--txt);
      border-radius:16px; padding:12px 12px; outline:none; width:100%;
      transition:border-color .15s ease, box-shadow .15s ease;
    }
    input:focus,select:focus,textarea:focus{border-color:rgba(96,165,250,.45); box-shadow:0 0 0 4px rgba(96,165,250,.10)}
    textarea{min-height:110px; resize:vertical}

    .btn{
      background:linear-gradient(180deg, rgba(34,211,238,.95), rgba(96,165,250,.92));
      border:none; color:#06101f; font-weight:950; border-radius:16px; padding:12px 14px;
      cursor:pointer; height:44px;
      box-shadow:0 12px 30px rgba(96,165,250,.15);
    }
    .btn:hover{filter:brightness(1.02)}
    .btn.secondary{
      background:rgba(15,26,46,.88);
      border:1px solid var(--b); color:var(--txt); font-weight:900;
      box-shadow:none;
    }
    .btn.secondary:hover{border-color:rgba(96,165,250,.28)}
    .btn.small{height:38px; padding:9px 12px; border-radius:14px}

    .card{
      background:linear-gradient(180deg, rgba(15,26,46,.84), rgba(11,18,32,.90));
      border:1px solid var(--b); border-radius:var(--r);
      box-shadow:var(--shadow2);
      overflow:hidden;
    }
    .h{padding:16px 16px 0; font-weight:950}
    .c{padding:16px}
    .grid{display:grid; gap:14px}
    .grid.cols2{grid-template-columns: 1fr 1fr}
    .grid.cols3{grid-template-columns: 1.2fr .8fr .8fr}

    .row{display:flex; gap:10px; align-items:center; flex-wrap:wrap}
    .kpi{display:flex; flex-direction:column; gap:4px}
    .kpi .v{font-size:24px;font-weight:950; letter-spacing:.2px}
    .kpi .s{font-size:12px;color:var(--muted)}
    .list{display:flex; flex-direction:column; gap:10px}
    .item{padding:12px;border-radius:16px;border:1px solid var(--b); background:rgba(7,11,18,.30)}
    .item:hover{border-color:rgba(96,165,250,.22)}
    .item .t{font-weight:950}
    .item .m{color:var(--muted);font-size:12px;margin-top:6px; line-height:1.7}
    .split{display:grid; grid-template-columns: 1fr 380px; gap:14px}
    .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,\"Courier New\",monospace; font-size:12px; line-height:1.75; white-space:pre-wrap}
    .foot{margin-top:18px; color:var(--muted); font-size:12px; line-height:1.9}
    .warn{color:var(--muted); font-size:12px}
    .hidden{display:none!important}
    .chip{
      display:inline-flex; align-items:center; gap:8px;
      padding:8px 10px; border-radius:999px;
      border:1px solid var(--b); background:rgba(7,11,18,.30);
      color:var(--txt); font-weight:900; cursor:pointer;
    }
    .chip:hover{border-color:rgba(96,165,250,.35)}
    .kbd{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,\"Courier New\",monospace; font-size:12px; padding:2px 8px; border:1px solid var(--b); border-radius:10px; color:var(--muted)}

    /* Mobile: overlay sidebar + bottom nav */
    .backdrop{
      position:fixed; inset:0;
      background:rgba(0,0,0,.55);
      backdrop-filter: blur(2px);
      z-index:35;
      opacity:0; pointer-events:none;
      transition:opacity .18s ease;
    }
    .mobnav{
      display:none;
      position:fixed; left:0; right:0; bottom:0;
      z-index:30;
      padding:10px 10px calc(10px + env(safe-area-inset-bottom));
      background:linear-gradient(180deg, rgba(7,11,18,.05), rgba(7,11,18,.78));
      border-top:1px solid var(--b);
      backdrop-filter: blur(10px);
      gap:8px;
    }
    .mobbtn{
      flex:1;
      display:flex; flex-direction:column; gap:4px;
      align-items:center; justify-content:center;
      height:52px;
      border-radius:16px;
      border:1px solid var(--b);
      background:rgba(7,11,18,.30);
      color:var(--txt);
      cursor:pointer;
      font-weight:900;
      font-size:11px;
    }
    .mobbtn svg{width:18px;height:18px; opacity:.95}
    .mobbtn.active{border-color:rgba(96,165,250,.55); box-shadow:0 0 0 4px rgba(96,165,250,.10)}
    .mobbtn.menu{flex:.8}

    /* Ticker tape + Watchlist (Trading-like UI) */
    .tickerRow{
      margin-top:12px;
      margin-bottom:14px;
      padding:10px;
      border:1px solid var(--b);
      border-radius:18px;
      background:rgba(7,11,18,.30);
      display:flex;
      gap:10px;
      overflow:auto;
      scrollbar-width:thin;
    }
    .tItem{
      min-width:140px;
      flex:0 0 auto;
      border:1px solid var(--b);
      background:rgba(15,26,46,.42);
      color:var(--txt);
      border-radius:16px;
      padding:10px 12px;
      cursor:pointer;
      display:flex;
      flex-direction:column;
      gap:4px;
      align-items:flex-start;
      text-align:right;
    }
    .tItem:hover{border-color:rgba(96,165,250,.55); box-shadow:0 0 0 4px rgba(96,165,250,.10)}
    .tSym{font-weight:950;font-size:12px;letter-spacing:.2px}
    .tPx{font-weight:950;font-size:12px}
    .tCh{font-weight:900;font-size:11px}

    .segRow{display:flex;gap:8px;flex-wrap:wrap}
    .segBtn{
      padding:8px 10px;
      border-radius:999px;
      border:1px solid var(--b);
      background:rgba(7,11,18,.18);
      color:var(--txt);
      cursor:pointer;
      font-weight:900;
      font-size:12px;
    }
    .segBtn.active{border-color:rgba(96,165,250,.55); box-shadow:0 0 0 4px rgba(96,165,250,.10)}

    .watchList{
      max-height:360px;
      overflow:auto;
      padding-right:2px;
      display:flex;
      flex-direction:column;
      gap:10px;
    }
    .wItem{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      padding:10px 10px;
      border-radius:16px;
      border:1px solid var(--b);
      background:rgba(7,11,18,.22);
      cursor:pointer;
    }
    .wItem:hover{border-color:rgba(96,165,250,.50); background:rgba(15,26,46,.35)}
    .wL{display:flex;flex-direction:column;gap:2px;min-width:0}
    .wSym{font-weight:950;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .wMeta{font-size:11px;color:var(--muted)}
    .wR{text-align:left;min-width:92px}
    .wPx{font-weight:950;font-size:12px}
    .wCh{font-weight:900;font-size:11px}
    .wA{display:flex;gap:6px;align-items:center}

    .miniBtn{
      width:34px;height:34px;
      border-radius:12px;
      border:1px solid var(--b);
      background:rgba(15,26,46,.45);
      color:var(--txt);
      cursor:pointer;
      display:flex;
      align-items:center;
      justify-content:center;
    }
    .miniBtn:hover{border-color:rgba(96,165,250,.55)}
    .miniBtn.active{border-color:rgba(250,204,21,.55); box-shadow:0 0 0 4px rgba(250,204,21,.12)}
    .miniBtn svg{width:18px;height:18px}

    /* Skeleton shimmer */
    .skel{position:relative; overflow:hidden; background:rgba(148,163,184,.12)}
    .skel:before{
      content:\"\";
      position:absolute;
      top:0; left:-40%;
      width:40%; height:100%;
      background:linear-gradient(90deg, transparent, rgba(255,255,255,.10), transparent);
      animation:shimmer 1.2s infinite;
    }
    .skel-txt{height:12px;width:80px;border-radius:999px;display:inline-block}
    @keyframes shimmer{0%{transform:translateX(0)}100%{transform:translateX(300%)}}


    /* Multi-chart (TradingView) */
    .mcGrid{display:grid; gap:12px}
    .mcGrid.one{grid-template-columns:1fr}
    .mcGrid.two{grid-template-columns:1fr 1fr}
    .mcGrid.four{grid-template-columns:1fr 1fr}
    .mcCell{border:1px solid var(--b); border-radius:16px; overflow:hidden; background:rgba(15,26,46,.45); display:flex; flex-direction:column}
    .mcHead{display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px; border-bottom:1px solid var(--b); background:rgba(7,11,18,.18)}
    .mcHead .left{display:flex; gap:8px; align-items:center; flex-wrap:wrap}
    .mcHead .right{display:flex; gap:8px; align-items:center}
    .mcHead select{width:120px; height:36px; padding:8px 10px; border-radius:14px}
    .mcBody{position:relative}
    .mcGrid.one .mcBody{height:520px}
    .mcGrid.two .mcBody{height:420px}
    .mcGrid.four .mcBody{height:320px}
    .mcBody .tradingview-widget-container,
    .mcBody .tradingview-widget-container__widget{height:100%}
    @media (max-width: 980px){
      .mcGrid.two,.mcGrid.four{grid-template-columns:1fr}
      .mcGrid.four .mcBody{height:340px}
    }

    /* Layout switch */
    .app.compact .main{padding:16px 16px 86px}
    .app.compact .topbar{padding:12px 12px; border-radius:18px}
    .app.compact .market{min-width:220px}
    .app.compact .tickerRow{padding:8px; border-radius:16px}


    @media (max-width: 980px){
      .app{grid-template-columns: 1fr}
      .side{
        position:fixed;
        top:0; bottom:0; right:0;
        width:min(var(--sideW), 86vw);
        height:auto;
        transform:translateX(110%);
        transition:transform .20s ease;
        z-index:40;
        border-left:1px solid var(--b);
      }
      .app.side-open .side{transform:translateX(0)}
      .app.side-open .backdrop{opacity:1; pointer-events:auto}
      .main{padding:12px 12px 86px}
      .grid.cols2,.grid.cols3{grid-template-columns:1fr}
      .split{grid-template-columns:1fr}
      .topbar{gap:10px; flex-wrap:wrap}
      .market{order:3; width:100%; justify-content:space-between}
      .controls{width:100%; justify-content:space-between}
      .field{flex:1}
      .field input{width:100%}
      .symField input{width:auto; flex:1}
      .symCloseBtn{display:flex}
      .mobnav{display:flex}
      .brand{padding-bottom:10px}
      .nav{gap:8px}
    }
    :focus-visible{outline:2px solid rgba(96,165,250,.65); outline-offset:2px}
    .toasts{position:fixed;left:16px;right:16px;bottom:16px;display:flex;flex-direction:column;gap:10px;z-index:9999;pointer-events:none}
    @media(min-width:640px){.toasts{left:auto;right:16px;width:360px}}
    .toast{pointer-events:auto;background:rgba(15,23,42,.92);border:1px solid rgba(31,42,68,.95);border-radius:14px;padding:12px 14px;box-shadow:0 12px 40px rgba(0,0,0,.35);display:flex;gap:10px;align-items:flex-start;opacity:0;transform:translateY(8px);transition:opacity .25s ease, transform .25s ease}
    .toast .t{font-weight:950;letter-spacing:-.2px}
    .toast .m{font-size:12px;color:var(--muted);margin-top:2px;line-height:1.55}
    .toast.ok{border-color:rgba(52,211,153,.55)}
    .toast.err{border-color:rgba(251,113,133,.55)}
  
.outRich{font-size:15px;line-height:1.9;white-space:normal}
.outRich h2,.outRich h3,.outRich h4{margin:10px 0 6px;font-weight:900}
.outRich p{margin:6px 0;color:rgba(230,237,245,.95)}
.outRich ul{margin:6px 0 10px;padding-right:1.2em}
.outRich li{margin:4px 0}
.outRich code{padding:2px 6px;border:1px solid rgba(148,163,184,.22);border-radius:8px;background:rgba(15,26,46,.6)}
.outRich .sp{height:8px}

.outArea{
  min-height:240px;
  padding:10px 10px;
  border:1px solid rgba(148,163,184,.18);
  background:rgba(7,11,18,.18);
  border-radius:16px;
  white-space:pre-wrap;
}
.msgList{display:flex;flex-direction:column;gap:12px}
.msgCard{border:1px solid rgba(148,163,184,.16);background:rgba(7,11,18,.12);border-radius:16px;padding:12px 12px}
.msgHead{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:12px;color:rgba(156,163,175,.92);margin-bottom:8px}
.msgHead .tag{font-weight:950;color:rgba(230,237,245,.92)}
.msgCard .outRich{font-size:14px}

/* Output snapshot */
.outTabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.outPane{min-height:10px}
.snapWrap{display:flex;flex-direction:column;gap:12px}
.snapCard{border:1px solid rgba(148,163,184,.16);background:rgba(7,11,18,.12);border-radius:16px;overflow:hidden}
.snapHead{padding:10px 12px;font-weight:950;color:rgba(230,237,245,.95);border-bottom:1px solid rgba(148,163,184,.16);background:rgba(15,26,46,.28)}
.snapBody{padding:12px}
.zoneGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
@media (max-width: 980px){ .zoneGrid{grid-template-columns:1fr} }


    /* Points energy bar */
    .energy{
      min-width:220px;
      background:rgba(7,11,18,.55);
      border:1px solid rgba(148,163,184,.16);
      border-radius:14px;
      padding:10px 12px;
      box-shadow:0 10px 26px rgba(0,0,0,.22);
    }
    .energyTop{display:flex;justify-content:space-between;gap:10px;font-size:12px;color:rgba(230,237,245,.92);margin-bottom:8px}
    .energyTop .mut{color:rgba(156,163,175,.95)}
    .energyBar{height:10px;border-radius:999px;background:rgba(148,163,184,.12);overflow:hidden}
    .energyFill{height:100%;width:0%;border-radius:999px;background:linear-gradient(90deg, rgba(96,165,250,.95), rgba(34,211,238,.95));transition:width .25s ease}
    .energySub{margin-top:6px;font-size:11px;color:rgba(156,163,175,.95);line-height:1.6}

    /* Queue progress bar */
    .progressWrap{
      display:none;
      margin:10px 0 12px;
      padding:10px 12px;
      border:1px solid rgba(148,163,184,.16);
      border-radius:14px;
      background:rgba(7,11,18,.55);
    }
    .progressHead{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px;font-size:12px;color:rgba(230,237,245,.92)}
    .progressBar{height:10px;border-radius:999px;background:rgba(148,163,184,.12);overflow:hidden}
    .progressFill{height:100%;width:0%;border-radius:999px;background:linear-gradient(90deg, rgba(52,211,153,.95), rgba(96,165,250,.95));transition:width .25s ease}

    /* Badges + key-value grid (used in Admin & Subscription) */
    .badge{
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:6px 10px;
      border-radius:999px;
      font-size:12px;
      font-weight:800;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(7,11,18,.55);
      color:rgba(230,237,245,.92);
      white-space:nowrap;
    }
    .badge.ok{border-color:rgba(52,211,153,.35); background:rgba(52,211,153,.10); color:rgba(167,243,208,.95)}
    .badge.bad{border-color:rgba(251,113,133,.35); background:rgba(251,113,133,.10); color:rgba(254,202,202,.95)}
    .badge.warn{border-color:rgba(251,191,36,.35); background:rgba(251,191,36,.10); color:rgba(254,243,199,.95)}
    .badge.mut{border-color:rgba(148,163,184,.18); background:rgba(148,163,184,.06); color:rgba(209,213,219,.95)}

    .kvs{display:grid;grid-template-columns:repeat(2, minmax(0,1fr));gap:10px}
    .kv{border:1px solid rgba(148,163,184,.14);background:rgba(7,11,18,.45);border-radius:14px;padding:10px}
    .kv .k{font-size:12px;color:rgba(156,163,175,.95);margin-bottom:4px}
    .kv .v{font-weight:800;color:rgba(230,237,245,.95);line-height:1.4}
    .kv .v.mono{font-weight:700}

    .link{color:var(--a);text-decoration:none;font-weight:900}
    .link:hover{opacity:.9;text-decoration:underline}

    /* Plan cards */
    .qrImg{width:220px;height:220px;border-radius:18px;border:1px solid var(--b);background:#fff;object-fit:contain}
    .planGrid{display:grid;grid-template-columns:repeat(2, minmax(0,1fr));gap:10px}
    .planCard{
      border:1px solid rgba(148,163,184,.14);
      background:rgba(7,11,18,.45);
      border-radius:16px;
      padding:12px;
      cursor:pointer;
      transition:transform .08s ease, border-color .12s ease, background .12s ease;
    }
    .planCard:hover{transform:translateY(-1px);border-color:rgba(96,165,250,.35);background:rgba(15,26,46,.55)}
    .planCard.active{border-color:rgba(52,211,153,.40);background:rgba(52,211,153,.08)}

    /* Steps */
    .steps{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 2px}
    .step{
      padding:8px 10px;
      border-radius:999px;
      border:1px dashed rgba(148,163,184,.22);
      background:rgba(7,11,18,.35);
      font-size:12px;
      color:rgba(230,237,245,.90);
      font-weight:800;
      white-space:nowrap;
    }

    /* Subscription CTA/result boxes */
    .subCta, .subCtaMini{
      border:1px solid rgba(96,165,250,.30);
      background:linear-gradient(180deg, rgba(96,165,250,.12), rgba(34,211,238,.06));
      border-radius:18px;
      padding:12px;
    }
    .subResult{
      border:1px solid rgba(148,163,184,.18);
      background:rgba(7,11,18,.45);
      border-radius:18px;
      padding:12px;
    }
    .subResult.ok{border-color:rgba(52,211,153,.30);background:rgba(52,211,153,.06)}
    .subResult.bad{border-color:rgba(251,113,133,.30);background:rgba(251,113,133,.06)}

    /* Transaction card */
    .txCard{
      border:1px solid rgba(148,163,184,.18);
      background:rgba(7,11,18,.45);
      border-radius:18px;
      padding:12px;
    }
    .txCard.ok{border-color:rgba(52,211,153,.30);background:rgba(52,211,153,.06)}
    .txCard.bad{border-color:rgba(251,113,133,.30);background:rgba(251,113,133,.06)}
.txVerdict{margin-top:10px;border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:10px;background:rgba(7,11,18,.35)}
.txVerdict.ok{border-color:rgba(52,211,153,.30);background:rgba(52,211,153,.06)}
.txVerdict.bad{border-color:rgba(251,113,133,.30);background:rgba(251,113,133,.06)}

    /* Table */
    .tbl{width:100%;border-collapse:separate;border-spacing:0;min-width:640px}
    .tbl th,.tbl td{padding:10px;border-bottom:1px solid rgba(148,163,184,.14);text-align:right}
    .tbl th{font-size:12px;color:rgba(156,163,175,.95);font-weight:900;background:rgba(7,11,18,.35);position:sticky;top:0}
    .tbl td{font-size:12px;color:rgba(230,237,245,.92)}
    .tbl tr:hover td{background:rgba(15,26,46,.35)}

    /* Buttons */
    .btn.ok{background:linear-gradient(90deg, rgba(52,211,153,.95), rgba(34,211,238,.65));border-color:rgba(52,211,153,.35)}
    .btn.danger{background:rgba(251,113,133,.10);border-color:rgba(251,113,133,.35);color:rgba(254,202,202,.95)}
    .btn.danger:hover{background:rgba(251,113,133,.16)}

    @media (max-width: 980px){
      .qrImg{width:220px;height:220px;border-radius:18px;border:1px solid var(--b);background:#fff;object-fit:contain}
    .planGrid{grid-template-columns:1fr}
      .kvs{grid-template-columns:1fr}
      .tbl{min-width:520px}
    }


    /* Mobile tweaks */
    body.mobile .energy{min-width:unset;width:100%}
    body.mobile .market{display:none}
    body.mobile .controls{flex-wrap:wrap}
    body.mobile .topbar{gap:10px}

</style>

  <!-- TradingView Lightweight Charts -->
  <script src=\"https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js\"></script>
</head>
<body>
  <div id=\"root\"></div>
  <div id=\"toastHost\" class=\"toasts\" aria-live=\"polite\" aria-atomic=\"true\"></div>
  <script src=\"/web/app.js\"></script>

  <div class=\"foot\" style=\"padding:14px 22px\">
    Lightweight Charts™ by TradingView — <a href=\"https://www.tradingview.com\" target=\"_blank\" rel=\"noreferrer\">tradingview.com</a>
  </div>
</body>
</html>`;
const WEB_APP_JS = String.raw`(() => {
  const $ = (q, el=document) => el.querySelector(q);
  const $$ = (q, el=document) => [...el.querySelectorAll(q)];

  // Global shortcuts: ESC closes menu, / focuses symbol
  document.addEventListener(\"keydown\", (e) => {
    const tag = (document.activeElement && document.activeElement.tagName) ? document.activeElement.tagName.toLowerCase() : \"\";
    const typing = (tag === \"input\" || tag === \"textarea\" || tag === \"select\");
    if (e.key === \"Escape\") {
      const app = $(\".app\");
      if (app) app.classList.remove(\"side-open\");
      try{ closeSymMenu(); }catch{}
      const inp = $(\"#symbolInp\");
      if (inp) { try{ inp.blur(); }catch{} }
    }
    if (e.key === \"/\" && !typing) {
      e.preventDefault();
      try{ openSymMenu(); }catch{}
      const inp = $(\"#symbolInp\");
      if (inp) inp.focus();
    }
  });

  const API = {
    signup:     \"/api/web/auth/signup\",
    login:      \"/api/web/auth/login\",
    resetReq:   \"/api/web/auth/reset/request\",
    resetConf:  \"/api/web/auth/reset/confirm\",
    accountGet: \"/api/web/account/get\",

    emailReq:   \"/api/web/verify/email/request\",
    emailConf:  \"/api/web/verify/email/confirm\",

    tgLink:     \"/api/web/verify/telegram/link\",
    tgReq:      \"/api/web/verify/telegram/request\",
    tgConf:     \"/api/web/verify/telegram/confirm\",

    user:       \"/api/user\",
    quote:      \"/api/quote\",
    news:       \"/api/news\",
    newsAnalyze:\"/api/news/analyze\",
    candles:    \"/api/candles\",
    analyze:    \"/api/analyze\",
    analyzeStatus:\"/api/analyze/status\",
    subPlans:   \"/api/subscription/plans\",
    subPurchase:\"/api/subscription/purchase\",

    refSummary:\"/api/referral/summary\",
    refWithdraw:\"/api/referral/commission/withdraw\",

    adminPayments:\"/api/admin/payments/list\",
    adminPaymentDecision:\"/api/admin/payments/decision\",
    adminPaymentCheck:\"/api/admin/payments/check\",

    adminCwList:\"/api/admin/commission-withdrawals/list\",
    adminCwDecision:\"/api/admin/commission-withdrawals/decision\",
  };

  const LS_TOKEN = \"iq_web_miniToken\";
  const LS_WEBTOKEN = \"iq_web_webToken\";
  const LS_PREFS = \"iq_web_prefs_v2\";
  const LS_FAVS  = \"iq_web_favs_v1\";
  function getLang(){
    try{
      const qp = new URLSearchParams(location.search).get("lang");
      if (qp === "fa" || qp === "en") { try{ localStorage.setItem("iq_lang", qp); }catch{} return qp; }
    } catch {}
    try{ const ls = localStorage.getItem("iq_lang"); if (ls === "fa" || ls === "en") return ls; }catch{}
    try{ const hl = (document.documentElement && document.documentElement.lang) ? document.documentElement.lang : ""; if (hl === "fa" || hl === "en") return hl; }catch{}
    const n = String(navigator.language || "").toLowerCase();
    return (n.startsWith("fa") ? "fa" : "en");
  }


  const ERR_FA = {
    invalid_email: \"ایمیل نامعتبر است.\",
    invalid_username: \"یوزرنیم نامعتبر است (فقط حروف/عدد لاتین و _ .).\",
    weak_password: \"پسورد باید حداقل ۸ کاراکتر باشد.\",
    missing_fields: \"همه فیلدهای لازم را کامل کن.\",
    username_taken: \"این یوزرنیم قبلاً ثبت شده است.\",
    email_taken: \"این ایمیل قبلاً ثبت شده است.\",
    invalid_credentials: \"اطلاعات ورود اشتباه است.\",
    too_many_requests: \"درخواست‌ها زیاد است؛ کمی صبر کن و دوباره تلاش کن.\",
    otp_expired: \"کد منقضی شده. دوباره درخواست بده.\",
    otp_wrong: \"کد اشتباه است.\",
    otp_locked: \"تلاش‌های زیاد؛ چند دقیقه بعد دوباره امتحان کن.\",
    invalid_code: \"کد واردشده نامعتبر است.\",
    telegram_not_linked: \"تلگرام هنوز متصل نشده. اول لینک اتصال را Start کن.\",
    account_not_found: \"حساب پیدا نشد.\",
    auth_expired: \"نشست منقضی شده. دوباره وارد شو.\",
    db_not_bound: \"دیتابیس D1 متصل نیست.\",
    kv_not_bound: \"KV متصل نیست.\",
    NO_EMAIL_PROVIDER: \"ارسال ایمیل تنظیم نشده است.\",
  };
  const ERR_EN = {
    invalid_email: "Invalid email.",
    invalid_username: "Invalid username (latin letters/numbers and _ . only).",
    weak_password: "Password must be at least 8 characters.",
    missing_fields: "Please fill all required fields.",
    username_taken: "This username is already taken.",
    email_taken: "This email is already registered.",
    invalid_credentials: "Wrong username/email or password.",
    too_many_requests: "Too many requests. Please try again shortly.",
    otp_expired: "Code expired. Request a new one.",
    otp_wrong: "Wrong code.",
    otp_locked: "Too many attempts. Try again in a few minutes.",
    invalid_code: "Invalid code.",
    telegram_not_linked: "Telegram not linked yet. Start the link first.",
    account_not_found: "Account not found.",
    auth_expired: "Session expired. Please log in again.",
    db_not_bound: "Database (D1) not connected.",
    kv_not_bound: "KV not connected.",
    NO_EMAIL_PROVIDER: "Email provider is not configured.",
    email_not_verified: "Please verify your email first.",
    login_required: "Please sign up / log in first."
  };


  function humanErr(code){
    const k = String(code || "");
    const L = (state && state.lang) ? state.lang : getLang();
    if (L === "en" && ERR_EN[k]) return ERR_EN[k];
    if (ERR_FA[k]) return ERR_FA[k];
    if (k === \"internal_error\") return \"خطای داخلی سرور. دوباره تلاش کن.\";
    if (k.startsWith(\"HTTP_\")) return \"خطای شبکه: \" + k;
    return k || \"خطا\";
  }

  const state = {
    lang: getLang(),
    tab: \"dashboard\",
    authTab: \"login\",
    miniToken: localStorage.getItem(LS_TOKEN) || \"\",
    webToken: localStorage.getItem(LS_WEBTOKEN) || \"\",
    startParam: \"\",
    isAdmin: false,
    isOwner: false,
    admin: { payments: [], cwithdrawals: [], wallet: \"\", checks: {}, error: \"\" },
    referral: null,
    referralWithdrawals: [],
    symbol: \"BTCUSDT\",
    timeframe: \"H4\",
    style: \"\",
    risk: \"2%\",
    newsEnabled: true,
    promptMode: \"style_plus_custom\",
    signalChartMode: \"tv\", // \"tv\" | \"png\"
    chartMode: \"tv\", // \"tv\" | \"zones\"
    layoutMode: \"pro\", // \"pro\" | \"compact\"
    sideCollapsed: false,
    symMenuCollapsed: false,
    livePaused: false,
    multiLayout: \"1\", // \"1\" | \"2\" | \"4\"
    multiTfs: [\"H4\",\"H1\",\"D1\",\"W1\"],
    watchGroup: \"favs\",
    watchSearch: \"\",
    extraQuotes: {},
    lastExtraTs: 0,
    symbols: [],
    styles: [],
    favs: [],
    quote: null,
    news: [],
    job: null,
    jobId: null,
    candles: [],
    overlayData: { boxes: [], lines: [] },
    timers: [],
    account: null,
    userState: null,
    subPlans: [],
    subWallet: \"\",
  };

  function tr(fa, en){
    return (state.lang === "en") ? String(en) : String(fa);
  }


  function loadPrefs(){
    try{
      const p = JSON.parse(localStorage.getItem(LS_PREFS) || \"null\");
      if (p && typeof p === \"object\"){
        if (p.symbol) state.symbol = String(p.symbol).trim().toUpperCase();
        if (!/^[A-Z0-9:_-]{3,30}$/.test(state.symbol)) state.symbol = \"BTCUSDT\";
        if (p.timeframe) state.timeframe = String(p.timeframe).trim().toUpperCase();
        if (p.style != null) state.style = String(p.style || \"\");
        if (p.risk) state.risk = String(p.risk || \"\");
        if (typeof p.newsEnabled === \"boolean\") state.newsEnabled = p.newsEnabled;
        if (p.promptMode) state.promptMode = String(p.promptMode || \"style_plus_custom\");
        if (p.signalChartMode) state.signalChartMode = String(p.signalChartMode || \"tv\");
        if (p.chartMode) state.chartMode = String(p.chartMode || \"tv\");
        if (p.layoutMode) state.layoutMode = String(p.layoutMode || \"pro\");
        if (typeof p.livePaused === \"boolean\") state.livePaused = p.livePaused;
        if (typeof p.sideCollapsed === \"boolean\") state.sideCollapsed = p.sideCollapsed;
        if (typeof p.symMenuCollapsed === \"boolean\") state.symMenuCollapsed = p.symMenuCollapsed;
        if (p.multiLayout) state.multiLayout = String(p.multiLayout || \"1\");
        if (Array.isArray(p.multiTfs)) state.multiTfs = p.multiTfs.map(x => String(x||\"\").trim().toUpperCase()).slice(0,4);
      }
    } catch {}
    try{
      const f = JSON.parse(localStorage.getItem(LS_FAVS) || \"[]\");
      if (Array.isArray(f)) state.favs = f.map(x => String(x||\"\").trim().toUpperCase()).filter(Boolean).slice(0, 30);
    } catch {}
  }

  function savePrefs(){
    try{
      localStorage.setItem(LS_PREFS, JSON.stringify({
        symbol: state.symbol,
        timeframe: state.timeframe,
        style: state.style,
        risk: state.risk,
        newsEnabled: state.newsEnabled,
        promptMode: state.promptMode,
        signalChartMode: state.signalChartMode,
        chartMode: state.chartMode,
        layoutMode: state.layoutMode,
        sideCollapsed: state.sideCollapsed,
        symMenuCollapsed: state.symMenuCollapsed,
        livePaused: state.livePaused,
        multiLayout: state.multiLayout,
        multiTfs: state.multiTfs,
      }));
      localStorage.setItem(LS_FAVS, JSON.stringify(state.favs || []));
    } catch {}
  }

  function applySymMenuClass(){
    try{
      const app = $(\".app\");
      if (app) app.classList.toggle(\"symmenu-closed\", !!state.symMenuCollapsed);
    } catch {}
  }
  function closeSymMenu(){
    state.symMenuCollapsed = true;
    savePrefs();
    applySymMenuClass();
  }
  function openSymMenu(){
    state.symMenuCollapsed = false;
    savePrefs();
    applySymMenuClass();
  }
  function toggleSymMenu(){
    state.symMenuCollapsed = !state.symMenuCollapsed;
    savePrefs();
    applySymMenuClass();
  }

  function updateEnergyUI(u){
    const bal = Number((u && (u.pointsBalance ?? u.points?.balance)) ?? (u?.state?.points?.balance) ?? 0);
    const cost = Number((u && (u.analysisPointsCost ?? u.points?.cost)) ?? 2);
    const left = Number((u && (u.analysesLeft ?? u.points?.analysesLeft)) ?? Math.max(0, Math.floor(bal / (cost || 2))));
    const maxUi = Number((u && (u.pointsMaxUi ?? u.points?.maxUi)) ?? 20);
    const pct = Math.max(0, Math.min(100, (bal / (maxUi || 20)) * 100));

    const bEl = $(\"#ptsBalance\");
    const lEl = $(\"#ptsLeft\");
    const fEl = $(\"#ptsFill\");
    const mEl = $(\"#ptsMeta\");

    if (bEl) bEl.textContent = bal + \" امتیاز\";
    if (lEl) lEl.textContent = left + \" تحلیل\";
    if (fEl) fEl.style.width = pct.toFixed(0) + \"%\";
    if (mEl) mEl.textContent = \"هزینه هر تحلیل: \" + cost + \" امتیاز\";
  }

  function setJobProgress(status, step){
    const wrap = $(\"#jobProgressWrap\");
    const label = $(\"#jobProgressLabel\");
    const pctEl = $(\"#jobProgressPct\");
    const fill = $(\"#jobProgressFill\");
    if (!wrap || !label || !pctEl || !fill) return;

    const s = String(status || \"\").toLowerCase();
    let pct = 0;
    let txt = \"در صف…\";

    if (s === \"queued\") {
      pct = 18 + Math.min(22, Number(step || 0) * 2);
      txt = \"در صف…\";
    } else if (s === \"running\" || s === \"processing\") {
      pct = 55 + Math.min(35, Number(step || 0) * 0.5);
      txt = \"در حال تحلیل…\";
    } else if (s === \"done\" || s === \"success\" || s === \"completed\") {
      pct = 100;
      txt = \"تکمیل شد ✅\";
    } else if (s === \"error\" || s === \"failed\") {
      pct = 100;
      txt = \"خطا ❌\";
    } else {
      pct = 40;
      txt = \"در حال پردازش…\";
    }

    wrap.style.display = (s === \"done\" || s === \"success\" || s === \"completed\" || s === \"error\" || s === \"failed\") ? \"block\" : \"block\";
    pctEl.textContent = pct.toFixed(0) + \"%\";
    label.textContent = txt;
    fill.style.width = pct.toFixed(0) + \"%\";

    if (s === \"done\" || s === \"success\" || s === \"completed\") {
      setTimeout(()=>{ try{ wrap.style.display=\"none\"; }catch{} }, 1200);
    }
  }


  function toggleFav(sym){
    const s = String(sym||\"\").trim().toUpperCase();
    if (!s) return;
    state.favs = Array.isArray(state.favs) ? state.favs : [];
    const i = state.favs.indexOf(s);
    if (i >= 0) state.favs.splice(i, 1);
    else state.favs.unshift(s);
    state.favs = state.favs.filter(Boolean).slice(0, 30);
    savePrefs();
  }
  function normSym(sym){
    const s = String(sym||\"\").trim().toUpperCase();
    if (!s) return \"\";
    if (s.includes(\":\")) return s.split(\":\").pop();
    return s;
  }

  function symCategory(sym){
    const u = normSym(sym);
    if (!u) return \"other\";
    if (u.endsWith(\"USDT\") || u.endsWith(\"USDC\") || u.endsWith(\"BUSD\")) return \"crypto\";
    if (u.startsWith(\"XAU\") || u.startsWith(\"XAG\") || u.includes(\"GOLD\") || u.includes(\"SILVER\")) return \"metals\";
    if (/^[A-Z]{6}$/.test(u)) return \"forex\";
    if (/(SPX|SPX500|US500|NAS100|US30|DJI|DAX|GER40|UK100|HK50|JP225|NIKKEI|USTECH|DE40)/.test(u)) return \"indices\";
    if (/^[A-Z]{1,5}$/.test(u)) return \"stocks\";
    return \"other\";
  }

  function catLabel(cat){
    const map = { favs:\"⭐\", all:\"All\", crypto:\"Crypto\", forex:\"Forex\", metals:\"Metals\", indices:\"Indices\", stocks:\"Stocks\", other:\"Other\" };
    return map[cat] || cat;
  }

  function quoteFmt(q){
    const px = (q && typeof q.price === \"number\") ? q.price.toLocaleString() : \"—\";
    const ch = (q && typeof q.changePct === \"number\") ? q.changePct : null;
    const chTxt = (ch==null) ? \"—\" : ((ch>0?\"+\":\"\") + (ch*100).toFixed(2) + \"%\");
    const cls = (ch==null) ? \"\" : (ch>0 ? \"pos\" : (ch<0 ? \"neg\" : \"\"));
    return { px, chTxt, cls };
  }

  function getTickerSymbols(){
    const base = [\"BTCUSDT\",\"ETHUSDT\",\"BNBUSDT\",\"XAUUSD\",\"EURUSD\",\"SPX500\",\"NAS100\"];
    const favs = Array.isArray(state.favs) ? state.favs : [];
    const out = [];
    [...favs, ...base].forEach(s=>{
      const x = normSym(s);
      if (!x) return;
      if (!out.includes(x)) out.push(x);
    });
    return out.slice(0, 10);
  }

  function buildTickerHtml(){
    const syms = getTickerSymbols();
    if (!syms.length) return \`<div class=\"warn\">نمادی برای نمایش نیست.</div>\`;
    return syms.map(s=>{
      const q = state.extraQuotes?.[s];
      const f = quoteFmt(q);
      const sk = !q;
      return \`
        <button class=\"tItem\" data-pick-sym=\"\${escapeAttr(s)}\" title=\"انتخاب \${escapeAttr(s)}\">
          <div class=\"tSym\">\${escapeHtml(s)}</div>
          <div class=\"tPx \${sk?'skel skel-txt':''}\">\${sk?'':escapeHtml(f.px)}</div>
          <div class=\"tCh \${f.cls}\">\${escapeHtml(f.chTxt)}</div>
        </button>\`;
    }).join(\"\");
  }

  function buildWatchListHtml(){
    const symList = Array.isArray(state.symbols) ? state.symbols : [];
    const favs = Array.isArray(state.favs) ? state.favs : [];
    const group = state.watchGroup || \"favs\";
    const term = (state.watchSearch || \"\").trim().toUpperCase();

    let base = [];
    if (group === \"favs\") base = favs;
    else {
      base = symList.map(normSym).filter(Boolean).filter(s=>{
        if (term && !s.includes(term)) return false;
        if (group !== \"all\" && symCategory(s) !== group) return false;
        return true;
      });
    }

    const seen = new Set();
    const out = [];
    for (const s0 of base){
      const s = normSym(s0);
      if (!s || seen.has(s)) continue;
      seen.add(s);
      out.push(s);
      if (out.length >= 28) break;
    }

    if (!out.length) return \`<div class=\"warn\">چیزی پیدا نشد.</div>\`;

    return out.map(s=>{
      const q = state.extraQuotes?.[s];
      const f = quoteFmt(q);
      const isFav = favs.includes(s);
      return \`
        <div class=\"wItem\" data-pick-sym=\"\${escapeAttr(s)}\">
          <div class=\"wL\">
            <div class=\"wSym\">\${escapeHtml(s)}</div>
            <div class=\"wMeta\">\${escapeHtml(catLabel(symCategory(s)))} • \${escapeHtml(state.timeframe)}</div>
          </div>
          <div class=\"wR\">
            <div class=\"wPx \${!q?'skel skel-txt':''}\">\${!q?'':escapeHtml(f.px)}</div>
            <div class=\"wCh \${f.cls}\">\${escapeHtml(f.chTxt)}</div>
          </div>
          <div class=\"wA\">
            <button class=\"miniBtn\" data-open-tab=\"chart\" data-sym=\"\${escapeAttr(s)}\" title=\"چارت\">\${svgIcon(\"chart\")}</button>
            <button class=\"miniBtn\" data-open-tab=\"signal\" data-sym=\"\${escapeAttr(s)}\" title=\"تحلیل\">\${svgIcon(\"bolt\")}</button>
            <button class=\"miniBtn \${isFav?'active':''}\" data-fav-sym=\"\${escapeAttr(s)}\" title=\"واچ‌لیست\">⭐</button>
          </div>
        </div>
      \`;
    }).join(\"\");
  }

  function updateTickerDom(){
    const el = $(\"#tickerRow\");
    if (el) { el.innerHTML = buildTickerHtml(); wirePickSymButtons(); wireExtraButtons(); }
  }

  function updateWatchlistDom(){
    const el = $(\"#watchListWrap\");
    if (el) {
      const st = el.scrollTop;
      el.innerHTML = buildWatchListHtml();
      el.scrollTop = st;
      wirePickSymButtons(); wireExtraButtons();
    }
    $$(\".segBtn[data-watch-group]\").forEach(b => b.classList.toggle(\"active\", (b.dataset.watchGroup || \"\") === (state.watchGroup || \"favs\")));
  }

  function updateMarketDom(){
    const q = state.quote || {};
    const f = quoteFmt(q);
    const symEl = $(\"#marketSym\"); if (symEl) symEl.textContent = state.symbol;
    const pxEl = $(\"#marketPx\"); if (pxEl) pxEl.textContent = f.px;
    const chEl = $(\"#marketCh\"); if (chEl){ chEl.textContent = f.chTxt; chEl.className = \"mCh \" + f.cls; }
  }

  async function refreshExtraQuotes(force=false){
    try{
      if (!force && (Date.now() - (state.lastExtraTs||0) < 9000)) return;
      const favs = Array.isArray(state.favs) ? state.favs : [];
      const syms = [...getTickerSymbols(), ...favs].map(normSym).filter(Boolean);

      const uniq = [];
      const seen = new Set();
      for (const s of syms){
        if (seen.has(s)) continue;
        seen.add(s);
        uniq.push(s);
        if (uniq.length >= 18) break;
      }
      if (!uniq.length) return;

      const map = Object.assign({}, state.extraQuotes || {});
      for (let i=0;i<uniq.length;i+=4){
        const batch = uniq.slice(i,i+4);
        const res = await Promise.allSettled(batch.map(sym => api(API.quote, { miniToken: state.miniToken, allowGuest: false, symbol: sym, timeframe: state.timeframe })));
        res.forEach((r, idx) => { if (r.status === \"fulfilled\") map[batch[idx]] = r.value; });
      }
      state.extraQuotes = map;
      state.lastExtraTs = Date.now();
    }catch{}
  }

  function captureDrafts(){
    // (removed) optional user note field
  }


  loadPrefs();

  function setToken(t){
    state.miniToken = t || \"\";
    if (t) localStorage.setItem(LS_TOKEN, t);
    else localStorage.removeItem(LS_TOKEN);
  }

  function setWebToken(t){
    state.webToken = t || \"\";
    if (t) localStorage.setItem(LS_WEBTOKEN, t);
    else localStorage.removeItem(LS_WEBTOKEN);
  }

  async function api(path, body){
    const payload = Object.assign({}, body || {});
    try{
      const p = String(path || \"\");
      if (!p.startsWith(\"/api/web/auth/\")) {
        if (state.miniToken && !payload.miniToken) payload.miniToken = state.miniToken;
        if (state.webToken && !payload.webToken) payload.webToken = state.webToken;
      }
    }catch{}
    const resp = await fetch(path, {
      method: \"POST\",
      headers: {\"Content-Type\":\"application/json\"},
      body: JSON.stringify(payload)
    });
    const txt = await resp.text();
    let json = null;
    try { json = JSON.parse(txt); } catch {}
    if (!resp.ok) {
      const err = json?.error || json?.message || txt || (\"HTTP_\"+resp.status);
      const e = new Error(humanErr(err));
      e.status = resp.status;
      e.payload = json;
      throw e;
    }
    if (json && json.ok === false) {
      const e = new Error(humanErr(json.error || json.message || \"request_failed\"));
      e.status = 200;
      e.payload = json;
      throw e;
    }
    return json ?? {};
  }

  function badge(kind, text){
    const k = String(kind || \"mut\");
    return '<span class=\"badge ' + escapeHtml(k) + '\">' + escapeHtml(text || \"\") + '</span>';
  }

  function shortHex(s, head=8, tail=6){
    const t = String(s || \"\");
    if (t.length <= head + tail + 3) return t;
    return t.slice(0, head) + \"…\" + t.slice(-tail);
  }

  function bscTxUrl(txHash){
    const base = String(state.bscscanTxBase || \"https://bscscan.com/tx/\");
    return base + String(txHash || \"\");
  }

  function bscAddrUrl(addr){
    const base = String(state.bscscanAddrBase || \"https://bscscan.com/address/\");
    return base + String(addr || \"\");
  }

  function tryHexTimestampToFa(ts){
    // ts can be hex string (0x...) or number string
    try{
      if (ts === null || ts === undefined) return \"\";
      let n = 0;
      const s = String(ts);
      if (s.startsWith(\"0x\") || s.startsWith(\"0X\")) n = parseInt(s, 16);
      else n = parseInt(s, 10);
      if (!Number.isFinite(n) || n <= 0) return \"\";
      return new Date(n * 1000).toLocaleString(\"fa-IR\");
    }catch{ return \"\"; }
  }

  function openSubscription(offer, reason){
    try{
      state.pendingOffer = offer || null;
      state.pendingOfferReason = String(reason || "");
      if (offer && offer.bscscanTxBase) state.bscscanTxBase = String(offer.bscscanTxBase);
      if (offer && offer.bscscanAddrBase) state.bscscanAddrBase = String(offer.bscscanAddrBase);
    }catch{}
    state.tab = "account";
    render();
    afterRender();
    setTimeout(function(){
      const el = document.getElementById("webSubCard");
      if (el && el.scrollIntoView) el.scrollIntoView({behavior:"smooth", block:"start"});
    }, 80);
  }



  function escapeHtml(s){ return String(s||\"\").replace(/[&<>\"]/g, c=>({ \"&\":\"&amp;\",\"<\":\"&lt;\",\">\":\"&gt;\",\"\\"\":\"&quot;\" }[c]));}

  function toRichHtml(txt){
    const safe = escapeHtml(String(txt||\"\"));
    const lines = safe.split(/\r?\n/);
    let html = \"\";
    let inUl = false;
    const inline = (t)=> t
      .replace(/\*\*(.+?)\*\*/g, \"<strong>$1</strong>\")
      .replace(/\x60([^\x60]+)\x60/g, \"<code>$1</code>\");
    for (let raw of lines){
      const line = String(raw||\"\").trimEnd();
      if (!line.trim()){
        if (inUl){ html += \"</ul>\"; inUl=false; }
        html += \"<div class='sp'></div>\";
        continue;
      }
      if (/^#{1,3}\s+/.test(line)){
        if (inUl){ html += \"</ul>\"; inUl=false; }
        const lvl = (line.match(/^#+/)[0]||\"#\").length;
        const tag = Math.min(4, lvl+1);
        const t = inline(line.replace(/^#{1,3}\s+/, \"\"));
        html += \"<h\"+tag+\">\"+t+\"</h\"+tag+\">\";
        continue;
      }
      if (/^[-•]\s+/.test(line)){
        if (!inUl){ html += \"<ul>\"; inUl=true; }
        html += \"<li>\"+inline(line.replace(/^[-•]\s+/, \"\"))+\"</li>\";
        continue;
      }
      if (inUl){ html += \"</ul>\"; inUl=false; }
      html += \"<p>\"+inline(line)+\"</p>\";
    }
    if (inUl) html += \"</ul>\";
    return \"<div class='outRich'>\"+html+\"</div>\";
  }



  const _digitMap = {\"۰\":\"0\",\"۱\":\"1\",\"۲\":\"2\",\"۳\":\"3\",\"۴\":\"4\",\"۵\":\"5\",\"۶\":\"6\",\"۷\":\"7\",\"۸\":\"8\",\"۹\":\"9\",\"٠\":\"0\",\"١\":\"1\",\"٢\":\"2\",\"٣\":\"3\",\"٤\":\"4\",\"٥\":\"5\",\"٦\":\"6\",\"٧\":\"7\",\"٨\":\"8\",\"٩\":\"9\"};
  function toLatinDigits(s){
    return String(s||\"\").replace(/[۰-۹٠-٩]/g, (d)=> _digitMap[d] || d);
  }

  function splitAnalysisToMessages(text){
    const raw = String(text||\"\").trim();
    if (!raw) return [];
    const norm = toLatinDigits(raw);

    const re = /(^|\n)\s*(\d{1,2})\s*[\)\.\-:]/g;
    const starts = [];
    let m;
    while ((m = re.exec(norm)) !== null){
      const n = Number(m[2]);
      if (!Number.isFinite(n) || n < 1 || n > 20) continue;
      const pos = m.index + (m[1] ? m[1].length : 0);
      if (!starts.length || starts[starts.length-1] !== pos) starts.push(pos);
    }

    // Fallback: split by blank lines
    if (!starts.length){
      const paras = raw.split(/\n{2,}/).map(p=>p.trim()).filter(Boolean);
      if (paras.length <= 1) return [raw];
      const target = Math.min(4, paras.length);
      const per = Math.ceil(paras.length / target);
      const out = [];
      for (let i=0;i<paras.length;i+=per){
        out.push(paras.slice(i,i+per).join(\"\n\n\"));
      }
      return out;
    }

    if (starts[0] !== 0) starts.unshift(0);

    const secs = [];
    for (let i=0;i<starts.length;i++){
      const a = starts[i];
      const b = (i+1 < starts.length) ? starts[i+1] : raw.length;
      const seg = raw.slice(a, b).trim();
      if (seg) secs.push(seg);
    }

    if (secs.length <= 4) return secs;
    // Usually 5 sections → return 4 long messages
    return [secs[0], secs[1], secs[2], secs.slice(3).join(\"\n\n\")];
  }

  function normalizeZoneTitle(raw){
    const t = String(raw||"").trim();
    const n = t.toLowerCase()
      .replace(/[^a-z0-9آ-ی]+/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    const has = (...keys)=> keys.some(k => n.includes(String(k).toLowerCase()));
    if (has("market structure","ساختار بازار","structure")) return "ساختار بازار";
    if (has("key levels","levels","سطوح کلیدی","سطح کلیدی")) return "سطوح کلیدی";
    if (has("candlestick","candle","رفتار کندل","کندل")) return "رفتار کندل";
    if (has("entry scenarios","entry","سناریوهای ورود","سناریو ورود","ورود")) return "سناریوهای ورود";
    if (has("bias","scenarios","بایاس","سناریوها")) return "بایاس و سناریوها";
    if (has("execution plan","execution","پلن اجرا","برنامه اجرا","اجرا")) return "پلن اجرا";
    if (has("risk","مدیریت ریسک","ریسک")) return "مدیریت ریسک";
    if (has("targets","take profit","tp","اهداف","تارگت","حد سود")) return "اهداف";
    if (has("stop","stop loss","sl","حد ضرر")) return "حد ضرر";
    return t || "خروجی";
  }

  function parseSnapshotZones(text){
    const raw = String(text||"").replace(/\r/g,"");
    const lines = raw.split("\n");
    const out = [];
    let cur = null;

    const pushCur = ()=>{
      if (!cur) return;
      cur.body = String(cur.body||"").replace(/^\s+|\s+$/g,"");
      if (cur.body) out.push(cur);
      cur = null;
    };

    const isKnownHeading = (t)=>{
      const n = String(t||"").toLowerCase();
      return /(market\s*structure|key\s*levels|candlestick|entry\s*scenarios|bias|execution\s*plan|ساختار\s*بازار|سطوح\s*کلیدی|کندل|ورود|بایاس|پلن\s*اجرا)/i.test(n);
    };

    for (let i=0;i<lines.length;i++){
      const lineRaw = lines[i];
      const line = String(lineRaw||"").trim();
      let head = "";

      if (/^#{1,4}\s+/.test(line)){
        head = line.replace(/^#{1,4}\s+/, "").trim();
      } else {
        const m1 = line.match(/^\*\*(.+?)\*\*\s*:?\s*$/);
        if (m1) head = (m1[1]||"").trim();
      }

      // plain heading like "Market Structure:" or "ساختار بازار:"
      if (!head){
        const m2 = line.match(/^([A-Za-zآ-ی][^:：]{0,60})\s*[:：]\s*$/);
        if (m2 && (isKnownHeading(m2[1]) || (m2[1].trim().length <= 35))) head = (m2[1]||"").trim();
      }

      // exact known heading lines
      if (!head && isKnownHeading(line) && line.length <= 50){
        head = line.replace(/[:：]\s*$/, "").trim();
      }

      if (head){
        pushCur();
        cur = { title: normalizeZoneTitle(head), rawTitle: head, body: "" };
        continue;
      }

      if (!cur) cur = { title: "خروجی", rawTitle:"", body: "" };
      cur.body += lineRaw + "\n";
    }
    pushCur();

    if (out.length <= 1){
      // Fallback to message split
      const msgs = splitAnalysisToMessages(raw);
      if (msgs.length <= 1) return out.length ? out : [{ title:"خروجی", body: raw.trim() }];
      return msgs.map((m,i)=>({ title: "بخش " + (i+1), body: m }));
    }

    // order known zones
    const order = ["ساختار بازار","سطوح کلیدی","رفتار کندل","سناریوهای ورود","بایاس و سناریوها","مدیریت ریسک","اهداف","حد ضرر","پلن اجرا"];
    out.sort((a,b)=>{
      const ai = order.indexOf(a.title); const bi = order.indexOf(b.title);
      const ax = ai<0?999:ai; const bx = bi<0?999:bi;
      if (ax !== bx) return ax - bx;
      return String(a.title).localeCompare(String(b.title));
    });

    // drop generic "خروجی" if there are real zones
    if (out.length > 1){
      const filtered = out.filter(z=> z.title !== "خروجی");
      if (filtered.length) return filtered;
    }
    return out;
  }

  function overlaySnapshotHtml(job){
    const spec = job?.quickChartSpec || job?.qcSpec || null;
    if (!spec) return '<div class="muted">زون‌های چارت موجود نیست.</div>';
    const ov = parseOverlaysFromQuickChartSpec(spec) || { boxes:[], lines:[] };
    const boxes = Array.isArray(ov.boxes) ? ov.boxes : [];
    const lines = Array.isArray(ov.lines) ? ov.lines : [];

    const num = (x)=>{
      const n = Number(x);
      if (!Number.isFinite(n)) return String(x||"");
      return (Math.round(n*100)/100).toString();
    };

    const boxRows = boxes.map(b=>(
      '<tr>'
      + '<td class="mono">'+escapeHtml(num(b.yMin))+'</td>'
      + '<td class="mono">'+escapeHtml(num(b.yMax))+'</td>'
      + '<td>'+escapeHtml(String(b.label||""))+'</td>'
      + '</tr>'
    )).join("");

    const lineRows = lines.map(l=>(
      '<tr>'
      + '<td class="mono">'+escapeHtml(num(l.price))+'</td>'
      + '<td>'+escapeHtml(String(l.label||""))+'</td>'
      + '</tr>'
    )).join("");

    return ''
      + (boxes.length ? (
        '<div class="pill" style="margin-bottom:8px">BOX</div>'
        + '<table class="table"><thead><tr><th>Min</th><th>Max</th><th>Label</th></tr></thead>'
        + '<tbody>' + boxRows + '</tbody></table>'
      ) : '<div class="muted">BOX ندارد.</div>')
      + '<div class="sep"></div>'
      + (lines.length ? (
        '<div class="pill" style="margin-bottom:8px">LINE</div>'
        + '<table class="table"><thead><tr><th>Price</th><th>Label</th></tr></thead>'
        + '<tbody>' + lineRows + '</tbody></table>'
      ) : '<div class="muted">LINE ندارد.</div>');
  }

  function snapshotHtml(text, job){
    const zones = parseSnapshotZones(text);
    const zoneCards = zones.map(z=>(
      '<div class="snapCard">'
      + '<div class="snapHead">'+escapeHtml(z.title)+'</div>'
      + '<div class="snapBody">'+toRichHtml(z.body)+'</div>'
      + '</div>'
    )).join("");

    return ''
      + '<div class="zoneGrid">'
      + '  <div class="snapWrap">' + (zoneCards || '<div class="muted">—</div>') + '</div>'
      + '  <div class="snapWrap">'
      + '    <div class="snapCard">'
      + '      <div class="snapHead">زون‌های چارت</div>'
      + '      <div class="snapBody">' + overlaySnapshotHtml(job) + '</div>'
      + '    </div>'
      + '  </div>'
      + '</div>';
  }

  function renderAnalysisMessages(text, outEl, job){
    if (!outEl) return;

    const raw = String(text||"");
    if (!raw.trim()){
      outEl.innerHTML = "<span class='warn'>—</span>";
      return;
    }

    const tab = (state.outTab === "text" ? "text" : "snapshot");

    const btn = (id, label)=> (
      '<button class="btn ' + (tab===id ? 'primary' : '') + '" data-out-tab="'+escapeAttr(id)+'">'+escapeHtml(label)+'</button>'
    );

    const msgs = splitAnalysisToMessages(raw);
    const msgHtml = (msgs.length ? (
      '<div class="msgList">'
      + msgs.map((m,i)=>(
        '<div class="msgCard">'
        + '  <div class="msgHead">'
        + '    <span class="tag">پیام '+(i+1)+' از '+msgs.length+'</span>'
        + '    <span class="muted">'+escapeHtml(state.symbol)+' • '+escapeHtml(String(state.timeframe||""))+'</span>'
        + '  </div>'
        +    toRichHtml(m)
        + '</div>'
      )).join("")
      + '</div>'
    ) : "<span class='warn'>—</span>");

    outEl.innerHTML = ''
      + '<div class="outTabs">'
      +   btn("snapshot","اسنپ‌شات")
      +   btn("text","متن")
      + '</div>'
      + '<div class="outPane">'
      +   (tab==="text" ? msgHtml : snapshotHtml(raw, job))
      + '</div>';

    outEl.querySelectorAll("button[data-out-tab]").forEach((b)=>{
      b.onclick = ()=>{
        const id = b.getAttribute("data-out-tab") || "snapshot";
        state.outTab = (id === "text" ? "text" : "snapshot");
        renderAnalysisMessages(text, outEl, job);
      };
    });
  }


  function toast(msg, kind=\"info\"){
    const host = document.getElementById(\"toastHost\");
    if (!host) return;
    const el = document.createElement(\"div\");
    el.className = \"toast\" + (kind===\"ok\"?\" ok\":kind===\"err\"?\" err\":\"\");
    const title = kind===\"ok\"?\"موفق\":(kind===\"err\"?\"خطا\":\"پیام\");
    const ico = kind===\"ok\"?\"✅\":(kind===\"err\"?\"⛔\":\"ℹ️\");
    el.innerHTML = \`<div style=\"margin-top:1px\">\${ico}</div><div><div class=\"t\">\${escapeHtml(title)}</div><div class=\"m\">\${escapeHtml(String(msg||\"\"))}</div></div>\`;
    host.appendChild(el);
    requestAnimationFrame(()=>{ el.style.opacity=\"1\"; el.style.transform=\"translateY(0)\"; });
    setTimeout(()=>{ el.style.opacity=\"0\"; el.style.transform=\"translateY(6px)\"; }, 2800);
    setTimeout(()=>{ el.remove(); }, 3600);
  }
  function escapeAttr(s){ return escapeHtml(s).replace(/\"/g,\"&quot;\");}


  function renderTxVisual(chk, fallbackTx){
    try{
      if (!chk) return "";
      const ok = !!chk.ok;
      const provider = String(chk.provider || "");
      const txHash = String(chk.txHash || fallbackTx || "");
      const expected = (chk.expected !== undefined && chk.expected !== null) ? String(chk.expected) : "";
      const amountVal = (chk.amount !== undefined && chk.amount !== null) ? chk.amount : (chk.report && chk.report.sum);
      const amount = (amountVal !== undefined && amountVal !== null) ? String(amountVal) : "";
      const to = String(chk.to || "");
      const token = String(chk.tokenContract || "");
      const transfers = String(chk.transfers || (chk.report && chk.report.transfers) || "");
      const rep = chk.report || {};
      const from = (rep.tx && rep.tx.from) ? String(rep.tx.from) : "";
      const blockNo = (rep.receipt && rep.receipt.blockNumber) ? String(rep.receipt.blockNumber) : ((rep.block && rep.block.number) ? String(rep.block.number) : "");
      const when = (rep.block && rep.block.timestamp) ? tryHexTimestampToFa(rep.block.timestamp) : "";
      const reason = String(chk.reason || chk.error || "");
      const matches = Array.isArray(rep.matches) ? rep.matches : [];

      let html = '<div class="txCard ' + (ok ? 'ok' : 'bad') + '">';
      html += '<div class="row" style="justify-content:space-between;gap:10px;flex-wrap:wrap">';
      html += '<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">';
      html += (ok ? badge('ok','OK') : badge('bad', reason || 'FAIL'));
      if (provider) html += badge('mut', provider.toUpperCase());
      if (transfers) html += badge('mut', 'Transfers: ' + transfers);
      html += '</div>';
      if (txHash) html += '<a class="link" target="_blank" rel="noreferrer" href="' + escapeAttr(bscTxUrl(txHash)) + '">BscScan ↗</a>';
      html += '</div>';

      html += '<div class="kvs" style="margin-top:10px">';
      if (expected) html += '<div class="kv"><div class="k">Expected</div><div class="v mono">' + escapeHtml(expected) + '</div></div>';
      if (amount)   html += '<div class="kv"><div class="k">Amount</div><div class="v mono">' + escapeHtml(amount) + '</div></div>';
      if (to)       html += '<div class="kv"><div class="k">To</div><div class="v mono">' + escapeHtml(shortHex(to, 10, 8)) + '</div></div>';
      if (from)     html += '<div class="kv"><div class="k">From</div><div class="v mono">' + escapeHtml(shortHex(from, 10, 8)) + '</div></div>';
      if (blockNo)  html += '<div class="kv"><div class="k">Block</div><div class="v mono">' + escapeHtml(blockNo) + '</div></div>';
      if (when)     html += '<div class="kv"><div class="k">Time</div><div class="v">' + escapeHtml(when) + '</div></div>';
      if (token)    html += '<div class="kv"><div class="k">Token</div><div class="v mono">' + escapeHtml(shortHex(token, 10, 8)) + '</div></div>';
      html += '</div>';

            // Decision summary
      {
        const expNum = Number(expected || 0);
        const gotNum = Number(amount || 0);
        const hasExp = Number.isFinite(expNum) && expNum > 0;
        const hasGot = Number.isFinite(gotNum) && gotNum >= 0;
        const diff = (hasExp && hasGot) ? (gotNum - expNum) : 0;
        const pct = (hasExp && hasGot && expNum > 0) ? (diff * 100 / expNum) : 0;
        let verdict = ok ? \"✅ پیشنهاد: تایید\" : \"❌ پیشنهاد: عدم تایید\";
        let note = \"\";
        if (!ok) note = reason || \"نیاز به بررسی\";
        else if (hasExp && hasGot && gotNum + 1e-12 < expNum) note = \"مبلغ کمتر از انتظار\";
        else if (hasExp && hasGot && gotNum - 1e-12 > expNum) note = \"مبلغ بیشتر از انتظار\";
        html += '<div class="txVerdict ' + (ok ? 'ok' : 'bad') + '">' +
          '<div style="font-weight:900">' + escapeHtml(verdict) + '</div>' +
          (note ? '<div class="muted" style="font-size:12px;margin-top:4px">' + escapeHtml(note) + '</div>' : '') +
          (hasExp && hasGot ? ('<div class="muted" style="font-size:12px;margin-top:6px">Δ ' + escapeHtml(String(diff.toFixed ? diff.toFixed(4) : diff)) + ' USDT (' + escapeHtml(String(pct.toFixed ? pct.toFixed(2) : pct)) + '%)</div>') : '') +
        '</div>';
      }

      if (matches.length){
        let sumA = 0;
        let maxA = 0;
        for (const t of matches){
          const a = Number(t.amount || 0);
          if (Number.isFinite(a)) { sumA += a; if (a > maxA) maxA = a; }
        }
        html += '<details class="details" style="margin-top:10px"><summary>Transfers (' + matches.length + ') • Total: ' + escapeHtml(String(sumA.toFixed ? sumA.toFixed(4) : sumA)) + ' USDT</summary>';
        html += '<div style="overflow:auto;margin-top:8px"><table class="tbl"><thead><tr><th>#</th><th>From</th><th>To</th><th>Amount</th><th>Share</th></tr></thead><tbody>';
        let i = 0;
        for (const t of matches.slice(0, 80)){
          i += 1;
          const f = shortHex(t.from || \"\", 10, 8);
          const tt = shortHex(t.to || \"\", 10, 8);
          const aNum = Number(t.amount || 0);
          const a = (t.amount !== undefined && t.amount !== null) ? String(t.amount) : (t.amountRaw ? String(t.amountRaw) : \"\");
          const share = (Number.isFinite(aNum) && sumA > 0) ? ((aNum*100/sumA).toFixed(1) + \"%\") : \"\";
          const hot = (Number.isFinite(aNum) && aNum >= maxA && maxA > 0) ? ' style="font-weight:900"' : \"\";
          html += '<tr><td class="mono">' + i + '</td><td class="mono">' + escapeHtml(f) + '</td><td class="mono">' + escapeHtml(tt) + '</td><td class="mono"' + hot + '>' + escapeHtml(a) + '</td><td class="mono">' + escapeHtml(share) + '</td></tr>';
        }
        html += '</tbody></table></div></details>';
      }
      // Raw (expandable)
      html += '<details class="details" style="margin-top:10px"><summary>Raw JSON</summary><pre class="pre" style="white-space:pre-wrap;max-height:260px;overflow:auto">' + escapeHtml(JSON.stringify(chk, null, 2)) + '</pre></details>';

      html += '</div>';
      return html;
    }catch(e){
      return '<div class="warn">خطا در نمایش گزارش تراکنش</div>';
    }
  }

  function appendUpgradeCta(outEl, left){
    try{
      if (!outEl || !outEl.insertAdjacentHTML) return;
      if (outEl.querySelector && outEl.querySelector("#upgradeCtaBtn")) return;
      const l = Number(left || 0);
      const msg = l >= 0 ? ("⚡ سهمیه شما کم است (" + l + " تحلیل باقی مانده). برای ادامه راحت‌تر، Pro بگیر.") : "⚡ برای سهمیه بیشتر، Pro بگیر.";
      const html =
        '<div class="subCtaMini" style="margin-top:14px">' +
          '<div class="row" style="justify-content:space-between;gap:10px;flex-wrap:wrap">' +
            '<div><div style="font-weight:900">پیشنهاد اشتراک</div><div class="muted" style="font-size:12px;margin-top:4px;line-height:1.7">' + escapeHtml(msg) + '</div></div>' +
            '<div class="row" style="gap:8px;flex-wrap:wrap">' +
              '<button class="btn" id="upgradeCtaBtn">خرید اشتراک</button>' +
              '<button class="btn secondary" id="upgradeCtaPlansBtn">پلن‌ها</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      outEl.insertAdjacentHTML("beforeend", html);

      const openIt = async (why) => {
        try{
          const r = await api(API.subPlans, { miniToken: state.miniToken });
          const offer = { wallet: r.wallet || "", plans: r.plans || [], bscscanTxBase: "https://bscscan.com/tx/", bscscanAddrBase: "https://bscscan.com/address/" };
          openSubscription(offer, why || "after_analysis");
        }catch(e){
          toast((e && e.message) ? e.message : "خطا", "err");
        }
      };

      const b1 = document.getElementById("upgradeCtaBtn");
      const b2 = document.getElementById("upgradeCtaPlansBtn");
      if (b1) b1.onclick = () => openIt("after_analysis");
      if (b2) b2.onclick = () => openIt("plans");
    }catch{}
  }


  // ---- TradingView (Widget) helpers ----
  function tvSymbolFromAppSymbol(sym){
    const s0 = String(sym||\"\").trim().toUpperCase();
    if (!s0) return \"BINANCE:BTCUSDT\";
    if (s0.includes(\":\")) return s0;
    if (/^[A-Z0-9]{3,12}USDT$/.test(s0)) return \"BINANCE:\" + s0;
    if (s0 === \"XAUUSD\" || s0 === \"XAGUSD\") return \"OANDA:\" + s0;
    if (/^[A-Z]{6}$/.test(s0)) return \"OANDA:\" + s0;
    return \"FX_IDC:\" + s0.replace(/[^A-Z0-9]/g, \"\");
  }

  function tvIntervalFromTf(tf){
    const x = String(tf||\"H4\").toUpperCase();
    if (x === \"M15\") return \"15\";
    if (x === \"H1\") return \"60\";
    if (x === \"H4\") return \"240\";
    if (x === \"D1\") return \"D\";
    if (x === \"W1\") return \"W\";
    return \"240\";
  }

  function tvChartLink(sym, tf){
    const s = encodeURIComponent(tvSymbolFromAppSymbol(sym));
    const i = encodeURIComponent(tvIntervalFromTf(tf));
    return \"https://www.tradingview.com/chart/?symbol=\" + s + \"&interval=\" + i;
  }

  function renderTvAdvancedChart(targetEl, sym, tf){
    if (!targetEl) return;
    // Clean previous widget
    targetEl.innerHTML = \"\";
    const container = document.createElement(\"div\");
    container.className = \"tradingview-widget-container\";
    const widget = document.createElement(\"div\");
    widget.className = \"tradingview-widget-container__widget\";
    container.appendChild(widget);

    const script = document.createElement(\"script\");
    script.type = \"text/javascript\";
    script.async = true;
    script.src = \"https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js\";
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbolFromAppSymbol(sym),
      interval: tvIntervalFromTf(tf),
      timezone: \"Etc/UTC\",
      theme: \"dark\",
      style: \"1\",
      locale: \"en\",
      enable_publishing: false,
      allow_symbol_change: true,
      calendar: false,
      hide_side_toolbar: false,
      hide_top_toolbar: false,
      save_image: false,
      support_host: \"https://www.tradingview.com\"
    });

    container.appendChild(script);
    targetEl.appendChild(container);
  }


  function multiCount(){
    return state.multiLayout === \"4\" ? 4 : (state.multiLayout === \"2\" ? 2 : 1);
  }

  function normalizeMultiTfs(){
    if (!Array.isArray(state.multiTfs)) state.multiTfs = [];
    const def = [\"H4\",\"H1\",\"D1\",\"W1\"];
    for (let i=0;i<4;i++){
      if (!state.multiTfs[i]) state.multiTfs[i] = def[i];
    }
    state.multiTfs = state.multiTfs.map(x => String(x||\"\").trim().toUpperCase()).slice(0,4);
    const def2 = [\"H4\",\"H1\",\"D1\",\"W1\"];
    for (let i=0;i<4;i++){
      if (!state.multiTfs[i]) state.multiTfs[i] = def2[i];
    }
    savePrefs();
  }

  function applyMultiPreset(name){
    if (name === \"mtf_a\") state.multiTfs = [\"M15\",\"H1\",\"H4\",\"D1\"];
    else if (name === \"mtf_b\") state.multiTfs = [\"H1\",\"H4\",\"D1\",\"W1\"];
    else state.multiTfs = [\"H4\",\"H1\",\"D1\",\"W1\"];
    savePrefs();
  }

  function renderTvMultiCharts(){
    normalizeMultiTfs();
    const count = multiCount();
    for (let i=0;i<count;i++){
      const el = $(\"#tvW\"+i);
      if (!el) continue;
      const tf = (state.multiTfs && state.multiTfs[i]) ? state.multiTfs[i] : state.timeframe;
      renderTvAdvancedChart(el, state.symbol, tf);
    }
  }

  function buildDefaultPrompt(){
    const s = (state.style || \"پرایس اکشن\").trim();
    return \`تحلیل \${s} برای \${state.symbol} روی تایم‌فریم \${state.timeframe}.
\` +
           \`خروجی ساختارمند بده: Market Structure، Key Levels، Entry Scenarios، Stop/TP و Execution Plan.
\` +
           \`حداقل RR = 1:2. اگر سبک \"\${s}\" نیاز دارد، فقط همان سبک را اجرا کن.\`;
  }

  function mount(html){ $(\"#root\").innerHTML = html; }
  const TAB_META = {
    dashboard:  { title: tr("داشبورد","Dashboard"),     sub: tr("قیمت و خبر","Prices & news"),      icon: "home" },
    news:       { title: tr("اخبار","News"),            sub: tr("لیست خبر","News list"),           icon: "news" },
    newsAnalyze:{ title: tr("تحلیل خبر","News AI"),     sub: tr("AI","AI"),                         icon: "spark" },
    signal:     { title: tr("سیگنال","Signal"),         sub: tr("AI + Queue","AI + Queue"),        icon: "bolt" },
    chart:      { title: tr("چارت","Chart"),            sub: tr("TradingView","TradingView"),      icon: "chart" },
    account:    { title: tr("حساب","Account"),          sub: tr("ایمیل/تلگرام","Email/Telegram"),  icon: "user" },
    subscription:{ title: tr("اشتراک","Subscription"),  sub: tr("پرداخت Pro","Pro payment"),       icon: "spark" },
    wallet:     { title: tr("کیف پول","Wallet"),        sub: tr("QR + پرداخت","QR + Pay"),         icon: "copy" },
    admin:      { title: tr("ادمین","Admin"),           sub: tr("پرداخت/کمیسیون","Payments/Ref"),  icon: "grid" },
  };

  function svgIcon(name){
    const common = 'viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"';
    if (name === \"home\")  return \`<svg class=\"nav-ico\" \${common}><path d=\"M3 10.5 12 3l9 7.5\"/><path d=\"M5 10v10h14V10\"/></svg>\`;
    if (name === \"news\")  return \`<svg class=\"nav-ico\" \${common}><path d=\"M5 6h14v13H5z\"/><path d=\"M8 10h8\"/><path d=\"M8 13h8\"/><path d=\"M8 16h6\"/></svg>\`;
    if (name === \"spark\") return \`<svg class=\"nav-ico\" \${common}><path d=\"M12 2l1.7 5.6L19 9l-5.3 1.4L12 16l-1.7-5.6L5 9l5.3-1.4L12 2z\"/></svg>\`;
    if (name === \"bolt\")  return \`<svg class=\"nav-ico\" \${common}><path d=\"M13 2 4 14h7l-1 8 9-12h-7z\"/></svg>\`;
    if (name === \"chart\") return \`<svg class=\"nav-ico\" \${common}><path d=\"M4 19V5\"/><path d=\"M4 19h16\"/><path d=\"M7 15l3-4 3 3 4-6\"/></svg>\`;
    if (name === \"user\")  return \`<svg class=\"nav-ico\" \${common}><path d=\"M20 21a8 8 0 0 0-16 0\"/><circle cx=\"12\" cy=\"8\" r=\"4\"/></svg>\`;
    if (name === \"search\")return \`<svg class=\"nav-ico\" \${common}><circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"M20 20l-3.5-3.5\"/></svg>\`;
    if (name === \"menu\")  return \`<svg class=\"nav-ico\" \${common}><path d=\"M4 6h16\"/><path d=\"M4 12h16\"/><path d=\"M4 18h16\"/></svg>\`;
    if (name === \"grid\")  return \`<svg class=\"nav-ico\" \${common}><path d=\"M4 4h7v7H4z\"/><path d=\"M13 4h7v7h-7z\"/><path d=\"M4 13h7v7H4z\"/><path d=\"M13 13h7v7h-7z\"/></svg>\`;
    if (name === \"pause\") return \`<svg class=\"nav-ico\" \${common}><path d=\"M6 4h4v16H6z\"/><path d=\"M14 4h4v16h-4z\"/></svg>\`;
    if (name === \"play\")  return \`<svg class=\"nav-ico\" \${common}><path d=\"M8 5v14l11-7z\"/></svg>\`;
    if (name === \"copy\")  return \`<svg class=\"nav-ico\" \${common}><rect x=\"9\" y=\"9\" width=\"13\" height=\"13\" rx=\"2\"/><path d=\"M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\"/></svg>\`;
    if (name === \"refresh\") return \`<svg class=\"nav-ico\" \${common}><path d=\"M21 12a9 9 0 1 1-3-6.7\"/><path d=\"M21 3v6h-6\"/></svg>\`;
    return \`<svg class=\"nav-ico\" \${common}><circle cx=\"12\" cy=\"12\" r=\"9\"/></svg>\`;
  }

  function fmtTime(ts){
    if (!ts) return \"—\";
    try{
      return new Date(ts).toLocaleTimeString(\"fa-IR\", { hour: \"2-digit\", minute: \"2-digit\" });
    }catch(e){
      return new Date(ts).toLocaleTimeString();
    }
  }


  function fmtMoney(n){
    const x = Number(n || 0);
    if (!Number.isFinite(x)) return \"0\";
    try { return x.toLocaleString(\"fa-IR\", { maximumFractionDigits: 2 }); } catch { return String(Math.round(x*100)/100); }
  }

  function pill(ok, text){
    return \`<span class=\"pill\" style=\"border-color:\${ok?'rgba(52,211,153,.55)':'rgba(251,113,133,.55)'}\">\${escapeHtml(text)}</span>\`;
  }

  function authView(){
    const activeLogin = state.authTab === \"login\" ? \"active\" : \"\";
    const activeSignup = state.authTab === \"signup\" ? \"active\" : \"\";
    return \`
      <div style=\"max-width:640px;margin:6vh auto\" class=\"card\">
        <div class="h">${tr("ورود / ثبت‌نام","Login / Sign up")}</div>
        <div class=\"c grid\">
          <div class=\"row\">
            <button class=\"btn-nav \${activeLogin}\" id=\"authTabLogin\" style=\"flex:1\">${tr("ورود","Login")}</button>
            <button class=\"btn-nav \${activeSignup}\" id=\"authTabSignup\" style=\"flex:1\">${tr("ثبت‌نام","Sign up")}</button>
          </div>

          <div id=\"authForms\"></div>

        </div>
      </div>
    \`;
  }

  function loginForm(){
    return \`
      <div class=\"grid\">
        <div class=\"row\">
          <input id=\"loginUser\" placeholder="${tr("یوزرنیم یا ایمیل","Username or email")}" />
        </div>
        <div class=\"row\">
          <input id=\"loginPass\" type=\"password\" placeholder="${tr("پسورد","Password")}" />
        </div>
        <div class=\"row\" style=\"justify-content:space-between;align-items:center\">
          <button class=\"btn\" id="loginBtn" style="min-width:160px">${tr("ورود","Login")}</button>
          <button class=\"btn secondary\" id="openResetBtn" style="min-width:160px">${tr("فراموشی رمز؟","Forgot password?")}</button>
          <div id=\"authMsg\" class=\"warn\" style=\"flex:1\"></div>
        </div>

        <div id=\"resetBox\" class=\"warn\" style=\"display:none;margin-top:10px\">
          <div style=\"font-weight:900;margin-bottom:6px\">بازیابی رمز عبور</div>
          <div class=\"row\">
            <input id=\"rsUser\" placeholder=\"یوزرنیم یا ایمیل\" />
            <select id=\"rsChannel\" style=\"max-width:150px\">
              <option value=\"email\">ایمیل</option>
              <option value=\"telegram\">تلگرام</option>
            </select>
            <button class=\"btn\" id=\"rsReqBtn\">ارسال کد</button>
          </div>
          <div class=\"row\">
            <input id=\"rsCode\" placeholder=\"کد ۶ رقمی\" style=\"max-width:180px\" />
            <input id=\"rsNewPass\" type=\"password\" placeholder=\"پسورد جدید (حداقل 8)\" />
            <button class=\"btn\" id=\"rsConfBtn\">تغییر رمز</button>
          </div>
          <div id=\"rsMsg\" style=\"font-size:12px;color:var(--muted);margin-top:6px\"></div>
        </div>
      </div>
    \`;
  }

  function signupForm(){
    return \`
      <div class=\"grid\">
        <div class=\"row\">
          <input id=\"suEmail\" placeholder=\"ایمیل\" />
        </div>
        <div class=\"row\">
          <input id=\"suUser\" placeholder=\"یوزرنیم (Latin) مثل: majid_23\" />
        </div>
        <div class=\"row\">
          <input id=\"suPass\" type=\"password\" placeholder=\"پسورد (حداقل 8 کاراکتر)\" />
        </div>
        <div class=\"row\">
          <input id=\"suTg\" placeholder=\"Telegram Username (اختیاری) مثل: mad_pyc\" />
        </div>
        <div class=\"row\">
          <button class=\"btn\" id=\"signupBtn\" style=\"min-width:160px\">ثبت‌نام</button>
          <div id=\"authMsg\" class=\"warn\" style=\"flex:1\"></div>
        </div>
      </div>
    \`;
  }

    function navBtn(id){
    const m = TAB_META[id] || { title: id, sub: \"\", icon: \"home\" };
    const active = state.tab === id ? \"active\" : \"\";
    const cur = state.tab === id ? \"page\" : \"false\";
    return \`
      <button class=\"btn-nav tabBtn \${active}\" data-tab=\"\${id}\" aria-current=\"\${cur}\">
        \${svgIcon(m.icon)}
        <div style=\"flex:1;min-width:0\">
          <div style=\"font-weight:950\">\${escapeHtml(m.title)}</div>
          <div style=\"font-size:12px;color:var(--muted);margin-top:2px\">\${escapeHtml(m.sub)}</div>
        </div>
        <span class=\"nav-arrow\">‹</span>
      </button>
    \`;
  }

  function shell(){
    const symList = Array.isArray(state.symbols) ? state.symbols : [];
    const styleList = (Array.isArray(state.styles) && state.styles.length) ? state.styles : [\"پرایس اکشن\",\"ICT\",\"ATR\"];
    const navIds = [\"dashboard\",\"chart\",\"signal\",\"news\",\"newsAnalyze\",\"account\"]; 
    if (state.isAdmin) navIds.push(\"admin\");

    const symOpts = symList.map(s => \`<option value=\"\${escapeAttr(normSym(String(s)).toUpperCase())}\"></option>\`).join(\"\");
    const styleOpts = styleList.map(s => \`<option value=\"\${escapeAttr(s)}\" \${s===state.style?\"selected\":\"\"}>\${escapeHtml(s)}</option>\`).join(\"\");

    const tfList = [\"M15\",\"H1\",\"H4\",\"D1\"];
    const tfOpts = tfList.map(tf => \`<option \${tf===state.timeframe?\"selected\":\"\"}>\${tf}</option>\`).join(\"\");

    const q = state.quote || {};
    const f = quoteFmt(q);

    const lastTs = Math.max(state.lastQuoteTs||0, state.lastNewsTs||0, state.lastExtraTs||0);
    const lastTxt = fmtTime(lastTs);

    const tm = TAB_META[state.tab] || { title: \"پنل\", sub: \"\" };
    const appCls = \`app\${state.layoutMode===\"compact\" ? \" compact\" : \"\"}\${state.sideCollapsed ? \" side-closed\" : \"\"}\${state.symMenuCollapsed ? \" symmenu-closed\" : \"\"}\`;
    const favActive = (Array.isArray(state.favs) ? state.favs : []).includes(normSym(state.symbol)) ? \"active\" : \"\";

    const liveTitle = state.livePaused ? \"به‌روزرسانی متوقف\" : \"به‌روزرسانی زنده\";
    const liveIcon  = state.livePaused ? \"⏸\" : \"📡\";

    const group = state.watchGroup || \"favs\";
    const seg = (id, label) => \`<button class=\"segBtn \${group===id?\"active\":\"\"}\" data-watch-group=\"\${id}\">\${escapeHtml(label)}</button>\`;

    const mobBtn = (id, label, icon) => {
      const active = state.tab === id ? \"active\" : \"\";
      return \`<button class=\"mobbtn tabBtn \${active}\" data-tab=\"\${id}\" aria-label=\"\${escapeAttr(label)}\">
        \${svgIcon(icon)}
        <div>\${escapeHtml(label)}</div>
      </button>\`;
    };

    return \`
      <div class=\"\${appCls}\">
        <div class=\"backdrop\" id=\"backdrop\"></div>

        <aside class=\"side\" aria-label=\"sidebar\">
          <div class=\"brand\">
            <img src=\"/web/logo\" alt=\"logo\" />
            <div>
              <div class=\"t1\">IQ Market</div>
              <div class=\"t2\">Web App — ترید حرفه‌ای</div>
            </div>
          </div>

          <div class=\"nav\">
            \${navIds.map(id => navBtn(id)).join(\"\")}
          </div>

          <div style=\"margin-top:14px\" class=\"warn\">
            <div class=\"row\">
              <span class=\"pill\">Symbol: <b>\${escapeHtml(state.symbol)}</b></span>
              <span class=\"pill\">TF: <b>\${escapeHtml(state.timeframe)}</b></span>
              <span class=\"pill\">Style: <b>\${escapeHtml(state.style || \"—\")}</b></span>
            </div>
            <div class=\"warn\" style=\"margin-top:8px\">میانبرها: <span class=\"kbd\">/</span> جستجوی نماد • <span class=\"kbd\">ESC</span> بستن منو</div>
          </div>

          <div class=\"card\" style=\"margin-top:14px;border-radius:16px\">
            <div class=\"c\">
              <div class=\"row\" style=\"justify-content:space-between;align-items:center\">
                <div class=\"warn\" style=\"font-weight:950\">📌 واچ‌لیست / مارکت</div>
                <span class=\"pill\">\${state.livePaused ? \"متوقف\" : \"زنده\"}</span>
              </div>

              <div class=\"row\" style=\"margin-top:10px\">
                <div class=\"field\" style=\"height:40px;border-radius:14px;flex:1\">
                  \${svgIcon(\"search\")}
                  <input id=\"watchSearchInp\" placeholder=\"جستجو در نمادها...\" value=\"\${escapeAttr(state.watchSearch||\"\")}\" style=\"height:36px\" />
                </div>
              </div>

              <div class=\"segRow\" id=\"watchGroupRow\" style=\"margin-top:10px\">
                \${seg(\"favs\",\"⭐\")}
                \${seg(\"all\",\"All\")}
                \${seg(\"crypto\",\"Crypto\")}
                \${seg(\"forex\",\"Forex\")}
                \${seg(\"metals\",\"Metals\")}
                \${seg(\"indices\",\"Indices\")}
              </div>

              <div class=\"watchList\" id=\"watchListWrap\" style=\"margin-top:10px\">
                \${buildWatchListHtml()}
              </div>

              <div class=\"row\" style=\"margin-top:10px;justify-content:space-between\">
                <button class=\"btn secondary small\" id=\"addCurToFavBtn\" style=\"flex:1\">⭐ نماد فعلی</button>
                <button class=\"btn secondary small\" id=\"refreshExtraBtn\" title=\"ریفرش\"><span style=\"display:flex;align-items:center;gap:8px\">\${svgIcon(\"refresh\")} ریفرش</span></button>
              </div>
            </div>
          </div>

          <div style=\"margin-top:18px\">
            <button class=\"btn secondary\" id=\"logoutBtn\" style=\"width:100%\">خروج</button>
          </div>
        </aside>

        <main class=\"main\">
          <header class=\"topbar\" aria-label=\"topbar\">
            <div class=\"topL\">
              <button class=\"iconBtn\" id=\"sidebarToggle\" title=\"منو\">\${svgIcon(\"menu\")}</button>
              <button class=\"iconBtn \${state.symMenuCollapsed?\"active\":\"\"}\" id=\"symMenuToggle\" title=\"نماد\">\${svgIcon(\"search\")}</button>
              <div>
                <div class=\"pageTitle\">\${escapeHtml(tm.title)} <span class=\"pill\" style=\"margin-right:8px\">WEB</span></div>
                <div class=\"pageSub\">آخرین بروزرسانی: <span class=\"kbd\">\${escapeHtml(lastTxt)}</span></div>
              </div>
            </div>

            <div class=\"market\" aria-label=\"market\">
              <div class=\"mSym\" id=\"marketSym\">\${escapeHtml(state.symbol)}</div>
              <div class=\"mPx\" id=\"marketPx\">\${escapeHtml(f.px)}</div>
              <div class=\"mCh \${f.cls}\" id=\"marketCh\">\${escapeHtml(f.chTxt)}</div>
            </div>


            <div class=\"energy\" id=\"energyBox\" aria-label=\"points\">
              <div class=\"energyTop\">
                <span id=\"ptsBalance\">—</span>
                <span class=\"mut\" id=\"ptsLeft\">—</span>
              </div>
              <div class=\"energyBar\"><div class=\"energyFill\" id=\"ptsFill\"></div></div>
              <div class=\"energySub\" id=\"ptsMeta\"></div>
            </div>

            <div class=\"controls\" aria-label=\"controls\">
              <div class=\"field symField\" title=\"جستجوی نماد ( / )\">
                \${svgIcon(\"search\")}
                <input id=\"symbolInp\" list=\"symList\" placeholder=\"Symbol مثل BTCUSDT\" value=\"\${escapeAttr(state.symbol)}\" />
                <button class=\"symCloseBtn\" id=\"symCloseBtn\" title=\"بستن\">✕</button>
              </div>
              <datalist id=\"symList\">\${symOpts}</datalist>

              <select id=\"tfSel\" title=\"تایم‌فریم\" style=\"max-width:110px;height:44px\">\${tfOpts}</select>

              <select id=\"styleSelTop\" title=\"سبک تحلیل\" style=\"max-width:210px;height:44px\">
                \${styleOpts}
              </select>

              <button class=\"iconBtn \${state.livePaused?\"active\":\"\"}\" id=\"liveToggleBtn\" title=\"\${liveTitle}\">\${liveIcon}</button>
          <button class=\"btn\" id=\"applySymbolBtn\" title=\"اعمال تنظیمات\">اعمال</button>
              <button class=\"iconBtn \${favActive}\" id=\"favToggleBtn\" title=\"واچ‌لیست\">⭐</button>
              <button class=\"iconBtn\" id=\"layoutToggleBtn\" title=\"تغییر چیدمان\">\${svgIcon(\"grid\")}</button>
            </div>
          </header>

          <div class=\"tickerRow\" id=\"tickerRow\" aria-label=\"ticker\">
            \${buildTickerHtml()}
          </div>

          <div id=\"view\"></div>
        </main>

        <nav class=\"mobnav\" aria-label=\"navigation\">
          \${mobBtn(\"dashboard\",\"خانه\",\"home\")}
          \${mobBtn(\"chart\",\"چارت\",\"chart\")}
          \${mobBtn(\"signal\",\"تحلیل\",\"bolt\")}
          \${mobBtn(\"news\",\"خبر\",\"news\")}
          \${mobBtn(\"account\",\"حساب\",\"user\")}
          <button class=\"mobbtn menu\" id=\"mobMenuBtn\" title=\"منو\">
            \${svgIcon(\"menu\")}
            <div>منو</div>
          </button>
        </nav>
      </div>
    \`;
  }


async function loadUserMeta(){
    const u = await api(API.user, { miniToken: state.miniToken, startParam: state.startParam || \"\" });

    try{ updateEnergyUI(u); }catch{}

    state.isAdmin = !!u.isAdmin;
    state.isOwner = !!u.isOwner;

    state.symbols = Array.isArray(u.symbols) ? u.symbols : [];
    state.styles = Array.isArray(u.styles) ? u.styles : [];

    const st = u.state || u.userState || {};
    state.userState = st;
    try{ if (typeof u.wallet === \"string\" && u.wallet) state.subWallet = String(u.wallet || \"\"); }catch{}
    // If some settings are empty locally, fall back to server defaults
    if ((!state.style || state.style === \"\") && st.style) state.style = String(st.style || \"\");
    if ((!state.timeframe || state.timeframe === \"\") && st.timeframe) state.timeframe = String(st.timeframe || \"\").toUpperCase();

    const ss = st.selectedSymbol || st.symbol;
    if ((!state.symbol || state.symbol === \"BTCUSDT\") && ss) state.symbol = String(ss || \"\").toUpperCase();

    savePrefs();
    return u;
  }

  async function refreshQuote(){
    const payload = { miniToken: state.miniToken, symbol: state.symbol, timeframe: state.timeframe };
    if (!payload.miniToken) payload.allowGuest = true;
    let q = await api(API.quote, payload);
    if (q && q.error === \"invalid_symbol\") {
      state.symbol = \"BTCUSDT\";
      savePrefs();
      payload.symbol = state.symbol;
      q = await api(API.quote, payload);
    }
    state.quote = q;
    state.lastQuoteTs = Date.now();
  }

  async function refreshNews(){
    const payload = { miniToken: state.miniToken, symbol: state.symbol };
    if (!payload.miniToken) payload.allowGuest = true;
    const r = await api(API.news, payload);
    state.news = r.articles || [];
    state.lastNewsTs = Date.now();
  }

  async function loadCandles(){
    const payload = { miniToken: state.miniToken, symbol: state.symbol, timeframe: state.timeframe, limit: 250 };
    if (!payload.miniToken) payload.allowGuest = true;
    const r = await api(API.candles, payload);
    const list = r.candles || [];
    state.candles = list
      .filter(x => x && x.t)
      .map(x => ({
        time: Math.floor(x.t / 1000),
        open: +x.o, high: +x.h, low: +x.l, close: +x.c
      }));
  }

  function viewDashboard(){
    const q = state.quote;
    const px = (q && typeof q.price === \"number\") ? q.price.toLocaleString() : \"—\";
    const ch = (q && typeof q.changePct === \"number\") ? q.changePct : null;
    const chTxt = (ch==null) ? \"—\" : ((ch>0?\"+\":\"\") + (ch*100).toFixed(2) + \"%\");
    const chClass = (ch==null) ? \"\" : (ch>0 ? \"pos\" : (ch<0 ? \"neg\" : \"\"));

    return \`
      <div class=\"grid cols3\">
        <div class=\"card\">
          <div class=\"h\">قیمت لحظه‌ای</div>
          <div class=\"c grid\">
            <div class=\"kpi\">
              <div class=\"v\">\${escapeHtml(px)}</div>
              <div class=\"s\">Symbol: \${escapeHtml(state.symbol)} — TF: \${escapeHtml(state.timeframe)}</div>
            </div>
            <div class=\"row\">
              <div class=\"pill \${chClass}\">Change: \${escapeHtml(chTxt)}</div>
              <div class=\"pill\">Quality: \${escapeHtml(q?.quality || \"—\")}</div>
            </div>
          </div>
        </div>

        <div class=\"card\">
          <div class=\"h\">عملیات سریع</div>
          <div class=\"c grid\">
            <button class=\"btn\" id=\"goSignalBtn\">تحلیل سیگنال</button>
            <button class=\"btn secondary\" id=\"goNewsBtn\">اخبار</button>
            <button class=\"btn secondary\" id=\"goChartBtn\">چارت</button>
          </div>
        </div>

        <div class=\"card\">
          <div class=\"h\">آخرین خبر</div>
          <div class=\"c\">
            \${(state.news?.[0]) ? \`
              <div class=\"item\">
                <div class=\"t\">\${escapeHtml(state.news[0].title || \"—\")}</div>
                <div class=\"m\">\${escapeHtml(state.news[0].source || state.news[0].site || \"\")}</div>
              </div>\` : \`<div class=\"warn\">خبری دریافت نشد.</div>\`}
          </div>
        </div>
      </div>
    \`;
  }

  function viewNews(){
    return \`
      <div class=\"card\">
        <div class=\"h\">اخبار لحظه‌ای (\${escapeHtml(state.symbol)})</div>
        <div class=\"c\">
          <div class=\"list\">
            \${(state.news||[]).map(n => \`
              <div class=\"item\">
                <div class=\"t\">\${escapeHtml(n.title || \"—\")}</div>
                <div class=\"m\">\${escapeHtml((n.source||n.site||\"\") + \" — \" + (n.time||n.publishedAt||\"\"))}</div>
                \${n.url ? \`<div class=\"m\"><a href=\"\${escapeAttr(n.url)}\" target=\"_blank\" rel=\"noreferrer\">باز کردن</a></div>\` : \"\" }
              </div>\`).join(\"\")}
          </div>
        </div>
      </div>
    \`;
  }

  function viewNewsAnalyze(){
    return \`
      <div class=\"card\">
        <div class=\"h\">تحلیل خبر با AI</div>
        <div class=\"c grid\">
          <div class=\"warn\">مسیر: <span class=\"mono\">/api/news/analyze</span></div>
          <button class=\"btn\" id=\"runNewsAnalyzeBtn\">تحلیل کن</button>
          <div class=\"card\" style=\"border-radius:14px\">
            <div class=\"c mono\" id=\"newsAnalyzeOut\">—</div>
          </div>
        </div>
      </div>
    \`;
  }

  function viewSignal(){
    const styleList = (Array.isArray(state.styles) && state.styles.length) ? state.styles : [\"پرایس اکشن\",\"ICT\",\"ATR\"];
    const styleOpts = styleList.map(s => \`<option value=\"\${escapeAttr(s)}\" \${s===state.style?\"selected\":\"\"}>\${escapeHtml(s)}</option>\`).join(\"\");
    const riskOpts = [\"0.5%\",\"1%\",\"2%\",\"3%\",\"5%\"].map(r => \`<option \${r===state.risk?\"selected\":\"\"}>\${r}</option>\`).join(\"\");
    const pmList = [
      [\"style_only\",\"فقط سبک (Style Only)\"],
      [\"style_plus_custom\",\"سبک + متن شما (Style + Custom)\"],
      [\"custom_only\",\"فقط متن شما (Custom Only)\"],
      [\"combined_all\",\"ترکیبی (All)\"],
    ];
    const pmOpts = pmList.map(([v,t]) => \`<option value=\"\${escapeAttr(v)}\" \${v===state.promptMode?\"selected\":\"\"}>\${escapeHtml(t)}</option>\`).join(\"\");

    return \`
      <div class=\"card\">
        <div class=\"h\">تحلیل سیگنال (Queue)</div>
        <div class=\"c grid\">
          <div class=\"warn\">
            مسیر: <span class=\"mono\">/api/analyze</span> و پیگیری: <span class=\"mono\">/api/analyze/status</span>
          </div>

          <div class=\"row\">
            <select id=\"styleSelSignal\" style=\"max-width:220px\">\${styleOpts}</select>
            <select id=\"riskSel\" style=\"max-width:130px\">\${riskOpts}</select>

            <label class=\"chip\" style=\"gap:8px\">
              <input type=\"checkbox\" id=\"newsToggle\" \${state.newsEnabled?\"checked\":\"\"} />
              خبر
            </label>

            <button class=\"btn secondary\" id=\"openTvFromSignalBtn\">چارت TV</button>
            <button class=\"btn secondary\" id=\"openZonesFromSignalBtn\">زون‌ها</button>
          </div>

          <div class=\"row\">
            <button class=\"btn\" id=\"runSignalBtn\">${tr("شروع تحلیل","Start analysis")}</button>
            <span class=\"pill\" id=\"jobStatePill\">Idle</span>
            <span class=\"pill\">Style: \${escapeHtml(state.style || \"—\")}</span>
          </div>

          <div class=\"split\">
            <div class=\"card\" style=\"border-radius:14px\">
              <div class=\"c\">
                <div class=\"row\" style=\"justify-content:space-between;align-items:center;margin-bottom:10px\">
                  <div class=\"warn\" style=\"font-weight:900\">خروجی تحلیل</div>
                  <div class=\"row\" style=\"gap:8px\">
                    <button class=\"miniBtn\" id=\"copySignalBtn\" title=\"Copy\">\${svgIcon(\"copy\")}</button>
                    <button class=\"miniBtn\" id=\"clearSignalBtn\" title=\"Clear\">🧹</button>
                  </div>
                </div>
                
                <div class=\"progressWrap\" id=\"jobProgressWrap\">
                  <div class=\"progressHead\">
                    <span id=\"jobProgressLabel\">در صف…</span>
                    <span id=\"jobProgressPct\">0%</span>
                  </div>
                  <div class=\"progressBar\"><div class=\"progressFill\" id=\"jobProgressFill\"></div></div>
                </div>

                <div id=\"signalOut\" class=\"outArea\">—</div>
              </div>
            </div>

            <div class=\"card\" style=\"border-radius:14px\">
              <div class=\"c\">
                <div class=\"row\" style=\"justify-content:space-between;align-items:center\">
                  <div class=\"segRow\" style=\"gap:8px\">
                    <button class=\"segBtn \${state.signalChartMode!==\"png\"?\"active\":\"\"}\" data-signal-chart=\"tv\">Live TV</button>
                    <button class=\"segBtn \${state.signalChartMode===\"png\"?\"active\":\"\"}\" data-signal-chart=\"png\">Snapshot</button>
                  </div>
                  <button class=\"miniBtn\" id=\"signalTvOpenBtn\" title=\"Open in TradingView\">↗</button>
                </div>

                <div id=\"signalTvWrap\" style=\"height:380px;border-radius:14px;overflow:hidden;margin-top:10px;display:\${state.signalChartMode===\"png\"?\"none\":\"block\"}\"></div>
                <img id=\"chartImg\" style=\"width:100%;border-radius:14px;display:\${state.signalChartMode===\"png\"?\"block\":\"none\"}\" />

                <div class=\"warn\" style=\"margin-top:10px;line-height:1.7\">
                  Zones همزمان روی تب «چارت» (حالت Zones) رسم می‌شوند. برای دیدن زون‌ها سریع، روی «زون‌ها» بزن. (برای دیدن لایو، Live TV را انتخاب کن)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    \`;
  }


  function viewChart(){
    const mode = state.chartMode || \"tv\";
    const ml = state.multiLayout || \"1\";
    const count = (ml === \"4\") ? 4 : (ml === \"2\" ? 2 : 1);

    const tfs = Array.isArray(state.multiTfs) ? state.multiTfs : [];
    const optList = (sel) => [\"M15\",\"H1\",\"H4\",\"D1\",\"W1\"].map(x => \`<option value=\"\${x}\" \${String(sel||\"\").toUpperCase()===x?\"selected\":\"\"}>\${x}</option>\`).join(\"\");

    const cells = Array.from({length:count}).map((_,i) => {
      const tf = String(tfs[i] || (i===0 ? state.timeframe : (i===1 ? \"H1\" : (i===2 ? \"H4\" : \"D1\")))).toUpperCase();
      return \`
        <div class=\"mcCell\">
          <div class=\"mcHead\">
            <div class=\"left\">
              <span class=\"pill\">#\${i+1}</span>
              <select class=\"mcTfSel\" data-mc-i=\"\${i}\">\${optList(tf)}</select>
            </div>
            <div class=\"right\">
              <button class=\"miniBtn\" data-mc-open=\"\${i}\" title=\"Open in TradingView\">↗</button>
            </div>
          </div>
          <div class=\"mcBody\" id=\"tvW\${i}\"></div>
        </div>
      \`;
    }).join(\"\");

    const gridClass = (ml === \"4\") ? \"four\" : (ml === \"2\" ? \"two\" : \"one\");

    return \`
      <div class=\"card\">
        <div class=\"h\">چارت (Zones / Live TradingView)</div>
        <div class=\"c grid\">
          <div class=\"warn\" style=\"line-height:1.7\">
            حالت <b>Zones</b>: Lightweight Charts + رسم نواحی خروجی مدل (quickChartSpec).<br/>
            حالت <b>Live</b>: ویجکت رسمی TradingView (پشتیبانی از <b>مولتی چارت</b>).
          </div>

          <div class=\"row\">
            <select id=\"chartModeSel\" style=\"max-width:190px\">
              <option value=\"tv\" \${mode===\"tv\"?\"selected\":\"\"}>Live (TradingView)</option>
              <option value=\"zones\" \${mode===\"zones\"?\"selected\":\"\"}>Zones (Lightweight)</option>
            </select>

            \${mode===\"tv\" ? \`
              <select id=\"mcLayoutSel\" style=\"max-width:150px\">
                <option value=\"1\" \${ml===\"1\"?\"selected\":\"\"}>تک چارت</option>
                <option value=\"2\" \${ml===\"2\"?\"selected\":\"\"}>۲ چارت</option>
                <option value=\"4\" \${ml===\"4\"?\"selected\":\"\"}>۴ چارت</option>
              </select>

              <select id=\"mcPresetSel\" style=\"max-width:210px\">
                <option value=\"custom\" selected>پریست: سفارشی</option>
                <option value=\"mtf_a\">M15 / H1 / H4 / D1</option>
                <option value=\"mtf_b\">H1 / H4 / D1 / W1</option>
              </select>
            \` : \`\`}

            <button class=\"btn secondary\" id=\"openTvBtn\">باز کردن در TradingView</button>

            <button class=\"btn\" id=\"reloadChartBtn\">\${mode===\"zones\"?\"بارگذاری مجدد\":\"ریفرش ویجکت\"}</button>

            <span class=\"pill\">\${escapeHtml(state.symbol)} / \${escapeHtml(state.timeframe)}</span>
          </div>

          <div id=\"tvWrap\" style=\"height:520px;border:1px solid var(--b);border-radius:14px;overflow:hidden;background:rgba(15,26,46,.55)\${mode===\"zones\"?\"\":\";display:none\"}\"></div>

          <div id=\"tvWidgetWrap\" style=\"border:1px solid var(--b);border-radius:14px;overflow:hidden;background:rgba(15,26,46,.35)\${mode===\"tv\"?\"\":\";display:none\"}\">
            \${mode===\"tv\" ? \`<div class=\"mcGrid \${gridClass}\">\${cells}</div>\` : \`\`}
          </div>

          \${mode===\"zones\" ? \`<div class=\"warn\" style=\"margin-top:6px;line-height:1.7\">برای مولتی‌چارت از حالت Live استفاده کن.</div>\` : \`\`}
        </div>
      </div>
    \`;
  }


  function viewAccount(){
    const a = state.account;
    if (!a) return \`<div class=\"card\"><div class=\"h\">حساب کاربری</div><div class=\"c warn\">در حال بارگذاری...</div></div>\`;

    const emailOk = !!a.emailVerified;
    const tgLinked = !!a.telegramChatId;
    const tgOk = !!a.telegramVerified;

    const us = state.userState || {};
    const sub = us.subscription || {};
    const subActive = !!sub.active;
    const subType = String(sub.type || \"free\");
    const subExp = sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString(\"fa-IR\") : \"—\";
    const subDaily = Number(sub.dailyLimit || 0);
    const offer = state.pendingOffer || null;
    const offerReason = String(state.pendingOfferReason || "");
    const offerTitle = (offerReason === "points") ? "امتیاز کافی نیست" : "پیشنهاد خرید اشتراک";
    const offerNote = (offerReason === "points")
      ? "برای ادامه تحلیل، اشتراک Pro بگیر یا امتیاز شارژ کن."
      : "برای سهمیه بیشتر و سرعت بهتر، Pro را فعال کن.";
    const offerTop = (offer && Array.isArray(offer.plans) && offer.plans[0]) ? offer.plans[0] : null;
    const offerTopTxt = offerTop ? (String(offerTop.title || offerTop.id || "Pro") + " — " + String(offerTop.amount || 0) + " " + String(offerTop.currency || "USDT")) : "";
    const offerHtml = offer ? (
      '<div class="subCta">' +
        '<div class="row" style="justify-content:space-between;gap:10px;flex-wrap:wrap">' +
          '<div>' +
            '<div style="font-weight:900">' + escapeHtml(offerTitle) + (offerTopTxt ? (' • ' + escapeHtml(offerTopTxt)) : '') + '</div>' +
            '<div class="muted" style="font-size:12px;margin-top:4px;line-height:1.7">' + escapeHtml(offerNote) + '</div>' +
          '</div>' +
          '<div class="row" style="gap:8px;flex-wrap:wrap">' +
            '<button class="btn" id="subCtaGoBtn">خرید اشتراک</button>' +
            '<button class="btn secondary" id="subCtaPlansBtn">دیدن پلن‌ها</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    ) : '';
    const lastSubRes = state.lastSubPurchase || null;
    const lastSubPay = state.lastSubPayment || null;
    const lastSubHtml = lastSubRes ? (
      '<div class="subResult ' + (lastSubRes.ok ? 'ok' : 'bad') + '">' +
        '<div class="row" style="justify-content:space-between;gap:10px;flex-wrap:wrap">' +
          '<div style="font-weight:900">' + (lastSubRes.ok ? '✅ نتیجه بررسی تراکنش' : '⚠️ نتیجه بررسی تراکنش') + '</div>' +
          (lastSubPay && lastSubPay.txHash ? ('<a class="link" target="_blank" rel="noreferrer" href="' + escapeAttr(bscTxUrl(lastSubPay.txHash)) + '">BscScan ↗</a>') : '') +
        '</div>' +
        '<div class="kvs" style="margin-top:10px">' +
          '<div class="kv"><div class="k">Provider</div><div class="v mono">' + escapeHtml(String(lastSubRes.provider || "")) + '</div></div>' +
          '<div class="kv"><div class="k">Status</div><div class="v">' + (lastSubRes.ok ? '<span class="badge ok">OK</span>' : ('<span class="badge bad">' + escapeHtml(String(lastSubRes.reason || "fail")) + '</span>')) + '</div></div>' +
          '<div class="kv"><div class="k">Expected</div><div class="v mono">' + escapeHtml(String(lastSubRes.expected ?? "")) + '</div></div>' +
          '<div class="kv"><div class="k">Amount</div><div class="v mono">' + escapeHtml(String(((lastSubRes.amount !== undefined && lastSubRes.amount !== null) ? lastSubRes.amount : ((lastSubRes.report && lastSubRes.report.sum) ? lastSubRes.report.sum : "")))) + '</div></div>' +
        '</div>' +
      '</div>'
    ) : '';

    const refSum = state.referral || {};
    const refCode = escapeHtml(refSum.code || ((us?.referral?.codes || [])[0] || \"\"));
    const refBal = Number((refSum.commissionBalance ?? us?.referral?.commissionBalance) || 0);
    const refPending = Number((refSum.commissionPending ?? us?.referral?.commissionPending) || 0);
    const refPaid = Number((refSum.commissionPaid ?? us?.referral?.commissionPaid) || 0);

    const cwList = Array.isArray(state.referralWithdrawals) ? state.referralWithdrawals : [];
    const cwHtml = cwList.length ? cwList.map((w) => {
      const st = String(w.status || \"pending\");
      const stFa = st === \"approved\" ? \"تایید\" : (st === \"rejected\" ? \"رد\" : \"در انتظار\");
      const when = w.createdAt ? fmtTime(w.createdAt) : \"\";
      const tx = (st === \"approved\" && w.txHash) ? (\" • Tx: \" + escapeHtml(String(w.txHash).slice(0, 10)) + \"...\") : \"\";
      return '<div class=\"row\" style=\"justify-content:space-between;border-top:1px solid var(--b);padding-top:10px;margin-top:10px;gap:10px\">' +
        '<div>' +
          '<div style=\"font-weight:800\">' + fmtMoney(w.amount) + ' USDT</div>' +
          '<div class=\"muted\" style=\"font-size:12px\">' + when + ' • ' + stFa + tx + '</div>' +
        '</div>' +
        '<div class=\"muted\" style=\"font-size:12px;max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\">' + escapeHtml(w.address || \"\") + '</div>' +
      '</div>';
    }).join(\"\") : '<div class=\"muted\">هنوز درخواستی ثبت نشده.</div>';

    return \`
      <div class=\"grid cols2\">
        <div class=\"card\">
          <div class=\"h\">مشخصات</div>
          <div class=\"c grid\">
            <div class=\"row\">
              \${pill(true, \"Username: \" + a.username)}
              \${pill(true, \"Email: \" + a.email)}
            </div>
            <div class=\"row\">
              \${pill(emailOk, emailOk ? \"Email Verified\" : \"Email Not Verified\")}
              \${pill(tgLinked, tgLinked ? \"Telegram Linked\" : \"Telegram Not Linked\")}
              \${pill(tgOk, tgOk ? \"Telegram Verified\" : \"Telegram Not Verified\")}
            </div>
            <div class=\"warn\" style=\"margin-top:10px\">
              <div style=\"font-size:13px;color:var(--muted);line-height:1.7\">
                Telegram Username ثبت‌شده: <span class=\"mono\">\${escapeHtml(a.telegramUsername || \"—\")}</span>
              </div>
            </div>
          </div>
        </div>

        <div class=\"card\">
          <div class=\"h\">تأیید ایمیل</div>
          <div class=\"c grid\">
            <div class=\"row\">
              <button class=\"btn\" id=\"emailReqBtn\">ارسال کد</button>
              <input id=\"emailCodeInp\" placeholder=\"کد ۶ رقمی\" />
              <button class=\"btn secondary\" id=\"emailConfBtn\">تأیید</button>
            </div>
            <div id=\"emailMsg\" class=\"warn\"></div>
          </div>
        </div>

        <div class=\"card\">
          <div class=\"h\">اتصال تلگرام</div>
          <div class=\"c grid\">
            <div class=\"row\">
              <button class=\"btn\" id=\"tgLinkBtn\">ساخت لینک اتصال</button>
              <button class=\"btn secondary\" id=\"tgOpenLinkBtn\" disabled>باز کردن تلگرام</button>
            </div>
            <div id=\"tgLinkOut\" class=\"mono warn\" style=\"word-break:break-all\"></div>
          </div>
        </div>

        <div class=\"card\">
          <div class=\"h\">OTP تلگرام</div>
          <div class=\"c grid\">
            <div class=\"row\">
              <button class=\"btn\" id=\"tgReqBtn\">ارسال کد به تلگرام</button>
              <input id=\"tgCodeInp\" placeholder=\"کد ۶ رقمی\" />
              <button class=\"btn secondary\" id=\"tgConfBtn\">تأیید</button>
            </div>
            <div id=\"tgMsg\" class=\"warn\"></div>
          </div>
        </div>

        
        <div class=\"card\" style=\"grid-column:1/-1\">
          <div class=\"h\">🤝 دعوت و کمیسیون</div>
          <div class=\"c grid\">
            <div class=\"row\" style=\"gap:10px;flex-wrap:wrap\">
              \${pill(true, \"کد دعوت: \" + (refCode || \"-\"))}
              \${pill(true, \"قابل برداشت: \" + fmtMoney(refBal))}
              \${pill(true, \"در انتظار: \" + fmtMoney(refPending))}
              \${pill(true, \"پرداخت شده: \" + fmtMoney(refPaid))}
            </div>

            <div class=\"row\" style=\"gap:10px;flex-wrap:wrap;margin-top:10px\">
              <input class=\"inp\" id=\"cwAmountInp\" placeholder=\"مبلغ برداشت (USDT)\" inputmode=\"decimal\" style=\"max-width:220px\"/>
              <input class=\"inp\" id=\"cwAddressInp\" placeholder=\"آدرس کیف پول (BEP20)\" style=\"flex:1;min-width:260px\"/>
              <button class=\"btn\" id=\"cwReqBtn\">درخواست برداشت</button>
            </div>

            <div id=\"cwMsg\" class=\"warn\" style=\"display:none;margin-top:10px\"></div>
            <div class=\"c\" style=\"padding:0;margin-top:10px\">\${cwHtml}</div>
          </div>
        </div>


<div class=\"card\" style=\"grid-column:1/-1\">
          <div class=\"h\">💎 اشتراک و کیف پول</div>
          <div class=\"c grid\">
            <div class=\"warn\" style=\"line-height:1.7\">
              پرداخت اشتراک و نمایش QR در تب‌های «اشتراک» و «کیف پول» قرار دارد.
            </div>
            <div class=\"row\" style=\"gap:10px;flex-wrap:wrap\">
              <button class=\"btn\" id=\"goSubTabBtn\">رفتن به تب اشتراک</button>
              <button class=\"btn secondary\" id=\"goWalletTabBtn\">رفتن به تب کیف پول</button>
            </div>
          </div>
        </div>
      </div>
    \`;
  }



function qrImgUrl(data){
  const t = encodeURIComponent(String(data || ""));
  // External QR generator (simple + reliable)
  return "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + t;
}

function viewSubscription(){
  // Reuse the same subscription purchase UI (ids are wired in wireAccountActions)
  const us = state.userState || {};
  const sub = us.subscription || {};
  const subActive = !!sub.active;
  const subType = String(sub.type || "free");
  const subExp = sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString("fa-IR") : "—";
  const subDaily = Number(sub.dailyLimit || 0);

  const addr = String(state.subWallet || "");
  const qr = addr ? ('<img alt="QR" class="qrImg" src="' + escapeAttr(qrImgUrl(addr)) + '"/>') : '<div class="muted">ولت ثبت نشده</div>';

  return `
    <div class="grid">
      <div class="card">
        <div class="h">💎 خرید اشتراک (Pro)</div>
        <div class="c grid">
          <div class="row">
            ${pill(subActive, subActive ? ("اشتراک فعال ✅ | پلن: " + escapeHtml(subType) + " | انقضا: " + escapeHtml(subExp) + " | سهمیه روزانه: " + escapeHtml(subDaily)) : "اشتراک فعلی: Free (برای افزایش سهمیه اشتراک بگیر)")}
            <button class="btn secondary" data-tab="wallet" style="margin-right:auto" onclick="window.__goTab && window.__goTab('wallet')">کیف پول + QR</button>
          </div>

          <div class="steps">
            <div class="step">1) انتخاب پلن</div>
            <div class="step">2) ارسال USDT به ولت</div>
            <div class="step">3) ثبت TxHash</div>
            <div class="step">4) بررسی خودکار / ادمین</div>
          </div>

          <div class="row" style="gap:14px;flex-wrap:wrap;align-items:flex-start">
            <div style="min-width:240px">
              <div class="muted" style="font-size:12px;margin-bottom:6px">QR آدرس پرداخت</div>
              ${qr}
            </div>
            <div style="flex:1;min-width:260px">
              <div class="warn" style="line-height:1.7">
                مبلغ پلن را به آدرس زیر (USDT - BEP20) ارسال کن و سپس TxHash را ثبت کن.
              </div>

              <div class="row">
                <input id="webSubWallet" class="mono" readonly value="${escapeAttr(state.subWallet || '')}" />
                <button class="btn secondary" id="webSubCopyWallet">کپی</button>
                <button class="btn ghost" id="webSubOpenWallet">مشاهده در اسکنر</button>
                <button class="btn ghost" id="webSubLoadPlans">دریافت پلن‌ها</button>
              </div>

              <div id="webSubPlanCards" class="planGrid"></div>
              <div id="webSubPlanInfo" class="kvs"></div>
              <div id="webSubPurchaseResult"></div>

              <div class="row">
                <select id="webSubPlanSel" style="flex:1;min-width:220px;height:44px"></select>
                <input id="webSubTxHash" class="mono" placeholder="TxHash (0x...)" style="flex:1;min-width:220px"
                       inputmode="text" autocomplete="off" />
              </div>

              <div class="row">
                <button class="btn" id="webSubSubmit">ثبت پرداخت</button>
                <div class="mut" style="font-size:12px">اگر تایید خودکار نشد، پرداخت در پنل ادمین تایید/رد می‌شود.</div>
              </div>

              <div id="webSubMsg" class="warn"></div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;
}

function viewWallet(){
  const us = state.userState || {};
  const sub = us.subscription || {};
  const subActive = !!sub.active;

  const addr = String(state.subWallet || "");
  const qr = addr ? ('<img alt="QR" class="qrImg" src="' + escapeAttr(qrImgUrl(addr)) + '"/>') : '';

  const bal = Number((us && (us.pointsBalance ?? us.points?.balance)) ?? 0);
  const left = Number((us && (us.analysesLeft ?? us.points?.analysesLeft)) ?? 0);

  return `
    <div class="grid cols2">
      <div class="card">
        <div class="h">👛 کیف پول پرداخت</div>
        <div class="c grid">
          <div class="warn" style="line-height:1.7">
            این آدرس برای پرداخت اشتراک Pro استفاده می‌شود. بعد از انتقال USDT (BEP20)، TxHash را در تب «اشتراک» ثبت کن.
          </div>
          <div class="row">
            <input id="walletAddrInp" class="mono" readonly value="${escapeAttr(addr)}" />
            <button class="btn secondary" id="walletCopyBtn">کپی</button>
            <button class="btn ghost" id="walletOpenBtn">اسکنر</button>
            <button class="btn" data-tab="subscription" onclick="window.__goTab && window.__goTab('subscription')">رفتن به اشتراک</button>
          </div>
          <div class="row" style="gap:14px;flex-wrap:wrap;align-items:flex-start">
            <div style="min-width:240px">
              <div class="muted" style="font-size:12px;margin-bottom:6px">QR Code</div>
              ${addr ? qr : '<div class="muted">ولت تنظیم نشده</div>'}
            </div>
            <div style="flex:1;min-width:260px">
              <div class="kvs">
                <div class="kv"><div class="k">اشتراک</div><div class="v">${subActive ? '<span class="badge ok">Active</span>' : '<span class="badge bad">Free</span>'}</div></div>
                <div class="kv"><div class="k">امتیاز</div><div class="v mono">${escapeHtml(String(bal))}</div></div>
                <div class="kv"><div class="k">تحلیل باقی‌مانده</div><div class="v mono">${escapeHtml(String(left))}</div></div>
              </div>
              <div class="muted" style="font-size:12px;line-height:1.7;margin-top:10px">
                نکته: اگر QR را اسکن کردی ولی ولت شما Memo/Tag خواست، نیازی نیست (BEP20).
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function wireWalletActions(){
  const addr = String(state.subWallet || "");
  const c = $("#walletCopyBtn");
  const o = $("#walletOpenBtn");
  const inp = $("#walletAddrInp");
  if (c) c.onclick = async () => {
    const t = (inp ? inp.value : addr) || "";
    if (!t) return toast("ولت ثبت نشده", "err");
    try{ await navigator.clipboard.writeText(String(t)); toast("کپی شد ✅", "ok"); }catch{ toast("کپی انجام نشد", "err"); }
  };
  if (o) o.onclick = () => {
    const t = (inp ? inp.value : addr) || "";
    if (!t) return toast("ولت ثبت نشده", "err");
    try{ window.open(bscAddrUrl(t), "_blank", "noopener,noreferrer"); }catch{}
  };
}

  function render(){
    captureDrafts();
    mount(shell());
    const viewEl = $(\"#view\");

    if (state.tab === \"dashboard\") viewEl.innerHTML = viewDashboard();
    else if (state.tab === \"news\") viewEl.innerHTML = viewNews();
    else if (state.tab === \"newsAnalyze\") viewEl.innerHTML = viewNewsAnalyze();
    else if (state.tab === \"signal\") viewEl.innerHTML = viewSignal();
    else if (state.tab === \"chart\") viewEl.innerHTML = viewChart();
    else if (state.tab === "account") viewEl.innerHTML = viewAccount();
    else if (state.tab === "subscription") viewEl.innerHTML = viewSubscription();
    else if (state.tab === "wallet") viewEl.innerHTML = viewWallet();
    else if (state.tab === "admin") viewEl.innerHTML = viewAdmin();

    const isNarrow = () => (window.matchMedia && window.matchMedia(\"(max-width: 980px)\").matches);
    const closeSide = () => { const app = $(\".app\"); if(app) app.classList.remove(\"side-open\"); };
    const toggleSide = () => {
      const app = $(\".app\"); if(!app) return;
      if (isNarrow()){
        app.classList.toggle(\"side-open\");
      } else {
        state.sideCollapsed = !state.sideCollapsed;
        savePrefs();
        app.classList.toggle(\"side-closed\", !!state.sideCollapsed);
      }
    };

    $$(\".tabBtn[data-tab]\").forEach(b => b.onclick = async () => {
      state.tab = b.dataset.tab;
      closeSide();
      if (state.tab === \"account\") await loadAccount();
      if (state.tab === \"admin\") await loadAdmin();
      render();
      afterRender();
    });

    const st = $(\"#sidebarToggle\"); if (st) st.onclick = () => toggleSide();

    const smt = $(\"#symMenuToggle\");
    if (smt) smt.onclick = () => {
      try{ toggleSymMenu(); }catch{}
      if (!state.symMenuCollapsed) setTimeout(() => { const inp = $(\"#symbolInp\"); if (inp) inp.focus(); }, 60);
    };
    const bd = $(\"#backdrop\"); if (bd) bd.onclick = () => closeSide();
    const mm = $(\"#mobMenuBtn\"); if (mm) mm.onclick = () => toggleSide();
    try{ applySymMenuClass(); }catch{}


    // Close symbol selector menu (desktop + mobile)
    const symCloseBtn = $(\"#symCloseBtn\");
    if (symCloseBtn) symCloseBtn.onclick = () => {
      const inp = $(\"#symbolInp\");
      if (inp) {
        inp.value = state.symbol;
        try{ inp.blur(); }catch{}
      }
      try{ closeSymMenu(); }catch{}
    };

    $(\"#applySymbolBtn\").onclick = async () => {
      const symInp = $(\"#symbolInp\");
      state.symbol = ((symInp ? (symInp.value || \"\") : \"\") || \"BTCUSDT\").trim().toUpperCase();
      try{ if(symInp) symInp.blur(); }catch{}
      try{ const app = $(\".app\"); if(app) app.classList.remove(\"side-open\"); }catch{}
      try{ closeSymMenu(); }catch{}
      state.timeframe = $(\"#tfSel\").value;
      const stSel = $(\"#styleSelTop\");
      if (stSel) state.style = stSel.value;
      if (!Array.isArray(state.multiTfs)) state.multiTfs = [];
      if (!state.multiTfs[0] || (state.multiLayout || \"1\") === \"1\") state.multiTfs[0] = state.timeframe;
      savePrefs();

      await fullRefresh();
      render();
      afterRender();
    };

    $(\"#logoutBtn\").onclick = () => {
      cleanupTimers();
      setToken(\"\");
      setWebToken(\"\");
      state.quote = null; state.news = []; state.job=null; state.jobId=null; state.account=null;
      boot();
    };

    const favBtn = $(\"#favToggleBtn\");
    if (favBtn) favBtn.onclick = async () => {
      toggleFav(state.symbol);
      favBtn.classList.toggle(\"active\", (state.favs||[]).includes(normSym(state.symbol)));
      await refreshExtraQuotes(true);
      updateTickerDom();
      updateWatchlistDom();
    };

    const stSelTop = $(\"#styleSelTop\");
    if (stSelTop) stSelTop.onchange = () => { state.style = stSelTop.value; savePrefs(); };

    wirePickSymButtons();
    wireExtraButtons();

    const goSignalBtn = $(\"#goSignalBtn\");
    if (goSignalBtn) goSignalBtn.onclick = () => { state.tab=\"signal\"; render(); afterRender(); };
    const goNewsBtn = $(\"#goNewsBtn\");
    if (goNewsBtn) goNewsBtn.onclick = () => { state.tab=\"news\"; render(); afterRender(); };
    const goChartBtn = $(\"#goChartBtn\");
    if (goChartBtn) goChartBtn.onclick = () => { state.tab=\"chart\"; render(); afterRender(); };
  }

  function cleanupTimers(){
    state.timers.forEach(t => clearInterval(t));
    state.timers = [];
  }

  async function afterRender(){
    if (state.tab === \"newsAnalyze\") {
      $(\"#runNewsAnalyzeBtn\").onclick = async () => {
        $(\"#newsAnalyzeOut\").textContent = \"در حال تحلیل...\";
        try{
          const out = await api(API.newsAnalyze, { miniToken: state.miniToken, symbol: state.symbol });
          $(\"#newsAnalyzeOut\").textContent = JSON.stringify(out, null, 2);
        } catch(e){
          $(\"#newsAnalyzeOut\").textContent = \"خطا: \" + e.message;
        }
      };
    }

    if (state.tab === \"signal\") {
      const styleSel = $(\"#styleSelSignal\");
      const riskSel = $(\"#riskSel\");
      const newsToggle = $(\"#newsToggle\");

      if (styleSel) styleSel.onchange = () => { state.style = styleSel.value; savePrefs(); render(); afterRender(); };
      if (riskSel) riskSel.onchange = () => { state.risk = riskSel.value; savePrefs(); };
      if (newsToggle) newsToggle.onchange = () => { state.newsEnabled = !!newsToggle.checked; savePrefs(); };

      // Chart mode toggle (Live TV / Snapshot)
      $$(\"[data-signal-chart]\").forEach(b => b.onclick = () => {
        const v = String(b.dataset.signalChart || \"tv\");
        state.signalChartMode = v;
        savePrefs();
        render();
        afterRender();
      });

      const openTvBtn = $(\"#openTvFromSignalBtn\");
      if (openTvBtn) openTvBtn.onclick = () => window.open(tvChartLink(state.symbol, state.timeframe), \"_blank\");

      const openZonesBtn = $(\"#openZonesFromSignalBtn\");
      if (openZonesBtn) openZonesBtn.onclick = () => {
        state.tab = \"chart\";
        state.chartMode = \"zones\";
        savePrefs();
        render();
        afterRender();
      };

      const tvOpenBtn = $(\"#signalTvOpenBtn\");
      if (tvOpenBtn) tvOpenBtn.onclick = () => window.open(tvChartLink(state.symbol, state.timeframe), \"_blank\");

      const copyBtn = $(\"#copySignalBtn\");
      if (copyBtn) copyBtn.onclick = async () => {
        const rt = (state.job && (state.job.resultText || state.job.result)) || $(\"#signalOut\")?.innerText || \"\";
        try{
          await navigator.clipboard.writeText(String(rt||\"\"));
          toast(\"کپی شد ✅\", \"ok\");
        }catch{
          toast(\"کپی انجام نشد\", \"err\");
        }
      };

      const clearBtn = $(\"#clearSignalBtn\");
      if (clearBtn) clearBtn.onclick = () => {
        state.jobId = \"\";
        state.job = null;
        const pill = $(\"#jobStatePill\"); if (pill) pill.textContent = \"Idle\";
        const out = $(\"#signalOut\"); if (out) out.textContent = \"—\";
        const img = $(\"#chartImg\");
        if (img) { img.removeAttribute(\"src\"); img.style.display = \"none\"; }
        try{ setJobProgress(\"idle\", 0); }catch{}
        toast(\"خروجی پاک شد\", \"ok\");
      };

      // Render TradingView widget when visible
      if ((state.signalChartMode || \"tv\") !== \"png\") {
        renderTvAdvancedChart($(\"#signalTvWrap\"), state.symbol, state.timeframe);
      }

      const runBtn = $(\"#runSignalBtn\");
      if (runBtn) runBtn.onclick = async () => {
        if (!state.miniToken){
          // تحلیل فقط بعد از ثبت‌نام/ورود با ایمیل فعال است
          toast(state.lang==="en" ? "Please sign up / log in first" : "اول ثبت‌نام/ورود کنید", "warn");
          state.tab = "auth";
          state.authTab = "signup";
          render();
          afterRender();
          return;
        }
        const prompt = \"\";

        const pill = $(\"#jobStatePill\");
        const out = $(\"#signalOut\");
        const img = $(\"#chartImg\");

        if (pill) pill.textContent = \"Queued\";
        if (out) out.textContent = \"در صف...\";
        if (img) img.style.display = \"none\";
        try{ setJobProgress(\"queued\", 0); }catch{}

        try{
          const payload = {
            miniToken: state.miniToken,
            allowGuest: false,
            lang: state.lang || getLang(),
            symbol: state.symbol,
            timeframe: state.timeframe,
            style: state.style,
            risk: state.risk,
            newsEnabled: state.newsEnabled,
            userPrompt: prompt
          };
          const res = await api(API.analyze, payload);
          if (res && res.miniToken && !state.miniToken) {
            state.miniToken = String(res.miniToken || "");
            try{ localStorage.setItem(LS_TOKEN, state.miniToken); }catch{}
          }

          state.jobId = res.jobId;
          if (!state.jobId) throw new Error(\"jobId not returned\");
          await pollJob();
        }catch(e){
          if (e && e.status === 402 && e.payload && e.payload.subscriptionOffer){
            if (pill) pill.textContent = \"Need Pro\";
            if (out) out.textContent = \"امتیاز کافی نیست. برای ادامه اشتراک تهیه کن.\";
            toast(\"امتیاز کافی نیست — خرید اشتراک\", \"warn\");
            openSubscription(e.payload.subscriptionOffer, \"points\");
            return;
          }
          if (pill) pill.textContent = \"Error\";
          if (out) out.textContent = \"خطا: \" + (e && e.message ? e.message : \"unknown\");
          toast((e && e.message) ? e.message : \"خطا\", \"err\");
        }
      };
    }

    if (state.tab === \"chart\") {
      const modeSel = $(\"#chartModeSel\");
      if (modeSel) modeSel.onchange = () => {
        state.chartMode = modeSel.value;
        savePrefs();
        render();
        afterRender();
      };

      const mcLayoutSel = $(\"#mcLayoutSel\");
      if (mcLayoutSel) mcLayoutSel.onchange = () => {
        state.multiLayout = mcLayoutSel.value;
        savePrefs();
        render();
        afterRender();
      };

      const mcPresetSel = $(\"#mcPresetSel\");
      if (mcPresetSel) mcPresetSel.onchange = () => {
        const v = mcPresetSel.value || \"custom\";
        if (v !== \"custom\") applyMultiPreset(v);
        render();
        afterRender();
      };

      $$(\".mcTfSel\").forEach(sel => sel.onchange = () => {
        const i = Number(sel.dataset.mcI || 0);
        normalizeMultiTfs();
        state.multiTfs[i] = sel.value;
        savePrefs();
        // سبک‌ترین راه: بازسازی صفحه چارت
        render();
        afterRender();
      });

      $$(\"[data-mc-open]\").forEach(btn => btn.onclick = () => {
        const i = Number(btn.dataset.mcOpen || 0);
        normalizeMultiTfs();
        const tf = state.multiTfs[i] || state.timeframe;
        window.open(tvChartLink(state.symbol, tf), \"_blank\");
      });

      const openTvBtn = $(\"#openTvBtn\");
      if (openTvBtn) openTvBtn.onclick = () => window.open(tvChartLink(state.symbol, state.timeframe), \"_blank\");

      $(\"#reloadChartBtn\").onclick = async () => {
        if ((state.chartMode || \"tv\") === \"zones\") {
          await loadCandles();
          initTvChart();
          applyOverlaysFromJobIfAny();
        } else {
          renderTvMultiCharts();
        }
      };

      if ((state.chartMode || \"tv\") === \"zones\") {
        await loadCandles();
        initTvChart();
        applyOverlaysFromJobIfAny();
      } else {
        renderTvMultiCharts();
      }
    }


    if (state.tab === \"account\") {
      wireAccountActions();
    }

    if (state.tab === \"admin\") {
      wireAdminActions();
    }
  }

  async function pollJob(){
    const pillEl = $(\"#jobStatePill\");
    const outEl = $(\"#signalOut\");
    const img = $(\"#chartImg\");

    for (let i=0;i<180;i++){
      const st = await api(API.analyzeStatus, { miniToken: state.miniToken, jobId: state.jobId });
      state.job = st.job || st;

      const status = state.job?.status || state.job?.state || \"running\";
      if (pillEl) pillEl.textContent = status;
      try{ setJobProgress(status, i); }catch{}

      const rt = (state.job && (state.job.resultText || state.job.result)) || \"\";
      if (rt && outEl) renderAnalysisMessages(rt, outEl, state.job);
      else if (outEl && (state.job?.errorMessage || state.job?.error)) outEl.textContent = String(state.job.errorMessage || state.job.error);
      else if (outEl) outEl.textContent = (status === \"queued\" ? \"در صف...\" : \"در حال پردازش...\");

      if (img && state.job?.chartUrl) {
        img.src = state.job.chartUrl;
        img.style.display = (state.signalChartMode === \"png\") ? \"block\" : \"none\";
      }

      if (status === \"done\" || status === \"completed\" || state.job?.done) {
        try{
          await loadCandles();
          if (state.tab === \"chart\") {
            initTvChart();
            applyOverlaysFromJobIfAny();
          }
        }catch{}
        try{
          const u2 = await api(API.user, { miniToken: state.miniToken });
          state.userState = u2.state || u2;
          updateEnergyUI(u2);
          const left = Number(u2.analysesLeft ?? 0);
          const subActive = !!(state.userState && state.userState.subscription && state.userState.subscription.active);
          if (!subActive && left <= 2) appendUpgradeCta(outEl, left);
        }catch{}
        return;
      }

      await new Promise(r => setTimeout(r, 2000));
    }
    if (pillEl) pillEl.textContent = \"timeout\";
  }


  async function fullRefresh(){
    await Promise.allSettled([refreshQuote(), refreshNews(), refreshExtraQuotes()]);
  }

  function startLiveTimers(){
    cleanupTimers();
    state.timers.push(setInterval(() => refreshQuote().then(()=>{ updateMarketDom(); if(state.tab===\"dashboard\") render(); }), 10000));
    state.timers.push(setInterval(() => refreshExtraQuotes().then(()=>{ updateTickerDom(); updateWatchlistDom(); }), 15000));
    state.timers.push(setInterval(() => refreshNews().then(()=>{ if(state.tab===\"dashboard\"||state.tab===\"news\") render(); }), 30000));
  }

  function wirePickSymButtons(){
    $$(\"[data-pick-sym]\").forEach(b => b.onclick = async (e) => {
      const s = String(b.dataset.pickSym || \"\").trim().toUpperCase();
      if (!s) return;
      state.symbol = s;
      try{ const inp = $(\"#symbolInp\"); if(inp) inp.blur(); }catch{}
      try{ const app = $(\".app\"); if(app) app.classList.remove(\"side-open\"); }catch{}
      try{ closeSymMenu(); }catch{}
      savePrefs();
      await fullRefresh();
      render();
      afterRender();
    });
  }

  function wireExtraButtons(){
    const layoutBtn = $(\"#layoutToggleBtn\");
    if (layoutBtn) layoutBtn.onclick = () => {
      state.layoutMode = (state.layoutMode === \"compact\") ? \"pro\" : \"compact\";
      savePrefs();
      const app = $(\".app\");
      if (app) app.classList.toggle(\"compact\", state.layoutMode === \"compact\");
    };

    const wSearch = $(\"#watchSearchInp\");
    if (wSearch) wSearch.oninput = () => {
      state.watchSearch = wSearch.value || \"\";
      updateWatchlistDom();
    };

    $$(\".segBtn[data-watch-group]\").forEach(b => b.onclick = () => {
      state.watchGroup = String(b.dataset.watchGroup || \"favs\");
      updateWatchlistDom();
    });

    const refreshBtn = $(\"#refreshExtraBtn\");
    if (refreshBtn) refreshBtn.onclick = async () => {
      refreshBtn.disabled = true;
      await refreshExtraQuotes(true);
      updateTickerDom();
      updateWatchlistDom();
      refreshBtn.disabled = false;
    };

    const addCur = $(\"#addCurToFavBtn\");
    if (addCur) addCur.onclick = async () => {
      toggleFav(state.symbol);
      await refreshExtraQuotes(true);
      updateTickerDom();
      updateWatchlistDom();
      const favTop = $(\"#favToggleBtn\");
      if (favTop) favTop.classList.toggle(\"active\", (state.favs||[]).includes(normSym(state.symbol)));
    };

    $$(\"[data-fav-sym]\").forEach(b => b.onclick = async (e) => {
      e.stopPropagation();
      toggleFav(b.dataset.favSym);
      await refreshExtraQuotes(true);
      updateTickerDom();
      updateWatchlistDom();
      const favTop = $(\"#favToggleBtn\");
      if (favTop) favTop.classList.toggle(\"active\", (state.favs||[]).includes(normSym(state.symbol)));
    });

    $$(\"[data-open-tab]\").forEach(b => b.onclick = async (e) => {
      e.stopPropagation();
      const sym = String(b.dataset.sym || \"\").trim().toUpperCase();
      const tab = String(b.dataset.openTab || \"\");
      if (sym) state.symbol = sym;
      if (tab) state.tab = tab;
      savePrefs();
      await fullRefresh();
      render();
      afterRender();
    });
  }


  function parseOverlaysFromQuickChartSpec(qs){
    const anns = qs?.options?.plugins?.annotation?.annotations;
    if (!Array.isArray(anns)) return { boxes: [], lines: [] };

    const boxes = anns
      .filter(a => a?.type === \"box\" && a?.yMin != null && a?.yMax != null)
      .map(a => ({
        yMin:+a.yMin, yMax:+a.yMax,
        label: a?.label?.content || \"\",
        bg: a?.backgroundColor || \"rgba(96,165,250,.12)\",
        border: a?.borderColor || \"rgba(96,165,250,.55)\"
      }));

    const lines = anns
      .filter(a => a?.type === \"line\" && a?.value != null)
      .map(a => ({
        price:+a.value,
        label: a?.label?.content || \"\",
        color: a?.borderColor || \"rgba(52,211,153,.85)\"
      }));

    return { boxes, lines };
  }

  function initTvChart(){
    const wrap = $(\"#tvWrap\");
    if (!wrap || !window.LightweightCharts) return;

    wrap.innerHTML = \"\";
    wrap.style.position = \"relative\";

    const chart = LightweightCharts.createChart(wrap, {
      autoSize: true,
      layout: { background: { type: \"solid\", color: \"transparent\" }, textColor: \"#E5E7EB\" },
      grid: { vertLines: { color: \"rgba(31,42,68,.6)\" }, horzLines: { color: \"rgba(31,42,68,.6)\" } },
      rightPriceScale: { borderColor: \"rgba(31,42,68,.9)\" },
      timeScale: { borderColor: \"rgba(31,42,68,.9)\" }
    });

    const series = chart.addCandlestickSeries();
    series.setData(state.candles);

    const canvas = document.createElement(\"canvas\");
    canvas.style.position = \"absolute\";
    canvas.style.inset = \"0\";
    canvas.style.pointerEvents = \"none\";
    wrap.appendChild(canvas);

    const ctx = canvas.getContext(\"2d\");

    function drawOverlay(){
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0,0,w,h);

      const boxes = state.overlayData.boxes || [];
      boxes.forEach(b => {
        const y1 = series.priceToCoordinate(b.yMax);
        const y2 = series.priceToCoordinate(b.yMin);
        if (y1 == null || y2 == null) return;

        const top = Math.min(y1,y2) * devicePixelRatio;
        const bot = Math.max(y1,y2) * devicePixelRatio;

        ctx.fillStyle = b.bg;
        ctx.strokeStyle = b.border;
        ctx.lineWidth = 2 * devicePixelRatio;

        ctx.fillRect(0, top, w, Math.max(1, bot-top));
        ctx.strokeRect(0, top, w, Math.max(1, bot-top));

        if (b.label) {
          ctx.font = (12 * devicePixelRatio) + \"px ui-sans-serif,system-ui\";
          ctx.fillStyle = \"rgba(229,231,235,.92)\";
          ctx.fillText(b.label, 12 * devicePixelRatio, Math.max(14*devicePixelRatio, top + 16*devicePixelRatio));
        }
      });
    }

    function resizeCanvas(){
      const r = wrap.getBoundingClientRect();
      canvas.width = Math.floor(r.width * devicePixelRatio);
      canvas.height = Math.floor(r.height * devicePixelRatio);
      canvas.style.width = r.width + \"px\";
      canvas.style.height = r.height + \"px\";
      drawOverlay();
    }

    // price lines
    (state.overlayData.lines || []).forEach(l => {
      try{
        series.createPriceLine({
          price: l.price,
          color: l.color,
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: l.label || \"\"
        });
      } catch {}
    });

    chart.timeScale().fitContent();
    window.addEventListener(\"resize\", resizeCanvas);
    chart.subscribeCrosshairMove(() => drawOverlay());
    chart.timeScale().subscribeVisibleTimeRangeChange(() => drawOverlay());

    setTimeout(resizeCanvas, 20);
    setTimeout(drawOverlay, 80);
  }

  function applyOverlaysFromJobIfAny(){
    const job = state.job;
    if (!job) return;
    const spec = job.quickChartSpec || job.qcSpec || null;
    if (spec) {
      state.overlayData = parseOverlaysFromQuickChartSpec(spec);
      initTvChart();
    }
  }

  async function loadAccount(){
    try{
      const r = await api(API.accountGet, { miniToken: state.miniToken });
      state.account = r.account || r;

      try {
        const ref = await api(API.refSummary, { miniToken: state.miniToken });
        state.referral = ref.referral || null;
        state.referralWithdrawals = Array.isArray(ref.withdrawals) ? ref.withdrawals : [];
      } catch {
        state.referral = state.referral || null;
        state.referralWithdrawals = state.referralWithdrawals || [];
      }
    }catch{
      state.account = null;
    }
  }

  
  async function loadAdmin(){
    if (!state.isAdmin) {
      state.admin = { payments: [], cwithdrawals: [], wallet: \"\", checks: {}, error: \"no_access\" };
      return;
    }
    try {
      const pl = await api(API.subPlans, { miniToken: state.miniToken });
      const wallet = String(pl.wallet || \"\");
      const p = await api(API.adminPayments, { miniToken: state.miniToken });
      const payments = Array.isArray(p.payments) ? p.payments : [];
      const cw = await api(API.adminCwList, { miniToken: state.miniToken });
      const cwithdrawals = Array.isArray(cw.withdrawals) ? cw.withdrawals : [];
      state.admin = { payments, cwithdrawals, wallet, checks: state.admin?.checks || {}, error: \"\" };
    } catch (e) {
      state.admin = { payments: [], cwithdrawals: [], wallet: state.admin?.wallet || \"\", checks: state.admin?.checks || {}, error: (e && e.message) ? e.message : \"error\" };
    }
  }

  function viewAdmin(){
    if (!state.isAdmin) {
      return '<div class=\"card\"><div class=\"h\">پنل ادمین</div><div class=\"c\"><div class=\"muted\">دسترسی ادمین ندارید.</div></div></div>';
    }

    const a = state.admin || {};
    const wallet = escapeHtml(a.wallet || \"\");
    const pays = Array.isArray(a.payments) ? a.payments : [];
    const subs = pays.filter((x) => x && (x.kind === \"subscription\" || x.planId));
    subs.sort((x, y) => {
      const xs = String(x.status || \"pending\") === \"pending\" ? 0 : 1;
      const ys = String(y.status || \"pending\") === \"pending\" ? 0 : 1;
      if (xs !== ys) return xs - ys;
      return String(y.createdAt || \"\").localeCompare(String(x.createdAt || \"\"));
    });

    const cw = Array.isArray(a.cwithdrawals) ? a.cwithdrawals : [];
    cw.sort((x, y) => {
      const xs = String(x.status || \"pending\") === \"pending\" ? 0 : 1;
      const ys = String(y.status || \"pending\") === \"pending\" ? 0 : 1;
      if (xs !== ys) return xs - ys;
      return String(y.createdAt || \"\").localeCompare(String(x.createdAt || \"\"));
    });

    let html = '<div class=\"grid cols2\" id=\"adminPanel\">';
    html += '<div class=\"card\" style=\"grid-column:1/-1\"><div class=\"h\">🛡 پنل ادمین</div><div class=\"c\">';
    html += '<div class=\"row\" style=\"gap:10px;flex-wrap:wrap\">' +
      pill(true, \"Wallet: \" + wallet) +
      pill(true, \"Payments: \" + String(subs.length)) +
      pill(true, \"Withdrawals: \" + String(cw.length)) +
      '</div>';
    html += '<div class=\"row\" style=\"gap:10px;flex-wrap:wrap;margin-top:10px\">' +
      '<button class=\"btn\" id=\"adminRefreshBtn\">به‌روزرسانی</button>' +
      (a.error ? '<div class=\"warn\" style=\"padding:10px\">' + escapeHtml(a.error) + '</div>' : '') +
      '</div>';
    html += '</div></div>';

    // Payments
    html += '<div class=\"card\" style=\"grid-column:1/-1\"><div class=\"h\">💳 تایید پرداخت اشتراک</div><div class=\"c\">';
    if (!subs.length) {
      html += '<div class=\"muted\">پرداختی برای نمایش وجود ندارد.</div>';
    } else {
      for (const p of subs) {
        const st = String(p.status || \"pending\");
        const stFa = st === \"approved\" ? \"تایید\" : (st === \"rejected\" ? \"رد\" : \"در انتظار\");
        const who = escapeHtml(p.username ? (\"@\" + p.username) : String(p.userId || \"\"));
        const when = p.createdAt ? fmtTime(p.createdAt) : \"\";
        const plan = escapeHtml(p.planId || \"\");
        const amt = fmtMoney(p.amount || 0);
        const tx = escapeHtml(String(p.txHash || \"\"));
        const chk = ((a.checks && p.paymentId) ? a.checks[p.paymentId] : null) || p.check || null;
        const chkTxt = chk ? (chk.ok ? (\"✅ OK | amount=\" + fmtMoney(chk.amount || chk.transferAmount || 0)) : (\"❌ \" + escapeHtml(chk.reason || chk.error || \"fail\"))) : \"\";
        const chkObj = chk && (chk.result ? chk.result : chk);
        const rep = chkObj && (chkObj.report || chkObj.raw || chkObj.receipt) ? chkObj : null;
        const repHtml = chkObj ? renderTxVisual(chkObj, tx) : '';

        html += '<div class=\"row\" style=\"justify-content:space-between;border-top:1px solid var(--b);padding-top:10px;margin-top:10px;gap:10px;flex-wrap:wrap\">' +
          '<div style=\"min-width:220px\">' +
            '<div class=\"row\" style=\"gap:8px;flex-wrap:wrap;align-items:center\">' +
              '<span class=\"badge ' + (st === \"approved\" ? \"ok\" : (st === \"rejected\" ? \"bad\" : \"warn\")) + '\">' + stFa + '</span>' +
              '<div style=\"font-weight:900\">' + amt + ' USDT</div>' +
            '</div>' +
            '<div class=\"muted\" style=\"font-size:12px\">' + when + ' • ' + who + (plan ? (\" • \" + plan) : \"\") + '</div>' +
            (tx ? '<div class=\"muted\" style=\"font-size:12px;max-width:520px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\">Tx: ' + tx + '</div>' : '') +
            (chkTxt ? '<div class=\"muted\" style=\"font-size:12px;margin-top:4px\">' + chkTxt + '</div>' : '') + repHtml +
          '</div>' +
          '<div class=\"row\" style=\"gap:8px;flex-wrap:wrap\">' +
            '<button class=\"btn\" data-admin-act=\"pay-check\" data-pay-id=\"' + escapeHtml(p.paymentId || \"\") + '\">BEP20 Scan</button>' +
            '<button class=\"btn ok\" data-admin-act=\"pay-approve\" data-pay-id=\"' + escapeHtml(p.paymentId || \"\") + '\">تایید</button>' +
            '<button class=\"btn danger\" data-admin-act=\"pay-reject\" data-pay-id=\"' + escapeHtml(p.paymentId || \"\") + '\">رد</button>' +
          '</div>' +
        '</div>';
      }
    }
    html += '</div></div>';

    // Commission withdrawals
    html += '<div class=\"card\" style=\"grid-column:1/-1\"><div class=\"h\">🏧 برداشت کمیسیون</div><div class=\"c\">';
    if (!cw.length) {
      html += '<div class=\"muted\">درخواستی وجود ندارد.</div>';
    } else {
      for (const w of cw) {
        const st = String(w.status || \"pending\");
        const stFa = st === \"approved\" ? \"تایید\" : (st === \"rejected\" ? \"رد\" : \"در انتظار\");
        const who = escapeHtml(w.username ? (\"@\" + w.username) : String(w.userId || \"\"));
        const when = w.createdAt ? fmtTime(w.createdAt) : \"\";
        const amt = fmtMoney(w.amount || 0);
        const addr = escapeHtml(String(w.address || \"\"));
        const tx = escapeHtml(String(w.txHash || \"\"));

        html += '<div class=\"row\" style=\"justify-content:space-between;border-top:1px solid var(--b);padding-top:10px;margin-top:10px;gap:10px;flex-wrap:wrap\">' +
          '<div style=\"min-width:220px\">' +
            '<div style=\"font-weight:800\">' + stFa + ' • ' + amt + ' USDT</div>' +
            '<div class=\"muted\" style=\"font-size:12px\">' + when + ' • ' + who + '</div>' +
            '<div class=\"muted\" style=\"font-size:12px;max-width:520px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\">' + addr + '</div>' +
            (tx ? '<div class=\"muted\" style=\"font-size:12px;margin-top:4px\">Tx: ' + tx + '</div>' : '') +
          '</div>' +
          '<div class=\"row\" style=\"gap:8px;flex-wrap:wrap;align-items:center\">' +
            '<input class=\"inp\" placeholder=\"TxHash (برای تایید)\" style=\"min-width:260px\" data-cw-tx=\"' + escapeHtml(w.id || \"\") + '\" value=\"' + tx + '\"/>' +
            '<button class=\"btn\" data-admin-act=\"cw-approve\" data-cw-id=\"' + escapeHtml(w.id || \"\") + '\">تایید</button>' +
            '<button class=\"btn secondary\" data-admin-act=\"cw-reject\" data-cw-id=\"' + escapeHtml(w.id || \"\") + '\">رد</button>' +
          '</div>' +
        '</div>';
      }
    }
    html += '</div></div>';

    html += '</div>';
    return html;
  }

  function wireAdminActions(){
    if (!state.isAdmin) return;

    const refreshBtn = $(\"#adminRefreshBtn\");
    if (refreshBtn) {
      refreshBtn.onclick = async () => {
        refreshBtn.disabled = true;
        try {
          await loadAdmin();
          render();
        } catch (e) {
          toast(e?.message || \"خطا\");
        } finally {
          refreshBtn.disabled = false;
        }
      };
    }

    const panel = $(\"#adminPanel\");
    if (!panel) return;

    panel.onclick = async (e) => {
      const btn = e.target && e.target.closest ? e.target.closest(\"button[data-admin-act]\") : null;
      if (!btn) return;
      const act = btn.dataset.adminAct;
      if (!act) return;

      if (act.startsWith(\"pay-\")) {
        const pid = btn.dataset.payId || \"\";
        const p = (state.admin?.payments || []).find((x) => String(x.paymentId || \"\") === String(pid));
        if (!p) return toast(\"پرداخت یافت نشد\");

        if (act === \"pay-check\") {
          btn.disabled = true;
          try {
            const r = await api(API.adminPaymentCheck, { miniToken: state.miniToken, txHash: p.txHash, amount: p.amount, address: state.admin?.wallet || \"\" });
            state.admin.checks = state.admin.checks || {};
            state.admin.checks[pid] = r.check || r;
            render();
          } catch (e2) {
            toast(e2?.message || \"خطا در اسکن\");
          } finally {
            btn.disabled = false;
          }
          return;
        }

        if (act === \"pay-approve\" || act === \"pay-reject\") {
          const decision = act === \"pay-approve\" ? \"approved\" : \"rejected\";
          btn.disabled = true;
          try {
            await api(API.adminPaymentDecision, { miniToken: state.miniToken, paymentId: pid, decision });
            await loadAdmin();
            render();
          } catch (e2) {
            toast(e2?.message || \"خطا در تایید/رد\");
          } finally {
            btn.disabled = false;
          }
          return;
        }
      }

      if (act.startsWith(\"cw-\")) {
        const id = btn.dataset.cwId || \"\";
        if (!id) return;

        if (act === \"cw-approve\") {
          const inp = panel.querySelector('input[data-cw-tx=\"' + CSS.escape(id) + '\"]');
          const txHash = String(inp?.value || \"\").trim();
          if (!txHash) return toast(\"TxHash لازم است\");
          btn.disabled = true;
          try {
            await api(API.adminCwDecision, { miniToken: state.miniToken, withdrawalId: id, decision: \"approved\", txHash });
            await loadAdmin();
            render();
          } catch (e2) {
            toast(e2?.message || \"خطا\");
          } finally {
            btn.disabled = false;
          }
          return;
        }

        if (act === \"cw-reject\") {
          btn.disabled = true;
          try {
            await api(API.adminCwDecision, { miniToken: state.miniToken, withdrawalId: id, decision: \"rejected\" });
            await loadAdmin();
            render();
          } catch (e2) {
            toast(e2?.message || \"خطا\");
          } finally {
            btn.disabled = false;
          }
          return;
        }
      }
    };
  }

function wireAccountActions(){
    const emailReqBtn = $(\"#emailReqBtn\");
    const emailConfBtn = $(\"#emailConfBtn\");
    const tgLinkBtn = $(\"#tgLinkBtn\");
    const tgOpenLinkBtn = $(\"#tgOpenLinkBtn\");
    const tgReqBtn = $(\"#tgReqBtn\");
    const tgConfBtn = $(\"#tgConfBtn\");

    let lastTgUrl = \"\";

    if (emailReqBtn) emailReqBtn.onclick = async () => {
      $(\"#emailMsg\").textContent = \"در حال ارسال...\";
      try{
        const r = await api(API.emailReq, { miniToken: state.miniToken });
        $(\"#emailMsg\").textContent = r.debugCode ? (\"کد تست: \" + r.debugCode) : \"کد ارسال شد.\";
      }catch(e){
        $(\"#emailMsg\").textContent = \"خطا: \" + e.message;
      }
    };

    if (emailConfBtn) emailConfBtn.onclick = async () => {
      const code = ($(\"#emailCodeInp\").value || \"\").trim();
      $(\"#emailMsg\").textContent = \"در حال تأیید...\";
      try{
        await api(API.emailConf, { miniToken: state.miniToken, code });
        $(\"#emailMsg\").textContent = \"✅ ایمیل تأیید شد.\";
        await loadAccount();
        render();
        afterRender();
      }catch(e){
        $(\"#emailMsg\").textContent = \"خطا: \" + e.message;
      }
    };

    if (tgLinkBtn) tgLinkBtn.onclick = async () => {
      $(\"#tgLinkOut\").textContent = \"در حال ساخت لینک...\";
      try{
        const r = await api(API.tgLink, { miniToken: state.miniToken });
        lastTgUrl = r.url || \"\";
        $(\"#tgLinkOut\").textContent = lastTgUrl || \"—\";
        if (tgOpenLinkBtn) { tgOpenLinkBtn.disabled = !lastTgUrl; tgOpenLinkBtn.onclick = () => { if(lastTgUrl) window.open(lastTgUrl, \"_blank\"); }; }
      }catch(e){
        $(\"#tgLinkOut\").textContent = \"خطا: \" + e.message;
      }
    };

    if (tgReqBtn) tgReqBtn.onclick = async () => {
      $(\"#tgMsg\").textContent = \"در حال ارسال...\";
      try{
        const r = await api(API.tgReq, { miniToken: state.miniToken });
        $(\"#tgMsg\").textContent = r.debugCode ? (\"کد تست: \" + r.debugCode) : \"کد به تلگرام ارسال شد.\";
      }catch(e){
        $(\"#tgMsg\").textContent = \"خطا: \" + e.message;
      }
    };

    if (tgConfBtn) tgConfBtn.onclick = async () => {
      const code = ($(\"#tgCodeInp\").value || \"\").trim();
      $(\"#tgMsg\").textContent = \"در حال تأیید...\";
      try{
        await api(API.tgConf, { miniToken: state.miniToken, code });
        $(\"#tgMsg\").textContent = \"✅ تلگرام تأیید شد.\";
        await loadAccount();
        render();
        afterRender();
      }catch(e){
        $(\"#tgMsg\").textContent = \"خطا: \" + e.message;
      }
    };
    // Subscription purchase (Web App)
    const subWalletInp = $(\"#webSubWallet\");
    const subCopyBtn = $(\"#webSubCopyWallet\");
    const subLoadBtn = $(\"#webSubLoadPlans\");
    const subOpenWalletBtn = $(\"#webSubOpenWallet\");
    const planCardsEl = $(\"#webSubPlanCards\");
    const planInfoEl  = $(\"#webSubPlanInfo\");
    const subResEl    = $(\"#webSubPurchaseResult\");
    const ctaGoBtn    = $(\"#subCtaGoBtn\");
    const ctaPlansBtn = $(\"#subCtaPlansBtn\");

    function getSelectedPlan(){
      const pid = String(subPlanSel ? subPlanSel.value : \"\").trim();
      const plans = Array.isArray(state.subPlans) ? state.subPlans : [];
      return plans.find(p => String(p.id||\"\") === pid) || (plans[0] || null);
    }

    function renderSubPlanInfo(){
      if (!planInfoEl) return;
      const p = getSelectedPlan();
      if (!p) { planInfoEl.innerHTML = \"\"; return; }
      const days = Number(p.days || 0);
      const lim = Number(p.dailyLimit || 0);
      const cur = String(p.currency || \"USDT\");
      const net = String(p.network || \"BEP20\");
      const amt = String(p.amount || 0);

      planInfoEl.innerHTML =
        '<div class=\"kv\"><div class=\"k\">پلن</div><div class=\"v\">' + escapeHtml(String(p.title || p.id || \"\")) + '</div></div>' +
        '<div class=\"kv\"><div class=\"k\">مبلغ</div><div class=\"v mono\">' + escapeHtml(amt + \" \" + cur) + '</div></div>' +
        '<div class=\"kv\"><div class=\"k\">مدت</div><div class=\"v\">' + escapeHtml(String(days) + \" روز\") + '</div></div>' +
        '<div class=\"kv\"><div class=\"k\">سهمیه</div><div class=\"v\">' + escapeHtml(String(lim) + \"/روز\") + '</div></div>' +
        '<div class=\"kv\"><div class=\"k\">شبکه</div><div class=\"v\">' + escapeHtml(net) + '</div></div>' +
        '<div class=\"kv\"><div class=\"k\">کپی مبلغ</div><div class=\"v\">' +
          '<button class=\"btn secondary\" id=\"webSubCopyAmount\" style=\"height:34px\">کپی</button>' +
        '</div></div>';

      const ca = $(\"#webSubCopyAmount\");
      if (ca) ca.onclick = async () => {
        try{
          await navigator.clipboard.writeText(String(amt));
          toast(\"مبلغ کپی شد ✅\", \"ok\");
        }catch{ toast(\"کپی انجام نشد\", \"err\"); }
      };
    }

    function renderSubPlanCards(plans){
      if (!planCardsEl) return;
      planCardsEl.innerHTML = \"\";
      const list = Array.isArray(plans) ? plans : [];
      for (const p of list){
        const pid = String(p.id || \"\");
        const title = String(p.title || pid || \"\");
        const days = Number(p.days || 0);
        const lim = Number(p.dailyLimit || 0);
        const cur = String(p.currency || \"USDT\");
        const net = String(p.network || \"BEP20\");
        const amt = String(p.amount || 0);
        const isOn = (subPlanSel && String(subPlanSel.value||\"\") === pid);
        const el = document.createElement(\"div\");
        el.className = \"planCard\" + (isOn ? \" active\" : \"\");
        el.setAttribute(\"data-plan\", pid);
        el.innerHTML =
          '<div class=\"row\" style=\"justify-content:space-between;gap:8px\">' +
            '<div style=\"font-weight:900\">' + escapeHtml(title) + '</div>' +
            '<div class=\"mono\" style=\"font-weight:900\">' + escapeHtml(amt + \" \" + cur) + '</div>' +
          '</div>' +
          '<div class=\"muted\" style=\"font-size:12px;margin-top:6px\">' + escapeHtml(days + \" روز\" + \" • \" + lim + \"/روز\" + \" • \" + net) + '</div>';
        el.onclick = () => {
          if (subPlanSel) subPlanSel.value = pid;
          $$(\".planCard\", planCardsEl).forEach(x => x.classList.remove(\"active\"));
          el.classList.add(\"active\");
          renderSubPlanInfo();
        };
        planCardsEl.appendChild(el);
      }
    }
    const subPlanSel = $(\"#webSubPlanSel\");
    const subTxInp = $(\"#webSubTxHash\");
    const subSubmitBtn = $(\"#webSubSubmit\");
    const subMsg = $(\"#webSubMsg\");

    async function loadSubPlans(){
      if (!subPlanSel) return;
      if (subMsg) subMsg.textContent = \"در حال دریافت پلن‌ها...\";

      try{
        const r = await api(API.subPlans, { miniToken: state.miniToken });
        const plans = Array.isArray(r.plans) ? r.plans : [];
        state.subPlans = plans;
        state.subWallet = String(r.wallet || state.subWallet || \"\");
        if (subWalletInp) subWalletInp.value = state.subWallet || \"\";
        subPlanSel.innerHTML = \"\";
        if (!plans.length){
          const o = document.createElement(\"option\");
          o.value = \"\";
          o.textContent = \"پلنی موجود نیست\";
          subPlanSel.appendChild(o);
          if (subMsg) subMsg.textContent = \"پلنی موجود نیست.\"; 
          return;
        }
        for (const p of plans){
          const o = document.createElement(\"option\");
          o.value = String(p.id || \"\");
          const days = Number(p.days || 0);
          const lim = Number(p.dailyLimit || 0);
          const cur = String(p.currency || \"USDT\");
          const net = String(p.network || \"BEP20\");
          const title = String(p.title || p.id || \"\");
          o.textContent = title + \" — \" + String(p.amount || 0) + \" \" + cur + \" / \" + days + \" روز / سهمیه \" + lim + \"/روز (\" + net + \" )\";
          subPlanSel.appendChild(o);
        }
        renderSubPlanCards(plans);
        renderSubPlanInfo();
        if (subMsg) subMsg.textContent = \"پلن را انتخاب کن و TxHash را وارد کن.\"; 
      }catch(e){
        if (subMsg) subMsg.textContent = \"خطا: \" + e.message;
      }
    }

    if (subCopyBtn) subCopyBtn.onclick = async () => {
      const t = (subWalletInp ? subWalletInp.value : (state.subWallet||\"\")) || \"\";
      if (!t) { toast(\"ولت ثبت نشده\", \"err\"); return; }
      try{
        await navigator.clipboard.writeText(String(t));
        toast(\"کپی شد ✅\", \"ok\");
      }catch{
        toast(\"کپی انجام نشد\", \"err\");
      }
    };
    if (subOpenWalletBtn) subOpenWalletBtn.onclick = () => {
      const addr = (subWalletInp ? subWalletInp.value : (state.subWallet||"")) || "";
      if (!addr) { toast("ولت ثبت نشده", "err"); return; }
      try{ window.open(bscAddrUrl(addr), "_blank", "noopener,noreferrer"); }catch{}
    };

    if (subPlanSel) subPlanSel.onchange = () => {
      renderSubPlanCards(Array.isArray(state.subPlans)?state.subPlans:[]);
      renderSubPlanInfo();
    };

    if (ctaGoBtn) ctaGoBtn.onclick = () => {
      try{ state.pendingOffer = null; state.pendingOfferReason = ""; }catch{}
      const txi = $("#webSubTxHash");
      if (txi && txi.focus) txi.focus();
      toast("پلن را انتخاب کن و TxHash را ثبت کن", "ok");
      render();
      afterRender();
    };

    if (ctaPlansBtn) ctaPlansBtn.onclick = async () => {
      try{ await loadSubPlans(); }catch{}
      toast("پلن‌ها به‌روزرسانی شد", "ok");
    };


    if (subLoadBtn) subLoadBtn.onclick = () => loadSubPlans();

    if (subSubmitBtn) subSubmitBtn.onclick = async () => {
      if (subMsg) subMsg.textContent = \"در حال ثبت پرداخت...\";

      try{
        const planId = String(subPlanSel ? subPlanSel.value : \"\").trim();
        const txHash = String(subTxInp ? subTxInp.value : \"\").trim();
        if (!planId) throw new Error(\"پلن را انتخاب کن.\");
        if (!txHash) throw new Error(\"TxHash را وارد کن.\");
        const r = await api(API.subPurchase, { miniToken: state.miniToken, planId, txHash });
        state.lastSubPurchase = r.result || null;
        state.lastSubPayment = r.payment || null;
        if (subResEl && r.result) { subResEl.innerHTML = renderTxVisual(r.result, r.payment ? r.payment.txHash : txHash); }

        if (r && r.activated) {
          if (subMsg) subMsg.textContent = \"✅ پرداخت تایید شد و اشتراک فعال شد.\"; 
        } else {
          if (subMsg) subMsg.textContent = \"⏳ پرداخت ثبت شد و در انتظار تایید ادمین است.\"; 
        }

        await loadUserMeta();
        await loadAccount();
        render();
        afterRender();
      }catch(e){
        if (subMsg) subMsg.textContent = \"خطا: \" + e.message;
      }
    };

    if (subPlanSel && !state.subPlansLoaded) {
      state.subPlansLoaded = true;
      loadSubPlans();
    }


    // Referral commission withdraw
    const cwBtn = $(\"#cwReqBtn\");
    if (cwBtn) {
      cwBtn.onclick = async () => {
        const amt = Number(String($(\"#cwAmountInp\")?.value || \"\").replace(\",\", \".\"));
        const addr = String($(\"#cwAddressInp\")?.value || \"\").trim();
        const msgEl = $(\"#cwMsg\");
        const showMsg = (txt) => {
          if (!msgEl) return;
          msgEl.style.display = \"block\";
          msgEl.innerHTML = escapeHtml(String(txt || \"\"));
        };

        if (!Number.isFinite(amt) || amt <= 0) return showMsg(\"مبلغ برداشت نامعتبر است.\");
        if (!addr || addr.length < 6) return showMsg(\"آدرس کیف پول نامعتبر است.\");

        cwBtn.disabled = true;
        try {
          await api(API.refWithdraw, { miniToken: state.miniToken, amount: amt, address: addr });
          showMsg(\"✅ درخواست برداشت ثبت شد و در انتظار تایید ادمین است.\");
          await loadAccount();
          render();
        } catch (e) {
          showMsg(e?.message || \"خطا در ثبت درخواست برداشت\");
        } finally {
          cwBtn.disabled = false;
        }
      };
    }

  }

// Quick links to Subscription/Wallet tabs (if present)
const goSub = $("#goSubTabBtn");
const goWal = $("#goWalletTabBtn");
if (goSub) goSub.onclick = () => { try{ window.__goTab && window.__goTab("subscription"); }catch{} };
if (goWal) goWal.onclick = () => { try{ window.__goTab && window.__goTab("wallet"); }catch{} };


  async function boot(){
    try{ if (location && String(location.pathname||\"\").startsWith(\"/m\")) document.body.classList.add(\"mobile\"); }catch{}

    try{
      const qs = new URLSearchParams(String(location.search || \"\"));
      const ref = String(qs.get(\"ref\") || qs.get(\"start\") || \"\").trim();
      if (ref) state.startParam = ref.startsWith(\"ref_\") ? ref : (\"ref_\" + ref);

      // Admin/Owner webToken via URL
      const accessTok = String(qs.get(\"access\") || qs.get(\"webToken\") || qs.get(\"token\") || \"\").trim();
      if (accessTok) {
        setWebToken(accessTok);
        // Prefer admin session; clear normal user session token
        setToken(\"\");
        state.tab = \"admin\";
        // Remove token from URL
        try{
          qs.delete(\"access\"); qs.delete(\"webToken\"); qs.delete(\"token\");
          const q = qs.toString();
          history.replaceState(null, \"\", location.pathname + (q ? (\"?\" + q) : \"\") );
        }catch{}
      }
    }catch{}
    if (!state.miniToken && !state.webToken) {
      mount(authView());
      const formsEl = $(\"#authForms\");

      function renderAuthForms(){
        formsEl.innerHTML = state.authTab === \"login\" ? loginForm() : signupForm();

        const msgEl = $(\"#authMsg\");

        if (state.authTab === \"login\") {
          $(\"#loginBtn\").onclick = async () => {
            msgEl.textContent = \"در حال ورود...\";
            try{
              const usernameOrEmail = ($(\"#loginUser\").value || \"\").trim();
              const password = ($(\"#loginPass\").value || \"\").trim();
              const r = await api(API.login, { usernameOrEmail, password });
              setToken(r.miniToken);
              await loadUserMeta();
              await loadAccount();
              await fullRefresh();
              state.tab = \"dashboard\";
              render();
              afterRender();
              if (!state.livePaused) startLiveTimers();
            }catch(e){
              msgEl.textContent = \"خطا: \" + e.message;
            }
          };

          // Password reset (email/telegram)
          const resetBox = $(\"#resetBox\");
          const openResetBtn = $(\"#openResetBtn\");
          const rsMsg = $(\"#rsMsg\");
          if (openResetBtn && resetBox) {
            openResetBtn.onclick = () => {
              const cur = (resetBox.style.display || \"none\");
              resetBox.style.display = (cur === \"none\") ? \"block\" : \"none\";
              const v = ($(\"#loginUser\").value || \"\").trim();
              if (v) $(\"#rsUser\").value = v;
              if (rsMsg) rsMsg.textContent = \"\";
            };
          }

          const rsReqBtn = $(\"#rsReqBtn\");
          if (rsReqBtn) rsReqBtn.onclick = async () => {
            if (rsMsg) rsMsg.textContent = \"در حال ارسال کد...\";
            try{
              const usernameOrEmail = ($(\"#rsUser\").value || $(\"#loginUser\").value || \"\").trim();
              const channel = ($(\"#rsChannel\").value || \"email\");
              const r = await api(API.resetReq, { usernameOrEmail, channel });
              if (rsMsg) rsMsg.textContent = r.debugCode ? (\"کد تست: \" + r.debugCode) : \"کد ارسال شد.\";
            }catch(e){
              if (rsMsg) rsMsg.textContent = \"خطا: \" + e.message;
            }
          };

          const rsConfBtn = $(\"#rsConfBtn\");
          if (rsConfBtn) rsConfBtn.onclick = async () => {
            if (rsMsg) rsMsg.textContent = \"در حال تغییر رمز...\";
            try{
              const usernameOrEmail = ($(\"#rsUser\").value || $(\"#loginUser\").value || \"\").trim();
              const code = ($(\"#rsCode\").value || \"\").trim();
              const newPassword = ($(\"#rsNewPass\").value || \"\").trim();
              const r = await api(API.resetConf, { usernameOrEmail, code, newPassword });
              if (r && r.miniToken) setToken(r.miniToken);
              if (rsMsg) rsMsg.textContent = \"✅ رمز عبور تغییر کرد. در حال ورود...\";
              await loadUserMeta();
              await loadAccount();
              await fullRefresh();
              state.tab = \"dashboard\";
              render();
              afterRender();
              if (!state.livePaused) startLiveTimers();
            }catch(e){
              if (rsMsg) rsMsg.textContent = \"خطا: \" + e.message;
            }
          };

        } else {
          $(\"#signupBtn\").onclick = async () => {
            msgEl.textContent = \"در حال ثبت‌نام...\";
            try{
              const email = ($(\"#suEmail\").value || \"\").trim();
              const username = ($(\"#suUser\").value || \"\").trim();
              const password = ($(\"#suPass\").value || \"\").trim();
              const telegramUsername = ($(\"#suTg\").value || \"\").trim();
              const r = await api(API.signup, { email, username, password, telegramUsername });
              setToken(r.miniToken);
              await loadUserMeta();
              await loadAccount();
              await fullRefresh();
              state.tab = \"dashboard\";
              render();
              afterRender();
              if (!state.livePaused) startLiveTimers();
            }catch(e){
              msgEl.textContent = \"خطا: \" + e.message;
            }
          };
        }
      }

      $(\"#authTabLogin\").onclick = () => { state.authTab=\"login\"; $(\"#authTabLogin\").classList.add(\"active\"); $(\"#authTabSignup\").classList.remove(\"active\"); renderAuthForms(); };
      $(\"#authTabSignup\").onclick = () => { state.authTab=\"signup\"; $(\"#authTabSignup\").classList.add(\"active\"); $(\"#authTabLogin\").classList.remove(\"active\"); renderAuthForms(); };

      renderAuthForms();
      return;
    }

    try{
      await loadUserMeta();
      await loadAccount();
      await fullRefresh();
      render();
      afterRender();
      if (!state.livePaused) startLiveTimers();
    } catch(e){
      setToken(\"\");
      setWebToken(\"\");
      boot();
    }
  }

  mount(\"<div class='warn' style='padding:22px'>در حال بارگذاری...</div>\");
  boot();
})();`;


const ADMIN_APP_HTML = String.raw`<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>Admin — IQ Market</title>
  <meta name="theme-color" content="#05070D" />
  <link rel="icon" href="/admin/logo" />
  <link rel="stylesheet" href="/admin/style.css" />
</head>
<body>
  <div id="root" class="boot">در حال بارگذاری پنل ادمین...</div>
  <script src="/admin/app.js"></script>
</body>
</html>`;

const ADMIN_APP_CSS = String.raw`
:root{
  --bg:#05070D; --bg2:#070B12; --surface:rgba(11,18,32,.78); --surface2:rgba(15,26,46,.86);
  --txt:#E6EDF5; --muted:#9CA3AF; --b:rgba(148,163,184,.16); --a:#60A5FA; --ok:#34D399; --bad:#F87171;
  --warn:#FBBF24; --radius:14px;
}
*{ box-sizing:border-box; }
html,body{ height:100%; }
body{
  margin:0;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
  background: radial-gradient(1100px 600px at 80% -10%, rgba(96,165,250,.22), transparent),
              radial-gradient(900px 600px at 0% 10%, rgba(52,211,153,.12), transparent),
              linear-gradient(180deg, var(--bg), #070B12 35%, #05070D);
  color: var(--txt);
}
a{ color:inherit; }
.boot{ padding:28px; color:var(--muted); }

.shell{
  display:grid;
  grid-template-columns: 280px 1fr;
  min-height:100vh;
}
.side{
  position:sticky; top:0;
  height:100vh;
  padding:16px 14px;
  border-right:1px solid var(--b);
  background: linear-gradient(180deg, rgba(7,11,18,.92), rgba(5,7,13,.88));
  backdrop-filter: blur(10px);
}
.brand{
  display:flex; align-items:center; gap:10px;
  padding:10px 10px 14px;
  border-bottom:1px solid var(--b);
  margin-bottom:12px;
}
.brand img{ width:42px; height:42px; border-radius:12px; background:rgba(255,255,255,.06); padding:6px; }
.brand .t{ font-weight:800; letter-spacing:.3px; }
.brand .s{ font-size:12px; color:var(--muted); margin-top:2px; }

.nav{ display:flex; flex-direction:column; gap:8px; padding:8px; }
.nav button{
  all:unset; cursor:pointer;
  display:flex; align-items:center; gap:10px;
  padding:12px 12px;
  border:1px solid transparent;
  border-radius:12px;
  color:var(--txt);
}
.nav button:hover{ background:rgba(255,255,255,.04); border-color:rgba(255,255,255,.06); }
.nav button.active{
  background:rgba(96,165,250,.12);
  border-color:rgba(96,165,250,.28);
}
.nav .badge{
  margin-right:auto;
  font-size:12px;
  padding:3px 8px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.12);
  color:var(--muted);
}
.main{ padding:18px 18px 40px; }
.topbar{
  display:flex; align-items:center; gap:10px;
  padding:12px 14px;
  border:1px solid var(--b);
  border-radius:16px;
  background:rgba(10,16,28,.62);
  backdrop-filter: blur(10px);
}
.topbar .grow{ flex:1; }
.pill{
  display:inline-flex; align-items:center; gap:8px;
  padding:6px 10px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.12);
  color:var(--muted);
  font-size:12px;
}
.btn{
  border:none; cursor:pointer;
  padding:10px 12px;
  border-radius:12px;
  background:rgba(255,255,255,.06);
  color:var(--txt);
  border:1px solid rgba(255,255,255,.12);
}
.btn:hover{ background:rgba(255,255,255,.09); }
.btn.primary{
  background:rgba(96,165,250,.18);
  border-color:rgba(96,165,250,.35);
}
.btn.danger{
  background:rgba(248,113,113,.16);
  border-color:rgba(248,113,113,.28);
}
.btn.ok{
  background:rgba(52,211,153,.14);
  border-color:rgba(52,211,153,.26);
}
.grid{
  display:grid;
  grid-template-columns: repeat(12, 1fr);
  gap:12px;
  margin-top:14px;
}
.card{
  grid-column: span 12;
  border:1px solid var(--b);
  border-radius:16px;
  background:rgba(10,16,28,.58);
  backdrop-filter: blur(10px);
  overflow:hidden;
}
.card .hd{
  padding:12px 14px;
  border-bottom:1px solid var(--b);
  display:flex; align-items:center; justify-content:space-between;
}
.card .bd{ padding:14px; }
.card h3{ margin:0; font-size:14px; }
.muted{ color:var(--muted); font-size:12px; }
.kpis{ display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; }
.kpi{
  border:1px solid rgba(255,255,255,.10);
  border-radius:14px;
  padding:10px 12px;
  background:rgba(255,255,255,.03);
}
.kpi .v{ font-weight:800; font-size:18px; margin-top:4px; }
.row{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.sep{ height:1px; background:var(--b); margin:12px 0; }
.input{
  width:100%;
  background:rgba(255,255,255,.04);
  border:1px solid rgba(255,255,255,.10);
  color:var(--txt);
  border-radius:12px;
  padding:10px 12px;
  outline:none;
}
.table{ width:100%; border-collapse:collapse; }
.table th, .table td{
  text-align:right;
  padding:10px 8px;
  border-bottom:1px solid rgba(255,255,255,.08);
  font-size:13px;
}
.table th{ color:var(--muted); font-weight:600; }
.tag{
  display:inline-flex; align-items:center; gap:6px;
  padding:4px 8px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.14);
  font-size:12px;
}
.tag.ok{ border-color:rgba(52,211,153,.35); background:rgba(52,211,153,.10); }
.tag.bad{ border-color:rgba(248,113,113,.35); background:rgba(248,113,113,.10); }
.tag.warn{ border-color:rgba(251,191,36,.35); background:rgba(251,191,36,.10); }
.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
.small{ font-size:12px; }
.click{ cursor:pointer; }
details{ border:1px solid rgba(255,255,255,.10); border-radius:12px; padding:10px 12px; background:rgba(255,255,255,.03); }
details summary{ cursor:pointer; color:var(--muted); }
.toast{
  position:fixed; bottom:18px; left:18px; right:18px;
  display:flex; justify-content:center;
  pointer-events:none;
}
.toast .t{
  pointer-events:auto;
  max-width:840px;
  width:100%;
  border:1px solid rgba(255,255,255,.16);
  border-radius:14px;
  padding:12px 14px;
  background:rgba(10,16,28,.86);
  backdrop-filter: blur(10px);
}
@media (max-width: 900px){
  .shell{ grid-template-columns: 1fr; }
  .side{ position:relative; height:auto; border-right:none; border-bottom:1px solid var(--b); }
  .kpis{ grid-template-columns: repeat(2, 1fr); }
}

/* Responsive sidebar + ticket UI */
.btn.ghost{background:transparent;border:1px solid var(--b);color:var(--txt)}
.backdrop{
  display:none;
  position:fixed; inset:0;
  background:rgba(0,0,0,.55);
  opacity:0; pointer-events:none;
  transition:opacity .2s ease;
  z-index:40;
}
body.side-open .backdrop{display:block; opacity:1; pointer-events:auto}

@media (max-width: 900px){
  .shell{grid-template-columns:1fr}
  .side{
    position:fixed; top:0; bottom:0; right:0;
    width:min(280px,86vw);
    transform:translateX(110%);
    transition:transform .2s ease;
    z-index:50;
    border-right:none;
    border-left:1px solid var(--b);
  }
  body.side-open .side{transform:translateX(0)}
}
@media (min-width: 901px){
  .btn.ghost{display:none}
}

.tag.ok{border-color:rgba(52,211,153,.45); background:rgba(52,211,153,.10); color:rgba(229,231,235,.95)}
.tag.bad{border-color:rgba(248,113,113,.45); background:rgba(248,113,113,.10); color:rgba(229,231,235,.95)}
.tag.warn{border-color:rgba(251,191,36,.45); background:rgba(251,191,36,.10); color:rgba(229,231,235,.95)}

.preWrap{white-space:pre-wrap; word-break:break-word}

.kvs{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px}
@media (max-width: 900px){ .kvs{grid-template-columns:1fr} }
.kv{border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:10px 12px; background:rgba(255,255,255,.02)}
.kv .k{font-size:12px;color:var(--muted);margin-bottom:6px}
.kv .v{font-size:13px}
.small{font-size:12px}

.tkItem{border:1px solid var(--b); border-radius:14px; padding:10px; background:rgba(7,11,18,.12); margin-top:10px}
.tkSum{cursor:pointer}
.tkPreview{margin-top:8px; color:rgba(230,237,245,.92)}
.tkBody{margin-top:10px}
`;


const ADMIN_MOBILE_OVERRIDES_CSS = String.raw`
/* Mobile overrides for admin panel (/adminm) */
@media (max-width: 900px){
  body{ padding: 10px !important; }
  .shell{ display:block !important; }
  .side{ position:static !important; width:auto !important; margin-bottom:12px !important; }
  .topbar{ position:static !important; margin-bottom:10px !important; }
  .tabs{ overflow-x:auto !important; white-space:nowrap !important; }
  .tabs button{ display:inline-block !important; }

  /* Tables: allow horizontal scroll if needed + keep action buttons tappable */
  table{ display:block !important; width:100% !important; overflow-x:auto !important; -webkit-overflow-scrolling:touch !important; }
  th,td{ white-space:normal !important; vertical-align:top !important; }
  td .btn{ display:block !important; width:100% !important; margin:6px 0 !important; }

  /* Layout helpers */
  .row{ display:flex !important; flex-wrap:wrap !important; gap:10px !important; }
  .grid,.cols{ display:block !important; }

  input,select,textarea,button{ max-width:100% !important; }
  .btn{ width:100% !important; }
  .card{ margin:10px 0 !important; }
}
/* extra small phones */
@media (max-width: 560px){
  body{ font-size:14px !important; }
  .container{ padding:8px !important; }
  .kpi{ grid-template-columns:1fr !important; }
  .actions{ flex-wrap:wrap !important; gap:8px !important; }
}
`;

const ADMIN_APP_JS = String.raw`// @ts-nocheck
(() => {
  const $ = (q, el) => (el || document).querySelector(q);
  const $$ = (q, el) => Array.from((el || document).querySelectorAll(q));

  const root = document.getElementById("root");

  const store = {
    webToken: "",
    role: "user",
    branding: { title: "IQ Market", tagline: "", presentation: "" },
    bootstrap: null,
    view: "dashboard",
    loading: false,
    cache: {
      payments: null,
      withdrawals: null,
      tickets: null,
      users: null,
    },
  };

  function qsParam(name){
    try{
      const u = new URL(location.href);
      return (u.searchParams.get(name) || "").trim();
    }catch{ return ""; }
  }

  function stripTokenFromUrl(){
    try{
      const u = new URL(location.href);
      ["access","webToken","token"].forEach((k)=>u.searchParams.delete(k));
      history.replaceState({}, "", u.toString());
    }catch{}
  }

  function setToken(tok){
    store.webToken = String(tok || "").trim();
    try{
      if (store.webToken) localStorage.setItem("iq_admin_webToken", store.webToken);
      else localStorage.removeItem("iq_admin_webToken");
    }catch{}
  }

  function getToken(){
    if (store.webToken) return store.webToken;
    try{
      const t = localStorage.getItem("iq_admin_webToken");
      if (t) store.webToken = String(t).trim();
    }catch{}
    return store.webToken;
  }

  function esc(s){
    return String(s == null ? "" : s)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#39;");
  }

  function shortHash(h, head=6, tail=4){
    const s = String(h||"");
    const hN = Math.max(1, Number(head||6));
    const tN = Math.max(1, Number(tail||4));
    if (s.length <= (hN + tN + 1)) return s;
    return s.slice(0, hN) + "…" + s.slice(-tN);
  }

  function fmt(n){
    const x = Number(n||0);
    if (!Number.isFinite(x)) return "0";
    return (Math.round(x*100)/100).toString();
  }

  function fmtDate(iso){
    const s = String(iso||"");
    if (!s) return "";
    try{
      const d = new Date(s);
      return d.toLocaleString("fa-IR");
    }catch{ return s; }
  }

  function bscTxUrl(tx){
    return "https://bscscan.com/tx/" + encodeURIComponent(String(tx||""));
  }

  function badge(status){
    const s = String(status||"pending");
    if (s === "approved") return '<span class="tag ok">تایید</span>';
    if (s === "rejected") return '<span class="tag bad">رد</span>';
    return '<span class="tag warn">در انتظار</span>';
  }

  function toast(msg){
    const holder = document.createElement("div");
    holder.className = "toast";
    holder.innerHTML = '<div class="t">' + esc(msg) + "</div>";
    document.body.appendChild(holder);
    setTimeout(()=> holder.remove(), 2600);
  }

  async function getBranding(){
    try{
      const r = await fetch("/api/public/branding");
      const j = await r.json().catch(()=>null);
      if (j && j.branding) {
        store.branding = j.branding;
        document.title = "Admin — " + (store.branding.title || "IQ Market");
      }
    }catch{}
  }

  async function api(path, body){
    const token = getToken();
    const payload = Object.assign({}, body || {}, { webToken: token });
    const r = await fetch(path, { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify(payload) });
    const j = await r.json().catch(()=>null);
    if (!r.ok || !j || j.ok === false){
      const err = (j && (j.error || j.reason)) ? (j.error || j.reason) : ("HTTP " + r.status);
      const e = new Error(err);
      e.status = r.status;
      e.payload = j;
      throw e;
    }
    return j;
  }

  function setLoading(on){
    store.loading = !!on;
    const el = $("#loadingPill");
    if (el) el.textContent = store.loading ? "در حال پردازش…" : "آماده";
  }

  function shellHtml(){
    const b = store.branding || {};
    const title = esc(b.title || "IQ Market");
    const tagline = esc(b.tagline || "");
    return ''
      + '<div class="backdrop" id="backdrop"></div>'
      + '<div class="shell">'
      + '  <aside class="side">'
      + '    <div class="brand">'
      + '      <img src="/admin/logo" alt="logo" />'
      + '      <div>'
      + '        <div class="t">' + title + '</div>'
      + '        <div class="s">' + tagline + '</div>'
      + '      </div>'
      + '    </div>'
      + '    <div class="nav">'
      + navBtn("dashboard","داشبورد")
      + navBtn("users","کاربران")
      + navBtn("points","امتیاز")
      + navBtn("payments","پرداخت‌ها")
      + navBtn("withdrawals","برداشت‌ها")
      + navBtn("tickets","تیکت‌ها")
      + navBtn("settings","تنظیمات")
      + navBtn("branding","برندینگ")
      + navBtn("tools","ابزارها")
      + '    </div>'
      + '  </aside>'
      + '  <main class="main">'
      + '    <div class="topbar">'
      + '      <button class="btn ghost" id="menuBtn" title="Menu" aria-label="Menu">☰</button>'
      + '      <div class="pill" id="rolePill">نقش: ' + esc(store.role || "user") + '</div>'
      + '      <div class="pill" id="loadingPill">آماده</div>'
      + '      <div class="grow"></div>'
      + '      <button class="btn" id="logoutBtn">خروج</button>'
      + '    </div>'
      + '    <div id="view"></div>'
      + '  </main>'
      + '</div>';
  }

  function navBtn(id, label){
    const active = store.view === id ? " active" : "";
    let badgeTxt = "";
    if (id === "payments" && store.bootstrap && store.bootstrap.payments){
      const p = store.bootstrap.payments.filter(x=>String(x.status||"pending")==="pending").length;
      if (p) badgeTxt = '<span class="badge">'+p+'</span>';
    }
    if (id === "withdrawals" && store.bootstrap && store.bootstrap.withdrawals){
      const w = store.bootstrap.withdrawals.filter(x=>String(x.status||"pending")==="pending").length;
      if (w) badgeTxt = '<span class="badge">'+w+'</span>';
    }
    if (id === "tickets" && store.bootstrap && store.bootstrap.tickets){
      const t = store.bootstrap.tickets.filter(x=>String(x.status||"open")!=="closed").length;
      if (t) badgeTxt = '<span class="badge">'+t+'</span>';
    }
    const ownerOnly = (id === "settings" || id === "branding");
    if (ownerOnly && store.role !== "owner") return "";
    return '<button class="tab'+active+'" data-tab="'+id+'"><span>'+esc(label)+'</span>'+badgeTxt+'</button>';
  }

  function loginHtml(){
    return ''
      + '<div class="grid">'
      + '  <div class="card" style="grid-column:span 12">'
      + '    <div class="hd"><h3>ورود پنل ادمین</h3><span class="muted">WEB_ADMIN_TOKEN یا WEB_OWNER_TOKEN</span></div>'
      + '    <div class="bd">'
      + '      <div class="row">'
      + '        <input id="tokInput" class="input mono" placeholder="توکن را وارد کنید" />'
      + '        <button id="loginBtn" class="btn primary">ورود</button>'
      + '      </div>'
      + '      <div class="sep"></div>'
      + '      <div class="muted">لینک سریع: /admin?access=YOUR_TOKEN</div>'
      + '    </div>'
      + '  </div>'
      + '</div>';
  }

  function render(){
    if (!getToken()){
      root.innerHTML = loginHtml();
      $("#loginBtn").onclick = async () => {
        const t = ($("#tokInput").value || "").trim();
        if (!t) return toast("توکن را وارد کنید");
        setToken(t);
        await boot();
      };
      return;
    }

    root.innerHTML = shellHtml();

    const closeSide = ()=> document.body.classList.remove("side-open");
    const menuBtn = $("#menuBtn");
    const backdrop = $("#backdrop");
    if (menuBtn) menuBtn.onclick = ()=> document.body.classList.toggle("side-open");
    if (backdrop) backdrop.onclick = closeSide;

    $("#logoutBtn").onclick = () => {
      setToken("");
      store.bootstrap = null;
      store.view = "dashboard";
      document.body.classList.remove("side-open");
      render();
    };

    $$(".tab").forEach((b)=>{
      b.addEventListener("click", async () => {
        const id = b.getAttribute("data-tab");
        if (!id) return;
        store.view = id;
        closeSide();
        render(); // re-render nav active state
        await renderView();
      });
    });

    renderView().catch(()=>{});
  }

  function card(title, bodyHtml){
    return ''
      + '<div class="card">'
      + '  <div class="hd"><h3>'+esc(title)+'</h3></div>'
      + '  <div class="bd">'+bodyHtml+'</div>'
      + '</div>';
  }

  async function ensureBootstrap(){
    if (store.bootstrap) return store.bootstrap;
    setLoading(true);
    try{
      const j = await api("/api/admin/bootstrap", {});
      store.bootstrap = j;
      store.role = (j.role || j.roleHint || (j.isOwner ? "owner" : (j.isAdmin ? "admin" : "admin")) || "admin");
      const pill = $("#rolePill");
      if (pill) pill.textContent = "نقش: " + (store.role || "admin");
      return store.bootstrap;
    } finally {
      setLoading(false);
    }
  }

  function kpi(label, value, hint){
    return ''
      + '<div class="kpi">'
      + '  <div class="muted">'+esc(label)+'</div>'
      + '  <div class="v">'+esc(value)+'</div>'
      + '  <div class="muted">'+esc(hint||"")+'</div>'
      + '</div>';
  }

  function progress(label, used, lim){
    const u = Number(used||0), l = Math.max(1, Number(lim||0));
    const p = Math.max(0, Math.min(100, Math.round((u/l)*100)));
    return ''
      + '<div>'
      + '  <div class="row" style="justify-content:space-between">'
      + '    <div class="muted">'+esc(label)+'</div>'
      + '    <div class="muted">'+esc(u)+' / '+esc(l)+'</div>'
      + '  </div>'
      + '  <div style="height:10px;border:1px solid rgba(255,255,255,.12);border-radius:999px;overflow:hidden;background:rgba(255,255,255,.03)">'
      + '    <div style="height:100%;width:'+p+'%;background:rgba(96,165,250,.55)"></div>'
      + '  </div>'
      + '</div>';
  }

  async function renderDashboard(){
    const b = await ensureBootstrap();
    const payments = (b.payments || []).slice(0, 12);
    const withdrawals = (b.withdrawals || []).slice(0, 12);
    const tickets = (b.tickets || []).slice(0, 12);

    const pendingP = payments.filter(x=>String(x.status||"pending")==="pending").length;
    const pendingW = withdrawals.filter(x=>String(x.status||"pending")==="pending").length;
    const openT = tickets.filter(x=>String(x.status||"open")!=="closed").length;

    let html = ''
      + '<div class="grid">'
      + '  <div class="card" style="grid-column:span 12">'
      + '    <div class="hd"><h3>خلاصه</h3><span class="muted">آخرین وضعیت سیستم</span></div>'
      + '    <div class="bd">'
      + '      <div class="kpis">'
      + kpi("پرداخت‌های در انتظار", String(pendingP), "نیاز به بررسی")
      + kpi("برداشت‌های در انتظار", String(pendingW), "نیاز به بررسی")
      + kpi("تیکت‌های باز", String(openT), "پشتیبانی")
      + kpi("Provider اسکن", esc((b.scanProvider || "") || "auto"), "BEP20")
      + '      </div>'
      + '    </div>'
      + '  </div>'
      + '</div>';

    $("#view").innerHTML = html;
  }

  async function fetchUsers(q){
    if (q && q.trim()){
      const j = await api("/api/admin/users/search", { q: q.trim(), limit: 25 });
      return j.users || [];
    }
    const j = await api("/api/admin/users", { limit: 50, page: 0, sort: "recent" });
    return j.users || [];
  }

  function usersTable(users){
    let rows = "";
    users.forEach((u)=>{
      rows += ''
        + '<tr class="click" data-uid="'+esc(u.userId)+'" data-un="'+esc(u.username||"")+'">'
        + '  <td class="mono">'+esc(u.userId)+'</td>'
        + '  <td>'+esc(u.username||"")+'</td>'
        + '  <td>'+esc(u.points||0)+'</td>'
        + '  <td>'+esc(u.subscriptionActive ? "✅" : "—")+'</td>'
        + '  <td>'+esc(u.dailyUsed||0)+' / '+esc(u.dailyLimit||0)+'</td>'
        + '  <td class="muted">'+esc(u.lastAnalysisAt||"")+'</td>'
        + '</tr>';
    });
    return ''
      + '<table class="table">'
      + '  <thead><tr><th>UID</th><th>یوزرنیم</th><th>امتیاز</th><th>اشتراک</th><th>مصرف روزانه</th><th>آخرین تحلیل</th></tr></thead>'
      + '  <tbody>'+rows+'</tbody>'
      + '</table>';
  }

  function modalHtml(title, inner){
    return ''
      + '<div id="modal" style="position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:flex-start;justify-content:center;padding:22px;z-index:50;">'
      + '  <div class="card" style="max-width:980px;width:100%;max-height:90vh;overflow:auto;">'
      + '    <div class="hd"><h3>'+esc(title)+'</h3><button class="btn" id="closeModal">بستن</button></div>'
      + '    <div class="bd">'+inner+'</div>'
      + '  </div>'
      + '</div>';
  }

  function closeModal(){
    const m = $("#modal");
    if (m) m.remove();
  }

  function buildUserCards(summary){
    const sub = summary.subscription || {};
    const fin = summary.finance || {};
    const ref = summary.referral || {};
    const usage = summary.usage || {};
    const subTag = sub.active ? '<span class="tag ok">اشتراک فعال</span>' : '<span class="tag warn">Free</span>';

    return ''
      + '<div class="grid">'
      + '  <div class="card" style="grid-column:span 12">'
      + '    <div class="hd"><h3>نمای کلی</h3><span>'+subTag+'</span></div>'
      + '    <div class="bd">'
      + '      <div class="kpis" style="grid-template-columns:repeat(4,1fr)">'
      + kpi("یوزر", esc(summary.username||""), "UID: " + esc(summary.userId))
      + kpi("امتیاز", esc(summary.points.balance), "Spent: " + esc(summary.points.spent))
      + kpi("پرداخت‌ها", esc(fin.payments.total), "Count: " + esc(fin.payments.count))
      + kpi("تحلیل‌ها", esc(summary.totalAnalyses||0), "Last: " + esc(summary.lastAnalysisAt||""))
      + '      </div>'
      + '      <div class="sep"></div>'
      + progress("مصرف روزانه", usage.dailyUsed||0, usage.dailyLimit||0)
      + '      <div class="sep"></div>'
      + '      <div class="row">'
      + '        <div class="pill">Plan: '+esc(sub.plan||sub.type||"free")+'</div>'
      + '        <div class="pill">Expires: '+esc(sub.expiresAt||"")+'</div>'
      + '        <div class="pill">Referral: '+esc(ref.code||"—")+'</div>'
      + '        <div class="pill">Invites: '+esc(ref.successfulInvites||0)+'</div>'
      + '      </div>'
      + '    </div>'
      + '  </div>'
      + '</div>';
  }

  async function openUserReport(uid, username){
    setLoading(true);
    try{
      const j = await api("/api/admin/users/report", { userId: uid, username: username });
      const s = j.summary || {};
      let inner = '';
      inner += buildUserCards(s);

      inner += '<div class="sep"></div>';

      // Payments list mini
      const pays = (j.payments || []).slice(0, 20);
      let pRows = "";
      pays.forEach((p)=>{
        pRows += '<tr>'
          + '<td>'+badge(p.status)+'</td>'
          + '<td class="mono"><a href="'+bscTxUrl(p.txHash||"")+'" target="_blank">'+esc(shortHash(p.txHash||""))+'</a></td>'
          + '<td>'+esc(p.planId||p.plan||"")+'</td>'
          + '<td>'+esc(fmt(p.amount||0))+'</td>'
          + '<td class="muted">'+esc(fmtDate(p.createdAt||""))+'</td>'
          + '</tr>';
      });
      inner += card("پرداخت‌های اخیر", ''
        + '<table class="table"><thead><tr><th>وضعیت</th><th>Tx</th><th>پلن</th><th>مبلغ</th><th>زمان</th></tr></thead><tbody>'
        + (pRows || '<tr><td colspan="5" class="muted">پرداختی ثبت نشده</td></tr>')
        + '</tbody></table>'
      );

      // Withdrawals mini
      const wds = (j.withdrawals || []).slice(0, 20);
      let wRows = "";
      wds.forEach((w)=>{
        wRows += '<tr>'
          + '<td>'+badge(w.status)+'</td>'
          + '<td class="mono">'+esc(shortHash(w.address||""))+'</td>'
          + '<td>'+esc(fmt(w.amount||0))+'</td>'
          + '<td class="muted">'+esc(fmtDate(w.createdAt||""))+'</td>'
          + '</tr>';
      });
      inner += card("برداشت‌های اخیر", ''
        + '<table class="table"><thead><tr><th>وضعیت</th><th>آدرس</th><th>مبلغ</th><th>زمان</th></tr></thead><tbody>'
        + (wRows || '<tr><td colspan="4" class="muted">برداشتی ثبت نشده</td></tr>')
        + '</tbody></table>'
      );

      // Tickets mini
      const tks = (j.tickets || []).slice(0, 20);
      let tRows = "";
      tks.forEach((t)=>{
        tRows += '<tr>'
          + '<td>'+esc(t.status||"open")+'</td>'
          + '<td>'+esc((t.subject||"").slice(0,40))+'</td>'
          + '<td class="muted">'+esc(fmtDate(t.createdAt||""))+'</td>'
          + '</tr>';
      });
      inner += card("تیکت‌ها", ''
        + '<table class="table"><thead><tr><th>وضعیت</th><th>موضوع</th><th>زمان</th></tr></thead><tbody>'
        + (tRows || '<tr><td colspan="3" class="muted">تیکتی نیست</td></tr>')
        + '</tbody></table>'
      );

      inner += '<div class="sep"></div>';
      inner += '<details><summary>Raw JSON (State + Lists)</summary><pre class="mono small" style="white-space:pre-wrap">'+esc(JSON.stringify(j, null, 2))+'</pre></details>';

      document.body.insertAdjacentHTML("beforeend", modalHtml("گزارش کاربر: " + (s.username || uid), inner));
      $("#closeModal").onclick = closeModal;
      $("#modal").addEventListener("click", (ev)=>{ if (ev.target && ev.target.id==="modal") closeModal(); });

    } finally {
      setLoading(false);
    }
  }

  async function renderUsers(){
    let html = ''
      + '<div class="grid">'
      + '  <div class="card" style="grid-column:span 12">'
      + '    <div class="hd"><h3>کاربران</h3><span class="muted">جستجو و گزارش کامل</span></div>'
      + '    <div class="bd">'
      + '      <div class="row">'
      + '        <input id="userQ" class="input" placeholder="جستجو: username / phone / id" />'
      + '        <button class="btn primary" id="userSearchBtn">جستجو</button>'
      + '        <button class="btn" id="userReloadBtn">ریفرش</button>'
      + '      </div>'
      + '      <div class="sep"></div>'
      + '      <div id="usersTableWrap" class="muted">در حال بارگذاری…</div>'
      + '    </div>'
      + '  </div>'
      + '</div>';

    $("#view").innerHTML = html;

    async function load(q){
      setLoading(true);
      try{
        const users = await fetchUsers(q||"");
        $("#usersTableWrap").innerHTML = usersTable(users);
        $$("#usersTableWrap tbody tr").forEach((tr)=>{
          tr.addEventListener("click", async () => {
            const uid = tr.getAttribute("data-uid");
            const un = tr.getAttribute("data-un");
            await openUserReport(uid, un);
          });
        });
      } catch(e){
        $("#usersTableWrap").innerHTML = '<div class="muted">خطا: '+esc(e.message||e)+'</div>';
      } finally { setLoading(false); }
    }

    $("#userSearchBtn").onclick = () => load($("#userQ").value || "");
    $("#userReloadBtn").onclick = () => load("");
    await load("");
  }

  async function renderPayments(){
    const b = await ensureBootstrap();
    const items = (b.payments || []);
    let rows = "";
    items.forEach((p, i)=>{
      const tx = p.txHash || "";
      const id = p.id || p.paymentId || String(i);
      rows += ''
        + '<tr>'
        + '  <td>'+badge(p.status)+'</td>'
        + '  <td>'+esc(p.username||"")+'</td>'
        + '  <td>'+esc(p.planId||p.plan||"")+'</td>'
        + '  <td>'+esc(fmt(p.amount||0))+'</td>'
        + '  <td class="mono"><a target="_blank" href="'+bscTxUrl(tx)+'">'+esc(shortHash(tx))+'</a></td>'
        + '  <td class="muted">'+esc(fmtDate(p.createdAt||""))+'</td>'
        + '  <td>'
        + '    <button class="btn" data-scan="'+esc(tx)+'" data-amt="'+esc(p.amount||0)+'">Scan</button>'
        + '    <button class="btn ok" data-appr="'+esc(id)+'">تایید</button>'
        + '    <button class="btn danger" data-rej="'+esc(id)+'">رد</button>'
        + '  </td>'
        + '</tr>'
        + '<tr><td colspan="7"><div id="scan_'+esc(id)+'" class="muted"></div></td></tr>';
    });

    const html = card("پرداخت‌ها", ''
      + '<div class="muted">روی Scan بزن تا گزارش کامل تراکنش (Receipt/Transfers/Raw) نمایش داده شود.</div>'
      + '<div class="sep"></div>'
      + '<table class="table"><thead><tr><th>وضعیت</th><th>یوزر</th><th>پلن</th><th>مبلغ</th><th>Tx</th><th>زمان</th><th>اکشن</th></tr></thead>'
      + '<tbody>' + (rows || '<tr><td colspan="7" class="muted">موردی نیست</td></tr>') + '</tbody></table>'
    );
    $("#view").innerHTML = '<div class="grid"><div style="grid-column:span 12">'+html+'</div></div>';

    // wire buttons
    $$("[data-scan]").forEach((btn)=>{
      btn.addEventListener("click", async ()=>{
        const tx = btn.getAttribute("data-scan");
        const amt = Number(btn.getAttribute("data-amt")||0);
        if (!tx) return;
        setLoading(true);
        try{
          const j = await api("/api/admin/payments/check", { txHash: tx, amount: amt });
          const rep = j.check || j.result || j;
          const verdict = rep.ok ? '<span class="tag ok">✅ قابل تایید</span>' : '<span class="tag bad">❌ مشکل</span>';
          const diff = (Number(rep.amount||0) - Number(rep.expected||0));
          const diffTxt = Number.isFinite(diff) ? fmt(diff) : "—";
          let transfersHtml = "";
          try{
            const matches = (rep.report && rep.report.matches) ? rep.report.matches : [];
            if (matches && matches.length){
              let trs = "";
              let total = 0;
              matches.forEach((m)=>{
                const a = Number(m.amount||0);
                total += (Number.isFinite(a)?a:0);
              });
              matches.forEach((m)=>{
                const a = Number(m.amount||0);
                const share = total>0 && Number.isFinite(a) ? Math.round((a/total)*100) : 0;
                trs += '<tr>'
                  + '<td class="mono">'+esc(shortHash(m.from||""))+'</td>'
                  + '<td class="mono">'+esc(shortHash(m.to||""))+'</td>'
                  + '<td>'+esc(fmt(a))+'</td>'
                  + '<td class="muted">'+esc(share)+'%</td>'
                  + '</tr>';
              });
              transfersHtml = ''
                + '<div class="sep"></div>'
                + '<div class="row">'
                + '  <div class="pill">Transfers: '+esc(matches.length)+'</div>'
                + '  <div class="pill">Total: '+esc(fmt(total))+'</div>'
                + '</div>'
                + '<table class="table"><thead><tr><th>From</th><th>To</th><th>Amount</th><th>Share</th></tr></thead><tbody>'+trs+'</tbody></table>';
            }
          }catch{}

          const out = ''
            + '<div class="row">'
            + '  '+verdict
            + '  <span class="pill">Provider: '+esc(rep.provider||"")+'</span>'
            + '  <span class="pill">Expected: '+esc(fmt(rep.expected||0))+'</span>'
            + '  <span class="pill">Received: '+esc(fmt(rep.amount||0))+'</span>'
            + '  <span class="pill">Δ: '+esc(diffTxt)+'</span>'
            + '</div>'
            + transfersHtml
            + '<div class="sep"></div>'
            + '<details><summary>Raw JSON</summary><pre class="mono small" style="white-space:pre-wrap">'+esc(JSON.stringify(rep, null, 2))+'</pre></details>';

          // find scan row container
          const tr = btn.closest("tr");
          const next = tr ? tr.nextElementSibling : null;
          if (next){
            const holder = next.querySelector("div[id^='scan_']");
            if (holder) holder.innerHTML = out;
          }
        } catch(e){
          toast("Scan خطا: " + (e.message||e));
        } finally {
          setLoading(false);
        }
      });
    });

    $$("[data-appr]").forEach((btn)=>{
      btn.addEventListener("click", async ()=>{
        const id = btn.getAttribute("data-appr");
        if (!id) return;
        setLoading(true);
        try{
          await api("/api/admin/payments/decision", { paymentId: id, status: "approved" });
          toast("تایید شد");
          store.bootstrap = null;
          await renderPayments();
        } catch(e){ toast("خطا: "+(e.message||e)); } finally { setLoading(false); }
      });
    });

    $$("[data-rej]").forEach((btn)=>{
      btn.addEventListener("click", async ()=>{
        const id = btn.getAttribute("data-rej");
        if (!id) return;
        setLoading(true);
        try{
          await api("/api/admin/payments/decision", { paymentId: id, status: "rejected" });
          toast("رد شد");
          store.bootstrap = null;
          await renderPayments();
        } catch(e){ toast("خطا: "+(e.message||e)); } finally { setLoading(false); }
      });
    });
  }

  async function renderWithdrawals(){
    const b = await ensureBootstrap();
    const items = (b.withdrawals || []);
    let rows = "";
    items.forEach((w, i)=>{
      const id = w.id || String(i);
      rows += ''
        + '<tr>'
        + '  <td>'+badge(w.status)+'</td>'
        + '  <td>'+esc(w.username||"")+'</td>'
        + '  <td class="mono">'+esc(shortHash(w.address||""))+'</td>'
        + '  <td>'+esc(fmt(w.amount||0))+'</td>'
        + '  <td class="muted">'+esc(fmtDate(w.createdAt||""))+'</td>'
        + '  <td>'
        + '    <button class="btn ok" data-wap="'+esc(id)+'">تایید</button>'
        + '    <button class="btn danger" data-wrj="'+esc(id)+'">رد</button>'
        + '  </td>'
        + '</tr>';
    });

    $("#view").innerHTML = '<div class="grid"><div style="grid-column:span 12">'
      + card("برداشت‌ها", ''
        + '<table class="table"><thead><tr><th>وضعیت</th><th>یوزر</th><th>آدرس</th><th>مبلغ</th><th>زمان</th><th>اکشن</th></tr></thead>'
        + '<tbody>' + (rows || '<tr><td colspan="6" class="muted">موردی نیست</td></tr>') + '</tbody></table>'
      )
      + '</div></div>';

    $$("[data-wap]").forEach((btn)=>{
      btn.addEventListener("click", async ()=>{
        const id = btn.getAttribute("data-wap");
        if (!id) return;
        setLoading(true);
        try{
          await api("/api/admin/withdrawals/review", { id, decision: "approved" });
          toast("تایید شد");
          store.bootstrap = null;
          await renderWithdrawals();
        } catch(e){ toast("خطا: "+(e.message||e)); } finally { setLoading(false); }
      });
    });
    $$("[data-wrj]").forEach((btn)=>{
      btn.addEventListener("click", async ()=>{
        const id = btn.getAttribute("data-wrj");
        if (!id) return;
        setLoading(true);
        try{
          await api("/api/admin/withdrawals/review", { id, decision: "rejected" });
          toast("رد شد");
          store.bootstrap = null;
          await renderWithdrawals();
        } catch(e){ toast("خطا: "+(e.message||e)); } finally { setLoading(false); }
      });
    });
  }

  async function renderTickets(){
    const b = await ensureBootstrap();
    const items = Array.isArray(b.tickets) ? b.tickets : [];

    // pending first, then newest
    items.sort((x,y)=>{
      const xs = String(x.status||"pending")==="pending" ? 0 : 1;
      const ys = String(y.status||"pending")==="pending" ? 0 : 1;
      if (xs !== ys) return xs - ys;
      return String(y.createdAt||"").localeCompare(String(x.createdAt||""));
    });

    const cssEsc = (window.CSS && CSS.escape) ? CSS.escape : (s)=> String(s).replace(/[^a-zA-Z0-9_-]/g, (m)=>'\\'+m);

    const tBadge = (st)=>{
      const s = String(st||"pending");
      if (s === "answered") return '<span class="tag ok">پاسخ داده شد</span>';
      if (s === "closed") return '<span class="tag bad">بسته</span>';
      return '<span class="tag warn">در انتظار</span>';
    };

    const opt = (v, cur)=> '<option value="'+esc(v)+'"'+(String(cur)===String(v)?' selected':'')+'>'+esc(v)+'</option>';

    let list = '';
    items.forEach((t)=>{
      const id = String(t.id||"");
      const who = t.username ? ("@"+String(t.username).replace(/^@/,"")) : String(t.userId||"");
      const kind = String(t.kind||"general");
      const txt = String(t.text||"");
      const phone = String(t.phone||"");
      const st = String(t.status||"pending");
      const reply = String(t.reply||"");
      const created = fmtDate(t.createdAt||"");
      const updated = t.updatedAt ? fmtDate(t.updatedAt) : "";

      list += ''
        + '<details class="tkItem">'
        +   '<summary class="tkSum">'
        +     '<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">'
        +        tBadge(st)
        +       '<span class="pill mono small">'+esc(shortHash(id, 10, 6))+'</span>'
        +       '<span class="pill small">'+esc(kind)+'</span>'
        +       '<span class="muted small">'+esc(who)+'</span>'
        +       '<span class="muted small">'+esc(created)+'</span>'
        +     '</div>'
        +     '<div class="tkPreview">'+esc(txt.slice(0,140))+'</div>'
        +   '</summary>'
        +   '<div class="tkBody">'
        +     '<div class="kvs">'
        +       '<div class="kv"><div class="k">ID</div><div class="v mono">'+esc(id)+'</div></div>'
        +       '<div class="kv"><div class="k">User</div><div class="v">'+esc(who)+'</div></div>'
        +       '<div class="kv"><div class="k">Phone</div><div class="v mono">'+esc(phone||"-")+'</div></div>'
        +       '<div class="kv"><div class="k">Updated</div><div class="v">'+esc(updated||"-")+'</div></div>'
        +     '</div>'
        +     '<div class="sep"></div>'
        +     '<div class="muted">متن:</div>'
        +     '<pre class="mono preWrap">'+esc(txt)+'</pre>'
        +     '<div class="sep"></div>'
        +     '<div class="muted">پاسخ:</div>'
        +     '<textarea class="input" rows="5" data-tk-reply="'+esc(id)+'">'+esc(reply)+'</textarea>'
        +     '<div class="row" style="margin-top:10px;gap:10px;flex-wrap:wrap;align-items:center">'
        +       '<select class="input" style="min-width:160px" data-tk-status="'+esc(id)+'">'
        +         opt("pending", st)
        +         opt("answered", st)
        +         opt("closed", st)
        +       '</select>'
        +       '<button class="btn primary" data-tk-act="save" data-id="'+esc(id)+'">ذخیره/ارسال</button>'
        +       '<button class="btn danger" data-tk-act="close" data-id="'+esc(id)+'">بستن</button>'
        +     '</div>'
        +     (t.updatedBy ? ('<div class="muted small" style="margin-top:8px">Updated by: '+esc(t.updatedBy)+'</div>') : '')
        +   '</div>'
        + '</details>';
    });

    $("#view").innerHTML = '<div class="grid"><div style="grid-column:span 12">'
      + card("تیکت‌ها", ''
        + '<div class="row" style="justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">'
        + '  <div class="muted">برای پاسخ، تیکت را باز کنید و متن را ارسال کنید (به تلگرام کاربر پیام می‌شود).</div>'
        + '  <button class="btn" id="tkRefreshBtn">به‌روزرسانی</button>'
        + '</div>'
        + '<div class="sep"></div>'
        + '<div id="ticketsWrap">' + (list || '<div class="muted">موردی نیست.</div>') + '</div>'
      )
      + '</div></div>';

    const refreshBtn = $("#tkRefreshBtn");
    if (refreshBtn) refreshBtn.onclick = async ()=>{
      refreshBtn.disabled = true;
      try{
        store.bootstrap = null;
        await ensureBootstrap();
        await renderTickets();
      } finally {
        refreshBtn.disabled = false;
      }
    };

    const wrap = $("#ticketsWrap");
    if (!wrap) return;
    wrap.onclick = async (e)=>{
      const btn = e.target && e.target.closest ? e.target.closest("button[data-tk-act]") : null;
      if (!btn) return;
      const act = btn.getAttribute("data-tk-act");
      const id  = btn.getAttribute("data-id");
      if (!act || !id) return;

      const repEl = wrap.querySelector('textarea[data-tk-reply="'+cssEsc(id)+'"]');
      const stEl  = wrap.querySelector('select[data-tk-status="'+cssEsc(id)+'"]');
      const reply = String(repEl && repEl.value ? repEl.value : "").trim();
      let status  = String(stEl && stEl.value ? stEl.value : "pending");
      if (act === "close") status = "closed";

      btn.disabled = true;
      setLoading(true);
      try{
        await api("/api/admin/tickets/update", { id, status, reply });
        toast("ثبت شد");
        store.bootstrap = null;
        await ensureBootstrap();
        await renderTickets();
      } catch(e2){
        toast("خطا: " + (e2.message || e2));
      } finally {
        setLoading(false);
        btn.disabled = false;
      }
    };
  }


  async function renderSettings(){
    const b = await ensureBootstrap();
    if (store.role !== "owner"){
      $("#view").innerHTML = '<div class="grid"><div class="card" style="grid-column:span 12"><div class="hd"><h3>تنظیمات</h3></div><div class="bd"><div class="muted">فقط Owner دسترسی دارد.</div></div></div></div>';
      return;
    }

    const wallet = esc(b.wallet || "");
    const plans = esc(JSON.stringify(b.plans || [], null, 2));
    const basePoints = esc(String(b.basePoints || ""));
    const freeLimit = esc(String(b.freeDailyLimit || ""));

    $("#view").innerHTML = '<div class="grid">'
      + '<div class="card" style="grid-column:span 12"><div class="hd"><h3>تنظیمات Owner</h3></div><div class="bd">'
      + '<div class="row"><div class="pill">Wallet</div></div>'
      + '<textarea id="walletInp" class="input mono" style="height:70px">'+wallet+'</textarea>'
      + '<div class="row" style="margin-top:10px"><button class="btn primary" id="saveWalletBtn">ذخیره Wallet</button></div>'
      + '<div class="sep"></div>'
      + '<div class="row"><div class="pill">Plans (JSON)</div></div>'
      + '<textarea id="plansInp" class="input mono" style="height:220px">'+plans+'</textarea>'
      + '<div class="row" style="margin-top:10px"><button class="btn primary" id="savePlansBtn">ذخیره Plans</button></div>'
      + '<div class="sep"></div>'
      + '<div class="row" style="gap:12px;align-items:flex-start">'
      + '  <div style="flex:1">'
      + '    <div class="pill">Base Points</div>'
      + '    <input id="basePointsInp" class="input" value="'+basePoints+'" />'
      + '  </div>'
      + '  <div style="flex:1">'
      + '    <div class="pill">Free Daily Limit</div>'
      + '    <input id="freeLimitInp" class="input" value="'+freeLimit+'" />'
      + '  </div>'
      + '</div>'
      + '<div class="row" style="margin-top:10px"><button class="btn primary" id="saveLimitsBtn">ذخیره</button></div>'
      + '</div></div>'
      + '</div>';

    $("#saveWalletBtn").onclick = async ()=>{
      setLoading(true);
      try{
        await api("/api/admin/wallet", { wallet: ($("#walletInp").value||"").trim() });
        toast("ذخیره شد");
        store.bootstrap = null;
      } catch(e){ toast("خطا: "+(e.message||e)); } finally { setLoading(false); }
    };

    $("#savePlansBtn").onclick = async ()=>{
      setLoading(true);
      try{
        const raw = ($("#plansInp").value||"").trim();
        const parsed = raw ? JSON.parse(raw) : [];
        await api("/api/admin/subscription/plans", { plans: parsed });
        toast("ذخیره شد");
        store.bootstrap = null;
      } catch(e){ toast("خطا: "+(e.message||e)); } finally { setLoading(false); }
    };

    $("#saveLimitsBtn").onclick = async ()=>{
      setLoading(true);
      try{
        const bp = Number($("#basePointsInp").value||0);
        const fl = Number($("#freeLimitInp").value||0);
        await api("/api/admin/points/base", { basePoints: bp });
        await api("/api/admin/free-limit", { freeDailyLimit: fl });
        toast("ذخیره شد");
        store.bootstrap = null;
      } catch(e){ toast("خطا: "+(e.message||e)); } finally { setLoading(false); }
    };
  }

  async function renderBranding(){
    if (store.role !== "owner"){
      $("#view").innerHTML = '<div class="grid"><div class="card" style="grid-column:span 12"><div class="hd"><h3>برندینگ</h3></div><div class="bd"><div class="muted">فقط Owner دسترسی دارد.</div></div></div></div>';
      return;
    }

    const b = store.branding || {};
    $("#view").innerHTML = '<div class="grid"><div class="card" style="grid-column:span 12">'
      + '<div class="hd"><h3>برندینگ</h3><span class="muted">تغییر لوگو و متن پرزنت</span></div>'
      + '<div class="bd">'
      + '<div class="row" style="gap:12px;align-items:flex-start">'
      + '  <div style="flex:1"><div class="pill">Title</div><input id="brTitle" class="input" value="'+esc(b.title||"")+'" /></div>'
      + '  <div style="flex:1"><div class="pill">Tagline</div><input id="brTag" class="input" value="'+esc(b.tagline||"")+'" /></div>'
      + '</div>'
      + '<div class="sep"></div>'
      + '<div class="pill">Presentation</div>'
      + '<textarea id="brPres" class="input" style="height:140px">'+esc(b.presentation||"")+'</textarea>'
      + '<div class="sep"></div>'
      + '<div class="pill">Logo SVG</div>'
      + '<textarea id="brLogo" class="input mono" style="height:180px" placeholder="<svg ...>"></textarea>'
      + '<div class="row" style="margin-top:10px">'
      + '  <button class="btn primary" id="saveBrandBtn">ذخیره</button>'
      + '  <button class="btn danger" id="clearLogoBtn">حذف لوگو KV</button>'
      + '</div>'
      + '<div class="sep"></div>'
      + '<div class="muted">نکته: لوگوی KV روی /web/logo و /admin/logo اعمال می‌شود.</div>'
      + '</div></div></div></div>';

    $("#saveBrandBtn").onclick = async ()=>{
      setLoading(true);
      try{
        const payload = {
          title: ($("#brTitle").value||"").trim(),
          tagline: ($("#brTag").value||"").trim(),
          presentation: ($("#brPres").value||"").trim(),
          logoSvg: ($("#brLogo").value||"").trim(),
        };
        const j = await api("/api/admin/branding/set", payload);
        store.branding = j.branding || store.branding;
        toast("ذخیره شد");
        await getBranding();
        render();
      } catch(e){ toast("خطا: "+(e.message||e)); } finally { setLoading(false); }
    };

    $("#clearLogoBtn").onclick = async ()=>{
      setLoading(true);
      try{
        const j = await api("/api/admin/branding/set", { logoSvg: "" });
        store.branding = j.branding || store.branding;
        toast("لوگو پاک شد");
        await getBranding();
        render();
      } catch(e){ toast("خطا: "+(e.message||e)); } finally { setLoading(false); }
    };
  }


  async function renderPoints(){
    $("#view").innerHTML = '<div class="grid">'
      + '<div class="card" style="grid-column:span 12">'
      + '  <div class="hd"><h3>امتیاز کاربران</h3><span class="muted">شارژ/کاهش امتیاز</span></div>'
      + '  <div class="bd">'
      + '    <div class="row" style="gap:10px;align-items:flex-end">'
      + '      <div style="flex:1;min-width:240px"><div class="pill">کاربر</div><input id="ptUser" class="input" placeholder="آیدی عددی یا @username" /></div>'
      + '      <div style="width:180px"><div class="pill">مقدار</div><input id="ptAmt" class="input" placeholder="مثلاً 50 یا -20" /></div>'
      + '      <div style="flex:1;min-width:240px"><div class="pill">توضیح</div><input id="ptNote" class="input" placeholder="اختیاری" /></div>'
      + '      <button class="btn primary" id="ptSubmit">ثبت</button>'
      + '    </div>'
      + '    <div class="sep"></div>'
      + '    <div class="muted" style="line-height:1.8">برای کم‌کردن امتیاز، مقدار منفی وارد کن (مثلاً -20).</div>'
      + '    <div class="sep"></div>'
      + '    <div class="row" style="gap:10px;flex-wrap:wrap">'
      + '      <button class="btn" data-amt="50">+50</button>'
      + '      <button class="btn" data-amt="100">+100</button>'
      + '      <button class="btn" data-amt="250">+250</button>'
      + '      <button class="btn" data-amt="-20">-20</button>'
      + '      <button class="btn" data-amt="-50">-50</button>'
      + '    </div>'
      + '    <div class="sep"></div>'
      + '    <div id="ptMsg" class="muted"></div>'
      + '  </div>'
      + '</div>'
      + '</div>';

    $$("#view [data-amt]").forEach(btn=>{
      btn.onclick = ()=>{ $("#ptAmt").value = btn.getAttribute("data-amt"); };
    });

    $("#ptSubmit").onclick = async ()=>{
      const targetRaw = ($("#ptUser").value||"").trim();
      const amount = Number(($("#ptAmt").value||"").trim());
      const note = ($("#ptNote").value||"").trim();
      if (!targetRaw) return toast("کاربر را وارد کنید");
      if (!Number.isFinite(amount) || amount === 0) return toast("مقدار معتبر وارد کنید");
      setLoading(true);
      try{
        let userId = null;
        let username = null;
        if (/^\d+$/.test(targetRaw)) userId = Number(targetRaw);
        else username = targetRaw.startsWith("@") ? targetRaw.slice(1) : targetRaw;
        const j = await api("/api/admin/points/credit", { userId, username, amount, note });
        $("#ptMsg").textContent = "انجام شد ✅ " + (j && j.user ? ("| " + (j.user.username||j.user.id||"")) : "");
        toast("ثبت شد");
      } catch(e){
        $("#ptMsg").textContent = "خطا: " + (e.message || e);
        toast("خطا: " + (e.message || e));
      } finally { setLoading(false); }
    };
  }

  async function renderTools(){
    $("#view").innerHTML = '<div class="grid"><div class="card" style="grid-column:span 12">'
      + '<div class="hd"><h3>ابزارها</h3></div>'
      + '<div class="bd">'
      + '<div class="row">'
      + '  <button class="btn" id="pdfBtn">گزارش PDF</button>'
      + '</div>'
      + '<div class="sep"></div>'
      + '<div class="muted">گزارش PDF برای Owner فعال است.</div>'
      + '</div></div></div></div>';

    $("#pdfBtn").onclick = async ()=>{
      try{
        // this endpoint returns PDF bytes; open in new tab
        window.open("/api/admin/report/pdf", "_blank");
      } catch(e){ toast("خطا"); }
    };
  }

  async function renderView(){
    try{
      if (store.view === "dashboard") return await renderDashboard();
      if (store.view === "users") return await renderUsers();
      if (store.view === "points") return await renderPoints();
      if (store.view === "payments") return await renderPayments();
      if (store.view === "withdrawals") return await renderWithdrawals();
      if (store.view === "tickets") return await renderTickets();
      if (store.view === "settings") return await renderSettings();
      if (store.view === "branding") return await renderBranding();
      if (store.view === "tools") return await renderTools();
      return await renderDashboard();
    } catch(e){
      if (String(e.status||"") === "401" || String(e.status||"") === "403"){
        toast("دسترسی ندارید یا توکن اشتباه است");
        setToken("");
        render();
        return;
      }
      $("#view").innerHTML = '<div class="grid"><div class="card" style="grid-column:span 12"><div class="hd"><h3>خطا</h3></div><div class="bd"><pre class="mono small" style="white-space:pre-wrap">'+esc(e.stack||e.message||e)+'</pre></div></div></div>';
    }
  }

  async function boot(){
    // URL token support
    const t = qsParam("access") || qsParam("webToken") || qsParam("token");
    if (t){
      setToken(t);
      stripTokenFromUrl();
    }
    await getBranding();
    render();
    if (getToken()){
      try{
        await ensureBootstrap();
        render(); // refresh nav badges
        await renderView();
      } catch(e){
        // token bad
      }
    }
  }

  root.innerHTML = '<div class="boot">در حال بارگذاری...</div>';
  boot();
})();`;

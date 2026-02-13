export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      env.__BASE_URL = url.origin;

      if (url.pathname === "/health") return new Response("ok", { status: 200 });

      // ===== MINI APP (inline) =====
      // Serve app.js from root and nested miniapp paths (e.g. /miniapp/app.js)
      if (request.method === "GET" && (url.pathname === "/app.js" || url.pathname.endsWith("/app.js"))) {
        return jsResponse(MINI_APP_JS);
      }
      // Serve Mini App shell on root and non-API clean paths (e.g. /miniapp)
      if (
        request.method === "GET" &&
        url.pathname !== "/health" &&
        !url.pathname.startsWith("/api/") &&
        !url.pathname.startsWith("/telegram/") &&
        !/\/[^/]+\.[^/]+$/.test(url.pathname)
      ) {
        return htmlResponse(MINI_APP_HTML);
      }

      // ===== MINI APP APIs =====

      // ===== AUTH (easy) =====
      if (url.pathname === "/api/auth/login" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

        const v = await authMiniappRequest(request, body, env);
        if (!v.ok) return jsonResponse({ ok: false, error: v.reason }, 401);

        const now = Math.floor(Date.now() / 1000);
        const maxAge = Number(env.SESSION_MAX_AGE || 7 * 24 * 3600);
        const payload = {
          uid: v.userId,
          un: v.fromLike?.username || "",
          fn: v.fromLike?.first_name || "",
          ln: v.fromLike?.last_name || "",
          iat: now,
          exp: now + maxAge,
        };

        const token = await makeSessionToken(payload, env);
        const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
        if (token) headers.set("set-cookie", setSessionCookie(token, env));

        return new Response(JSON.stringify({ ok: true, token: token || "" }), { status: 200, headers });
      }

      if (url.pathname === "/api/auth/logout" && request.method === "POST") {
        const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
        headers.set("set-cookie", clearSessionCookie());
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
      }

      if (url.pathname === "/api/user" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);
        const v = await authMiniappRequest(request, body, env);
        if (!v.ok) {
          if (miniappGuestEnabled(env)) {
            return jsonResponse(await buildMiniappGuestPayload(env));
          }
          return jsonResponse({ ok: false, error: v.reason }, 401);
        }

        const st = await ensureUser(v.userId, env);
        const quota = isStaff(v.fromLike, env) ? "∞" : `${st.dailyUsed}/${dailyLimit(env, st)}`;
        const symbols = [...MAJORS, ...METALS, ...INDICES, ...CRYPTOS];
        const styles = await getStyleList(env);
        const [offerBanner, offerBannerImage] = await Promise.all([getOfferBanner(env), getOfferBannerImage(env)]);
        const customPrompts = await getCustomPrompts(env);
        const role = isOwner(v.fromLike, env) ? "owner" : (isAdmin(v.fromLike, env) ? "admin" : "user");

        return jsonResponse({
          ok: true,
          welcome: await getMiniappWelcomeText(env),
          state: st,
          quota,
          symbols,
          styles,
          offerBanner,
          offerBannerImage,
          customPrompts,
          role,
          isStaff: role !== "user",
          wallet: (await getWallet(env)) || "",
          locale: {
            language: st.profile?.language || "fa",
            countryCode: st.profile?.countryCode || "IR",
            timezone: st.profile?.timezone || "Asia/Tehran",
            entrySource: st.profile?.entrySource || "",
          },
        });
      }

      if (url.pathname === "/api/settings" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

        const v = await authMiniappRequest(request, body, env);
        if (!v.ok) return jsonResponse({ ok: false, error: v.reason }, 401);

        const st = await ensureUser(v.userId, env);

        // users can tweak only their preferences (admin-only prompt/wallet enforced elsewhere)
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

        const quota = isStaff(v.fromLike, env) ? "∞" : `${st.dailyUsed}/${dailyLimit(env, st)}`;
        return jsonResponse({ ok: true, state: st, quota });
      }

      if (url.pathname.startsWith("/api/admin/") && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

        const v = await verifyTelegramInitData(body.initData, env.TELEGRAM_BOT_TOKEN, env.INITDATA_MAX_AGE_SEC, env.MINIAPP_AUTH_LENIENT);
        if (!v.ok) return jsonResponse({ ok: false, error: v.reason }, 401);
        if (!isStaff(v.fromLike, env)) return jsonResponse({ ok: false, error: "forbidden" }, 403);

        if (url.pathname === "/api/admin/bootstrap") {
          const [prompt, styles, commission, offerBanner, offerBannerImage, payments, stylePrompts, customPrompts, freeDailyLimit, withdrawals, tickets, adminFlags, welcomeBot, welcomeMiniapp] = await Promise.all([
            getAnalysisPrompt(env),
            getStyleList(env),
            getCommissionSettings(env),
            getOfferBanner(env),
            getOfferBannerImage(env),
            listPayments(env, 25),
            getStylePromptMap(env),
            getCustomPrompts(env),
            getFreeDailyLimit(env),
            listWithdrawals(env, 100),
            listSupportTickets(env, 100),
            getAdminFlags(env),
            getBotWelcomeText(env),
            getMiniappWelcomeText(env),
          ]);
          return jsonResponse({ ok: true, prompt, styles, commission, offerBanner, offerBannerImage, payments, stylePrompts, customPrompts, freeDailyLimit, withdrawals, tickets, adminFlags, welcomeBot, welcomeMiniapp });
        }

        if (url.pathname === "/api/admin/welcome") {
          if (typeof body.welcomeBot === "string") await setBotWelcomeText(env, body.welcomeBot);
          if (typeof body.welcomeMiniapp === "string") await setMiniappWelcomeText(env, body.welcomeMiniapp);
          return jsonResponse({ ok: true, welcomeBot: await getBotWelcomeText(env), welcomeMiniapp: await getMiniappWelcomeText(env) });
        }

        if (url.pathname === "/api/admin/wallet") {
          if (!isOwner(v.fromLike, env)) return jsonResponse({ ok: false, error: "forbidden" }, 403);
          if (!env.BOT_KV) return jsonResponse({ ok: false, error: "bot_kv_missing" }, 500);
          const wallet = typeof body.wallet === "string" ? body.wallet.trim() : null;
          if (wallet !== null) {
            await setWallet(env, wallet);
          }
          return jsonResponse({ ok: true, wallet: await getWallet(env) });
        }

        if (url.pathname === "/api/admin/tickets/list") {
          const limit = Math.min(300, Math.max(1, Number(body.limit || 100)));
          const tickets = await listSupportTickets(env, limit);
          return jsonResponse({ ok: true, tickets });
        }

        if (url.pathname === "/api/admin/tickets/update") {
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

        if (url.pathname === "/api/admin/prompt") {
          if (typeof body.prompt === "string" && env.BOT_KV) {
            await env.BOT_KV.put("settings:analysis_prompt", body.prompt.trim());
          }
          const prompt = await getAnalysisPrompt(env);
          return jsonResponse({ ok: true, prompt });
        }

        if (url.pathname === "/api/admin/styles") {
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

        if (url.pathname === "/api/admin/style-prompts") {
          const map = await getStylePromptMap(env);
          if (typeof body.stylePrompts === "object" && body.stylePrompts) {
            await setStylePromptMap(env, body.stylePrompts);
          }
          return jsonResponse({ ok: true, stylePrompts: await getStylePromptMap(env) });
        }

        if (url.pathname === "/api/admin/custom-prompts") {
          if (Array.isArray(body.customPrompts)) {
            await setCustomPrompts(env, body.customPrompts);
          }
          return jsonResponse({ ok: true, customPrompts: await getCustomPrompts(env) });
        }

        if (url.pathname === "/api/admin/free-limit") {
          const limit = toInt(body.limit, 3);
          await setFreeDailyLimit(env, limit);
          return jsonResponse({ ok: true, freeDailyLimit: await getFreeDailyLimit(env) });
        }

        if (url.pathname === "/api/admin/features") {
          if (!isOwner(v.fromLike, env)) return jsonResponse({ ok: false, error: "forbidden" }, 403);
          const flags = await getAdminFlags(env);
          if (typeof body.capitalModeEnabled === "boolean") flags.capitalModeEnabled = body.capitalModeEnabled;
          if (typeof body.profileTipsEnabled === "boolean") flags.profileTipsEnabled = body.profileTipsEnabled;
          await setAdminFlags(env, flags);
          return jsonResponse({ ok: true, adminFlags: await getAdminFlags(env) });
        }


        if (url.pathname === "/api/admin/offer") {
          if (typeof body.offerBanner === "string" && env.BOT_KV) {
            await setOfferBannerSafe(env, body.offerBanner);
          }
          if (typeof body.offerBannerImage === "string") {
            try {
              await setOfferBannerImage(env, body.offerBannerImage);
            } catch (e) {
              return jsonResponse({ ok: false, error: String(e?.message || e || "offer_image_failed") }, 400);
            }
          }
          return jsonResponse({ ok: true, offerBanner: await getOfferBanner(env), offerBannerImage: await getOfferBannerImage(env) });
        }

        if (url.pathname === "/api/admin/commissions") {
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

        if (url.pathname === "/api/admin/users") {
          if (!isOwner(v.fromLike, env)) return jsonResponse({ ok: false, error: "forbidden" }, 403);
          const users = await listUsers(env, Number(body.limit || 100));
          const now = Date.now();
          const report = users.map((u) => {
            const createdAt = u.createdAt || "";
            const usageDays = createdAt ? Math.max(1, Math.ceil((now - Date.parse(createdAt)) / (24 * 3600 * 1000))) : 0;
            const lastTx = Array.isArray(u.wallet?.transactions) ? u.wallet.transactions[u.wallet.transactions.length - 1] : null;
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
            };
          });
          return jsonResponse({ ok: true, users: report });
        }

        if (url.pathname === "/api/admin/report/pdf") {
          if (!isOwner(v.fromLike, env)) return jsonResponse({ ok: false, error: "forbidden" }, 403);
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

        if (url.pathname === "/api/admin/payments/list") {
          return jsonResponse({ ok: true, payments: await listPayments(env, 100) });
        }
        if (url.pathname === "/api/admin/capital/toggle") {
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


        if (url.pathname === "/api/admin/withdrawals/list") {
          const withdrawals = await listWithdrawals(env, 200);
          return jsonResponse({ ok: true, withdrawals });
        }

        if (url.pathname === "/api/admin/withdrawals/review") {
          const id = String(body.id || "").trim();
          const decision = String(body.decision || "").trim();
          const txHash = String(body.txHash || "").trim();
          if (!id || !["approved","rejected"].includes(decision)) return jsonResponse({ ok: false, error: "bad_request" }, 400);
          const updated = await reviewWithdrawal(env, id, decision, txHash, v.fromLike);
          return jsonResponse({ ok: true, withdrawal: updated });
        }

        if (url.pathname === "/api/admin/payments/decision") {
          const paymentId = String(body.paymentId || "").trim();
          const status = String(body.status || "").trim() === "approved" ? "approved" : "rejected";
          const raw = env.BOT_KV ? await env.BOT_KV.get(`payment:${paymentId}`) : "";
          if (!raw) return jsonResponse({ ok: false, error: "payment_not_found" }, 404);
          let payment = null;
          try { payment = JSON.parse(raw); } catch {}
          if (!payment) return jsonResponse({ ok: false, error: "payment_bad_json" }, 500);
          payment.status = status;
          payment.reviewedAt = new Date().toISOString();
          payment.reviewedBy = normHandle(v.fromLike?.username);
          if (env.BOT_KV) await env.BOT_KV.put(`payment:${paymentId}`, JSON.stringify(payment));
          return jsonResponse({ ok: true, payment });
        }

        // Backward-compat alias for older admin clients
        if (url.pathname === "/api/admin/withdrawals/decision") {
          const id = String(body.withdrawalId || body.id || "").trim();
          const decisionRaw = String(body.status || body.decision || "").trim();
          const decision = decisionRaw === "approved" ? "approved" : (decisionRaw === "rejected" ? "rejected" : "");
          const txHash = String(body.txHash || "").trim();
          if (!id || !decision) return jsonResponse({ ok: false, error: "bad_request" }, 400);
          const updated = await reviewWithdrawal(env, id, decision, txHash, v.fromLike);
          return jsonResponse({ ok: true, withdrawal: updated });
        }



        if (url.pathname === "/api/admin/payments/approve") {
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

          if (st.referral?.referredBy) {
            const inviter = await ensureUser(String(st.referral.referredBy), env);
            const commission = await getCommissionSettings(env);
            const pctRaw = resolveCommissionPercent(inviter.profile?.username, commission);
            const pct = Math.max(10, Number.isFinite(Number(pctRaw)) ? Number(pctRaw) : 0);
            const reward = pct > 0 ? Math.round((amount * pct) * 100) / 100 : 0;
            inviter.referral.commissionTotal = (inviter.referral.commissionTotal || 0) + reward;
            inviter.referral.commissionBalance = (inviter.referral.commissionBalance || 0) + reward;
            await saveUser(inviter.userId, inviter, env);
            payment.commission = { inviterId: inviter.userId, percent: pct, amount: reward };
          }

          await saveUser(userId, st, env);
          await storePayment(env, payment);
          return jsonResponse({ ok: true, payment, subscription: st.subscription });
        }

        if (url.pathname === "/api/admin/subscription/activate") {
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

        if (url.pathname === "/api/admin/custom-prompts/requests") {
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

            // notify user
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

        if (url.pathname === "/api/admin/custom-prompts/send") {
          const username = String(body.username || "").trim();
          const promptId = String(body.promptId || "").trim();
          const userId = await getUserIdByUsername(env, username);
          if (!userId) return jsonResponse({ ok: false, error: "user_not_found" }, 404);
          const prompts = await getCustomPrompts(env);
          const match = prompts.find((p) => String(p?.id || "") === promptId);
          if (!match) return jsonResponse({ ok: false, error: "prompt_not_found" }, 404);
          await tgSendMessage(env, userId, `📌 پرامپت اختصاصی فعال شد:\n${match.title || match.id}\n\n${match.text || ""}`, mainMenuKeyboard(env));
          return jsonResponse({ ok: true });
        }

        if (url.pathname === "/api/admin/payments/check") {
          const payload = {
            txHash: String(body.txHash || "").trim(),
            address: String(body.address || "").trim(),
            amount: Number(body.amount || 0),
          };
          const result = await verifyBlockchainPayment(payload, env);
          return jsonResponse({ ok: true, result });
        }
      }

      if (url.pathname === "/api/support/ticket" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

        const v = await authMiniappRequest(request, body, env);
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
کاربر: ${st.profile?.username ? "@"+st.profile.username : st.userId}
شماره: ${st.profile?.phone || "-"}
متن:
${text}`);
        }


        return jsonResponse({ ok: true, ticket, supportNotified: !!supportChatId });
      }

      if (url.pathname === "/api/wallet/deposit/notify" && request.method === "POST") {
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
کاربر: ${st.profile?.username ? "@"+st.profile.username : st.userId}
TxID: ${txid}
مبلغ: ${amount || "-"}
وضعیت: pending`);
        }


        return jsonResponse({ ok: true, payment, supportNotified: !!supportChatId });
      }

      if (url.pathname === "/api/chart" && request.method === "GET") {
        const symbol = String(url.searchParams.get("symbol") || "").trim().toUpperCase();
        const tf = String(url.searchParams.get("tf") || "H4").trim().toUpperCase();
        const levelsRaw = String(url.searchParams.get("levels") || "").trim();
        const levels = levelsRaw
          ? levelsRaw.split(",").map((x) => Number(x)).filter((n) => Number.isFinite(n)).slice(0, 6)
          : [];

        if (!symbol || !isSymbol(symbol)) {
          return jsonResponse({ ok: false, error: "invalid_symbol" }, 400);
        }

        const quoteRespKey = `quote|${symbol}|${tf}`;
        const quoteCachedResp = apiRespCacheGet(quoteRespKey);
        if (quoteCachedResp) return jsonResponse(quoteCachedResp);

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
          if (Array.isArray(levels) && levels.length) {
            const svg = buildLevelsOnlySvg(symbol, tf, levels);
            return new Response(svg, {
              status: 200,
              headers: {
                "Content-Type": "image/svg+xml; charset=utf-8",
                "Cache-Control": "public, max-age=30",
                "X-Chart-Fallback": "levels_only_svg",
              },
            });
          }
          return jsonResponse({ ok: false, error: "no_market_data" }, 404);
        }

        try {
          const png = await renderQuickChartPng(env, candles, symbol, tf, levels);
          return new Response(png, {
            status: 200,
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=60",
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
              "Cache-Control": "public, max-age=30",
              "X-Chart-Fallback": "internal_svg",
            },
          });
        }
      }

      if (url.pathname === "/api/quote" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

        const v = await authMiniappRequest(request, body, env);
        const allowGuest = miniappGuestEnabled(env) && !v.ok && !!body.allowGuest;
        if (!v.ok && !allowGuest) return jsonResponse({ ok: false, error: v.reason }, 401);

        const st = v.ok ? await ensureUser(v.userId, env) : defaultUser("guest");
        const symbol = String(body.symbol || "").trim();
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

      if (url.pathname === "/api/news" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

        const v = await authMiniappRequest(request, body, env);
        const allowGuest = miniappGuestEnabled(env) && !v.ok && !!body.allowGuest;
        if (!v.ok && !allowGuest) return jsonResponse({ ok: false, error: v.reason }, 401);

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

      if (url.pathname === "/api/news/analyze" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

        const v = await authMiniappRequest(request, body, env);
        const allowGuest = miniappGuestEnabled(env) && !v.ok && !!body.allowGuest;
        if (!v.ok && !allowGuest) return jsonResponse({ ok: false, error: v.reason }, 401);

        const symbol = String(body.symbol || "").trim().toUpperCase();
        if (!symbol || !isSymbol(symbol)) return jsonResponse({ ok: false, error: "invalid_symbol" }, 400);

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
      if (url.pathname === "/api/analyze" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return jsonResponse({ ok: false, error: "bad_json" }, 400);

        const v = await authMiniappRequest(request, body, env);
        if (!v.ok) return jsonResponse({ ok: false, error: v.reason }, 401);

        const st = await ensureUser(v.userId, env);
        const symbol = String(body.symbol || "").trim();
        if (!symbol || !isSymbol(symbol)) return jsonResponse({ ok: false, error: "invalid_symbol" }, 400);

        // lightweight onboarding gate for mini-app: block only if absolutely no identity fields exist
        const hasAnyIdentity = !!(st.profile?.name || st.profile?.phone || st.profile?.username || v.fromLike?.username);
        if (!hasAnyIdentity) {
          return jsonResponse({ ok: false, error: "onboarding_required" }, 403);
        }

        if (env.BOT_KV && !canAnalyzeToday(st, v.fromLike, env)) {
          const quota = isStaff(v.fromLike, env) ? "∞" : `${st.dailyUsed}/${dailyLimit(env, st)}`;
          return jsonResponse({ ok: false, error: `quota_exceeded_${quota}` }, 429);
        }

        const userPrompt = typeof body.userPrompt === "string" ? body.userPrompt : "";

        try {
          const flowTimeoutMs = Math.max(15000, Number(env.SIGNAL_FLOW_TIMEOUT_MS || 70000));
          const result = await Promise.race([
            runSignalTextFlowReturnText(env, v.fromLike, st, symbol, userPrompt),
            timeoutPromise(flowTimeoutMs, "api_analyze_timeout"),
          ]);
          if (env.BOT_KV) {
            consumeDaily(st, v.fromLike, env);
            recordAnalysisSuccess(st);
            await saveUser(v.userId, st, env);
          }
          const quota = isStaff(v.fromLike, env) ? "∞" : `${st.dailyUsed}/${dailyLimit(env, st)}`;
          let chartUrl = "";
          let levels = [];
          let quickChartSpec = null;
          let zonesSvg = "";
          try {
            if (String(env.QUICKCHART || "") !== "0") {
              const tf = st.timeframe || "H4";
              const candles = await getMarketCandlesWithFallback(env, symbol, tf).catch(() => []);
              levels = refineLevelsByCandles(extractLevels(result), candles);
              const origin = new URL(request.url).origin;
              if (Array.isArray(candles) && candles.length) {
                chartUrl = `${origin}/api/chart?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}&levels=${encodeURIComponent(levels.join(","))}`;
                quickChartSpec = buildQuickChartSpec(candles, symbol, tf, levels);
              } else if (levels.length) {
                chartUrl = buildQuickChartLevelsOnlyUrl(symbol, tf, levels);
                quickChartSpec = { fallback: "levels_only", symbol, timeframe: tf, levels };
              }
            }
          } catch (e) {
            console.error("chartUrl build error:", e?.message || e);
          }
          try {
            zonesSvg = buildZonesSvgFromAnalysis(result, symbol, st.timeframe || "H4");
          } catch (e) {
            console.error("zones svg build error:", e?.message || e);
          }
          const quickchartConfig = { symbol, timeframe: st.timeframe || "H4", levels };
          return jsonResponse({ ok: true, result, state: st, quota, chartUrl, levels, quickChartSpec, quickchartConfig, zonesSvg });
        } catch (e) {
          console.error("api/analyze error:", e);
          return jsonResponse({ ok: false, error: "server_error" }, 500);
        }
      }

      // Telegram webhook route: /telegram/<secret>
      if (url.pathname.startsWith("/telegram/")) {
        const secret = url.pathname.split("/")[2] || "";
        if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== String(env.TELEGRAM_WEBHOOK_SECRET)) {
          return new Response("forbidden", { status: 403 });
        }
        if (request.method !== "POST") return new Response("method not allowed", { status: 405 });

        const update = await request.json().catch(() => null);
        if (!update) return new Response("bad request", { status: 400 });

        // respond fast; do heavy work in waitUntil
        ctx.waitUntil(handleUpdate(update, env));
        return new Response("ok", { status: 200 });
      }

      return new Response("not found", { status: 404 });
    } catch (e) {
      console.error("fetch error:", e);
      return new Response("error", { status: 500 });
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try { await runDailySuggestions(env); } catch (e) { console.error("runDailySuggestions error:", e); }
      try { await runDailyProfileNotifications(env); } catch (e) { console.error("runDailyProfileNotifications error:", e); }
    })());
  },
};

/* ========================== BRAND / COPY ========================== */
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
/start | شروع تحلیل
/signals | سیگنال‌ها
/education | آموزش و مفاهیم بازار
/support | پشتیبانی

────────────────────────

⚠️ سلب مسئولیت:
تمام تحلیل‌ها صرفاً جنبه آموزشی و تحلیلی دارند و مسئولیت نهایی معاملات بر عهده کاربر است.`;

const WELCOME_MINIAPP =
`👋 به MarketiQ خوش آمدید — هوش تحلیلی شما در بازارهای مالی
این مینی‌اپ برای گرفتن تحلیل سریع، تنظیمات، و مدیریت دسترسی طراحی شده است.
⚠️ تحلیل‌ها آموزشی است و مسئولیت معاملات با شماست.`;

/* ========================== CONFIG ========================== */
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
  WALLET_BALANCE: "📜 تاریخچه تراکنشات",
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
const TIMEOUT_TEXT_MS = 26000;
const TIMEOUT_VISION_MS = 12000;
const TIMEOUT_POLISH_MS = 15000;

/* ========================== UTILS ========================== */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function chunkText(s, size = 3500) {
  const out = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
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

function toInt(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
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

function applyLocaleDefaults(st) {
  const loc = inferLocaleByPhone(st?.profile?.phone || "");
  st.profile = st.profile || {};
  st.profile.language = st.profile.language || loc.lang;
  st.profile.countryCode = st.profile.countryCode || loc.country;
  st.profile.timezone = st.profile.timezone || loc.tz;

  if (!st.timeframe) st.timeframe = (loc.country === "IR" ? "H1" : "H4");
  if (!st.risk) st.risk = "متوسط";
  if (!st.style) st.style = "پرایس اکشن";
  if (st.profile.preferredStyle && ALLOWED_STYLE_LIST.includes(st.profile.preferredStyle)) {
    st.style = st.profile.preferredStyle;
  }
  if (typeof st.newsEnabled !== "boolean") st.newsEnabled = true;
  if (!st.promptMode) st.promptMode = "style_plus_custom";
  return st;
}

async function finalizeOnboardingRewards(env, st) {
  if (!st?.profile?.onboardingDone) return;
  if (!st?.referral?.referredBy || !st?.referral?.referredByCode) return;
  if (st?.referral?.onboardingRewardDone) return;

  const phone = st.profile?.phone || "";
  if (!phone) return;
  const isNew = await isPhoneNew(env, phone);
  await markPhoneSeen(env, phone, st.userId);
  if (!isNew) {
    st.referral.onboardingRewardDone = true;
    st.referral.onboardingRewardAt = new Date().toISOString();
    return;
  }

  const inviterId = String(st.referral.referredBy);
  const inviter = await ensureUser(inviterId, env);
  inviter.referral.successfulInvites = (inviter.referral.successfulInvites || 0) + 1;
  inviter.referral.points = (inviter.referral.points || 0) + 3;
  if (inviter.referral.points >= 500) {
    inviter.referral.points -= 500;
    inviter.subscription.active = true;
    inviter.subscription.type = "gift";
    inviter.subscription.dailyLimit = 50;
    inviter.subscription.expiresAt = futureISO(30);
  }
  await saveUser(inviterId, inviter, env);

  st.referral.onboardingRewardDone = true;
  st.referral.onboardingRewardAt = new Date().toISOString();
}

function isStaff(from, env) {
  // staff = admin or owner
  return isOwner(from, env) || isAdmin(from, env);
}

function isOwner(from, env) {
  const uid = String(from?.userId || from?.id || "").trim();
  const ownerIds = String(env.OWNER_USER_IDS || env.OWNER_IDS || "").split(",").map((x) => String(x || "").trim()).filter(Boolean);
  if (uid && ownerIds.includes(uid)) return true;

  const u = normHandle(from?.username);
  const raw = (env.OWNER_HANDLES || "").toString().trim();
  if (!u || !raw) return false;
  const set = new Set(raw.split(",").map(normHandle).filter(Boolean));
  return set.has(u);
}

function isAdmin(from, env) {
  const uid = String(from?.userId || from?.id || "").trim();
  const adminIds = String(env.ADMIN_USER_IDS || env.ADMIN_IDS || "").split(",").map((x) => String(x || "").trim()).filter(Boolean);
  if (uid && adminIds.includes(uid)) return true;

  const u = normHandle(from?.username);
  const raw = (env.ADMIN_HANDLES || "").toString().trim();
  if (!u || !raw) return false;
  const set = new Set(raw.split(",").map(normHandle).filter(Boolean));
  return set.has(u);
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
  return s.split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
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

/* ========================== PROMPTS (ADMIN/OWNER ONLY) ========================== */
const DEFAULT_ANALYSIS_PROMPT = `SYSTEM OVERRIDE: تحلیل‌گر چندسبکی بازار (BASE PROMPT)

متغیرها:
- STYLE_MODE: {STYLE}
- RISK_PROFILE: {RISK}
- NEWS_MODE: {NEWS}
- TIMEFRAME: {TIMEFRAME}

قوانین قطعی:
1) خروجی فقط فارسی باشد.
2) فقط از MARKET_DATA استفاده کن و اگر داده ناکافی است شفاف اعلام کن.
3) سیگنال قطعی نده؛ سناریومحور و شرطی بنویس.
4) اعداد کلیدی را دقیق بنویس و اگر ناموجود بود «نامشخص از داده» درج کن.
5) مدیریت ریسک را الزامی بیاور (Entry / SL / TP).

راهنمای سبک:
- پرایس اکشن: ساختار بازار، شکست/پولبک، نواحی حمایت/مقاومت، رفتار کندل.
- ICT: نقدینگی، Sweep/Grab، OB/FVG، شکست ساختار و جهت حرکت پول هوشمند.
- ATR: وضعیت نوسان، SL/TP مبتنی بر ATR، فیلتر ورود در نوسان‌های پرریسک.
- ترکیبی: بهترین اجزای سه سبک را بدون تناقض ادغام کن.

راهنمای ریسک:
- کم: ورود با تایید قوی، SL محافظه‌کار.
- متوسط: تایید استاندارد، TP مرحله‌ای.
- زیاد: هشدار ریسک بالا + سناریوی ابطال دقیق.

فرمت خروجی (اجباری):
۱) ساختار و وضعیت بازار
۲) نواحی کلیدی و نقدینگی
۳) سناریوهای ورود/خروج مشروط
۴) مدیریت ریسک و ابطال تحلیل
۵) جمع‌بندی کوتاه اجرایی`;

/* ========================== STYLE PROMPTS (DEFAULTS) ==========================
 * Users choose st.style (Persian labels) and we inject a style-specific guide
 * into the analysis prompt. Admin can still override the global base prompt via KV.
 */
const STYLE_PROMPTS_DEFAULT = {
  "پرایس اکشن": `Professional Price Action Market Analysis Prompt

Constraints:
- Pure Price Action Only
- Indicators are forbidden unless explicitly requested
- Focus on high-probability setups only
- Step-by-step and execution-focused

Required Sections:
1) Market Structure
- Uptrend / Downtrend / Range
- HH / HL / LH / LL labeling
- Structure status: Intact / BOS / MSS

2) Key Levels
- Strong Support zones
- Strong Resistance zones
- Flip zones (SR->Resistance / Resistance->Support)
- Psychological levels (if relevant)

3) Candlestick Behavior
- Pin Bar / Engulfing / Inside Bar
- Explain buyer/seller intent

4) Entry Scenarios
- Clear entry zone
- Logical structure-based Stop Loss
- TP1 and TP2
- Minimum RR = 1:2

5) Bias & Scenarios
- Main bias (Bullish / Bearish / Neutral)
- Alternative scenario on invalidation

6) Execution Plan
- Continuation or Reversal
- Required confirmation before entry`,
  "ICT": `ICT & Smart Money Analyst

Methodology:
- ICT (Inner Circle Trader)
- Smart Money Concepts only
- No indicators, no retail concepts

Analyze Symbol/Timeframe with these sections:
1) Higher Timeframe Bias (Daily/H4)
- HTF bias (Bullish/Bearish/Neutral)
- Premium / Discount / Equilibrium(50%)
- Imbalance vs Balance

2) Liquidity Mapping
- EQH / EQL
- Buy-side and Sell-side liquidity
- Stop-loss pools
- Where liquidity is likely engineered toward

3) Market Structure
- BOS and MSS/CHoCH
- Manipulation phase vs Expansion phase

4) PD Arrays
- Bullish/Bearish Order Blocks
- FVG / Liquidity Voids
- PDH / PDL / PWH / PWL

5) Kill Zones (Intraday only)
- London Kill Zone / New York Kill Zone
- Why timing matters

6) Entry Model
- Liquidity Sweep -> MSS -> FVG Entry
- Liquidity Sweep -> Order Block Entry
- Entry, Stop Loss, Liquidity-based Targets

7) Narrative
- Who is trapped?
- Where smart money entered?
- Where price is likely engineered to go?

Execution Plan:
- Clear bias, entry rules, targets, invalidation level`,
  "ATR": `Quantitative Trading Assistant (ATR-based Volatility)

Analysis Requirements:
1) Volatility State
- Current ATR value
- Compare with historical ATR average
- Expansion or contraction

2) Market Condition
- Trending or Ranging
- Breakout vs Mean Reversion suitability

3) Trade Setup
- Entry based on price structure
- SL = Entry ± (ATR x Multiplier)
- TP1/TP2 based on ATR expansion

4) Position Sizing
- Risk per trade (%)
- Position size based on SL distance

5) Trade Filtering
- When NOT to trade based on ATR
- High-risk volatility conditions (news/spikes)

6) Risk Management
- Max daily loss
- Max consecutive losses
- ATR-based trailing stop logic

7) Summary
- Statistical justification
- Expected trade duration
- Risk classification (Low/Medium/High)`,
};

function normalizeStyleLabel(style) {
  const s = String(style || "").trim();
  if (!s) return "";
  const low = s.toLowerCase();
  if (low === "price action" || low === "priceaction") return "پرایس اکشن";
  if (low === "ict") return "ICT";
  if (low === "atr") return "ATR";
  if (low === "combo" || low === "combined" || low === "all" || low === "ترکیبی") return "ترکیبی";
  return s;
}

function getStyleGuide(style) {
  const key = normalizeStyleLabel(style);
  if (key === "ترکیبی") {
    return [
      "[پرایس اکشن]", STYLE_PROMPTS_DEFAULT["پرایس اکشن"] || "",
      "[ICT]", STYLE_PROMPTS_DEFAULT["ICT"] || "",
      "[ATR]", STYLE_PROMPTS_DEFAULT["ATR"] || "",
    ].join(String.fromCharCode(10)).trim();
  }
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

/* ========================== STYLE PROMPTS (PER-STYLE) ========================== */
function styleKey(style) {
  return String(style || "").trim().toLowerCase().replace(/\s+/g, "_");
}
async function getStylePrompt(env, style) {
  if (!env.BOT_KV) return "";
  const map = await getStylePromptMap(env);
  const key = normalizeStyleLabel(style);
  if (key === "ترکیبی") {
    const parts = [];
    for (const s of ["پرایس اکشن", "ICT", "ATR"]) {
      const v = (map?.[styleKey(s)] || "").toString().trim();
      if (v) parts.push("[" + s + "]\n" + v);
    }
    return parts.join("\n\n");
  }
  return (map?.[styleKey(key)] || "").toString();
}
async function setStylePrompt(env, style, prompt) {
  if (!env.BOT_KV) return;
  const map = await getStylePromptMap(env);
  map[styleKey(style)] = String(prompt || "");
  await setStylePromptMap(env, map);
}

async function getStylePromptMap(env) {
  if (!env.BOT_KV) return {};
  const raw = await env.BOT_KV.get("settings:style_prompts_json");
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function setStylePromptMap(env, map) {
  if (!env.BOT_KV) return;
  const payload = map && typeof map === "object" ? map : {};
  await env.BOT_KV.put("settings:style_prompts_json", JSON.stringify(payload));
}

async function getCustomPrompts(env) {
  if (!env.BOT_KV) return [];
  const raw = await env.BOT_KV.get("settings:custom_prompts");
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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
const ALLOWED_STYLE_LIST = ["پرایس اکشن", "ICT", "ATR", "ترکیبی"];
const DEFAULT_STYLE_LIST = ALLOWED_STYLE_LIST.slice();

async function getStyleList(env) {
  if (!env.BOT_KV) return DEFAULT_STYLE_LIST.slice();
  const raw = await env.BOT_KV.get("settings:style_list");
  if (!raw) return DEFAULT_STYLE_LIST.slice();
  try {
    const list = JSON.parse(raw);
    const filtered = Array.isArray(list) ? list.filter((s) => ALLOWED_STYLE_LIST.includes(s)) : [];
    return filtered.length ? filtered : DEFAULT_STYLE_LIST.slice();
  } catch {
    return DEFAULT_STYLE_LIST.slice();
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

async function setOfferBanner(env, text) {
  if (!env.BOT_KV) return;
  await env.BOT_KV.put("settings:offer_banner", String(text || "").trim());
}






async function setOfferBannerImage(env, dataUrl) {
  if (!env.BOT_KV) return;
  const clean = String(dataUrl || "").trim();
  if (!clean) {
    await env.BOT_KV.delete("settings:offer_banner_image");
    return;
  }
  if (!clean.startsWith("data:image/")) throw new Error("bad_offer_image_format");
  if (clean.length > 1_500_000) throw new Error("offer_image_too_large");
  await env.BOT_KV.put("settings:offer_banner_image", clean);
}


// Compatibility alias for editor diagnostics in mirrored index.js files.
const setOfferBannerSafe = async (env, text) => setOfferBanner(env, text);
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
  if (!env.BOT_KV) return;
  const id = String(st.userId);

  const raw = await env.BOT_KV.get("users:index");
  let list = [];
  try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
  if (!Array.isArray(list)) list = [];
  if (!list.includes(id)) list.push(id);
  await env.BOT_KV.put("users:index", JSON.stringify(list.slice(-2000)));

  const handle = normHandle(st.profile?.username);
  if (handle) {
    await env.BOT_KV.put(`users:by_username:${handle}`, id);
  }
}

async function getUserIdByUsername(env, username) {
  if (!env.BOT_KV) return "";
  const handle = normHandle(username);
  if (!handle) return "";
  return (await env.BOT_KV.get(`users:by_username:${handle}`)) || "";
}

async function listUsers(env, limit = 100) {
  if (!env.BOT_KV) return [];
  const raw = await env.BOT_KV.get("users:index");
  let list = [];
  try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
  if (!Array.isArray(list)) return [];
  const ids = list.slice(-limit);
  const users = [];
  for (const id of ids) {
    const u = await getUser(id, env);
    if (u) users.push(u);
  }
  return users;
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

async function storeSupportTicket(env, ticket) {
  if (!env.BOT_KV) return;
  await env.BOT_KV.put(`ticket:${ticket.id}`, JSON.stringify(ticket));
  const raw = await env.BOT_KV.get("tickets:index");
  let list = [];
  try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
  if (!Array.isArray(list)) list = [];
  if (!list.includes(ticket.id)) list.push(ticket.id);
  await env.BOT_KV.put("tickets:index", JSON.stringify(list.slice(-1000)));
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

  // ensure index
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
  const endpoint = (env.BLOCKCHAIN_CHECK_URL || "").toString().trim();
  if (!endpoint) return { ok: false, reason: "check_url_missing" };
  const r = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }, Number(env.BLOCKCHAIN_CHECK_TIMEOUT_MS || 8000));
  const j = await r.json().catch(() => null);
  return j || { ok: false, reason: "bad_response" };
}

/* ========================== KEYBOARDS ========================== */
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
    [BTN.QUOTE, BTN.NEWS],
    [BTN.NEWS_ANALYSIS, BTN.MINIAPP],
    [BTN.WALLET, BTN.PROFILE],
    [BTN.INVITE, BTN.SUPPORT],
    [BTN.EDUCATION, BTN.LEVELING],
    [BTN.HOME],
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

function getMiniappUrl(env) {
  const raw = (env.MINIAPP_URL || env.PUBLIC_BASE_URL || env.__BASE_URL || "").toString().trim();
  if (!raw) return "";
  return raw.endsWith("/") ? raw : (raw + "/");
}
async function miniappInlineKeyboard(env, st, from) {
  const url = getMiniappUrl(env);
  if (!url) return null;
  const finalUrl = url;
  return { inline_keyboard: [[{ text: BTN.MINIAPP, web_app: { url: finalUrl } }]] };
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



/* ========================== BOT_DB (D1) STATE ========================== */
/*
DDL (Cloudflare D1):
CREATE TABLE IF NOT EXISTS users (
  userId TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  amount REAL NOT NULL,
  address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
*/
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
/* ========================== KV STATE ========================== */
async function getUser(userId, env) {
  // Prefer BOT_DB (D1). Fallback to KV.
  const db = await dbGetUser(userId, env);
  if (db) return db;

  if (!env.BOT_KV) return null;
  const raw = await env.BOT_KV.get(`u:${userId}`);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
async function saveUser(userId, st, env) {
  // Write-through to BOT_DB (D1) if available. Also keep KV for compatibility.
  await dbSaveUser(userId, st, env);

  if (!env.BOT_KV) return;
  await env.BOT_KV.put(`u:${userId}`, JSON.stringify(st));
  await updateUserIndexes(env, st);
}

function defaultUser(userId) {
  return {
    userId,
    createdAt: new Date().toISOString(),

    // bot state machine
    state: "idle",
    selectedSymbol: "",

    // preferences
    timeframe: "H4",
    style: "پرایس اکشن",
    risk: "متوسط",
    newsEnabled: true,
    promptMode: "style_plus_custom",

    // usage quota
    dailyDate: kyivDateString(),
    dailyUsed: 0,
    freeDailyLimit: 3,

    // onboarding/profile
    profile: {
      name: "",
      phone: "",
      username: "",
      firstName: "",
      lastName: "",
      marketExperience: "",
      preferredMarket: "",
      level: "", // beginner/intermediate/pro
      levelNotes: "",
      preferredStyle: "",
      language: "fa",
      countryCode: "IR",
      timezone: "Asia/Tehran",
      entrySource: "",
      onboardingDone: false,
      capital: 0,
      capitalCurrency: "USDT",

    },

    capital: {
      amount: 0,
      enabled: true,
    },

    // referral / points / subscription
    referral: {
      codes: [],            // 1 code
      referredBy: "",       // inviter userId
      referredByCode: "",   // which code
      successfulInvites: 0,
      points: 0,
      commissionTotal: 0,
      commissionBalance: 0,
      onboardingRewardDone: false,
      onboardingRewardAt: "",
    },
    subscription: {
      active: false,
      type: "free", // free/premium/gift
      expiresAt: "",
      dailyLimit: 3,
    },

    // wallet (local balance placeholder)
    wallet: {
      balance: 0,
      transactions: [],
    },

    // provider overrides
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

  // one-way migrate KV -> D1 when BOT_DB is enabled
  if (env.BOT_DB && !dbExisting && kvExisting) {
    await dbSaveUser(userId, st, env);
  }

  if (from?.username) st.profile.username = String(from.username);
  if (from?.first_name) st.profile.firstName = String(from.first_name);
  if (from?.last_name) st.profile.lastName = String(from.last_name);
  if (st.profile?.phone) applyLocaleDefaults(st);

  const today = kyivDateString();
  if (st.dailyDate !== today) {
    st.dailyDate = today;
    st.dailyUsed = 0;
  }

  if (!Array.isArray(st.referral.codes) || st.referral.codes.length < 1) {
    st.referral.codes = (st.referral.codes || []).filter(Boolean);
    while (st.referral.codes.length < 1) st.referral.codes.push(randomCode(10));
  }

  const freeLimit = await getFreeDailyLimit(env);
  st.freeDailyLimit = freeLimit;

  if (env.BOT_KV) await saveUser(userId, st, env);
  return st;
}

function dailyLimit(env, st) {
  if (st?.subscription?.active) {
    return toInt(st?.subscription?.dailyLimit, 3) || 3;
  }
  return toInt(st?.freeDailyLimit || st?.subscription?.dailyLimit || 0, 0) || 3;
}

function canAnalyzeToday(st, from, env) {
  if (isStaff(from, env)) return true;
  const today = kyivDateString();
  const used = (st.dailyDate === today) ? (st.dailyUsed || 0) : 0;
  return used < dailyLimit(env, st);
}

function consumeDaily(st, from, env) {
  if (isStaff(from, env)) return;
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

/* ========================== TELEGRAM API ========================== */
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
  return tgApi(env, "sendMessage", {
    chat_id: chatId,
    text: String(text).slice(0, 3900),
    reply_markup: replyMarkup,
    disable_web_page_preview: true,
  });
}

async function tgSendMessageHtml(env, chatId, html, replyMarkup) {
  return tgApi(env, "sendMessage", {
    chat_id: chatId,
    text: String(html).slice(0, 3900),
    parse_mode: "HTML",
    reply_markup: replyMarkup,
    disable_web_page_preview: false,
  });
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

// Send SVG as document (Telegram reliably shows it)
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

/* ========================== TYPING LOOP ========================== */
function stopToken() { return { stop: false }; }
async function typingLoop(env, chatId, token) {
  while (!token.stop) {
    await tgSendChatAction(env, chatId, "typing");
    await sleep(TYPING_INTERVAL_MS);
  }
}

/* ========================== IMAGE PICKING ========================== */
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

/* ========================== PROVIDER CHAINS ========================== */

function resolveTextProviderChain(env, orderOverride, prompt = "") {
  const raw = orderOverride || env.TEXT_PROVIDER_ORDER;
  const base = [...new Set(parseOrder(raw, ["cf","openai","openrouter","deepseek","gemini"]))];
  if (base.length <= 1) return base;
  const minuteBucket = Math.floor(Date.now() / 60000);
  const promptSeed = String(prompt || "").slice(0, 64);
  return rotateBySeed(base, `text|${promptSeed}|${minuteBucket}`);
}

function providerApiKey(name, env, seed = "") {
  const key = String(name || "").toLowerCase();
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
  return "";
}

async function runTextProviders(prompt, env, orderOverride) {
  const chain = resolveTextProviderChain(env, orderOverride, prompt);
  let lastErr = null;
  for (const p of chain) {
    if (providerInCooldown(p)) continue;
    try {
      const out = await Promise.race([
        textProvider(p, prompt, env),
        timeoutPromise(TIMEOUT_TEXT_MS, `text_${p}_timeout`)
      ]);
      if (out && String(out).trim()) {
        markProviderSuccess(p, "text");
        return String(out).trim();
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
  const raw = (orderOverride || env.POLISH_PROVIDER_ORDER || "").toString().trim();
  if (!raw) return draft;

  const chain = parseOrder(raw, ["openai","cf","gemini"]);
  const polishPrompt =
    `تو یک ویراستار سخت‌گیر فارسی هستی. متن زیر را فقط “سفت‌وسخت” کن:\n` +
    `- فقط فارسی\n- قالب شماره‌دار ۱ تا ۵ حفظ شود\n- لحن افشاگر/تیز\n- اضافه‌گویی حذف\n- خیال‌بافی نکن\n\n` +
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
        return String(out).trim();
      }
      markProviderFailure(p, env, "polish");
    } catch (e) {
      markProviderFailure(p, env, "polish");
      console.error("polish provider failed:", p, e?.message || e);
    }
  }
  return draft;
}

async function runVisionProviders(imageUrl, visionPrompt, env, orderOverride) {
  const chain = parseOrder(orderOverride || env.VISION_PROVIDER_ORDER, ["openai","cf","gemini","hf"]);
  const totalBudget = Number(env.VISION_TOTAL_BUDGET_MS || 20000);
  const deadline = Date.now() + totalBudget;

  let lastErr = null;
  let cached = /** @type {any} */ (null);

  for (const p of chain) {
    const remaining = deadline - Date.now();
    if (remaining <= 500) break;

    try {
      if ((p === "cf" || p === "gemini" || p === "hf") && cached && cached.tooLarge) continue;

      const out = await Promise.race([
        visionProvider(p, imageUrl, visionPrompt, env, () => cached, (c) => (cached = c)),
        timeoutPromise(Math.min(TIMEOUT_VISION_MS, remaining), `vision_${p}_timeout`)
      ]);
      if (out && String(out).trim()) return String(out).trim();
    } catch (e) {
      lastErr = e;
      console.error("vision provider failed:", p, e?.message || e);
    }
  }

  throw lastErr || new Error("all_vision_providers_failed_or_budget_exceeded");
}

async function textProvider(name, prompt, env) {
  name = String(name || "").toLowerCase();

  if (name === "cf") {
    if (!env.AI) throw new Error("AI_binding_missing");
    const out = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [{ role: "user", content: prompt }],
      max_tokens: 900,
      temperature: 0.25,
    });
    return out?.response || out?.result || "";
  }

  if (name === "openai") {
    const apiKey = providerApiKey("openai", env, prompt);
    if (!apiKey) throw new Error("OPENAI_API_KEY_missing");
    const r = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.25,
      }),
    }, TIMEOUT_TEXT_MS);
    const j = await r.json().catch(() => null);
    return j?.choices?.[0]?.message?.content || "";
  }

  if (name === "openrouter") {
    const apiKey = providerApiKey("openrouter", env, prompt);
    if (!apiKey) throw new Error("OPENROUTER_API_KEY_missing");
    const r = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.25,
      }),
    }, TIMEOUT_TEXT_MS);
    const j = await r.json().catch(() => null);
    return j?.choices?.[0]?.message?.content || "";
  }

  if (name === "deepseek") {
    const apiKey = providerApiKey("deepseek", env, prompt);
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY_missing");
    const r = await fetchWithTimeout("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL || "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.25,
      }),
    }, TIMEOUT_TEXT_MS);
    const j = await r.json().catch(() => null);
    return j?.choices?.[0]?.message?.content || "";
  }

  if (name === "gemini") {
    const apiKey = providerApiKey("gemini", env, prompt);
    if (!apiKey) throw new Error("GEMINI_API_KEY_missing");
    const r = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.25, maxOutputTokens: 900 },
        }),
      },
      TIMEOUT_TEXT_MS
    );
    const j = await r.json().catch(() => null);
    return j?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
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
    if (!providerApiKey("openai", env, imageUrl) && !env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY_missing");
    const body = {
      model: env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: visionPrompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      }],
      temperature: 0.2,
    };
    const r = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${providerApiKey("openai", env, imageUrl) || env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }, TIMEOUT_VISION_MS);
    const j = await r.json().catch(() => null);
    return j?.choices?.[0]?.message?.content || "";
  }

  if (name === "cf") {
    if (!env.AI) throw new Error("AI_binding_missing");
    const c = await ensureImageCache(imageUrl, env, getCache, setCache);
    if (c.tooLarge) return "";
    const out = await env.AI.run("@cf/llava-hf/llava-1.5-7b-hf", { image: c.bytesArr, prompt: visionPrompt });
    return out?.description || out?.response || out?.result || "";
  }

  if (name === "gemini") {
    if (!providerApiKey("gemini", env, imageUrl) && !env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY_missing");
    const c = await ensureImageCache(imageUrl, env, getCache, setCache);
    if (c.tooLarge) return "";
    const r = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(providerApiKey("gemini", env, imageUrl) || env.GEMINI_API_KEY || "")}`,
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
          generationConfig: { temperature: 0.2, maxOutputTokens: 900 },
        }),
      },
      TIMEOUT_VISION_MS
    );
    const j = await r.json().catch(() => null);
    return j?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
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

/* ========================== MARKET DATA (LIVE) ========================== */
function assetKind(symbol) {
  if (symbol.endsWith("USDT")) return "crypto";
  if (/^[A-Z]{6}$/.test(symbol)) return "forex";
  if (symbol === "XAUUSD" || symbol === "XAGUSD") return "metal";
  if (symbol === "DJI" || symbol === "NDX" || symbol === "SPX") return "index";
  return "unknown";
}

function providerSupportsSymbol(provider, symbol, env) {
  const kind = assetKind(symbol);
  if (provider === "binance") return kind === "crypto";
  if (provider === "twelvedata") return !!(env.TWELVEDATA_API_KEY || env.TWELVEDATA_API_KEYS) && ["crypto", "forex", "metal"].includes(kind);
  if (provider === "alphavantage") return !!(env.ALPHAVANTAGE_API_KEY || env.ALPHAVANTAGE_API_KEYS) && ["forex", "metal"].includes(kind);
  if (provider === "finnhub") return !!(env.FINNHUB_API_KEY || env.FINNHUB_API_KEYS) && kind === "forex";
  if (provider === "yahoo") return true;
  return true;
}

function parseApiKeyPool(primary, many) {
  const arr = [];
  const one = String(primary || "").trim();
  if (one) arr.push(one);
  const list = String(many || "").split(",").map((x) => x.trim()).filter(Boolean);
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
  const desired = parseOrder(env.MARKET_DATA_PROVIDER_ORDER, ["binance","twelvedata","alphavantage","finnhub","yahoo"]);
  const filtered = desired.filter((p) => providerSupportsSymbol(p, symbol, env));
  const chain = filtered.length ? filtered : ["yahoo"];
  const minuteBucket = Math.floor(Date.now() / 60000);
  return rotateBySeed(chain, `${symbol}|${timeframe}|${minuteBucket}`);
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
  if (/^[A-Z]{6}$/.test(symbol)) return `${symbol.slice(0,3)}/${symbol.slice(3,6)}`;
  if (symbol === "XAUUSD") return "XAU/USD";
  if (symbol === "XAGUSD") return "XAG/USD";
  return symbol;
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
function yahooInterval(tf) {
  // Yahoo supports 15m/30m/60m/1d reliably. 240m is often unsupported -> no data.
  // We fetch 60m for H4 and downsample to 4H candles.
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
    out.push({ t: g[g.length - 1].t, o, h, l, c, v });
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

async function fetchTwelveDataCandles(symbol, timeframe, limit, timeoutMs, env) {
  const tdPool = parseApiKeyPool(env.TWELVEDATA_API_KEY, env.TWELVEDATA_API_KEYS);
  if (!tdPool.length) throw new Error("twelvedata_key_missing");
  const kind = assetKind(symbol);
  if (kind === "unknown") throw new Error("twelvedata_unknown_symbol");

  const interval = mapTimeframeToTwelve(timeframe);
  const sym = mapForexSymbolForTwelve(symbol);
  const tdKey = pickApiKey(tdPool, `${symbol}|${timeframe}|${Math.floor(Date.now() / 60000)}`);
  const base = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(sym)}&interval=${encodeURIComponent(interval)}&outputsize=${limit}&apikey=${encodeURIComponent(tdKey)}`;
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
  // Yahoo can intermittently return 404 from some edges / for some symbols.
  // We try multiple hosts + richer headers, and we keep H4 as 60m + downsample.
  const interval = yahooInterval(timeframe);
  const ysym = toYahooSymbol(symbol);

  // Pick a range that gives enough bars for downsampling + analysis.
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
  const limit = Number(env.MARKET_DATA_CANDLES_LIMIT || 120);
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
      markProviderFailure(p, env);
    }
  }

  const stale = await getMarketCacheStale(env, cacheKey);
  if (Array.isArray(stale) && stale.length) return stale;

  // fallback: use near timeframe source and aggregate to requested tf
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

  // final fallback: try stale cache from any timeframe and remap
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
      markProviderFailure(p, env);
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

  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const trend = (sma20 && sma50) ? (sma20 > sma50 ? "صعودی" : "نزولی") : "نامشخص";

  const n = Math.min(50, candles.length);
  const recent = candles.slice(-n);
  const hi = Math.max(...recent.map(x => x.h));
  const lo = Math.min(...recent.map(x => x.l));

  const lastClose = last.c;
  const changePct = prev?.c ? ((lastClose - prev.c) / prev.c) * 100 : 0;

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

function buildLocalFallbackAnalysis(symbol, st, candles, reason = "") {
  const tf = st?.timeframe || "H4";
  const snap = computeSnapshot(Array.isArray(candles) ? candles : []);
  const levels = extractLevelsFromCandles(Array.isArray(candles) ? candles : []);
  const levelTxt = levels.length ? levels.join(" | ") : "داده کافی نیست";
  const bias = snap?.trend || "نامشخص";
  const risk =
    String(st?.risk || "").trim() ||
    (snap ? (Math.abs(Number(snap.changePct || 0)) > 2 ? "بالا" : "متوسط") : "نامشخص");

  return [
    "۱) وضعیت کلی",
    `نماد ${symbol} در تایم‌فریم ${tf} با بایاس ${bias} ارزیابی شد.`,
    snap ? `قیمت آخر: ${snap.lastPrice} | تغییر: ${snap.changePct}%` : "قیمت لحظه‌ای معتبر در دسترس نیست.",
    "",
    "۲) زون‌ها و سطوح",
    `سطوح پیشنهادی (auto): ${levelTxt}`,
    "",
    "۳) سناریوها",
    `سناریوی اصلی: ادامه ${bias === "صعودی" ? "حرکت رو به بالا" : (bias === "نزولی" ? "فشار فروش" : "نوسانی")}.`,
    "سناریوی جایگزین: شکست ساختار خلاف جهت و بازگشت به محدوده‌های میانی.",
    "",
    "۴) مدیریت ریسک",
    `ریسک پیشنهادی: ${risk}. ورود پله‌ای، حدضرر اجباری و کاهش اهرم توصیه می‌شود.`,
    "",
    "۵) وضعیت سرویس",
    `تحلیل با فالبک داخلی تولید شد (${reason || "text_provider_unavailable"}).`,
  ].join(String.fromCharCode(10));
}

/* ========================== TEXT BUILDERS ========================== */
async function buildTextPromptForSymbol(symbol, userPrompt, st, marketBlock, env, newsBlock = "") {
  const tf = st.timeframe || "H4";
  const baseRaw = await getAnalysisPrompt(env);
  const sp = await getStylePrompt(env, st.style);
  const customPrompts = await getCustomPrompts(env);
  const customPrompt = customPrompts.find((p) => String(p?.id || "") === String(st.customPromptId || ""));
  const promptMode = String(st.promptMode || "style_plus_custom").trim();
  const includeStylePrompt = promptMode !== "custom_only";
  const includeStyleGuide = promptMode === "combined_all" || promptMode === "style_only" || promptMode === "style_plus_custom";
  const includeCustomPrompt = !!customPrompt?.text && (promptMode === "custom_only" || promptMode === "style_plus_custom" || promptMode === "combined_all");
  const newsAnalysisBlock = newsBlock ? await buildNewsAnalysisSummary(symbol, parseNewsBlockRows(newsBlock), env) : "";
  const base = baseRaw
     .split("{TIMEFRAME}").join(tf)
     .split("{STYLE}").join(st.style || "")
     .split("{RISK}").join(st.risk || "")
     .split("{NEWS}").join(st.newsEnabled ? "on" : "off");

  const userExtra = (isStaff({ username: st.profile?.username }, env) && userPrompt?.trim())
    ? userPrompt.trim()
    : "تحلیل با حالت نهادی";

  return (
    `${base}

` +
    (includeStylePrompt && sp ? `STYLE_PROMPT:
${sp}

` : ``) +
    (includeStyleGuide && getStyleGuide(st.style) ? `STYLE_GUIDE:
${getStyleGuide(st.style)}

` : ``) +
    (includeCustomPrompt ? `CUSTOM_PROMPT:
${customPrompt.text}

` : ``) +
    `ASSET: ${symbol}
` +

    `USER SETTINGS: Style=${st.style}, Risk=${st.risk}, Capital=${st.capital?.enabled === false ? "disabled" : (st.profile?.capital ? (st.profile.capital + " " + (st.profile.capitalCurrency || "USDT")) : (st.capital?.amount || "unknown"))}, Lang=${st.profile?.language || "fa"}, TZ=${st.profile?.timezone || "Asia/Tehran"}, Country=${st.profile?.countryCode || "IR"}

` +
    `MARKET_DATA:
${marketBlock}

` +
    (newsBlock ? `NEWS_HEADLINES_FA:
${newsBlock}

` : ``) +
    (newsAnalysisBlock ? `NEWS_ANALYSIS_FA:
${newsAnalysisBlock}

` : ``) +
    `RULES:
` +
    `- خروجی فقط فارسی و دقیقاً بخش‌های ۱ تا ۵
` +
    (st.style === "ترکیبی" || promptMode === "combined_all"
      ? `- از ترکیب سبک‌ها (پرایس اکشن، اسمارت‌مانی، ساختار بازار، حجم، سناریو) استفاده کن
`
      : `- فقط بر اساس سبک انتخابی (${st.style || "مشخص نشده"}) تحلیل کن و سبک‌های دیگر را دخیل نکن
`) +
    `- مدیریت سرمایه متناسب با Capital را لحاظ کن و سایز پوزیشن پیشنهادی بده
` +
    `- quickchart_config را به شکل JSON داخلی بساز اما به کاربر نمایش نده
` +
    `- سطح‌های قیمتی را مشخص کن (X/Y/Z)
` +
    `- شرط کندلی را واضح بگو (close/wick)
` +
    `- از داده OHLC استفاده کن، خیال‌بافی نکن
` +
    `- اگر NEWS_HEADLINES_FA موجود بود، تحلیل خبری کوتاه و اثر خبر روی سناریوها را اضافه کن

` +
    `EXTRA:
${userExtra}`
  );
}

async function buildVisionPrompt(st, env) {
  const tf = st.timeframe || "H4";
  const baseRaw = await getAnalysisPrompt(env);
  const sp = await getStylePrompt(env, st.style);
  const customPrompts = await getCustomPrompts(env);
  const customPrompt = customPrompts.find((p) => String(p?.id || "") === String(st.customPromptId || ""));
  const promptMode = String(st.promptMode || "style_plus_custom").trim();
  const includeStylePrompt = promptMode !== "custom_only";
  const includeStyleGuide = promptMode === "combined_all" || promptMode === "style_only" || promptMode === "style_plus_custom";
  const includeCustomPrompt = !!customPrompt?.text && (promptMode === "custom_only" || promptMode === "style_plus_custom" || promptMode === "combined_all");
  const base = baseRaw
     .split("{TIMEFRAME}").join(tf)
     .split("{STYLE}").join(st.style || "")
     .split("{RISK}").join(st.risk || "")
     .split("{NEWS}").join(st.newsEnabled ? "on" : "off");
  return (
    `${base}

` +
    (includeStylePrompt && sp ? `STYLE_PROMPT:
${sp}

` : ``) +
    (includeStyleGuide && getStyleGuide(st.style) ? `STYLE_GUIDE:
${getStyleGuide(st.style)}

` : ``) +
    (includeCustomPrompt ? `CUSTOM_PROMPT:
${customPrompt.text}

` : ``) +
    `TASK: این تصویر چارت را تحلیل کن. دقیقاً خروجی ۱ تا ۵ بده و سطح‌ها را مشخص کن.
` +
    `RULES: فقط فارسی، لحن افشاگر، خیال‌بافی نکن.
`
  );
}

/* ========================== WALLET (ADMIN ONLY) ========================== */
async function getWallet(env) {
  if (!env.BOT_KV) return (env.WALLET_ADDRESS || "").toString().trim();
  const v = await env.BOT_KV.get("settings:wallet");
  return (v || env.WALLET_ADDRESS || "").toString().trim();
}
async function setWallet(env, wallet) {
  if (!env.BOT_KV) throw new Error("BOT_KV_missing");
  await env.BOT_KV.put("settings:wallet", String(wallet || "").trim());
}

/* ========================== LEVELING (AI) ========================== */
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

/* ========================== REFERRAL / POINTS ========================== */
async function storeReferralCodeOwner(env, code, ownerUserId) {
  if (!env.BOT_KV) return;
  await env.BOT_KV.put(`ref:${code}`, String(ownerUserId));
}
async function resolveReferralOwner(env, code) {
  if (!env.BOT_KV) return "";
  const v = await env.BOT_KV.get(`ref:${code}`);
  return (v || "").toString().trim();
}

async function hashPhone(phone) {
  const data = new TextEncoder().encode(String(phone || "").trim());
  const digest = await crypto.subtle.digest("SHA-256", data);
  const u8 = new Uint8Array(digest);
  let hex = "";
  for (const b of u8) hex += b.toString(16).padStart(2, "0");
  return hex;
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
  // kept for backward compatibility; referral reward is finalized after full onboarding
  return finalizeOnboardingRewards(env, newUserSt);
}

function futureISO(days) {
  const d = new Date(Date.now() + days * 24 * 3600 * 1000);
  return d.toISOString();
}

/* ========================== UPDATE HANDLER ========================== */
async function handleUpdate(update, env) {
  try {
    const msg = update.message;
    if (!msg) return;

    const chatId = msg.chat?.id;
    const from = msg.from;
    const userId = from?.id;
    if (!chatId || !userId) return;

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

    const text = (msg.text || "").trim();

    if (text === "/start") {
      const refArg = (msg.text || "").split(" ").slice(1).join(" ").trim();
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


    if (text === "/wallet" || text === BTN.WALLET) {
      const wallet = await getWallet(env);
      const txt =
        `💳 ولت
🧾 تاریخچه تراکنشات
ولت
➕ واریز

` +
        `marketi1 PRO
با ارزش ۲۵ USDT

` +
        (wallet ? `آدرس ولت درگاه:
${wallet}

` : "") +
        `«واریزی فقط به آدرس ولت درگاه ممکن است
در لیست زیر باید از واریز هش واریزی را ارسال کنید.»`;
      return tgSendMessage(env, chatId, txt, walletMenuKeyboard());
    }

    if (text === BTN.WALLET_BALANCE) {
      const bal = Number(st.wallet?.balance || 0);
      const txs = Array.isArray(st.wallet?.transactions) ? st.wallet.transactions.slice(-5).reverse() : [];
      const txText = txs.length
        ? txs.map((t, i) => `${i + 1}) ${t?.txHash || "—"} | ${Number(t?.amount || 0)} USDT | ${t?.createdAt || "—"}`).join(String.fromCharCode(10))
        : "—";
      return tgSendMessage(env, chatId, `📜 تاریخچه تراکنشات

💰 موجودی: ${bal} USDT

${txText}`, walletMenuKeyboard());
    }

    if (text === BTN.WALLET_DEPOSIT) {
      const wallet = await getWallet(env);
      const memo = `U${st.userId}`;
      st.state = "wallet_deposit_txid";
      await saveUser(userId, st, env);
      const txt =
        `➕ واریز

` +
        `marketi1 PRO
با ارزش ۲۵ USDT

` +
        (wallet ? `آدرس ولت درگاه:
${wallet}
` : "") +
        `
Memo/Tag: ${memo}

` +
        `«واریزی فقط به آدرس ولت درگاه ممکن است
در زیر باید از واریز هش واریزی را ارسال کنید.»

` +
        `TxID پرداخت را همینجا بفرست (در صورت نیاز: <txid> <amount>).`;
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
      const { link, share, points, invites, commissionBalance } = inviteShareText(st, env);
      if (!link) return tgSendMessage(env, chatId, "لینک دعوت آماده نیست. بعداً دوباره تلاش کن.", mainMenuKeyboard(env));
      const txt =
        `🤝 دعوت

` +
        `✅ دعوت موفق: ${invites}
🎁 امتیاز شما: ${points}

` +
        `🔗 لینک رفرال قابل کپی: <a href="${escapeHtml(link)}">کپی/باز کردن لینک</a>
` +
        (share ? `🚀 اشتراک سریع: <a href="${escapeHtml(share)}">ارسال سریع لینک</a>

` : `
`) +
        `«با معرفی دوستانتان به ربات ۳ تحلیل به معنی ۶ امتیاز بدست می آورید
در صورت خرید اشتراک دوستانتان ۱۰ درصد از مبلغ اشتراک را دریافت میکنید»`;
      return tgSendMessageHtml(env, chatId, txt, mainMenuKeyboard(env));
    }


    if (text === "/education" || text === BTN.EDUCATION) {
      return tgSendMessage(env, chatId, "📚 آموزش و مفاهیم بازار\n\nبه‌زودی محتوای آموزشی اضافه می‌شود.", mainMenuKeyboard(env));
    }

    if (text === "/support" || text === BTN.SUPPORT) {
      const handle = env.SUPPORT_HANDLE || "@support";
      const wallet = await getWallet(env);
      const walletLine = wallet ? `

💳 آدرس ولت جهت پرداخت:
${wallet}` : "";
      return tgSendMessage(
        env,
        chatId,
        `🆘 پشتیبانی\n\nبرای سوالات آماده یا ارسال تیکت از دکمه‌ها استفاده کن.

با ارسال تیکت می‌توانید با کارشناسان ما نظرات خود را درمیان بگذارید.\n\nپیام مستقیم: ${handle}${walletLine}`,
        kb([[BTN.SUPPORT_FAQ, BTN.SUPPORT_TICKET], [BTN.SUPPORT_CUSTOM_PROMPT], [BTN.HOME]])
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
        return tgSendMessage(env, chatId, "⚠️ لینک مینی‌اپ تنظیم نشده. مقدار MINIAPP_URL یا PUBLIC_BASE_URL را تنظیم کنید.", mainMenuKeyboard(env));
      }
      const finalUrl = url;
      const kbInline = {
        inline_keyboard: [
          [{ text: "🧩 ورود داخل تلگرام", web_app: { url: finalUrl } }],
        ],
      };
      return tgSendMessage(env, chatId, "🧩 مینی‌اپ فعال شد. فقط از دکمه ورود داخل تلگرام استفاده کنید.", kbInline);
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
      applyLocaleDefaults(st);
      await finalizeOnboardingRewards(env, st);

      await saveUser(userId, st, env);

      const marketFa = ({crypto:"کریپتو", forex:"فارکس", metals:"فلزات", stocks:"سهام"})[result.recommendedMarket] || "کریپتو";
      const nudge = await buildOnboardingNudge(env, st);
      return tgSendMessage(
        env,
        chatId,
        `✅ تعیین سطح انجام شد.

سطح: ${st.profile.level}
پیشنهاد بازار: ${marketFa}

تنظیمات پیشنهادی:
⏱ ${st.timeframe} | 🎯 ${st.style} | ⚠️ ${st.risk}

یادداشت:
${st.profile.levelNotes || "—"}${nudge}

اگر می‌خوای دوباره تعیین‌سطح انجام بدی یا تنظیماتت تغییر کنه، به پشتیبانی پیام بده (ادمین بررسی می‌کند).`,
        mainMenuKeyboard(env)
      );
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
کاربر: ${st.profile?.username ? "@"+st.profile.username : st.userId}
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

      st.selectedSymbol = text;
      st.state = "await_prompt";
      await saveUser(userId, st, env);

      const quota = isStaff(from, env) ? "∞" : `${st.dailyUsed}/${dailyLimit(env, st)}`;
      return tgSendMessage(env, chatId, `✅ نماد: ${st.selectedSymbol}\n\nبرای شروع تحلیل روی «${BTN.ANALYZE}» بزن.\n\nسهمیه امروز: ${quota}`, kb([[BTN.ANALYZE], [BTN.BACK, BTN.HOME]]));
    }

    if (st.state === "await_prompt" && st.selectedSymbol) {
      if (env.BOT_KV && !canAnalyzeToday(st, from, env)) {
        return tgSendMessage(env, chatId, `⛔️ سهمیه امروزت تموم شده (${dailyLimit(env, st)} تحلیل در روز).`, mainMenuKeyboard(env));
      }

      const symbol = st.selectedSymbol;
      const isAnalyzeCmd = text === BTN.ANALYZE || text.replace(/\s+/g, "") === "تحلیلکن";
      if (!isAnalyzeCmd) return tgSendMessage(env, chatId, `برای شروع تحلیل روی «${BTN.ANALYZE}» بزن ✅`, kb([[BTN.ANALYZE], [BTN.BACK, BTN.HOME]]));

      st.state = "idle";
      st.selectedSymbol = "";

      const ok = await runSignalTextFlow(env, chatId, from, st, symbol, "");
      if (ok && env.BOT_KV) {
        consumeDaily(st, from, env);
        recordAnalysisSuccess(st);
        await saveUser(userId, st, env);
      }
      return;
    }


    if (st.state === "wallet_deposit_txid") {
      const parts = String(text || "").trim().split(/\s+/).filter(Boolean);
      const txid = String(parts[0] || "").trim();
      const amount = Number(parts[1] || 0);
      if (!txid || txid.length < 8) {
        return tgSendMessage(env, chatId, "TxID نامعتبر است. دوباره ارسال کن.", kb([[BTN.BACK, BTN.HOME]]));
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

      // store request (D1 if available, else KV)
      if (env.BOT_DB) {
        await env.BOT_DB.prepare(
          "INSERT INTO withdrawals (id, userId, createdAt, amount, address, status) VALUES (?1, ?2, ?3, ?4, ?5, 'pending')"
        ).bind(wid, String(st.userId), createdAt, amount, address).run();
      } else if (env.BOT_KV) {
        await env.BOT_KV.put(`withdraw:${wid}`, JSON.stringify({ id: wid, userId: st.userId, createdAt, amount, address, status: "pending" }));
      }

      st.state = "idle";
      await saveUser(userId, st, env);
      return tgSendMessage(env, chatId, "✅ درخواست برداشت ثبت شد و در انتظار بررسی است.", walletMenuKeyboard());
    }

    return tgSendMessage(env, chatId, "از منوی پایین استفاده کن ✅", mainMenuKeyboard(env));
  } catch (e) {
    console.error("handleUpdate error:", e);
  }
}

/* ========================== START / ONBOARDING ========================== */
async function onStart(env, chatId, from, st, refArg) {
  st.state = "idle";
  st.selectedSymbol = "";
  st.profile.username = from?.username ? String(from.username) : st.profile.username;

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

  const mkb = await miniappInlineKeyboard(env, st, from);
  if (mkb) await tgSendMessage(env, chatId, "🧩 ورود سریع به مینی‌اپ:", mkb);

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
  const flags = await getAdminFlags(env);
  if (flags.capitalModeEnabled && !Number(st.profile?.capital || 0)) {
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

  const phone = String(contact.phone_number || "").trim();
  st.profile.phone = phone;
  st.profile.onboardingDone = false;
  applyLocaleDefaults(st);

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

/* ========================== ADMIN: USERS LIST ========================== */
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
    const pts = u?.referral?.points || 0;
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

/* ========================== ROUTING HELPERS ========================== */
function isSymbol(t) {
  return MAJORS.includes(t) || METALS.includes(t) || INDICES.includes(t) || CRYPTOS.includes(t);
}

/* ========================== TEXTS ========================== */
function getSupportFaq() {
  return [
    { q: "چطور سهمیه روزانه شارژ می‌شود؟", a: "سهمیه هر روز (Tehran) صفر می‌شود و مجدداً قابل استفاده است." },
    { q: "چرا تحلیل ناموفق شد؟", a: "اتصال دیتا یا مدل ممکن است موقتاً قطع باشد. چند دقیقه بعد دوباره تلاش کن." },
    { q: "چطور اشتراک فعال کنم؟", a: "پرداخت را انجام بده و هش تراکنش را برای ادمین ارسال کن تا تأیید و فعال شود." },
    { q: "چطور رفرال کار می‌کند؟", a: "هر دعوت موفق با شماره جدید ۳ امتیاز دارد. هر ۵۰۰ امتیاز = ۳۰ روز اشتراک هدیه." },
  ];
}

async function sendSettingsSummary(env, chatId, st, from) {
  const quota = isStaff(from, env) ? "∞" : `${st.dailyUsed}/${dailyLimit(env, st)}`;
  const wallet = await getWallet(env);
  const txt =
    `⚙️ تنظیمات:\n\n` +
    `⏱ تایم‌فریم: ${st.timeframe}\n` +
    `🎯 سبک: ${st.style}\n` +
    `🧩 پرامپت اختصاصی: ${st.customPromptId || "پیش‌فرض"}\n` +
    `⚠️ ریسک: ${st.risk}\n` +
    `📰 خبر: ${st.newsEnabled ? "روشن ✅" : "خاموش ❌"}\n\n` +
    `سهمیه امروز: ${quota}\n` +
    (wallet ? `\n💳 آدرس ولت:\n${wallet}\n` : "") +
    (isStaff(from, env) ? `\n(ادمین/اونر) برای تغییر پرامپت: /setprompt ...\n` : "");
  return tgSendMessage(env, chatId, txt, settingsMenuKeyboard());
}

function profileText(st, from, env) {
  const quota = isStaff(from, env) ? "∞" : `${st.dailyUsed}/${dailyLimit(env, st)}`;
  const adminTag = isStaff(from, env) ? "✅ ادمین/اونر" : "👤 کاربر";
  const level = st.profile?.level ? `
سطح: ${st.profile.level}` : "";

  return `👤 پروفایل

وضعیت: ${adminTag}
🆔 ID: ${st.userId}
نام: ${st.profile?.name || "-"}
یوزرنیم: ${st.profile?.username ? "@"+st.profile.username : "-"}
شماره: ${st.profile?.phone ? maskPhone(st.profile.phone) : "-"}${level}

📅 امروز(Tehran): ${kyivDateString()}
سهمیه امروز: ${quota}`;
}

function inviteShareText(st, env) {
  const botUser = env.BOT_USERNAME ? String(env.BOT_USERNAME).replace(/^@/, "") : "";
  const code = (st.referral?.codes || [])[0] || "";
  const link = code ? (botUser ? `https://t.me/${botUser}?start=ref_${code}` : `ref_${code}`) : "";
  const share = link ? `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("با لینک من عضو شو و اشتراک هدیه بگیر ✅")}` : "";
  return {
    link,
    share,
    points: Number(st?.referral?.points || 0),
    invites: Number(st?.referral?.successfulInvites || 0),
    commissionBalance: Number(st?.referral?.commissionBalance || 0),
  };
}


function fmtNudgePrice(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "نامشخص";
  const abs = Math.abs(x);
  const dp = abs >= 1000 ? 0 : (abs >= 100 ? 2 : (abs >= 1 ? 4 : 6));
  return x.toFixed(dp);
}

async function buildOnboardingNudge(env, st) {
  const market = String(st?.profile?.preferredMarket || "").toLowerCase();
  const symbol = market.includes("forex") ? "EURUSD" : (market.includes("metal") ? "XAUUSD" : "BTCUSDT");
  const tf = String(st?.timeframe || "H4").toUpperCase();
  try {
    const candles = await getMarketCandlesWithFallback(env, symbol, tf);
    const tail = Array.isArray(candles) ? candles.slice(-30) : [];
    const highs = tail.map((c) => Number(c.high ?? c.h)).filter(Number.isFinite);
    const lows = tail.map((c) => Number(c.low ?? c.l)).filter(Number.isFinite);
    if (!highs.length || !lows.length) throw new Error("no_data");
    const hi = Math.max(...highs);
    const lo = Math.min(...lows);
    return `تحلیل کوتاه نمونه (${symbol}/${tf}): حمایت حوالی ${fmtNudgePrice(lo)} و مقاومت حوالی ${fmtNudgePrice(hi)}؛ با توجه به سبک ${st?.style || "پرایس اکشن"} بعد از تثبیت کندلی می‌توان سناریوی ورود امن‌تری داشت.`;
  } catch {
    return "تحلیل کوتاه نمونه: با توجه به پروفایل شما، ربات روی سناریوهای مرحله‌ای (حمایت/مقاومت + تایید کندلی) خروجی دقیق‌تری می‌دهد؛ یک نماد انتخاب کن تا تحلیل کامل بگیری.";
  }
}

function buildOnboardingNudge(st) {
  const symbol = String(st?.selectedSymbol || st?.profile?.preferredSymbol || "BTCUSDT").toUpperCase();
  const tf = String(st?.timeframe || "H4").toUpperCase();
  const risk = String(st?.risk || "متوسط");
  return `🚀 شروع سریع پیشنهادی:
یک تحلیل کوتاه برای ${symbol} روی ${tf} با سطح ریسک ${risk} بگیر تا خروجی متناسب با پروفایلت را ببینی.`;
}

/* ========================== FLOWS ========================== */

/* ========================== QUICKCHART IMAGE (CANDLESTICK) ==========================
QuickChart renders Chart.js configs as images via https://quickchart.io/chart .
Financial (candlestick/OHLC) charts are supported via chartjs-chart-financial plugin.
*/
function buildQuickChartSpec(candles, symbol, tf, levels = []) {
  const items = (candles || []).slice(-60).map((c) => ({
    x: new Date(c.t || c.time || c.ts || c.timestamp || Date.now()).toISOString(),
    o: Number(c.o),
    h: Number(c.h),
    l: Number(c.l),
    c: Number(c.c),
  }));
  const annotations = (levels || []).slice(0, 6).map((lvl, idx) => ({
    type: "line",
    scaleID: "y",
    value: Number(lvl),
    borderColor: idx === 0 ? "#00d1ff" : idx === 1 ? "#ff6b6b" : "#f7c948",
    borderWidth: 1.5,
    borderDash: [6, 4],
    label: { enabled: true, content: `L${idx + 1}: ${Number(lvl).toFixed(4)}` },
  }));
  return {
    type: "candlestick",
    data: { datasets: [{ label: `${symbol} ${tf}`, data: items }] },
    options: {
      plugins: {
        legend: { display: false },
        title: { display: true, text: `${symbol} · ${tf}` },
        annotation: { annotations },
      },
      scales: { x: { ticks: { maxRotation: 0, autoSkip: true } } },
    },
  };
}

function buildQuickChartCandlestickUrl(candles, symbol, tf, levels = []) {
  const items = (candles || []).slice(-80).map((c) => ({
    x: Number(c.t || c.time || c.ts || c.timestamp || Date.now()),
    o: Number(c.o),
    h: Number(c.h),
    l: Number(c.l),
    c: Number(c.c),
  })).filter((x) => Number.isFinite(x.x) && Number.isFinite(x.o) && Number.isFinite(x.h) && Number.isFinite(x.l) && Number.isFinite(x.c));

  const zoneLines = (levels || []).slice(0, 8).map((lvl, idx) => ({
    type: "line",
    scaleID: "y",
    value: Number(lvl),
    borderColor: idx % 2 === 0 ? "#00d1ff" : "#ff8a65",
    borderWidth: 1.5,
    borderDash: [6, 4],
    label: { enabled: true, content: `Z${idx + 1}` },
  })).filter((x) => Number.isFinite(x.value));

  const cfg = {
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
        annotation: { annotations: zoneLines },
      },
      scales: {
        x: { ticks: { maxRotation: 0, autoSkip: true } },
      },
    },
  };

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
  let out = String(text || "");
  out = out.replace(/\*\*?\s*quickchart_config\s*\*\*?/gi, "");
  out = out.replace(/```\s*json[\s\S]*?quickchart[\s\S]*?```/gi, "");
  out = out.replace(/quickchart_config\s*:\s*\{[\s\S]*?\}/gi, "");
  return out.trim();
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

async function runSignalTextFlow(env, chatId, from, st, symbol, userPrompt) {
  await tgSendMessage(env, chatId, `⏳ جمع‌آوری داده و تحلیل ${symbol}...`, kb([[BTN.HOME]]));

  const t = stopToken();
  const typingTask = typingLoop(env, chatId, t);

  try {
    const flowTimeoutMs = Math.max(15000, Number(env.SIGNAL_FLOW_TIMEOUT_MS || 70000));
    const result = await Promise.race([
      runSignalTextFlowReturnText(env, from, st, symbol, userPrompt),
      timeoutPromise(flowTimeoutMs, "signal_text_flow_timeout"),
    ]);

    // 📸 QuickChart candlestick image
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
          // اگر دیتا نداریم، عکس ارسال نکن
          await tgSendMessage(env, chatId, "⚠️ برای این نماد در این تایم‌فریم دیتای کافی پیدا نشد؛ چارت ارسال نشد.", kb([[BTN.HOME]]));
        } else {
          const levels = extractLevels(result);
          const chartUrl = buildQuickChartCandlestickUrl(candles, symbol, st.timeframe || "H4", levels);
          const caption = candles.length < 5
            ? `📈 چارت ${symbol} (${st.timeframe || "H4"}) — داده محدود`
            : `📈 چارت ${symbol} (${st.timeframe || "H4"})`;
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

    for (const part of chunkText(result, 3500)) {
      await tgSendMessage(env, chatId, part, mainMenuKeyboard(env));
    }
    return true;
  } catch (e) {
    console.error("runSignalTextFlow error:", e);
    t.stop = true;
    await tgSendMessage(env, chatId, "⚠️ فعلاً امکان انجام این عملیات نیست. لطفاً بعداً دوباره تلاش کن.", mainMenuKeyboard(env));
    return false;
  }
}

function analysisCacheKey(symbol, st) {
  const tf = st.timeframe || "H4";
  const style = st.style || "";
  const risk = st.risk || "";
  const news = st.newsEnabled ? "1" : "0";
  return `analysis:${String(symbol).toUpperCase()}:${tf}:${style}:${risk}:${news}`;
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

function buildMarketBlock(candles, maxRows) {
  const snap = computeSnapshot(candles);
  const ohlc = candlesToCompactCSV(candles, maxRows);
  return (
    `lastPrice=${snap?.lastPrice}\n` +
    `changePct=${snap?.changePct}%\n` +
    `trend=${snap?.trend}\n` +
    `range50_hi=${snap?.range50?.hi} range50_lo=${snap?.range50?.lo}\n` +
    `sma20=${snap?.sma20} sma50=${snap?.sma50}\n` +
    `lastTs=${snap?.lastTs}\n\n` +
    `OHLC_CSV(t,o,h,l,c):\n${ohlc}`
  );
}

async function runSignalTextFlowReturnText(env, from, st, symbol, userPrompt) {
  const useCache = !userPrompt && !isStaff(from, env);
  const cacheKey = useCache ? analysisCacheKey(symbol, st) : "";
  if (useCache) {
    const cached = await getAnalysisCache(env, cacheKey);
    if (cached) return cached;
  }

  let candles = [];
  try {
    candles = await getMarketCandlesWithFallback(env, symbol, st.timeframe || "H4");
  } catch (e) {
    console.error("market provider failed (all)", e?.message || e);
    candles = [];
  }
  const marketBlock = buildMarketBlock(candles, 80);
  const newsBlock = st.newsEnabled ? (await buildNewsBlockForSymbol(symbol, env, 5)) : "";
  const prompt = await buildTextPromptForSymbol(symbol, userPrompt, st, marketBlock, env, newsBlock);
  let draft = "";
  try {
    draft = await runTextProviders(prompt, env, st.textOrder);
  } catch (e) {
    console.error("text providers failed (retry compact):", e?.message || e);
    try {
      const compactBlock = buildMarketBlock(candles, 40);
      const compactPrompt = await buildTextPromptForSymbol(symbol, userPrompt, st, compactBlock, env, newsBlock);      draft = await runTextProviders(compactPrompt, env, st.textOrder);
    } catch (e2) {
      console.error("text providers failed (fallback local):", e2?.message || e2);
      draft = buildLocalFallbackAnalysis(symbol, st, candles, e2?.message || "text_provider_timeout");
    }
  }
  const polished = await runPolishProviders(draft, env, st.polishOrder);
  const clean = stripHiddenModelOutput(polished);
  if (useCache && clean) await setAnalysisCache(env, cacheKey, clean);
  return clean;
}


async function handleVisionFlow(env, chatId, from, userId, st, fileId) {
  if (env.BOT_KV && !canAnalyzeToday(st, from, env)) {
    await tgSendMessage(env, chatId, `⛔️ سهمیه امروزت تموم شده (${dailyLimit(env, st)} تحلیل در روز).`, mainMenuKeyboard(env));
    return;
  }

  await tgSendMessage(env, chatId, "🖼️ عکس دریافت شد… در حال تحلیل 🔍", kb([[BTN.HOME]]));

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
    const polished = await runPolishProviders(draft, env, st.polishOrder);

    if (String(env.RENDER_ZONES || "") === "1") {
      const svg = buildZonesSvgFromAnalysis(polished, "CHART", tf);
      await tgSendSvgDocument(env, chatId, svg, "zones.svg", `🖼️ نقشه زون‌ها (${tf})`);
    }

    t.stop = true;
    await Promise.race([typingTask, sleep(10)]).catch(() => {});

    for (const part of chunkText(polished, 3500)) {
      await tgSendMessage(env, chatId, part, mainMenuKeyboard(env));
    }
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

/* ========================== ZONES RENDER (SVG) ========================== */


async function renderQuickChartPng(env, candles, symbol, tf, levels = []) {
  const chartUrl = buildQuickChartCandlestickUrl(candles, symbol, tf, levels);
  const r = await fetch(chartUrl, { cf: { cacheTtl: 60, cacheEverything: true } });
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
  const allNums = (src.match(/\b\d{1,7}(?:\.\d{1,6})?\b/g) || [])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);

  const keyLines = src
    .split(/\n+/)
    .filter((ln) => /(?:support|resistance|zone|entry|sl|tp|حمایت|مقاومت|زون|ورود|حد\s*ضرر|حد\s*سود)/i.test(ln));
  const hinted = (keyLines.join("\n").match(/\b\d{1,7}(?:\.\d{1,6})?\b/g) || [])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);

  const base = hinted.length ? hinted : allNums;
  const cleanNums = base.filter((n) => n > 0.0000001 && n < 10000000);
  cleanNums.sort((a, b) => a - b);

  const merged = [];
  for (const v of cleanNums) {
    if (!merged.length) { merged.push(v); continue; }
    const prev = merged[merged.length - 1];
    const tol = Math.max(0.0001, prev * 0.0025);
    if (Math.abs(v - prev) <= tol) {
      merged[merged.length - 1] = Number(((prev + v) / 2).toFixed(6));
    } else {
      merged.push(v);
    }
  }
  return merged.slice(0, 10);
}

function refineLevelsByCandles(levels, candles) {
  const lv = (Array.isArray(levels) ? levels : []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (!lv.length) return [];
  if (!Array.isArray(candles) || !candles.length) return lv.slice(0, 8);
  const highs = candles.map((x) => Number(x?.h)).filter((n) => Number.isFinite(n));
  const lows = candles.map((x) => Number(x?.l)).filter((n) => Number.isFinite(n));
  if (!highs.length || !lows.length) return lv.slice(0, 8);
  const hi = Math.max(...highs), lo = Math.min(...lows);
  const minV = lo * 0.7;
  const maxV = hi * 1.3;
  const filtered = lv.filter((n) => n >= minV && n <= maxV);
  if (!filtered.length) return extractLevelsFromCandles(candles).slice(0, 8);
  return [...new Set(filtered.map((n) => Number(n.toFixed(6))))].sort((a,b)=>a-b).slice(0, 8);
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

function buildZonesSvgFromAnalysis(analysisText, symbol, timeframe) {
  const levels = extractLevels(analysisText);
  const W = 900, H = 520;
  const pad = 60;

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
        .l{ stroke: rgba(255,255,255,.20); stroke-width: 2; }
        .z{ fill:url(#a); opacity:0.18; }
        .p{ font: 700 14px ui-monospace,monospace; fill: rgba(255,255,255,.92); }
      </style>
    </defs>
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#g)"/>
    <rect x="${pad}" y="${pad}" width="${W-2*pad}" height="${H-2*pad}" rx="24" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.10)"/>
  `;

  const header = `
    <text class="t" x="${pad}" y="${pad-18}">MarketiQ • Zones</text>
    <text class="s" x="${pad}" y="${pad-0}">${escapeXml(symbol)} — ${escapeXml(timeframe)} — (auto)</text>
  `;

  const plotX = pad + 30;
  const plotY = pad + 30;
  const plotW = W - 2*pad - 60;
  const plotH = H - 2*pad - 80;

  let lines = "";
  if (levels.length >= 2) {
    const min = levels[0], max = levels[levels.length-1];
    const toY = (v) => plotY + plotH - ((v - min) / (max - min || 1)) * plotH;

    for (let i = 0; i < Math.min(levels.length-1, 4); i++) {
      const y1 = toY(levels[i+1]);
      const y2 = toY(levels[i]);
      lines += `<rect class="z" x="${plotX}" y="${Math.min(y1,y2)}" width="${plotW}" height="${Math.abs(y2-y1)}" rx="14"/>`;
      lines += `<line class="l" x1="${plotX}" y1="${y1}" x2="${plotX+plotW}" y2="${y1}"/>`;
      lines += `<text class="p" x="${plotX+plotW+10}" y="${y1+5}">${levels[i+1]}</text>`;
    }
    const y0 = toY(levels[0]);
    lines += `<line class="l" x1="${plotX}" y1="${y0}" x2="${plotX+plotW}" y2="${y0}"/>`;
    lines += `<text class="p" x="${plotX+plotW+10}" y="${y0+5}">${levels[0]}</text>`;
  } else {
    lines += `<text class="s" x="${plotX}" y="${plotY+30}">Level یافت نشد. برای رندر بهتر، خروجی مدل باید شامل چند عدد سطح باشد.</text>`;
  }

  const footer = `
    <text class="s" x="${pad}" y="${H-18}">Generated by MarketiQ (SVG) — Educational use only</text>
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${bg}${header}${lines}${footer}</svg>`;
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

/* ========================== MINI APP INLINE ASSETS ========================== */
function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}
function jsResponse(js, status = 200) {
  return new Response(js, {
    status,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}
function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}


function extractInitDataFromRequest(request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("initData") || url.searchParams.get("init_data");
    if (q) return q;

    const auth = request.headers.get("authorization") || request.headers.get("Authorization");
    if (auth) {
      const m = auth.match(/^Bearer\s+(.+)$/i);
      if (m && m[1]) return m[1].trim();
    }

    const h = request.headers.get("x-telegram-initdata") || request.headers.get("x-initdata");
    if (h) return String(h).trim();
  } catch (_) {}
  return "";
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  const parts = String(header).split(";");
  for (const p of parts) {
    const i = p.indexOf("=");
    if (i === -1) continue;
    const k = p.slice(0, i).trim();
    const v = p.slice(i + 1).trim();
    if (!k) continue;
    out[k] = v;
  }
  return out;
}

function b64urlEncode(bytes) {
  let bin = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecodeToBytes(s) {
  s = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSha256(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

async function makeSessionToken(payload, env) {
  const secret = env.SESSION_SECRET || env.MINIAPP_SESSION_SECRET || "";
  if (!secret) return "";
  const header = { alg: "HS256", typ: "JWT" };
  const enc = (o) => b64urlEncode(new TextEncoder().encode(JSON.stringify(o)));
  const h = enc(header);
  const p = enc(payload);
  const data = `${h}.${p}`;
  const sig = await hmacSha256(secret, data);
  return `${data}.${b64urlEncode(sig)}`;
}

async function verifySessionToken(token, env) {
  const secret = env.SESSION_SECRET || env.MINIAPP_SESSION_SECRET || "";
  if (!secret) return { ok: false, reason: "no_session_secret" };
  token = String(token || "").trim();
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "bad_token" };
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  let sig;
  try { sig = b64urlDecodeToBytes(s); } catch (_) { return { ok: false, reason: "bad_token_sig" }; }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const ok = await crypto.subtle.verify("HMAC", key, sig, new TextEncoder().encode(data));
  if (!ok) return { ok: false, reason: "bad_token_sig" };

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlDecodeToBytes(p)));
  } catch (_) {
    return { ok: false, reason: "bad_token_payload" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload?.exp && now > payload.exp) return { ok: false, reason: "token_expired" };
  if (!payload?.uid) return { ok: false, reason: "token_missing_uid" };

  return { ok: true, payload };
}

function extractSessionTokenFromRequest(request) {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization");
  if (auth) {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m && m[1]) return m[1].trim();
  }

  const cookies = parseCookies(request.headers.get("cookie") || request.headers.get("Cookie"));
  if (cookies.mq_session) return cookies.mq_session;

  const h = request.headers.get("x-session-token") || request.headers.get("x-mq-session");
  if (h) return String(h).trim();

  return "";
}

async function authMiniappRequest(request, body, env) {
  const hasSessionSecret = !!String(env.SESSION_SECRET || env.MINIAPP_SESSION_SECRET || "").trim();
  if (hasSessionSecret) {
    const tok = extractSessionTokenFromRequest(request);
    if (tok) {
      const vt = await verifySessionToken(tok, env);
      if (vt.ok) {
        const pl = vt.payload;
        const fromLike = {
          id: pl.uid,
          username: pl.un || "",
          first_name: pl.fn || "",
          last_name: pl.ln || "",
        };
        return { ok: true, userId: pl.uid, fromLike, via: "session" };
      }
    }
  }

  const initData = (body && body.initData) ? body.initData : extractInitDataFromRequest(request);
  const v = await verifyTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN, env.INITDATA_MAX_AGE_SEC, env.MINIAPP_AUTH_LENIENT);
  if (!v.ok) return v;
  return { ...v, via: "initData" };
}

function setSessionCookie(token, env) {
  const maxAge = Number(env.SESSION_MAX_AGE || 7 * 24 * 3600);
  return `mq_session=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=None`;
}

function clearSessionCookie() {
  return `mq_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None`;
}

function miniappGuestEnabled(env) {
  const v = String(env.MINIAPP_GUEST_READONLY || "1").trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "no");
}

async function buildMiniappGuestPayload(env) {
  const st = defaultUser("guest");
  const symbols = [...MAJORS, ...METALS, ...INDICES, ...CRYPTOS];
  const styles = await getStyleList(env);
  return {
    ok: true,
    guest: true,
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



/* ========================== TELEGRAM MINI APP initData verification ========================== */
async function verifyTelegramInitData(initData, botToken, maxAgeSecRaw, lenientRaw) {
  if (!initData || typeof initData !== "string") return { ok: false, reason: "initData_missing" };
  const lenient = String(lenientRaw || "").trim() === "1" || String(lenientRaw || "").toLowerCase() === "true";
  const initRaw = String(initData || "").trim();
  if (lenient && initRaw.startsWith("dev:")) {
    const devId = Number(initRaw.split(":")[1] || "0") || 999001;
    return { ok: true, userId: devId, fromLike: { username: "dev_user", userId: String(devId), id: devId } };
  }
  if (!botToken && !lenient) return { ok: false, reason: "bot_token_missing" };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash && !lenient) return { ok: false, reason: "hash_missing" };
  params.delete("hash");

  const authDate = Number(params.get("auth_date") || "0");
  if ((!Number.isFinite(authDate) || authDate <= 0) && !lenient) return { ok: false, reason: "auth_date_invalid" };
  const now = Math.floor(Date.now() / 1000);
  const maxAgeSec = Math.max(60, Number(maxAgeSecRaw || 0) || (lenient ? 7 * 24 * 60 * 60 : 300));
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

  const fromLike = { username: user?.username || "", userId: String(userId), id: Number(userId) || undefined };
  return { ok: true, userId, fromLike };
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
function timingSafeEqualHex(a, b) {
  a = String(a || "").toLowerCase();
  b = String(b || "").toLowerCase();
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ========================== MINI APP UI (MODERN TRADING) ========================== */
const MINI_APP_HTML = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>MarketiQ Mini App</title>
  <meta name="color-scheme" content="dark light" />
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
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
      <button class="tab-btn" data-tab="admin">پنل مدیریت</button>
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
          <div class="quote-grid">
            <div class="quote-item"><div class="k">نماد</div><div class="v" id="quoteSymbol">—</div></div>
            <div class="quote-item"><div class="k">قیمت</div><div class="v" id="quotePrice">—</div></div>
            <div class="quote-item"><div class="k">تغییر</div><div class="v" id="quoteChange">—</div></div>
            <div class="quote-item"><div class="k">روند</div><div class="v" id="quoteTrend">—</div></div>
          </div>
          <div class="muted" style="font-size:12px; margin-top:8px;" id="quoteMeta">در حال دریافت داده…</div>
        </div>
      </div>

      <div class="card tab-section" id="newsCard" data-tab-section="news">
        <div class="card-h">
          <strong>📰 اخبار فارسی نماد</strong>
          <button id="refreshNews" class="btn ghost" style="min-width:unset; padding:6px 10px;">بروزرسانی</button>
        </div>
        <div class="card-b">
          <div class="mini-list" id="newsList">در حال دریافت خبر…</div>
          <div class="muted" style="margin-top:10px; font-size:12px;">تحلیل خبری:</div>
          <div class="mini-list" id="newsAnalysis">در حال تولید تحلیل خبری…</div>
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

        <div class="out" id="out">آماده…</div>

        <div class="card" id="chartCard" style="display:none; margin-top:12px;">
          <div class="card-h">
            <strong>چارت</strong>
            <span class="muted" id="chartMeta">QuickChart</span>
          </div>
          <div class="card-b">
            <img id="chartImg" alt="chart" style="width:100%; border-radius:16px; display:block;" />
          </div>
        </div>
      </div>

      <div class="card tab-panel" id="supportCard" data-panel="support">
        <div class="card-h">
          <strong>پشتیبانی</strong>
          <span>ارسال تیکت</span>
        </div>
        <div class="card-b">
          <div class="chips" id="adminTabs">
            <button type="button" class="chip on" data-tab="overview">مرور</button>
            <button type="button" class="chip" data-tab="content">محتوا</button>
            <button type="button" class="chip" data-tab="operations">عملیات</button>
            <button type="button" class="chip" data-tab="support">پشتیبانی</button>
            <button type="button" class="chip" data-tab="reports">گزارش</button>
          </div>
          <div class="field admin-tab" data-tab="overview">
            <div class="label">متن تیکت</div>
            <textarea id="supportTicketText" class="control" placeholder="مشکل یا درخواست خود را بنویسید..." maxlength="300"></textarea>
          </div>
          <div class="actions">
            <button id="sendSupportTicket" class="btn">✉️ ارسال تیکت</button>
          </div>
          <div class="muted" style="font-size:12px; line-height:1.6;">پاسخ از طریق پشتیبانی تلگرام ارسال می‌شود.
با ارسال تیکت می‌توانید با کارشناسان ما نظرات خود را درمیان بگذارید.</div>
        </div>
      </div>

      <div class="card admin-card tab-section" id="adminCard" data-tab-section="admin">
        <div class="card-h">
          <strong id="adminTitle">پنل ادمین</strong>
          <span>مدیریت پرامپت، سبک‌ها، پرداخت، برداشت و تیکت‌ها</span>
        </div>
        <div class="card-b admin-grid">
          <div class="field">
            <div class="label">پرامپت اصلی تحلیل</div>
            <textarea id="adminPrompt" class="control" placeholder="پرامپت اصلی تحلیل..."></textarea>
            <div class="actions">
              <button id="savePrompt" class="btn primary">ذخیره پرامپت</button>
            </div>
          </div>

          <div class="field">
            <div class="label">پرامپت پایه + سبک‌ها (JSON)</div>
            <textarea id="stylePromptJson" class="control" placeholder='{"پرایس_اکشن":"...","ict":"...","atr":"..."}'></textarea>
            <div class="admin-row">
              <input id="stylePromptJsonFile" type="file" accept="application/json,.json" class="control" />
            </div>
            <div class="actions">
              <button id="saveStylePrompts" class="btn">ذخیره JSON سبک‌ها</button>
            </div>
          </div>

          <div class="field">
            <div class="label">مدیریت سبک‌ها</div>
            <div class="admin-row">
              <input id="newStyle" class="control" placeholder="سبک جدید" />
              <button id="addStyle" class="btn">افزودن سبک</button>
            </div>
            <div class="admin-row">
              <input id="removeStyleName" class="control" placeholder="نام سبک برای حذف" />
              <button id="removeStyle" class="btn ghost">حذف سبک</button>
            </div>
            <div class="mini-list" id="styleList">—</div>
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
            <div class="label">پرامپت‌های اختصاصی (JSON)</div>
            <textarea id="customPromptsJson" class="control" placeholder='[{"id":"p1","title":"VIP","text":"..."}]'></textarea>
            <div class="admin-row">
              <input id="customPromptsJsonFile" type="file" accept="application/json,.json" class="control" />
            </div>
            <div class="actions">
              <button id="saveCustomPrompts" class="btn">ذخیره پرامپت‌های اختصاصی</button>
            </div>
            <div class="admin-row">
              <input id="customPromptUser" class="control" placeholder="یوزرنیم کاربر" />
              <input id="customPromptId" class="control" placeholder="شناسه پرامپت" />
              <button id="sendCustomPrompt" class="btn ghost">ارسال به کاربر</button>
            </div>
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
            <div class="mini-list" id="paymentList">—</div>
          </div>

          
          <div class="field admin-tab" data-tab="content">
            <div class="label">بنر پیشنهاد (نمایش داخل مینی‌اپ)</div>
            <textarea id="offerBannerInput" class="control" placeholder="متن بنر پیشنهاد..."></textarea>
            <input id="offerBannerImageInput" type="file" accept="image/*" class="control" />
            <div class="muted" style="font-size:12px;">برای حذف تصویر، فایل را خالی بگذار و ذخیره کن.</div>
            <div class="actions">
              <button id="saveOfferBanner" class="btn">ذخیره بنر</button>
            </div>
            <div class="admin-row">
              <input id="offerImageFile" type="file" accept="image/*" class="control" />
              <button id="clearOfferImage" class="btn ghost">حذف تصویر</button>
            </div>
            <input id="offerBannerImageInput" class="control" placeholder="یا لینک تصویر بنر..." />
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

      <script src="https://telegram.org/js/telegram-web-app.js"></script>
      <script src="app.js"></script>
</body>
</html>`;

const MINI_APP_JS = `let tg = null;

function injectTelegramSdkOnce() {
  if (window.Telegram?.WebApp) return Promise.resolve();
  return new Promise((resolve) => {
    const existing = document.querySelector('script[src="https://telegram.org/js/telegram-web-app.js"]');
    const finish = () => {
      let tries = 0;
      const t = setInterval(() => {
        if (window.Telegram?.WebApp) { clearInterval(t); resolve(); return; }
        tries++;
        if (tries >= 20) { clearInterval(t); resolve(); }
      }, 100);
      setTimeout(() => { clearInterval(t); resolve(); }, 4000);
    };
    if (existing) {
      if (window.Telegram?.WebApp) return resolve();
      existing.addEventListener('load', finish, { once: true });
      setTimeout(finish, 200);
      return;
    }
    const sc = document.createElement('script');
    sc.src = 'https://telegram.org/js/telegram-web-app.js';
    sc.async = true;
    sc.onload = finish;
    sc.onerror = () => resolve();
    document.head.appendChild(sc);
  });
}

async function ensureTelegramReady() {
  await injectTelegramSdkOnce();
  const webapp = window.Telegram?.WebApp || null;
  if (webapp) {
    webapp.ready();
    if (webapp.expand) webapp.expand();
  }
  tg = webapp;
  return { tg: webapp, isTelegramRuntime: !!webapp };
}

const out = document.getElementById("out");
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
let IS_STAFF = false;
let IS_OWNER = false;
let IS_GUEST = false;
let OFFLINE_MODE = false;

const LOCAL_KEYS = {
  initData: "miniapp_init_data",
  userState: "miniapp_cached_user_state_v1",
  quoteCache: "miniapp_quote_cache_v1",
  newsCache: "miniapp_news_cache_v1",
  newsAnalysisCache: "miniapp_news_analysis_cache_v1",
  analyzeCache: "miniapp_analyze_cache_v1",
};
const API_BASE = window.location.origin;
let ADMIN_TICKETS = [];
let ADMIN_TICKETS_ALL = [];
let ADMIN_WITHDRAWALS = [];
let ADMIN_PROMPT_REQS = [];
let QUOTE_TIMER = null;
let QUOTE_BUSY = false;
let NEWS_TIMER = null;
const CONNECTION_HINT = "مینی‌اپ را داخل تلگرام باز کنید. در صورت خطا، یک‌بار ببندید و دوباره اجرا کنید.";

function getFreshInitData() {
  const tg = window.Telegram?.WebApp;
  const latestTg = (tg?.initData || "").trim();
  if (latestTg) {
    INIT_DATA = latestTg;
    try { localStorage.setItem(LOCAL_KEYS.initData, latestTg); } catch {}
  }
  return INIT_DATA || latestTg || "";
}

function buildAuthBody(extra = {}) {
  const initData = getFreshInitData();
  if (initData) return { initData, ...extra };
  const miniToken = MINI_TOKEN || localStorage.getItem(LOCAL_KEYS.miniToken) || "";
  if (miniToken) return { miniToken, ...extra };
  if (extra?.allowGuest) return { ...extra, allowGuest: true };
  return { ...extra };
}

function isTelegramLikelyContext() {
  const ua = String(navigator.userAgent || "").toLowerCase();
  const hasTgData = !!(window.Telegram || getParamEverywhere("tgWebAppData") || getParamEverywhere("tgWebAppVersion"));
  return ua.includes("telegram") || hasTgData;
}

function showOpenInTelegramState(msg) {
  out.textContent = msg;
  const box = document.createElement("div");
  box.style.marginTop = "10px";
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.type = "button";
  btn.textContent = "کپی لینک برای باز کردن داخل Telegram";
  btn.onclick = async () => {
    const link = window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      showToast("لینک کپی شد", "آن را در Telegram باز کنید", "COPY", false);
    } catch {
      showToast("کپی نشد", "لینک را دستی کپی کنید", "LINK", false);
    }
  };
  box.appendChild(btn);
  out.appendChild(box);
}

function isTelegramLikelyContext() {
  const ua = String(navigator.userAgent || "").toLowerCase();
  const hasTgData = !!(window.Telegram || getParamEverywhere("tgWebAppData") || getParamEverywhere("tgWebAppVersion"));
  return ua.includes("telegram") || hasTgData;
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
  const selected = tab || "dashboard";
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === selected);
  });
  document.querySelectorAll(".tab-section").forEach((sec) => {
    sec.classList.toggle("active", sec.dataset.tabSection === selected);
  });
}

function setupTabs(){
  const tabs = el("mainTabs");
  if (!tabs) return;
  tabs.addEventListener("click", (e) => {
    const b = e.target?.closest?.(".tab-btn");
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

function fillSymbols(list){
  ALL_SYMBOLS = Array.isArray(list) ? list.slice() : [];
  const sel = el("symbol");
  const cur = sel.value;
  sel.innerHTML = "";
  for (const s of ALL_SYMBOLS) {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  }
  if (cur && ALL_SYMBOLS.includes(cur)) sel.value = cur;
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
    opt.value = String(p?.id || "");
    opt.textContent = p?.title ? String(p.title) : String(p?.id || "");
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
  const chips = el("tfChips")?.querySelectorAll(".chip") || [];
  for (const c of chips) c.classList.toggle("on", c.dataset.tf === tf);
}

async function api(path, body){
  let lastErr = null;
  const quickBoot = path === "/api/user" && !!body?.allowGuest;
  const attempts = quickBoot ? 2 : 2;
  for (let i = 0; i < attempts; i++) {
    try {
      const ac = new AbortController();
      const quickMs = i === 0 ? 4500 : 9000;
      const tm = setTimeout(() => ac.abort("timeout"), quickBoot ? quickMs : (12000 + (i * 4000)));
      const r = await fetch(API_BASE + path, {        method: "POST",
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
  const errText = String(lastErr?.message || lastErr || "network_error");
  const normalized = errText.toLowerCase().includes("timeout") || errText.toLowerCase().includes("abort")
    ? "request_timeout"
    : errText;
  return { status: 599, json: { ok: false, error: normalized } };
}

async function adminApi(path, body){
  if (!IS_STAFF) return { status: 403, json: { ok: false, error: "forbidden" } };
  return api(path, buildAuthBody(body));
}

function prettyErr(j, status){
  const e = j?.error || "نامشخص";
  if (status === 429 && String(e).startsWith("quota_exceeded")) return "سهمیه امروز تمام شد.";
  if (status === 403 && String(e) === "onboarding_required") return "ابتدا حداقل نام یا یوزرنیم خود را تکمیل کنید.";
  if (status === 403 && String(e) === "forbidden") return "دسترسی این بخش برای نقش فعلی شما مجاز نیست.";
  if (status === 401) {
    if (String(e).includes("initData")) return "اتصال مینی‌اپ منقضی شده؛ اپ را مجدد از داخل تلگرام باز کنید.";
    return "احراز هویت تلگرام ناموفق است.";
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

  if (!data?.ok) {
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
    const timeframe = val("timeframe") || "H4";
    if (!symbol) return;
    const ck = quoteCacheKey(symbol, timeframe);

    if (OFFLINE_MODE) {
      const cached = readByKey(LOCAL_KEYS.quoteCache, ck);
      setQuoteUi(cached, "قیمت لحظه‌ای از کش محلی");
      return;
    }

    const { json } = await api("/api/quote", buildAuthBody({ symbol, timeframe, allowGuest: true }));
    if (json?.ok) {
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

function renderNewsList(json){
  const target = el("newsList");
  if (!target) return;
  if (!json?.ok || !Array.isArray(json.articles) || !json.articles.length) {
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
  if (json?.ok) {
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
    if (target) target.textContent = cached?.summary || "تحلیل خبری آفلاین موجود نیست.";
    return;
  }

  const { json } = await api("/api/news/analyze", buildAuthBody({ symbol, allowGuest: true }));
  if (!target) return;
  if (json?.ok) {
    cacheByKey(LOCAL_KEYS.newsAnalysisCache, ck, json);
    target.textContent = json.summary || "—";
    return;
  }
  const cached = readByKey(LOCAL_KEYS.newsAnalysisCache, ck);
  target.textContent = cached?.summary || "تحلیل خبری در دسترس نیست.";
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
  const tpl = el("ticketReplyTemplate")?.value || "";
  if (!tpl) return;
  const input = el("ticketReply");
  if (!input) return;
  if (!input.value.trim()) input.value = tpl;
}

function updateMeta(state, quota){
  const q = String(quota || "-");
  let energy = "—";
  let remainTxt = "∞";
  const m = q.match(/^(\d+)\/(\d+)$/);
  if (m) {
    const used = Number(m[1] || 0);
    const lim = Math.max(1, Number(m[2] || 1));
    const remain = Math.max(0, lim - used);
    const pct = Math.max(0, Math.min(100, Math.round((remain / lim) * 100)));
    energy = pct + "%";
    remainTxt = String(remain);
  } else if (q === "∞") {
    energy = "100%";
    remainTxt = "∞";
  }
  meta.textContent = "انرژی: " + energy + " | تحلیل باقی‌مانده: " + remainTxt + " | سهمیه: " + q;
  sub.textContent = "ID: " + (state?.userId || "-") + " | امروز(Tehran): " + (state?.dailyDate || "-");
  const q = String(quota || "");
  const m = q.match(/(\d+)\s*\/\s*(\d+)/);
  let used = 0;
  let limit = 0;
  if (m) {
    used = Number(m[1] || 0);
    limit = Number(m[2] || 0);
  }
  const remaining = Math.max(0, limit - used);
  const pct = limit > 0 ? Math.max(0, Math.min(100, Math.round((remaining / limit) * 100))) : 100;
  if (remainingText) remainingText.textContent = "تحلیل باقی‌مانده: " + (limit > 0 ? String(remaining) : "∞");
  if (energyText) energyText.textContent = "انرژی: " + (limit > 0 ? (pct + "%") : "نامحدود");
  if (energyFill) energyFill.style.width = (limit > 0 ? pct : 100) + "%";
}

function updateDashboardStats(role, quota){
  const raw = String(quota || "0/0");
  let used = 0, limit = 0;
  if (raw.includes("/")) {
    const [u, l] = raw.split("/");
    used = Number(u) || 0;
    limit = Number(l) || 0;
  }
  const remain = (Number.isFinite(limit) && limit > 0) ? Math.max(0, limit - used) : (raw === "∞" ? "∞" : 0);
  if (roleLabel) roleLabel.textContent = role || "user";
  if (energyToday) energyToday.textContent = raw === "∞" ? "نامحدود" : String(used);
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
  const global = commission?.globalPercent ?? 0;
  const overrides = commission?.overrides || {};
  const lines = ["کلی: " + global + "%"];
  for (const [k, v] of Object.entries(overrides)) lines.push(String(k) + ": " + String(v) + "%");
  target.textContent = lines.join("\\n");
}

function renderPayments(list){
  const target = el("paymentList");
  if (!target) return;
  if (!Array.isArray(list) || !list.length) { target.textContent = "—"; return; }
  target.textContent = list.slice(0, 8).map((p) => {
    const who = p.username || p.userId;
    return "• " + who + " | " + p.amount + " | " + p.status + " | " + (p.txHash || "—");
  }).join("\\n");
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

  const items = ADMIN_TICKETS.slice().sort((a,b) => String(b?.createdAt||"").localeCompare(String(a?.createdAt||"")));
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
  const items = ADMIN_WITHDRAWALS.slice().sort((a,b) => String(b?.createdAt||"").localeCompare(String(a?.createdAt||"")));
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
  const items = ADMIN_PROMPT_REQS.slice().sort((a,b) => String(b?.createdAt||"").localeCompare(String(a?.createdAt||"")));
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
  if (json?.ok) renderTickets(json.tickets || []);
}

function applyTicketFilter(status){
  if (!status) return renderTickets(ADMIN_TICKETS_ALL || [], true);
  const filtered = (ADMIN_TICKETS_ALL || []).filter((x) => String(x?.status || "pending") === status);
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

async function refreshWithdrawals(){
  const { json } = await adminApi("/api/admin/withdrawals/list", {});
  if (json?.ok) renderWithdrawals(json.withdrawals || []);
}

async function refreshPromptReqs(){
  const { json } = await adminApi("/api/admin/custom-prompts/requests", {});
  if (json?.ok) renderPromptReqs(json.requests || []);
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
  try { return JSON.parse(text); } catch { return fallback; }
}

function cacheUserSnapshot(json) {
  try {
    const data = {
      welcome: json?.welcome || "",
      state: json?.state || {},
      quota: json?.quota || "",
      symbols: json?.symbols || [],
      styles: json?.styles || [],
      customPrompts: json?.customPrompts || [],
      offerBanner: json?.offerBanner || "",
      offerBannerImage: json?.offerBannerImage || "",
      role: json?.role || "user",
      isStaff: !!json?.isStaff,
      wallet: json?.wallet || "",
      cachedAt: Date.now(),
    };
    localStorage.setItem(LOCAL_KEYS.userState, JSON.stringify(data));
  } catch {}
}

function readCachedUserSnapshot() {
  try {
    return safeJsonParse(localStorage.getItem(LOCAL_KEYS.userState) || "", null);
  } catch {
    return null;
  }
}

function applyUserState(json) {
  welcome.textContent = json.welcome || "";
  fillSymbols(json.symbols || []);
  const styleList = json.styles || [];
  fillStyles(styleList);
  fillCustomPrompts(json.customPrompts || []);
  if (json.state?.timeframe) setTf(json.state.timeframe);
  if (json.state?.style && styleList.includes(json.state.style)) {
    setVal("style", json.state.style);
  } else if (styleList.length) {
    setVal("style", styleList[0]);
  }
  if (json.state?.risk) setVal("risk", json.state.risk);
  if (typeof json.state?.customPromptId === "string") setVal("customPrompt", json.state.customPromptId);
  setVal("newsEnabled", String(!!json.state?.newsEnabled));
  setVal("promptMode", json.state?.promptMode || "style_plus_custom");

  if (json.state?.selectedSymbol && (json.symbols || []).includes(json.state.selectedSymbol)) {
    setVal("symbol", json.state.selectedSymbol);
  } else if (json.symbols?.length) setVal("symbol", json.symbols[0]);
  if (offerText) offerText.textContent = json.offerBanner || "فعال‌سازی اشتراک ویژه با تخفیف محدود.";
  if (offerTag) offerTag.textContent = json.role === "owner" ? "Owner" : "Special";
  if (offerImage) {
    const img = String(json.offerBannerImage || "").trim();
    offerImage.style.display = img ? "block" : "none";
    if (img) offerImage.src = img;
  }

  updateMeta(json.state, json.quota);
}


function storageGetObj(key, fallback = {}) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : fallback;
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function storageSetObj(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value || {})); } catch {}
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

// تست دستی: داخل تلگرام tg/initData آماده می‌شود و /api/user باید ok باشد.
// خارج تلگرام پیام "داخل تلگرام باز کنید" نمایش داده می‌شود و حالت محدود/مهمان فعال می‌ماند.
async function boot(){
  out.textContent = "⏳ در حال آماده‌سازی…";
  pillTxt.textContent = "Connecting…";
  showToast("در حال اتصال…", "دریافت پروفایل و تنظیمات", "API", true);

  const { tg, isTelegramRuntime } = await ensureTelegramReady();

  const preCached = readCachedUserSnapshot();
  if (preCached) {
    applyUserState(preCached);
    out.textContent = "⏳ در حال همگام‌سازی با سرور…";
    pillTxt.textContent = "Syncing…";
    setupLiveQuotePolling();
    setupNewsPolling();
  }

  const devModeEnabled = String(window.MINIAPP_DEV_MODE || "").trim() === "1";
  const maybeTelegram = isTelegramRuntime || isTelegramLikelyContext();
  const qsInitData = getParamEverywhere("initData") || "";
  const savedInitData = localStorage.getItem(LOCAL_KEYS.initData) || "";
  let initData = (tg?.initData || "").trim();

  // Telegram WebApp may populate initData with a slight delay.
  if (isTelegramRuntime && !initData) {
    for (let i = 0; i < 8 && !initData; i++) {
      await new Promise((r) => setTimeout(r, 300));
      initData = (tg?.initData || "").trim();
    }
  }

  if (initData) {
    INIT_DATA = initData;
    localStorage.setItem(LOCAL_KEYS.initData, initData);
  } else if (qsInitData) {
    INIT_DATA = qsInitData;
    localStorage.setItem(LOCAL_KEYS.initData, qsInitData);
  } else if (savedInitData) {
    INIT_DATA = savedInitData;
  } else if (!isTelegramRuntime && devModeEnabled) {
    const devInit = "dev:999001";
    INIT_DATA = devInit;
    localStorage.setItem(LOCAL_KEYS.initData, devInit);
    showToast("حالت آسان فعال شد", "ورود موقت برای تست مینی‌اپ", "DEV", false);
  } else {
    INIT_DATA = "";
    if (!isTelegramRuntime && maybeTelegram) {
      showToast("اتصال تلگرام کامل نشد", "لطفاً مینی‌اپ را دوباره از داخل Telegram باز کنید.", "WAIT", false);
    } else if (!isTelegramRuntime) {
      showToast("داخل تلگرام باز کنید", "این صفحه باید داخل Telegram WebView باز شود.", "BLOCKED", false);
      showOpenInTelegramState("این صفحه باید داخل تلگرام باز شود.");
    } else {
      showToast("حالت مهمان", "اتصال احراز نشده؛ اجرای محدود با داده عمومی", "GUEST", false);
    }
  }
  let {status, json} = await api("/api/user", buildAuthBody({ allowGuest: true }));


  if (!json?.ok && status === 401 && isTelegramRuntime && tg?.initData && !INIT_DATA) {
    INIT_DATA = tg.initData.trim();
    if (INIT_DATA) {
      try { localStorage.setItem(LOCAL_KEYS.initData, INIT_DATA); } catch {}
      const retryTg = await api("/api/user", buildAuthBody({ allowGuest: true }));
      status = retryTg.status;
      json = retryTg.json;
    }
  }

  if (!json?.ok && status === 401 && isTelegramRuntime && tg?.initData && !INIT_DATA) {
    INIT_DATA = tg.initData.trim();
    if (INIT_DATA) {
      try { localStorage.setItem(LOCAL_KEYS.initData, INIT_DATA); } catch {}
      const retryTg = await api("/api/user", buildAuthBody({ allowGuest: true }));
      status = retryTg.status;
      json = retryTg.json;
    }
  }

  if (!json?.ok) {
    if (status === 401) {
      try { localStorage.removeItem(LOCAL_KEYS.initData); } catch {}
    }
    const cached = readCachedUserSnapshot();
    if (!cached) {
      const fallback = {
        welcome: "نسخه محدود مینی‌اپ فعال شد.",
        state: { timeframe: "H4", style: "پرایس اکشن", risk: "متوسط", newsEnabled: true, promptMode: "style_plus_custom", selectedSymbol: "BTCUSDT" },
        quota: "guest",
        symbols: ["BTCUSDT","ETHUSDT","XAUUSD","EURUSD"],
        styles: ["پرایس اکشن","ICT","ATR","ترکیبی"],
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
    return;
  }
}

  OFFLINE_MODE = false;
  cacheUserSnapshot(json);
  applyUserState(json);
  out.textContent = "آماده ✅";
  pillTxt.textContent = "Online";
  hideToast();
  setupLiveQuotePolling();
  setupNewsPolling();
  IS_STAFF = !!json.isStaff;
  IS_OWNER = json.role === "owner";
  IS_GUEST = !!json.guest;

  const adminTabBtn = document.querySelector('.tab-btn[data-tab="admin"]');
  if (adminTabBtn) adminTabBtn.style.display = IS_STAFF ? "inline-flex" : "none";

  if (IS_STAFF && adminCard) {
    adminCard.classList.add("show");
    setAdminTab("overview");
    if (adminTitle) adminTitle.textContent = IS_OWNER ? "پنل اونر" : "پنل ادمین";

    // Owner-only blocks
    document.querySelectorAll(".owner-hide").forEach((x) => {
      x.classList.toggle("hidden", !IS_OWNER);
    });

    if (el("offerBannerInput")) el("offerBannerInput").value = json.offerBanner || "";
    if (el("offerBannerImageInput")) el("offerBannerImageInput").value = json.offerBannerImage || "";
    if (IS_OWNER && el("walletAddressInput")) el("walletAddressInput").value = json.wallet || "";

    await loadAdminBootstrap();
  } else {
    applyTab("dashboard");
  }
}

async function loadAdminBootstrap(){
  const { json } = await adminApi("/api/admin/bootstrap", {});
  if (!json?.ok) return;

  if (el("adminPrompt")) el("adminPrompt").value = json.prompt || "";
  if (el("stylePromptJson")) el("stylePromptJson").value = JSON.stringify(json.stylePrompts || {}, null, 2);
  if (el("customPromptsJson")) el("customPromptsJson").value = JSON.stringify(json.customPrompts || [], null, 2);
  if (el("freeDailyLimit")) el("freeDailyLimit").value = String(json.freeDailyLimit ?? "");
  if (el("offerBannerInput")) el("offerBannerInput").value = json.offerBanner || "";
  if (el("offerBannerImageInput")) el("offerBannerImageInput").value = json.offerBannerImage || "";
  if (el("welcomeBotInput")) el("welcomeBotInput").value = json.welcomeBot || "";
  if (el("welcomeMiniappInput")) el("welcomeMiniappInput").value = json.welcomeMiniapp || "";

  if (json.adminFlags) {
    if (el("flagCapitalMode")) el("flagCapitalMode").checked = !!json.adminFlags.capitalModeEnabled;
    if (el("flagProfileTips")) el("flagProfileTips").checked = !!json.adminFlags.profileTipsEnabled;
  }

  renderStyleList(json.styles || []);
  renderCommissionList(json.commission || {});
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
applyTab("dashboard");

el("q").addEventListener("input", (e) => filterSymbols(e.target.value));
el("symbol")?.addEventListener("change", () => { refreshLiveQuote(true); refreshSymbolNews(true); refreshNewsAnalysis(true); });
el("timeframe")?.addEventListener("change", () => refreshLiveQuote(true));
el("refreshNews")?.addEventListener("click", () => { refreshSymbolNews(true); refreshNewsAnalysis(true); });
el("tfChips").addEventListener("click", (e) => {
  const chip = e.target?.closest?.(".chip");
  const tf = chip?.dataset?.tf;
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
  };

  const {status, json} = await api("/api/settings", payload);
  if (!json?.ok) {
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
    if (cached?.result) {
      out.textContent = cached.result;
      if (cached?.zonesSvg) renderChartFallbackSvg(cached.zonesSvg);
      showToast("آفلاین", "آخرین تحلیل ذخیره‌شده نمایش داده شد.", "AI", false);
    } else {
      out.textContent = "⚠️ تحلیل آنلاین در حالت آفلاین/مهمان غیرفعال است. برای ادامه از داخل تلگرام متصل شوید.";
      showToast("محدود", "تحلیل نیاز به اتصال و احراز تلگرام دارد.", "AI", false);
    }
    return;
  }
  showToast("در حال تحلیل…", "جمع‌آوری دیتا + تولید خروجی", "AI", true);
  out.textContent = "⏳ در حال تحلیل…";

  const payload = buildAuthBody({ symbol: val("symbol"), userPrompt: "" });

  const {status, json} = await api("/api/analyze", payload);
  if (!json?.ok) {
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
  // Render chart if available
  const chartCard = el("chartCard");
  const chartImg = el("chartImg");
  if (chartCard && chartImg) {
      const u = json.chartUrl || "";
      const fallbackSvg = json.zonesSvg || "";
      const activeSymbol = val("symbol") || "-";
      const activeTf = val("timeframe") || "H4";
      const cm = el("chartMeta");
      if (u) {
        chartImg.onerror = () => {
          chartImg.onerror = null;
          chartImg.removeAttribute("src");
          chartCard.style.display = "none";
          if (fallbackSvg) renderChartFallbackSvg(fallbackSvg);
        };
        chartImg.src = u;
        chartCard.style.display = "block";
        if (cm) cm.textContent = "Candlestick | " + activeSymbol + " | " + activeTf;
      } else if (fallbackSvg) {
        renderChartFallbackSvg(fallbackSvg);
      } else {
        chartImg.removeAttribute("src");
        chartCard.style.display = "none";
        if (cm) cm.textContent = "QuickChart";
      }
    }
  updateMeta(json.state, json.quota);
  showToast("آماده ✅", "خروجی دریافت شد", "OK", false);
  setTimeout(hideToast, 1200);
});

el("sendSupportTicket")?.addEventListener("click", async () => {
  if (OFFLINE_MODE || IS_GUEST) {
    showToast("محدود", "ارسال تیکت در حالت آفلاین/مهمان ممکن نیست.", "SUP", false);
    return;
  }
  const text = (el("supportTicketText")?.value || "").trim();
  if (!text || text.length < 4) {
    showToast("خطا", "متن تیکت خیلی کوتاه است.", "SUP", false);
    return;
  }
  if (text.length > 300) {
    showToast("خطا", "حداکثر ۳۰۰ کاراکتر مجاز است.", "SUP", false);
    return;
  }
  showToast("در حال ارسال…", "تیکت در حال ثبت است", "SUP", true);
  const { status, json } = await api("/api/support/ticket", buildAuthBody({ text }));
  if (!json?.ok) {
    const msg = json?.error === "support_unavailable"
      ? "پشتیبانی در دسترس نیست."
      : "ارسال تیکت ناموفق بود.";
    showToast("خطا", msg, "SUP", false);
    return;
  }
  if (el("supportTicketText")) el("supportTicketText").value = "";
  showToast("ارسال شد ✅", "تیکت شما ثبت شد", "SUP", false);
  setTimeout(hideToast, 1200);
});

el("close").addEventListener("click", () => tg?.close());

el("savePrompt")?.addEventListener("click", async () => {
  const prompt = el("adminPrompt")?.value || "";
  const { json } = await adminApi("/api/admin/prompt", { prompt });
  if (json?.ok) showToast("ذخیره شد ✅", "پرامپت بروزرسانی شد", "ADM", false);
});

el("saveStylePrompts")?.addEventListener("click", async () => {
  const raw = el("stylePromptJson")?.value || "{}";
  const stylePrompts = safeJsonParse(raw, {});
  const { json } = await adminApi("/api/admin/style-prompts", { stylePrompts });
  if (json?.ok) showToast("ذخیره شد ✅", "JSON سبک‌ها بروزرسانی شد", "ADM", false);
});

el("stylePromptJsonFile")?.addEventListener("change", async (ev) => {
  const f = ev?.target?.files?.[0];
  if (!f) return;
  const txt = await f.text().catch(() => "");
  const parsed = safeJsonParse(txt, null);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    showToast("خطا", "فایل JSON سبک‌ها معتبر نیست", "ADM", false);
    return;
  }
  if (el("stylePromptJson")) el("stylePromptJson").value = JSON.stringify(parsed, null, 2);
  showToast("بارگذاری شد ✅", "JSON سبک‌ها از فایل لود شد", "ADM", false);
});

el("addStyle")?.addEventListener("click", async () => {
  const style = el("newStyle")?.value || "";
  const { json } = await adminApi("/api/admin/styles", { action: "add", style });
  if (json?.ok) {
    renderStyleList(json.styles || []);
    fillStyles(json.styles || []);
  }
});

el("removeStyle")?.addEventListener("click", async () => {
  const style = el("removeStyleName")?.value || "";
  const { json } = await adminApi("/api/admin/styles", { action: "remove", style });
  if (json?.ok) {
    renderStyleList(json.styles || []);
    fillStyles(json.styles || []);
  }
});

el("saveGlobalCommission")?.addEventListener("click", async () => {
  const percent = Number(el("globalCommission")?.value || 0);
  const { json } = await adminApi("/api/admin/commissions", { action: "setGlobal", percent });
  if (json?.ok) renderCommissionList(json.commission || {});
});

el("saveUserCommission")?.addEventListener("click", async () => {
  const username = el("commissionUser")?.value || "";
  const percent = Number(el("commissionPercent")?.value || 0);
  const { json } = await adminApi("/api/admin/commissions", { action: "setOverride", username, percent });
  if (json?.ok) renderCommissionList(json.commission || {});
});

el("saveFreeLimit")?.addEventListener("click", async () => {
  const limit = Number(el("freeDailyLimit")?.value || 3);
  const { json } = await adminApi("/api/admin/free-limit", { limit });
  if (json?.ok) showToast("ذخیره شد ✅", "سهمیه رایگان بروزرسانی شد", "ADM", false);
});


el("saveOfferBanner")?.addEventListener("click", async () => {
  const offerBanner = el("offerBannerInput")?.value || "";
  let offerBannerImage = undefined;
  const file = el("offerBannerImageInput")?.files?.[0];
  if (file) {
    offerBannerImage = await fileToDataUrl(file);
  }
  const { json } = await adminApi("/api/admin/offer", { offerBanner, offerBannerImage });
  if (json?.ok) {
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

el("offerImageFile")?.addEventListener("change", async (ev) => {
  const file = ev?.target?.files?.[0];
  if (!file) return;
  if (file.size > 1024 * 1024) {
    showToast("خطا", "حجم تصویر باید کمتر از 1MB باشد", "ADM", false);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = typeof reader.result === "string" ? reader.result : "";
    if (el("offerBannerImageInput")) el("offerBannerImageInput").value = dataUrl;
    if (offerImg) offerImg.src = dataUrl;
    if (offerMedia) offerMedia.classList.toggle("show", !!dataUrl);
  };
  reader.readAsDataURL(file);
});

el("clearOfferImage")?.addEventListener("click", async () => {
  const offerBanner = el("offerBannerInput")?.value || "";
  const { json } = await adminApi("/api/admin/offer", { offerBanner, clearOfferBannerImage: true });
  if (el("offerBannerImageInput")) el("offerBannerImageInput").value = "";
  if (el("offerImageFile")) el("offerImageFile").value = "";
  if (offerImg) offerImg.src = "";
  if (offerMedia) offerMedia.classList.remove("show");
  if (json?.ok) showToast("انجام شد ✅", "تصویر بنر حذف شد", "ADM", false);
});

el("saveWelcomeTexts")?.addEventListener("click", async () => {
  const welcomeBot = el("welcomeBotInput")?.value || "";
  const welcomeMiniapp = el("welcomeMiniappInput")?.value || "";
  const { json } = await adminApi("/api/admin/welcome", { welcomeBot, welcomeMiniapp });
  if (json?.ok) {
    if (el("welcomeBotInput")) el("welcomeBotInput").value = json.welcomeBot || welcomeBot;
    if (el("welcomeMiniappInput")) el("welcomeMiniappInput").value = json.welcomeMiniapp || welcomeMiniapp;
    if (welcome) welcome.textContent = json.welcomeMiniapp || welcome.textContent;
    showToast("ذخیره شد ✅", "متن خوش‌آمدگویی بروزرسانی شد", "ADM", false);
    setTimeout(hideToast, 1200);
  } else {
    showToast("خطا", "ذخیره متن خوش‌آمدگویی ناموفق بود", "ADM", false);
  }
});

el("saveFeatureFlags")?.addEventListener("click", async () => {
  const capitalModeEnabled = !!el("flagCapitalMode")?.checked;
  const profileTipsEnabled = !!el("flagProfileTips")?.checked;
  const { json } = await adminApi("/api/admin/features", { capitalModeEnabled, profileTipsEnabled });
  if (json?.ok) {
    showToast("ذخیره شد ✅", "ویژگی‌ها بروزرسانی شد", "OWN", false);
    setTimeout(hideToast, 1200);
  } else {
    showToast("خطا", "ذخیره ویژگی‌ها ناموفق بود", "OWN", false);
  }
});

el("saveWallet")?.addEventListener("click", async () => {
  const wallet = el("walletAddressInput")?.value || "";
  const { json } = await adminApi("/api/admin/wallet", { wallet });
  if (json?.ok) {
    showToast("ذخیره شد ✅", "آدرس ولت بروزرسانی شد", "OWN", false);
    setTimeout(hideToast, 1200);
  } else {
    showToast("خطا", "ذخیره آدرس ولت ناموفق بود", "OWN", false);
  }
});

el("refreshTickets")?.addEventListener("click", async () => {
  showToast("در حال دریافت…", "لیست تیکت‌ها", "TICKET", true);
  await refreshTickets();
  showToast("آماده ✅", "تیکت‌ها بروزرسانی شد", "TICKET", false);
  setTimeout(hideToast, 1000);
});

el("updateTicket")?.addEventListener("click", async () => {
  const id = el("ticketSelect")?.value || "";
  const status = el("ticketStatus")?.value || "pending";
  const reply = (el("ticketReply")?.value || "").trim();
  if (!id) { showToast("خطا", "یک تیکت انتخاب کنید.", "TICKET", false); return; }
  showToast("در حال ثبت…", "بروزرسانی تیکت", "TICKET", true);
  const { json } = await adminApi("/api/admin/tickets/update", { id, status, reply });
  if (json?.ok) {
    if (el("ticketReply")) el("ticketReply").value = "";
    await refreshTickets();
    showToast("ثبت شد ✅", "تیکت بروزرسانی شد", "TICKET", false);
    setTimeout(hideToast, 1200);
  } else {
    showToast("خطا", "ثبت تیکت ناموفق بود", "TICKET", false);
  }
});

el("ticketSelect")?.addEventListener("change", () => {
  const id = el("ticketSelect")?.value || "";
  const t = ADMIN_TICKETS.find((x) => x.id === id);
  if (t && el("ticketStatus")) el("ticketStatus").value = t.status || "pending";
});

el("ticketReplyTemplate")?.addEventListener("change", pickTicketReplyTemplate);
el("ticketQuickPending")?.addEventListener("click", () => applyTicketFilter("pending"));
el("ticketQuickAnswered")?.addEventListener("click", () => applyTicketFilter("answered"));

el("refreshWithdrawals")?.addEventListener("click", async () => {
  showToast("در حال دریافت…", "لیست برداشت‌ها", "WD", true);
  await refreshWithdrawals();
  showToast("آماده ✅", "برداشت‌ها بروزرسانی شد", "WD", false);
  setTimeout(hideToast, 1000);
});

el("reviewWithdrawalBtn")?.addEventListener("click", async () => {
  const id = el("withdrawSelect")?.value || "";
  const decision = el("withdrawDecision")?.value || "rejected";
  const txHash = (el("withdrawTxHash")?.value || "").trim();
  if (!id) { showToast("خطا", "یک برداشت انتخاب کنید.", "WD", false); return; }
  showToast("در حال ثبت…", "بررسی برداشت", "WD", true);
  const { json } = await adminApi("/api/admin/withdrawals/review", { id, decision, txHash });
  if (json?.ok) {
    if (el("withdrawTxHash")) el("withdrawTxHash").value = "";
    await refreshWithdrawals();
    showToast("ثبت شد ✅", "برداشت بروزرسانی شد", "WD", false);
    setTimeout(hideToast, 1200);
  } else {
    showToast("خطا", "ثبت برداشت ناموفق بود", "WD", false);
  }
});

el("refreshPromptReqs")?.addEventListener("click", async () => {
  showToast("در حال دریافت…", "درخواست‌های پرامپت", "PR", true);
  await refreshPromptReqs();
  showToast("آماده ✅", "لیست بروزرسانی شد", "PR", false);
  setTimeout(hideToast, 1000);
});

el("decidePromptReqBtn")?.addEventListener("click", async () => {
  const requestId = el("promptReqSelect")?.value || "";
  const status = el("promptReqDecision")?.value || "rejected";
  const promptId = (el("promptReqPromptId")?.value || "").trim();
  if (!requestId) { showToast("خطا", "یک درخواست را انتخاب کنید.", "PR", false); return; }
  if (status === "approved" && !promptId) {
    showToast("خطا", "برای تایید باید Prompt ID وارد کنید.", "PR", false);
    return;
  }
  showToast("در حال ثبت…", "بررسی درخواست", "PR", true);
  const { json } = await adminApi("/api/admin/custom-prompts/requests", { action: "decide", requestId, status, promptId });
  if (json?.ok) {
    await refreshPromptReqs();
    showToast("ثبت شد ✅", "درخواست بروزرسانی شد", "PR", false);
    setTimeout(hideToast, 1200);
  } else {
    showToast("خطا", "ثبت درخواست ناموفق بود", "PR", false);
  }
});

el("promptReqSelect")?.addEventListener("change", () => {
  const id = el("promptReqSelect")?.value || "";
  const r = ADMIN_PROMPT_REQS.find((x) => x.id === id);
  if (r && el("promptReqPromptId")) el("promptReqPromptId").value = r.promptId || "";
  if (r && el("promptReqDecision")) el("promptReqDecision").value = (r.status === "approved" ? "approved" : (r.status === "rejected" ? "rejected" : "rejected"));
});

el("saveCapitalToggle")?.addEventListener("click", async () => {
  const username = (el("capitalToggleUser")?.value || "").trim();
  const enabled = (el("capitalToggleEnabled")?.value || "true") === "true";
  if (!username) { showToast("خطا", "یوزرنیم را وارد کنید.", "CAP", false); return; }
  const { json } = await adminApi("/api/admin/capital/toggle", { username, enabled });
  if (json?.ok) {
    showToast("ثبت شد ✅", "تنظیم سرمایه بروزرسانی شد", "CAP", false);
    setTimeout(hideToast, 1200);
  } else {
    showToast("خطا", "ثبت ناموفق بود", "CAP", false);
  }
});


el("saveCustomPrompts")?.addEventListener("click", async () => {
  const raw = el("customPromptsJson")?.value || "[]";
  const customPrompts = safeJsonParse(raw, []);
  const { json } = await adminApi("/api/admin/custom-prompts", { customPrompts });
  if (json?.ok) {
    showToast("ذخیره شد ✅", "پرامپت‌های اختصاصی بروزرسانی شد", "ADM", false);
    fillCustomPrompts(json.customPrompts || []);
  }
});

el("customPromptsJsonFile")?.addEventListener("change", async (ev) => {
  const f = ev?.target?.files?.[0];
  if (!f) return;
  const txt = await f.text().catch(() => "");
  const parsed = safeJsonParse(txt, null);
  if (!Array.isArray(parsed)) {
    showToast("خطا", "فایل JSON پرامپت اختصاصی باید آرایه باشد", "ADM", false);
    return;
  }
  if (el("customPromptsJson")) el("customPromptsJson").value = JSON.stringify(parsed, null, 2);
  showToast("بارگذاری شد ✅", "JSON پرامپت اختصاصی از فایل لود شد", "ADM", false);
});

el("sendCustomPrompt")?.addEventListener("click", async () => {
  const username = el("customPromptUser")?.value || "";
  const promptId = el("customPromptId")?.value || "";
  const { json } = await adminApi("/api/admin/custom-prompts/send", { username, promptId });
  if (json?.ok) showToast("ارسال شد ✅", "پرامپت برای کاربر ارسال شد", "ADM", false);
});

el("approvePayment")?.addEventListener("click", async () => {
  const payload = {
    username: (el("payUsername")?.value || "").trim(),
    amount: Number(el("payAmount")?.value || 0),
    days: Number(el("payDays")?.value || 30),
    txHash: (el("payTx")?.value || "").trim(),
  };
  if (!payload.username || !Number.isFinite(payload.amount) || payload.amount <= 0) {
    showToast("خطا", "یوزرنیم و مبلغ معتبر را وارد کنید.", "PAY", false);
    return;
  }
  if (!Number.isFinite(payload.days) || payload.days <= 0) payload.days = 30;
  const { json } = await adminApi("/api/admin/payments/approve", payload);
  if (json?.ok) {
    showToast("پرداخت تایید شد ✅", "اشتراک فعال شد", "PAY", false);
    renderPayments([json.payment].filter(Boolean));
  } else {
    showToast("خطا", "تایید پرداخت ناموفق بود", "PAY", false);
  }
});

el("checkPayment")?.addEventListener("click", async () => {
  const payload = {
    txHash: el("payTx")?.value || "",
    amount: Number(el("payAmount")?.value || 0),
    address: "",
  };
  const { json } = await adminApi("/api/admin/payments/check", payload);
  if (json?.ok) showToast("نتیجه بلاک‌چین", JSON.stringify(json.result || {}), "CHAIN", false);
});

el("activateSubscription")?.addEventListener("click", async () => {
  const payload = {
    username: el("payUsername")?.value || "",
    days: Number(el("payDays")?.value || 30),
    dailyLimit: Number(el("payDailyLimit")?.value || 50),
  };
  const { json } = await adminApi("/api/admin/subscription/activate", payload);
  if (json?.ok) showToast("اشتراک فعال شد ✅", "فعال‌سازی دستی انجام شد", "ADM", false);
});

el("loadUsers")?.addEventListener("click", async () => {
  const [{ json: usersJson }, { json: bootJson }] = await Promise.all([
    adminApi("/api/admin/users", { limit: 200 }),
    adminApi("/api/admin/bootstrap", {}),
  ]);
  if (usersJson?.ok && bootJson?.ok) {
    renderFullAdminReport(usersJson.users || [], bootJson.payments || [], bootJson.withdrawals || [], bootJson.tickets || []);
  } else if (usersJson?.ok) {
    renderUsers(usersJson.users || []);
  }
});

el("downloadReportPdf")?.addEventListener("click", async () => {
  try {
    showToast("در حال ساخت PDF…", "گزارش کامل", "PDF", true);
    const r = await fetch(API_BASE + "/api/admin/report/pdf", {      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData: INIT_DATA, limit: 250 }),
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


el("reconnect")?.addEventListener("click", async () => {
  OFFLINE_MODE = false;
  await boot();
});

window.addEventListener("online", () => {
  if (pillTxt && pillTxt.textContent.toLowerCase().includes("offline")) pillTxt.textContent = "Online";
});

window.addEventListener("offline", () => {
  if (pillTxt) pillTxt.textContent = "Offline";
});

el("paymentPresets")?.addEventListener("click", (e) => {
  const btn = e.target?.closest?.("[data-days]");
  if (!btn) return;
  const days = Number(btn.getAttribute("data-days") || 30);
  const amount = Number(btn.getAttribute("data-amount") || 0);
  if (el("payDays")) el("payDays").value = String(days);
  if (el("payAmount")) el("payAmount").value = String(amount);
  if (el("payDailyLimit") && !el("payDailyLimit").value) el("payDailyLimit").value = "50";
  showToast("پلن انتخاب شد ✅", "روز: " + days + " | مبلغ: " + amount, "PAY", false);
});

boot();`;


async function runDailySuggestions(env) {
  if (!env.BOT_KV) return;
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Kyiv", hour: "2-digit", hour12: false }).format(new Date()));
  // exactly two pushes per day (09:00 and 18:00 Kyiv)
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
      ? articles.slice(0, 2).map((x, i) => `${i + 1}) ${x?.title || ""}`).join(String.fromCharCode(10))
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

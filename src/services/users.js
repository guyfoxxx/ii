import { kvGetJson, kvPutJson } from './storage/kv.js';
import { getUser as d1GetUser, putUser } from './storage/d1.js';
import { tehranDateString } from '../utils/time.js';

export function defaultUser(userId) {
  return {
    userId: Number(userId), createdAt: new Date().toISOString(), state: 'idle', selectedSymbol: 'XAUUSD', timeframe: '1h', style: 'classic', risk: 'medium', newsEnabled: true, promptMode: 'style_plus_custom',
    dailyDate: tehranDateString(), dailyUsed: 0, freeDailyLimit: 3,
    profile: { name: '', phone: '', username: '', firstName: '', lastName: '', level: 1, onboardingDone: false, capital: 0, capitalCurrency: 'USDT' },
    referral: { codes: [], successfulInvites: 0, points: 0, commissionTotal: 0, commissionBalance: 0 },
    subscription: { active: false, type: 'free', expiresAt: '', dailyLimit: 50 }, wallet: { balance: 0, transactions: [] }, stats: { totalAnalyses: 0, successfulAnalyses: 0 },
    customPromptId: '', pendingCustomPromptRequestId: '',
  };
}

export async function loadUser(env, userId) {
  const fromDb = await d1GetUser(env.BOT_DB, userId);
  if (fromDb) return fromDb;
  const fromKv = await kvGetJson(env.BOT_KV, `u:${userId}`);
  return fromKv || defaultUser(userId);
}

export async function saveUser(env, user) {
  await putUser(env.BOT_DB, user);
  await kvPutJson(env.BOT_KV, `u:${user.userId}`, user);
}

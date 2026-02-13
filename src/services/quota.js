import { tehranDateString } from '../utils/time.js';

export function dailyLimit(env, user) {
  if (user?.subscription?.active) return Number(user.subscription.dailyLimit || env.PREMIUM_DAILY_LIMIT || 50);
  return Number(user?.freeDailyLimit || env.FREE_DAILY_LIMIT || 3);
}

export function canAnalyze(env, user, isStaffUser = false) {
  if (isStaffUser) return true;
  const today = tehranDateString();
  if (user.dailyDate !== today) {
    user.dailyDate = today;
    user.dailyUsed = 0;
  }
  return Number(user.dailyUsed || 0) < dailyLimit(env, user);
}

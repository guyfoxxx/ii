export function buildAdminReportLines(users = [], payments = [], withdrawals = [], tickets = []) {
  const lines = [];
  lines.push('گزارش ادمین MarketiQ');
  lines.push(`Users: ${users.length}`);
  lines.push(`Payments: ${payments.length}`);
  lines.push(`Withdrawals: ${withdrawals.length}`);
  lines.push(`Tickets: ${tickets.length}`);
  lines.push('--- کاربران ---');
  for (const u of users.slice(0, 200)) {
    const h = u?.profile?.username ? `@${u.profile.username}` : '-';
    lines.push(`${u.userId} | ${h} | used=${u.dailyUsed || 0} | sub=${u?.subscription?.type || 'free'}`);
  }
  return lines;
}

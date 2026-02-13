export function tehranDateString(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(d);
}

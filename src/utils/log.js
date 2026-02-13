export function requestId() { return crypto.randomUUID().slice(0, 8); }
export function log(level, message, meta = {}) { console[level](`[${level}] ${message}`, meta); }

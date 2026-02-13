export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });

export const text = (body, status = 200, headers = {}) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', ...headers } });

export const html = (body, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });

export const js = (body, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'application/javascript; charset=utf-8' } });

export async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

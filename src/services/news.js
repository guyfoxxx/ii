export function parseRssItems(xml, limit = 5) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) && items.length < limit) {
    const block = m[1];
    const g = (tag) => (block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    items.push({ title: g('title'), link: g('link'), pubDate: g('pubDate') });
  }
  return items;
}

export async function getNews(symbol, env) {
  const q = encodeURIComponent(`${symbol} market`);
  const res = await fetch(`https://news.google.com/rss/search?q=${q}&hl=fa&gl=IR&ceid=IR:fa`, { cf: { cacheTtl: 120 } });
  const xml = await res.text();
  return parseRssItems(xml, Number(env.NEWS_ITEMS_LIMIT || 5));
}

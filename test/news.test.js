import { describe, it, expect } from 'vitest';
import { parseRssItems } from '../src/services/news.js';

describe('parseRssItems', () => {
  it('parses rss items', () => {
    const xml = '<rss><channel><item><title>A</title><link>L</link><pubDate>P</pubDate></item></channel></rss>';
    const out = parseRssItems(xml, 5);
    expect(out.length).toBe(1);
    expect(out[0].title).toBe('A');
  });
});

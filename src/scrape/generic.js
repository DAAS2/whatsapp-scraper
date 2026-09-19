import * as cheerio from 'cheerio';
import { httpText } from './fetcher.js';

export async function fetchGeneric(url) {
  const { text } = await httpText(url);
  if (!text) throw new Error('empty body');
  const result = parseHtml(url, text);
  if (!result.title && !result.description && result.bodyText.length < 200) {
    throw new Error('no useful content (JS wall?)');
  }
  return { source: 'web', ...result };
}

export function parseHtml(url, html) {
  const $ = cheerio.load(html);
  const meta = (sel) => $(sel).first().attr('content')?.trim() || '';
  const title = meta('meta[property="og:title"]') || $('title').first().text().trim();
  const description = meta('meta[property="og:description"]') || meta('meta[name="description"]');
  const siteName = meta('meta[property="og:site_name"]') || new URL(url).hostname;
  $('script,style,noscript,svg,iframe,nav,footer,header,aside,form,button').remove();
  const seen = new Set();
  const parts = [];
  $('p,li,h1,h2,h3,h4,article,pre,blockquote,td,span').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t.length > 40 && !seen.has(t)) {
      seen.add(t);
      parts.push(t);
    }
  });
  const bodyText = parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 4000);
  return { title, description, siteName, bodyText };
}

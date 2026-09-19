import * as cheerio from 'cheerio';
import { httpText } from './fetcher.js';
import { fetchWithBrowser } from './browser.js';

export function instagramShortcode(url) {
  const m = new URL(url).pathname.match(/^\/(reel|p|tv)\/([^/]+)/);
  return m ? { type: m[1], code: m[2] } : null;
}

function clean(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

export async function fetchInstagram(url) {
  const sc = instagramShortcode(url);
  if (!sc) throw new Error('not an instagram post/reel url');
  const embedUrl = `https://www.instagram.com/${sc.type}/${sc.code}/embed/captioned/`;
  const { text } = await httpText(embedUrl, {
    headers: { referer: 'https://www.instagram.com/' },
  });
  if (!text || text.length < 500) throw new Error('embed page empty');
  const $ = cheerio.load(text);
  const username = clean($('.CaptionUsername').first().text()) || clean($('.UsernameText').first().text());
  let caption = clean($('.Caption').first().text());
  if (username && caption.startsWith(username)) caption = clean(caption.slice(username.length));
  caption = caption || clean($('.EmbeddedMediaCaption').first().text());
  if (!caption) throw new Error('embed page is a JS shell (no static caption)');
  return {
    source: 'instagram',
    title: username ? `Instagram reel by ${username}` : `Instagram post ${sc.code}`,
    description: caption.slice(0, 600),
    siteName: username ? `Instagram · @${username}` : 'Instagram',
    bodyText: '',
    extra: { shortcode: sc.code, author: username || undefined },
    good: true,
  };
}

export async function fetchInstagramViaBrowser(url) {
  const sc = instagramShortcode(url);
  if (!sc) throw new Error('not an instagram post/reel url');
  const canonical = `https://www.instagram.com/${sc.type}/${sc.code}/`;
  let title = '';
  let description = '';
  try {
    const { html } = await fetchWithBrowser(canonical, { waitMs: 4_000 });
    const $ = cheerio.load(html);
    const meta = (sel) => $(sel).first().attr('content')?.trim() || '';
    title = clean(meta('meta[property="og:title"]'));
    description = clean(meta('meta[property="og:description"]'));
  } catch {
    // fall through to embed page
  }
  if (!description) {
    const { html: embedHtml } = await fetchWithBrowser(
      `https://www.instagram.com/${sc.type}/${sc.code}/embed/captioned/`,
      { waitMs: 5_000 },
    );
    const $ = cheerio.load(embedHtml);
    const username = clean($('.CaptionUsername').first().text());
    let caption = clean($('.Caption').first().text());
    if (username && caption.startsWith(username)) caption = clean(caption.slice(username.length));
    title = title || (username ? `Instagram reel by ${username}` : `Instagram post ${sc.code}`);
    description = caption;
  }
  if (!title && !description) throw new Error('browser got nothing (login wall)');
  return {
    source: 'instagram',
    title,
    description: description.slice(0, 600),
    siteName: 'Instagram',
    bodyText: '',
    extra: { shortcode: sc.code },
    good: true,
  };
}

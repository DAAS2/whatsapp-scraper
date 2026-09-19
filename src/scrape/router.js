import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { CACHE_DIR } from '../config.js';
import { httpText } from './fetcher.js';
import { fetchGitHub, parseRepo } from './github.js';
import { fetchYouTube, youtubeId } from './youtube.js';
import { fetchReddit } from './reddit.js';
import { fetchTwitter } from './twitter.js';
import { fetchGeneric, parseHtml } from './generic.js';
import { fetchWithBrowser } from './browser.js';
import { fetchNpm, fetchPypi } from './registry.js';
import { fetchInstagram, fetchInstagramViaBrowser, instagramShortcode } from './instagram.js';

const SOURCE_MAP = [
  ['github.com', 'github'],
  ['youtube.com', 'youtube'],
  ['youtu.be', 'youtube'],
  ['reddit.com', 'reddit'],
  ['redd.it', 'reddit'],
  ['x.com', 'twitter'],
  ['twitter.com', 'twitter'],
  ['instagram.com', 'instagram'],
  ['linkedin.com', 'linkedin'],
  ['arxiv.org', 'paper'],
  ['npmjs.com', 'package'],
  ['pypi.org', 'package'],
  ['medium.com', 'article'],
  ['dev.to', 'article'],
  ['substack.com', 'article'],
  ['news.ycombinator.com', 'forum'],
];

export function sourceFor(url) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  for (const [needle, source] of SOURCE_MAP) {
    if (host === needle || host.endsWith(`.${needle}`)) return source;
  }
  return 'web';
}

function scrapersFor(url) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  const chain = [];
  if (host === 'github.com' && parseRepo(url)) {
    chain.push(fetchGitHub);
    chain.push(fetchGeneric);
  } else if (host === 'youtu.be' || (host.endsWith('youtube.com') && youtubeId(url))) {
    chain.push(fetchYouTube);
  } else if ((host === 'reddit.com' || host.endsWith('.reddit.com')) && /\/comments\//.test(url)) {
    chain.push(fetchReddit);
  } else if ((host === 'x.com' || host === 'twitter.com') && /\/status\//.test(url)) {
    chain.push(fetchTwitter);
  } else if (host === 'npmjs.com' || host === 'npmjs.org') {
    chain.push(fetchNpm);
  } else if (host === 'pypi.org') {
    chain.push(fetchPypi);
  } else if ((host === 'instagram.com' || host.endsWith('.instagram.com')) && instagramShortcode(url)) {
    chain.push(fetchInstagram);
    chain.push(fetchInstagramViaBrowser);
  } else {
    chain.push(fetchGeneric);
  }
  chain.push(browserStep);
  chain.push(minimal);
  return chain;
}

async function browserStep(url) {
  const { html, text } = await fetchWithBrowser(url);
  const parsed = parseHtml(url, html);
  if (!parsed.title && !parsed.description && text.length < 200) {
    throw new Error('browser got nothing useful (login wall?)');
  }
  return { source: sourceFor(url), ...parsed, bodyText: parsed.bodyText || text.slice(0, 4000) };
}

function minimal(url) {
  const u = new URL(url);
  const seg = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
  const pretty = seg.replace(/[-_+]+/g, ' ').trim();
  return {
    source: sourceFor(url),
    title: pretty ? pretty.slice(0, 80) : u.hostname,
    description: `Link from your WhatsApp self-chat (${u.hostname}).`,
    siteName: u.hostname,
    bodyText: '',
    extra: {},
    degraded: true,
  };
}

function pick(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && v !== '') return v;
  return '';
}

function isGood(r) {
  return Boolean(r.title) && (Boolean(r.description) || (r.bodyText || '').length > 300);
}

function cacheFile(url) {
  return path.join(CACHE_DIR, `${crypto.createHash('sha1').update(url).digest('hex')}.json`);
}

export async function enrichLink(link, { useCache = true } = {}) {
  const file = cacheFile(link.url);
  if (useCache) {
    const cached = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    if (cached) return { ...cached, cached: true };
  }
  const acc = {
    id: link.id,
    url: link.url,
    sentAt: link.sentAt,
    source: sourceFor(link.url),
    status: 'failed',
    title: '',
    description: '',
    siteName: '',
    bodyText: '',
    extra: {},
    errors: [],
  };
  for (const step of scrapersFor(link.url)) {
    try {
      const r = await step(link.url);
      if (!r) continue;
      if (r.source && r.source !== 'web') acc.source = r.source;
      else if (acc.source === 'web' && r.source) acc.source = r.source;
      acc.title = pick(acc.title, r.title);
      acc.description = pick(acc.description, r.description);
      acc.siteName = pick(acc.siteName, r.siteName);
      acc.bodyText = pick(acc.bodyText, r.bodyText);
      acc.extra = { ...acc.extra, ...r.extra };
      if (r.degraded) acc.degraded = true;
      if (r.good) acc.good = true;
      if (!r.degraded && (r.good || isGood(acc))) break;
    } catch (e) {
      acc.errors.push(`${step.name}: ${e.message}`);
    }
  }
  acc.status = (isGood(acc) || acc.good) && !acc.degraded ? 'ok' : acc.title || acc.description ? 'partial' : 'failed';
  delete acc.degraded;
  delete acc.good;
  try {
    fs.writeFileSync(file, JSON.stringify(acc, null, 2), 'utf8');
  } catch {
    // cache write is best-effort
  }
  return acc;
}

export async function enrichLinks(links, { useCache = true, concurrency = 6, onProgress = () => {} } = {}) {
  const results = new Array(links.length);
  let cursor = 0;
  let done = 0;
  async function worker() {
    while (cursor < links.length) {
      const index = cursor++;
      results[index] = await enrichLink(links[index], { useCache });
      done += 1;
      onProgress(done, links.length, results[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, links.length) }, worker));
  return results;
}

export { httpText };

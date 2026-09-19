const URL_RE = /https?:\/\/[^\s"'<>]+/gi;

function trimTrailing(u) {
  let s = u;
  for (;;) {
    const last = s[s.length - 1];
    if (!last) return s;
    if ('.,;:!?"\''.includes(last)) {
      s = s.slice(0, -1);
      continue;
    }
    if (last === ')' || last === ']' || last === '}') {
      const open = { ')': '(', ']': '[', '}': '{' }[last];
      const opens = (s.match(new RegExp(`\\${open}`, 'g')) || []).length;
      const closes = (s.match(new RegExp(`\\${last}`, 'g')) || []).length;
      if (closes > opens) {
        s = s.slice(0, -1);
        continue;
      }
    }
    return s;
  }
}

export function extractUrls(text) {
  if (!text) return [];
  const out = [];
  for (const match of text.matchAll(URL_RE)) {
    const cleaned = trimTrailing(match[0]);
    if (cleaned.length > 10) out.push(cleaned);
  }
  return out;
}

const NOISE_PARAMS = /^(utm_|fbclid|gclid|igshid?|si|spm|scid|feature)$/i;

export function normalizeUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname.includes('.')) return null;
    u.hash = '';
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    for (const key of [...u.searchParams.keys()]) {
      if (NOISE_PARAMS.test(key)) u.searchParams.delete(key);
    }
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '');
    return u.toString();
  } catch {
    return null;
  }
}

export function buildLinkIndex(messages, limit) {
  const sorted = [...messages].sort((a, b) => b.timestamp - a.timestamp);
  const links = [];
  const seenUrls = new Set();
  let messagesWithLinks = 0;

  for (const m of sorted) {
    const urls = [...new Set(extractUrls(m.text).map(normalizeUrl).filter(Boolean))];
    if (!urls.length) continue;
    messagesWithLinks += 1;
    for (const url of urls) {
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);
      links.push({
        id: `L${String(links.length + 1).padStart(3, '0')}`,
        url,
        messageId: m.id,
        sentAt: m.timestamp,
        context: m.text.slice(0, 300),
      });
    }
    if (messagesWithLinks >= limit) break;
  }

  return {
    generatedAt: Date.now(),
    sourceJid: sorted[0]?.remote || null,
    messagesScanned: sorted.length,
    messagesWithLinks,
    links,
  };
}

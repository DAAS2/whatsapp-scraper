import { generateJSON } from './gemini.js';

const TYPES = ['repo', 'library', 'article', 'tutorial', 'video', 'reel', 'post', 'paper', 'tool', 'course', 'news', 'other'];

const INTRO = `You are organizing links that a developer saved to their own WhatsApp chat.
For each numbered link below, return one result object with:
- "id": the exact id given
- "title": a clean human-readable title (max 80 chars). Use the provided metadata; infer from the URL if metadata is thin.
- "type": one of ${TYPES.join(', ')}
- "summary": 1-2 sentences describing what it is and why it may be useful. Max 220 chars. Plain text, no links.
- "tags": 1-3 short lowercase topical tags (e.g. "llm", "rag", "react", "system-design", "latency", "devops", "career")

Return strict JSON: {"results": [{"id":"...","title":"...","type":"...","summary":"...","tags":["..."]}]}
Exactly one result per input, same order of ids.`;

function compactMeta(link) {
  const parts = [];
  if (link.title) parts.push(`title: ${link.title}`);
  if (link.description) parts.push(`desc: ${link.description.slice(0, 220)}`);
  if (link.siteName) parts.push(`site: ${link.siteName}`);
  const extra = Object.entries(link.extra || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length))
    .slice(0, 4)
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('|') : String(v).slice(0, 60)}`)
    .join(', ');
  if (extra) parts.push(extra);
  if (link.bodyText) parts.push(`content: ${link.bodyText.slice(0, 500).replace(/\s+/g, ' ')}`);
  if (link.context && !link.bodyText) parts.push(`chat context: ${link.context.slice(0, 120)}`);
  return parts.join(' | ');
}

function fallbackEntry(link) {
  let label = '';
  try {
    const u = new URL(link.url);
    label = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || u.hostname).replace(/[-_+]+/g, ' ').trim();
  } catch {
    label = link.url;
  }
  return {
    id: link.id,
    title: (label || link.url).slice(0, 80),
    type: link.source === 'github' ? 'repo' : link.source === 'youtube' ? 'video' : 'other',
    summary: `Saved link (${link.source}). Content could not be fetched; see URL for details.`,
    tags: [link.source === 'web' ? 'link' : link.source],
  };
}

function buildBatchPrompt(batch) {
  const listing = batch
    .map((l) => `${l.id}\nurl: ${l.url}\nsource: ${l.source}\nmetadata: ${compactMeta(l) || '(none)'}`)
    .join('\n\n---\n\n');
  return `${INTRO}\n\n${listing}`;
}

export async function classifyLinks(links, { batchSize = 8 } = {}) {
  const byId = new Map();
  const batches = [];
  for (let i = 0; i < links.length; i += batchSize) batches.push(links.slice(i, i + batchSize));

  for (const [i, batch] of batches.entries()) {
    console.log(`  classify batch ${i + 1}/${batches.length} (${batch.length} links)`);
    let out = null;
    try {
      out = await generateJSON(buildBatchPrompt(batch));
    } catch (e) {
      console.warn(`  batch failed after retries (${String(e?.message || e).slice(0, 120)}) — falling back to URL-based entries`);
    }
    const results = Array.isArray(out?.results) ? out.results : [];
    for (const r of results) {
      if (!r?.id || byId.has(r.id)) continue;
      if (!TYPES.includes(r.type)) r.type = 'other';
      if (!Array.isArray(r.tags) || !r.tags.length) r.tags = ['link'];
      r.tags = r.tags.slice(0, 3).map((t) => String(t).toLowerCase().replace(/[^a-z0-9+#-]/gi, '')).filter(Boolean);
      if (!r.tags.length) r.tags = ['link'];
      r.title = String(r.title || '').slice(0, 100);
      r.summary = String(r.summary || '').slice(0, 300);
      byId.set(r.id, r);
    }
  }

  const missing = links.filter((l) => !byId.has(l.id));
  if (missing.length) {
    try {
      const repair = await generateJSON(
        `For each link below, return {"results":[{"id","title","type","summary","tags"}]} like before.\n\n${missing
          .map((l) => `${l.id}\nurl: ${l.url}\nsource: ${l.source}\nmetadata: ${compactMeta(l) || '(none)'}`)
          .join('\n\n---\n\n')}`,
      );
      for (const r of repair?.results || []) {
        if (r?.id && !byId.has(r.id)) {
          if (!TYPES.includes(r.type)) r.type = 'other';
          byId.set(r.id, { ...r, tags: Array.isArray(r.tags) && r.tags.length ? r.tags.slice(0, 3) : ['link'] });
        }
      }
    } catch {
      // fall through to synthesized entries
    }
  }

  return links.map((l) => {
    const c = byId.get(l.id);
    const entry = c ? { ...c } : fallbackEntry(l);
    return {
      ...l,
      classified: {
        id: l.id,
        title: entry.title || fallbackEntry(l).title,
        type: entry.type || 'other',
        summary: entry.summary || '',
        tags: entry.tags || ['link'],
        synthesized: !c,
      },
    };
  });
}

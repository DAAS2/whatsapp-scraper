import fs from 'node:fs';
import path from 'node:path';
import { ROOT, CLASSIFIED_PATH, OUTLINE_PATH } from '../src/config.js';

const webPublic = path.join(ROOT, 'web', 'public');
fs.mkdirSync(webPublic, { recursive: true });

const classified = JSON.parse(fs.readFileSync(CLASSIFIED_PATH, 'utf8'));
const outline = JSON.parse(fs.readFileSync(OUTLINE_PATH, 'utf8'));

const byId = new Map(classified.map((l) => [l.id, l]));

const shapeLink = (l) => ({
  id: l.id,
  url: l.url,
  sentAt: l.sentAt,
  source: l.source,
  status: l.status,
  siteName: l.siteName || '',
  title: l.classified?.title || l.title || l.url,
  type: l.classified?.type || 'other',
  summary: l.classified?.summary || '',
  tags: l.classified?.tags || [],
  badges: Object.fromEntries(
    Object.entries(l.extra || {}).filter(([, v]) => v !== undefined && v !== null && v !== '' && !Array.isArray(v)),
  ),
});

const tagCounts = new Map();
const typeCounts = new Map();
let ok = 0;
let partial = 0;
let failed = 0;

const sections = outline.sections
  .map((s, i) => ({
    id: `sec-${i}`,
    title: s.title,
    blurb: s.blurb || '',
    subsections: (s.subsections || [])
      .map((sub) => {
        const links = (sub.linkIds || []).map((id) => byId.get(id)).filter(Boolean).map(shapeLink);
        for (const l of links) {
          for (const t of l.tags) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
          typeCounts.set(l.type, (typeCounts.get(l.type) || 0) + 1);
          if (l.status === 'ok') ok += 1;
          else if (l.status === 'partial') partial += 1;
          else failed += 1;
        }
        return { title: sub.title, links };
      })
      .filter((sub) => sub.links.length),
  }))
  .filter((s) => s.subsections.length);

const allLinks = classified.map(shapeLink);
const failures = allLinks.filter((l) => l.status === 'failed' || l.status === 'partial');
const dates = allLinks.map((l) => l.sentAt).filter(Boolean);
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

const library = {
  generatedAt: Date.now(),
  generatedOn: iso(Date.now()),
  dateRange: dates.length ? { from: iso(Math.min(...dates)), to: iso(Math.max(...dates)) } : null,
  counts: { total: allLinks.length, ok, partial, failed },
  typeCounts: Object.fromEntries([...typeCounts.entries()].sort((a, b) => b[1] - a[1])),
  tags: [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, count })),
  sections,
  failures: failures.map((l) => ({ id: l.id, url: l.url, source: l.source, status: l.status })),
};

const out = path.join(webPublic, 'library.json');
fs.writeFileSync(out, JSON.stringify(library, null, 2), 'utf8');
console.log(`wrote ${out} — ${allLinks.length} links, ${sections.length} sections, ${library.tags.length} tags`);

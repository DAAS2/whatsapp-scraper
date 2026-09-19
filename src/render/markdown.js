import fs from 'node:fs';
import path from 'node:path';
import { RESOURCES_DIR } from '../config.js';

const esc = (s) => String(s || '').replace(/\[/g, '\\[').replace(/\]/g, '\\]');

function fmtDate(ms) {
  if (!ms) return 'unknown date';
  return new Date(ms).toISOString().slice(0, 10);
}

function typeEmoji(type) {
  const map = {
    repo: '📦',
    library: '📚',
    article: '📝',
    tutorial: '🛠️',
    video: '▶️',
    reel: '🎬',
    post: '💬',
    paper: '📄',
    tool: '🧰',
    course: '🎓',
    news: '📰',
    other: '🔗',
  };
  return map[type] || '🔗';
}

function renderLink(l) {
  const c = l.classified;
  const title = c.title || l.url;
  const e = l.extra || {};
  const badges = [];
  if (e.stars) badges.push(`★ ${Number(e.stars).toLocaleString('en-US')}`);
  if (e.language) badges.push(e.language);
  if (e.channel) badges.push(e.channel);
  if (e.score) badges.push(`▲ ${e.score}`);
  const lines = [`- ${typeEmoji(c.type)} **[${esc(title)}](${l.url})**`];
  if (c.summary) lines.push(c.summary);
  const bits = [c.type, ...(c.tags || []), ...badges].filter(Boolean);
  if (bits.length) lines.push(`*${bits.join(' · ')}*`);
  return lines.join('  \n  ') + '\n';
}

export function renderMarkdown(classified, outline, stats) {
  const byId = new Map(classified.map((l) => [l.id, l]));
  const failures = classified.filter((l) => l.status === 'failed');

  const typeCounts = {};
  for (const l of classified) typeCounts[l.classified.type] = (typeCounts[l.classified.type] || 0) + 1;
  const typeLine = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${t}: ${n}`)
    .join(' · ');

  const dates = classified.map((l) => l.sentAt).filter(Boolean);
  const range = dates.length ? `${fmtDate(Math.max(...dates))} → ${fmtDate(Math.min(...dates))}` : '';

  const toc = outline.sections
    .map((s) => {
      const count = s.subsections.reduce((n, sub) => n + sub.linkIds.length, 0);
      return `${s.title} (${count})`;
    })
    .join(' · ');

  const out = [];
  out.push(`# WhatsApp Link Library — ${fmtDate(Date.now())}`);
  out.push('');
  out.push(`**${classified.length} links** · collected from your self-chat${range ? ` (${range})` : ''}`);
  out.push('');
  out.push(`**Types:** ${typeLine}`);
  out.push('');
  out.push(`**Sections:** ${toc}`);
  out.push('');
  out.push('---');
  out.push('');

  for (const section of outline.sections) {
    const count = section.subsections.reduce((n, sub) => n + sub.linkIds.length, 0);
    out.push(`## ${section.title} (${count})`);
    out.push('');
    if (section.blurb) {
      out.push(`*${section.blurb}*`);
      out.push('');
    }
    for (const sub of section.subsections) {
      if (!sub.linkIds.length) continue;
      out.push(`### ${sub.title}`);
      out.push('');
      for (const id of sub.linkIds) {
        const l = byId.get(id);
        if (!l) continue;
        out.push(renderLink(l));
      }
    }
  }

  if (failures.length) {
    out.push('---');
    out.push('');
    out.push(`## Couldn't fetch (${failures.length})`);
    out.push('');
    for (const l of failures) out.push(`- ${l.url}`);
    out.push('');
  }

  out.push('---');
  out.push('');
  out.push(`*Generated ${new Date().toISOString()} by whatsapp-link-harvester*`);
  out.push('');

  const file = path.join(RESOURCES_DIR, `whatsapp-links-${fmtDate(Date.now())}.md`);
  fs.writeFileSync(file, out.join('\n'), 'utf8');
  return file;
}

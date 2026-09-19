import { generateJSON } from './gemini.js';

const INTRO = `You are organizing a personal library of links that a developer saved to their own WhatsApp chat.
Build a hierarchical outline grouping ALL links into topical sections.

Rules:
- 3 to 8 top-level sections. Section titles are broad topics (e.g. "AI & LLMs", "Full-Stack Development", "System Design & Latency", "Career & Learning").
- Inside each section, create pragmatic subsections that make the links easy to browse and act on. Use labels like:
  "Learnings & Concepts" (theory, ideas, explanations),
  "Pathway: What to Learn Next" (learning order, roadmaps, prerequisites),
  "Repos & Code to Study",
  "Tools & Libraries",
  "Videos & Reels",
  "Articles & Posts",
  "Discussions & Community",
  or any better structure that fits the actual mix of links in that section.
- Order sections by importance/size (largest first). Order subsections so "Learnings" and "Pathway" style groupings come before raw collections when they exist.
- Every link id must appear in EXACTLY ONE subsection. Do not drop or duplicate ids.
- If a link fits nowhere, put it in a final section titled "Miscellaneous & Everything Else".

Return strict JSON:
{"sections":[{"title":"...","blurb":"one sentence on why this section matters","subsections":[{"title":"...","linkIds":["L001","L002"]}]}]}`;

function listing(classified) {
  return classified
    .map((l) => {
      const c = l.classified;
      return `${c.id} | ${c.type} | tags: ${c.tags.join(', ')} | ${c.title} | ${c.summary.slice(0, 140)}`;
    })
    .join('\n');
}

export async function buildOutline(classified) {
  const knownIds = new Set(classified.map((l) => l.id));
  const byId = new Map(classified.map((l) => [l.id, l]));

  let outline = null;
  try {
    outline = await generateJSON(`${INTRO}\n\nLinks:\n${listing(classified)}`, { temperature: 0.2 });
  } catch (e) {
    throw new Error(`Outline generation failed: ${String(e?.message || e).slice(0, 200)}`);
  }

  const sections = sanitize(outline, byId);
  const placed = new Set();
  for (const s of sections) {
    for (const sub of s.subsections) {
      sub.linkIds = sub.linkIds.filter((id) => knownIds.has(id) && !placed.has(id));
      for (const id of sub.linkIds) placed.add(id);
    }
  }

  const missing = classified.filter((l) => !placed.has(l.id));
  if (missing.length) {
    try {
      const repair = await generateJSON(
        `Place each link below into one of these existing sections. Return strict JSON:
{"placements":[{"id":"...","sectionTitle":"...","subsectionTitle":"..."}]}

Existing sections:
${sections.map((s) => `- "${s.title}" (subsections: ${s.subsections.map((x) => `"${x.title}"`).join(', ') || 'none'})`).join('\n')}

Links:
${listing(missing)}`,
        { temperature: 0.2 },
      );
      const bySection = new Map(sections.map((s) => [s.title, s]));
      for (const p of repair?.placements || []) {
        const section = bySection.get(p.sectionTitle);
        if (!section || !byId.has(p.id) || placed.has(p.id)) continue;
        let sub = section.subsections.find((x) => x.title === p.subsectionTitle);
        if (!sub) sub = { title: String(p.subsectionTitle || 'Additional').slice(0, 60), linkIds: [] };
        if (!section.subsections.includes(sub)) section.subsections.push(sub);
        sub.linkIds.push(p.id);
        placed.add(p.id);
      }
    } catch {
      // fall through to catch-all section
    }
  }

  const stillMissing = classified.filter((l) => !placed.has(l.id));
  if (stillMissing.length) {
    let misc = sections.find((s) => s.title === 'Miscellaneous & Everything Else');
    if (!misc) {
      misc = { title: 'Miscellaneous & Everything Else', blurb: 'Everything that did not fit a cleaner topic.', subsections: [] };
      sections.push(misc);
    }
    let sub = misc.subsections.find((x) => x.title === 'Uncategorized');
    if (!sub) {
      sub = { title: 'Uncategorized', linkIds: [] };
      misc.subsections.push(sub);
    }
    for (const l of stillMissing) {
      sub.linkIds.push(l.id);
      placed.add(l.id);
    }
  }

  sections.forEach((s) => s.subsections.forEach((sub) => sub.linkIds.forEach((id) => placed.add(id))));
  const empty = sections.filter((s) => !s.subsections.some((x) => x.linkIds.length));
  return { generatedAt: Date.now(), sections: sections.filter((s) => !empty.includes(s)) };
}

function sanitize(outline, byId) {
  const sections = [];
  for (const s of Array.isArray(outline?.sections) ? outline.sections : []) {
    const title = String(s?.title || '').trim().slice(0, 60);
    if (!title) continue;
    const subsections = [];
    for (const sub of Array.isArray(s?.subsections) ? s.subsections : []) {
      const subTitle = String(sub?.title || '').trim().slice(0, 60);
      if (!subTitle) continue;
      const linkIds = (Array.isArray(sub?.linkIds) ? sub.linkIds : [])
        .map((id) => String(id))
        .filter((id) => byId.has(id));
      subsections.push({ title: subTitle, linkIds });
    }
    if (!subsections.length) continue;
    sections.push({
      title,
      blurb: String(s?.blurb || '').trim().slice(0, 200),
      subsections,
    });
  }
  if (!sections.length) {
    sections.push({
      title: 'All Links',
      blurb: 'The outline model returned no usable structure.',
      subsections: [{ title: 'Everything', linkIds: [...byId.keys()] }],
    });
  }
  return sections;
}

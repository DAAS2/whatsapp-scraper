import { ensureDirs, readJson, writeJson, LINK_LIMIT, RAW_MESSAGES_PATH, LINKS_PATH, ENRICHED_PATH, CLASSIFIED_PATH, OUTLINE_PATH, GEMINI_API_KEY } from './config.js';
import { collectMessages } from './whatsapp/bridge.js';
import { buildLinkIndex } from './extract/links.js';
import { enrichLinks } from './scrape/router.js';
import { closeBrowser } from './scrape/browser.js';
import { classifyLinks } from './ai/classify.js';
import { buildOutline } from './ai/outline.js';
import { renderMarkdown } from './render/markdown.js';

ensureDirs();

export async function collectStage({ limit = LINK_LIMIT } = {}) {
  console.log(`[1/6] Collecting up to ${limit} link-messages from your WhatsApp self-chat...`);
  const messages = await collectMessages({ limit });
  console.log(`      raw pool: ${messages.length} messages`);
  return messages;
}

export function extractStage({ rawPath = RAW_MESSAGES_PATH, outPath = LINKS_PATH, limit = LINK_LIMIT } = {}) {
  console.log(`[2/6] Extracting links (up to ${limit} link-messages)...`);
  const raw = readJson(rawPath, []);
  if (!raw.length) throw new Error(`No raw messages at ${rawPath}. Run the collect stage first (or use the demo).`);
  const index = buildLinkIndex(raw, limit);
  writeJson(outPath, index);
  console.log(`      ${index.messagesWithLinks} messages with links → ${index.links.length} unique URLs`);
  return index;
}

export async function enrichStage({ linksPath = LINKS_PATH, outPath = ENRICHED_PATH, useCache = true } = {}) {
  console.log('[3/6] Scraping links...');
  const index = readJson(linksPath);
  if (!index?.links?.length) throw new Error(`No links at ${linksPath}. Run extract first.`);
  try {
    const results = await enrichLinks(index.links, {
      useCache,
      onProgress: (done, total, r) => {
        if (done % 10 === 0 || done === total) console.log(`      ${done}/${total} scraped (${r.status}: ${r.source})`);
      },
    });
    const counts = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
    console.log(`      statuses: ${JSON.stringify(counts)}`);
    writeJson(outPath, results);
    return results;
  } finally {
    await closeBrowser();
  }
}

export async function classifyStage({ enrichedPath = ENRICHED_PATH, outPath = CLASSIFIED_PATH } = {}) {
  console.log('[4/6] Classifying with Gemini...');
  const enriched = readJson(enrichedPath, []);
  if (!enriched.length) throw new Error(`No enriched links at ${enrichedPath}. Run scrape first.`);
  const classified = await classifyLinks(enriched);
  writeJson(outPath, classified);
  console.log(`      ${classified.filter((l) => !l.classified.synthesized).length}/${classified.length} classified by Gemini`);
  return classified;
}

export async function outlineStage({ classifiedPath = CLASSIFIED_PATH, outPath = OUTLINE_PATH } = {}) {
  console.log('[5/6] Building topic outline with Gemini...');
  const classified = readJson(classifiedPath, []);
  if (!classified.length) throw new Error(`No classified links at ${classifiedPath}. Run classify first.`);
  const outline = await buildOutline(classified);
  writeJson(outPath, outline);
  console.log(`      ${outline.sections.length} sections`);
  return outline;
}

export function renderStage({ classifiedPath = CLASSIFIED_PATH, outlinePath = OUTLINE_PATH } = {}) {
  console.log('[6/6] Rendering markdown...');
  const classified = readJson(classifiedPath, []);
  const outline = readJson(outlinePath);
  if (!classified.length || !outline) throw new Error('Missing classified links or outline. Run earlier stages first.');
  const file = renderMarkdown(classified, outline);
  console.log(`      wrote ${file}`);
  return file;
}

export async function runAll({ offline = false, noCache = false, limit = LINK_LIMIT } = {}) {
  if (!offline) await collectStage({ limit });
  extractStage({ limit });
  await enrichStage({ useCache: !noCache });
  if (!GEMINI_API_KEY) {
    console.warn('\nGEMINI_API_KEY not set — stopping after scrape. Add it to .env, then run: npm start -- classify outline render');
    return;
  }
  await classifyStage();
  await outlineStage();
  renderStage();
  console.log('\nDone. See resources/ for your link library.');
}

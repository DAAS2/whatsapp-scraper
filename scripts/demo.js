import path from 'node:path';
import { DATA_DIR, GEMINI_API_KEY, ensureDirs } from '../src/config.js';
import { extractStage, enrichStage } from '../src/pipeline.js';
import { classifyStage, outlineStage, renderStage } from '../src/pipeline.js';

ensureDirs();

const day = 86_400_000;
const now = Date.now();
const JID = '15551234567@s.whatsapp.net';
let n = 0;
const msg = (ago, text) => ({
  id: `DEMO${String(++n).padStart(3, '0')}`,
  remote: JID,
  timestamp: now - ago * day,
  fromMe: true,
  text,
});

const rawMessages = [
  msg(1, 'this changed how I think about agents https://www.anthropic.com/research/building-effective-agents'),
  msg(2, 'reading list for RAG eval https://arxiv.org/abs/2005.11401 and the cookbook https://github.com/openai/openai-cookbook'),
  msg(3, 'fast api is so clean https://github.com/fastapi/fastapi'),
  msg(4, 'great talk on LLM infra https://www.youtube.com/watch?v=PvHt9Y9iGms'),
  msg(5, 'reel on prompt tricks https://www.instagram.com/reel/C8xK9yPqZ1A/'),
  msg(6, 'someone posted this on LI https://www.linkedin.com/posts/janedoe_ai-engineering-activity-7201234567890123456-abcd'),
  msg(8, 'web.dev on LCP, latency matters https://web.dev/articles/optimize-lcp'),
  msg(9, 'pino logging again https://www.npmjs.com/package/pino'),
  msg(11, 'attention is all you need, rereading https://arxiv.org/abs/1706.03762'),
  msg(12, 'express server boilerplate https://github.com/expressjs/express'),
  msg(14, 'smart thread about latency budgets https://x.com/dan_abramov/status/1234567890123456789'),
  msg(16, 'save for later: the intelligence age https://blog.samaltman.com/the-intelligence-age'),
  msg(17, 'no link here just a reminder to drink water'),
  msg(18, 'LLM cost deep dive, worth it https://arxiv.org/abs/2404.04475'),
];

const fs = await import('node:fs');
const rawPath = path.join(DATA_DIR, 'demo-raw.json');
fs.writeFileSync(rawPath, JSON.stringify(rawMessages, null, 2));

console.log(`Demo: ${rawMessages.length} sample messages written to ${rawPath}\n`);

extractStage({ rawPath, outPath: path.join(DATA_DIR, 'demo-links.json') });
console.log('');
await enrichStage({
  linksPath: path.join(DATA_DIR, 'demo-links.json'),
  outPath: path.join(DATA_DIR, 'demo-enriched.json'),
  useCache: !process.argv.includes('--no-cache'),
});

if (!GEMINI_API_KEY) {
  console.log('\nScrape stage verified. Set GEMINI_API_KEY in .env to also test classify → outline → render.');
} else {
  console.log('');
  await classifyStage({
    enrichedPath: path.join(DATA_DIR, 'demo-enriched.json'),
    outPath: path.join(DATA_DIR, 'demo-classified.json'),
  });
  console.log('');
  await outlineStage({
    classifiedPath: path.join(DATA_DIR, 'demo-classified.json'),
    outPath: path.join(DATA_DIR, 'demo-outline.json'),
  });
  console.log('');
  renderStage({
    classifiedPath: path.join(DATA_DIR, 'demo-classified.json'),
    outlinePath: path.join(DATA_DIR, 'demo-outline.json'),
  });
  console.log('\nDemo complete.');
}

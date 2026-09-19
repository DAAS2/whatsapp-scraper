import fs from 'node:fs';
import { SESSION_DIR, LINK_LIMIT } from './config.js';
import { runAll, collectStage, extractStage, enrichStage, classifyStage, outlineStage, renderStage } from './pipeline.js';

function parseArgs(argv) {
  const args = { _: [] };
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [key, value] = a.replace(/^--/, '').split('=');
      args[key] = value === undefined ? true : value;
    } else {
      args._.push(a);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const commands = args._.length ? args._ : ['all'];
const limit = args.limit ? Number(args.limit) : LINK_LIMIT;

if (args.fresh) {
  fs.rmSync(SESSION_DIR, { recursive: true, force: true });
  console.log('Cleared WhatsApp session — you will scan a new QR code.');
}

const stages = {
  collect: () => collectStage({ limit }),
  extract: () => extractStage({ limit }),
  enrich: () => enrichStage({ useCache: !args['no-cache'] }),
  classify: () => classifyStage(),
  outline: () => outlineStage(),
  render: () => renderStage(),
};

try {
  if (commands.length === 1 && commands[0] === 'all') {
    await runAll({ offline: Boolean(args.offline), noCache: Boolean(args['no-cache']), limit });
  } else {
    for (const cmd of commands) {
      if (stages[cmd]) {
        await stages[cmd]();
      } else {
        console.log(`Unknown command "${cmd}". Usage:
  npm start                     full pipeline (WhatsApp → markdown)
  npm start -- --offline        full pipeline using existing data/links.json
  npm start -- classify outline render
  npm run demo                  try the pipeline on sample links (no WhatsApp needed)

Flags: --offline, --fresh (re-scan QR), --no-cache, --limit=200`);
        break;
      }
    }
  }
} catch (e) {
  console.error(`\nError: ${e?.message || e}`);
  process.exitCode = 1;
}

import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  extractMessageContent,
} from 'baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { SESSION_DIR, RAW_MESSAGES_PATH, LINK_LIMIT, readJson, writeJson } from '../config.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'error' });

export function messageText(m) {
  const c = extractMessageContent(m?.message);
  if (!c) return '';
  return (
    c.conversation ||
    c.extendedTextMessage?.text ||
    c.imageMessage?.caption ||
    c.videoMessage?.caption ||
    c.documentMessage?.caption ||
    c.documentWithCaptionMessage?.message?.documentMessage?.caption ||
    c.buttonsResponseMessage?.selectedDisplayText ||
    c.listResponseMessage?.title ||
    ''
  );
}

export async function collectMessages({ limit = LINK_LIMIT, timeoutMs = Number(process.env.COLLECT_TIMEOUT_MS) || 600_000 } = {}) {
  const seen = new Set();
  const rows = [];
  const selfJids = new Set();
  const jidCounts = new Map();
  let ownJid = null;
  let settled = false;
  let attempts = 0;
  let sock = null;
  let timer = null;
  let lastProgress = 0;
  let historyChunks = 0;
  let chunkMsgs = 0;

  let resolve;
  const promise = new Promise((r) => { resolve = r; });

  const finish = (reason) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    try { sock?.end(undefined); } catch { /* already closed */ }
    rows.sort((a, b) => b.timestamp - a.timestamp);
    console.log(`Collected ${rows.length} link-messages from your self-chat (${reason}).`);
    if (rows.length === 0 && jidCounts.size) {
      const top = [...jidCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      console.log(`  [debug] ${chunkMsgs} history messages seen, none from self-chat. Top jids: ${top.map(([j, c]) => `${j}×${c}`).join(', ')}`);
    }
    resolve(rows);
  };

  const push = (list) => {
    if (!Array.isArray(list)) return;
    for (const m of list) {
      const id = m?.key?.id;
      if (!id || seen.has(id)) continue;
      const remote = m?.key?.remoteJid;
      if (!remote) continue;
      const normalized = jidNormalizedUser(remote);
      if (!selfJids.has(normalized)) {
        if (ownJid && m.key.fromMe === true) {
          jidCounts.set(normalized, (jidCounts.get(normalized) || 0) + 1);
        }
        continue;
      }
      if (m.key.fromMe === false) continue;
      seen.add(id);
      const text = messageText(m);
      if (!text) continue;
      rows.push({
        id,
        remote: ownJid,
        timestamp: Number(m.messageTimestamp) * 1000,
        text,
      });
    }
    if (rows.length >= lastProgress + 25) {
      lastProgress = rows.length;
      console.log(`  ... ${rows.length}/${limit} link-messages so far`);
    }
    if (rows.length >= limit) finish('target reached');
  };

  timer = setTimeout(() => finish('timeout'), timeoutMs);

  const connect = async () => {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    let version;
    try {
      ({ version } = await fetchLatestBaileysVersion());
    } catch {
      version = undefined;
    }
    sock = makeWASocket({
      version,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
      browser: Browsers.macOS('Chrome'),
      syncFullHistory: true,
      shouldSyncHistoryMessage: () => true,
      markOnlineOnConnect: false,
      logger,
    });

    sock.ev.on('creds.update', (update) => {
      saveCreds(update);
      if (update.me?.lid) selfJids.add(jidNormalizedUser(update.me.lid));
      if (update.me?.id) selfJids.add(jidNormalizedUser(update.me.id));
    });

    sock.ev.on('lid-mapping.update', ({ lid, pn }) => {
      if (ownJid && jidNormalizedUser(pn) === ownJid) selfJids.add(jidNormalizedUser(lid));
    });

    sock.ev.on('connection.update', (update) => {
      if (update.qr) {
        console.log('Scan this QR in WhatsApp → Settings → Linked devices → Link a device:');
        qrcode.generate(update.qr, { small: true });
      }
      if (update.connection === 'open' && sock.user) {
        ownJid = jidNormalizedUser(sock.user.id);
        selfJids.add(ownJid);
        if (sock.user.lid) selfJids.add(jidNormalizedUser(sock.user.lid));
        attempts = 0;
        console.log(`Connected as ${ownJid}${sock.user.lid ? ` (lid: ${jidNormalizedUser(sock.user.lid)})` : ''}. Reading your "Message yourself" chat history...`);
        console.log('(First run streams your full history — this can take a few minutes. 515 "stream errored" lines are normal.)');
      }
      if (update.connection === 'close' && !settled) {
        const code = update.lastDisconnect?.error?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          console.error('Session was logged out. Delete the session/ folder and re-run to scan again.');
          finish('logged out');
        } else if (++attempts <= 8) {
          console.log(`Connection closed (code ${code}). Reconnecting (${attempts}/8)...`);
          setTimeout(connect, 5000);
        } else {
          console.error('Too many reconnect attempts.');
          finish('reconnect limit');
        }
      }
    });

    sock.ev.on('messaging-history.status', (s) => {
      console.log(`  history sync: ${s.status}`);
    });

    sock.ev.on('messaging-history.set', ({ messages }) => {
      historyChunks += 1;
      const n = Array.isArray(messages) ? messages.length : 0;
      chunkMsgs += n;
      console.log(`  history chunk #${historyChunks}: ${n} messages (pool ${chunkMsgs})`);
      push(messages);
    });

    sock.ev.on('messages.upsert', ({ messages }) => push(messages));

    if (!process.env.NO_HISTORY_HINT) {
      setTimeout(() => {
        if (!settled && rows.length === 0 && historyChunks === 0) {
          console.log('\nNo history arriving. If this session was paired before a failed run,');
          console.log('stop this process and run: npm start -- --fresh');
          console.log('(Full history sync only happens on a brand-new pairing.)\n');
        }
      }, 90_000);
    }
  };

  await connect();
  const collected = await promise;
  return mergeWithExisting(collected);
}

function mergeWithExisting(collected) {
  const existing = readJson(RAW_MESSAGES_PATH, []);
  if (!Array.isArray(existing) || !existing.length) {
    writeJson(RAW_MESSAGES_PATH, collected);
    return collected;
  }
  const byId = new Map(existing.map((r) => [r.id, r]));
  for (const row of collected) byId.set(row.id, row);
  const merged = [...byId.values()].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5000);
  writeJson(RAW_MESSAGES_PATH, merged);
  return merged;
}

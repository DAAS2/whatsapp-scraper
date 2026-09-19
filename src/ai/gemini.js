import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY, GEMINI_MODEL } from '../config.js';

const MIN_INTERVAL_MS = 7_000;

let client = null;
let chain = Promise.resolve();
let lastStart = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function getGemini() {
  if (!client) {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is missing. Put it in .env (copy .env.example) — free key: https://aistudio.google.com/apikey');
    }
    client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return client;
}

function parseJsonLoose(text) {
  let s = String(text || '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(s);
}

export async function generateJSON(prompt, { temperature = 0.3 } = {}) {
  const run = chain.then(async () => {
    let lastErr;
    for (let attempt = 0; attempt <= 4; attempt++) {
      const wait = Math.max(0, lastStart + MIN_INTERVAL_MS - Date.now());
      if (wait) await sleep(wait);
      lastStart = Date.now();
      try {
        const res = await getGemini().models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature,
          },
        });
        return parseJsonLoose(res.text);
      } catch (e) {
        lastErr = e;
        const msg = String(e?.message || e);
        const retriable = /quota|429|rate|exhausted|5\d\d|timeout|fetch|network/i.test(msg);
        if (!retriable || attempt === 4) break;
        await sleep(Math.min(60_000, 8_000 * 2 ** attempt));
      }
    }
    throw lastErr;
  });
  chain = run.catch(() => {});
  return run;
}

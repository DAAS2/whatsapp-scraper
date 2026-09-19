import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const ROOT = root;
export const SESSION_DIR = path.join(root, 'session');
export const DATA_DIR = path.join(root, 'data');
export const CACHE_DIR = path.join(root, 'cache', 'scrape');
export const RESOURCES_DIR = path.join(root, 'resources');

export const RAW_MESSAGES_PATH = path.join(DATA_DIR, 'raw-messages.json');
export const LINKS_PATH = path.join(DATA_DIR, 'links.json');
export const ENRICHED_PATH = path.join(DATA_DIR, 'links.enriched.json');
export const CLASSIFIED_PATH = path.join(DATA_DIR, 'links.classified.json');
export const OUTLINE_PATH = path.join(DATA_DIR, 'outline.json');

function intEnv(name, fallback) {
  const v = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export const LINK_LIMIT = intEnv('MAX_LINK_MESSAGES', 150);
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

export function ensureDirs() {
  for (const dir of [DATA_DIR, CACHE_DIR, RESOURCES_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

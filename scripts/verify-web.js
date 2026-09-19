import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, '.impeccable', 'review');
fs.mkdirSync(outDir, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', '4321', '--strictPort'], {
  cwd: path.join(root, 'web'),
  shell: true,
  stdio: 'ignore',
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const rel = (fill, bg) => {
  const hex = (s) => {
    if (!s || s === 'none' || !s.includes('rgb')) return null;
    return '#' + s.match(/\d+/g).slice(0, 3).map((n) => (+n).toString(16).padStart(2, '0')).join('');
  };
  const f = hex(fill);
  const b = hex(bg);
  if (!f || !b) return null;
  const lum = (c) => c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const l1 = lum([parseInt(f.slice(1, 3), 16), parseInt(f.slice(3, 5), 16), parseInt(f.slice(5, 7), 16)]);
  const l2 = lum([parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)]);
  return ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2);
};

try {
  await wait(2500);
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  for (const vp of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://localhost:4321', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForSelector('.row', { timeout: 15000 });
    await page.waitForTimeout(1300);

    const overflowX = await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth);

    const contrast = await page.evaluate(() => {
      const q = (sel, prop) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el)[prop] : null;
      };
      return {
        pairs: [
          ['body ink on bg', q('body', 'backgroundColor'), q('body', 'color')],
          ['.row-note', q('body', 'backgroundColor'), q('.row-note', 'color')],
          ['.strip-label', q('body', 'backgroundColor'), q('.strip-label', 'color')],
          ['.finder placeholder', q('.finder-input', 'backgroundColor'), getComputedStyle(document.querySelector('.finder-input'), '::placeholder').color],
          ['.masthead-num', q('body', 'backgroundColor'), q('.masthead-num', 'color')],
        ],
      };
    });
    for (const [name, bg, fg] of contrast.pairs) {
      const r = rel(fg, bg);
      if (!r) { console.log(`   contrast ${name}: skipped`); continue; }
      console.log(`   contrast ${name}: ${r}:1 ${+r >= 4.5 ? 'OK' : 'LOW'}`);
    }

    const geo = await page.evaluate(async () => {
      await document.fonts.load('700 24px "Bricolage Grotesque"');
      const fonts = {
        bricolage: document.fonts.check('700 24px "Bricolage Grotesque"'),
        plex: document.fonts.check('14px "IBM Plex Mono"'),
      };
      const rows = [...document.querySelectorAll('.row')].slice(0, 40);
      let clipped = 0;
      for (const r of rows) {
        if (r.scrollHeight > r.clientHeight + 2 || r.scrollWidth > r.clientWidth + 2) clipped += 1;
      }
      const header = document.querySelector('.header');
      return { fonts, clipped, headerOverflowX: header ? header.scrollWidth - header.clientWidth : 0 };
    });

    const rows = await page.locator('.row').count();
    const mastheads = await page.locator('.masthead').count();

    console.log(`== ${vp.name} (${vp.width}x${vp.height}) — rows ${rows}, mastheads ${mastheads}, overflowX ${overflowX}px, errors: ${errors.length ? errors.join('; ') : 'none'}`);
    console.log(`   geo: fonts bricolage=${geo.fonts.bricolage} plex=${geo.fonts.plex} · clippedRows=${geo.clipped}/40 · headerOverflowX=${geo.headerOverflowX}px`);

    await page.screenshot({ path: path.join(outDir, `${vp.name}.png`), fullPage: true });
    await page.screenshot({ path: path.join(outDir, `${vp.name}-fold.png`) });

    await page.evaluate(() => {
      try {
        localStorage.setItem('ll-theme-v2', 'dark');
        document.documentElement.dataset.theme = 'dark';
      } catch {}
    });
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(outDir, `${vp.name}-dark-fold.png`) });
    await page.evaluate(() => { try { localStorage.setItem('ll-theme-v2', 'light'); } catch {} });

    await page.close();
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:4321', { waitUntil: 'networkidle' });
  await page.waitForSelector('.row');
  await page.waitForTimeout(1100);
  await page.fill('.finder-input', 'linkedin');
  await page.waitForTimeout(500);
  console.log('== search "linkedin" →', await page.locator('.row').count(), 'rows; chips:', await page.locator('.course-chip').count());
  await page.fill('.finder-input', '');
  await page.click('.type-chip');
  await page.waitForTimeout(450);
  console.log('== type filter →', await page.locator('.row').count(), 'rows; chips:', await page.locator('.course-chip').count());
  await page.click('.tab');
  await page.waitForTimeout(450);
  console.log('== section tab →', await page.locator('.row').count(), 'rows');
  await browser.close();
} catch (e) {
  console.error('VERIFY FAILED:', e.message);
  process.exitCode = 1;
} finally {
  server.kill();
}
process.exit(0);

const MAX_PAGES = 250;
let browserPromise = null;
let used = 0;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import('playwright');
      for (const opts of [{ channel: 'msedge' }, { channel: 'chrome' }, {}]) {
        try {
          return await chromium.launch({ headless: true, ...opts });
        } catch {
          // try next channel
        }
      }
      throw new Error('no browser available (install chromium: npx playwright install chromium)');
    })();
  }
  return browserPromise;
}

export async function fetchWithBrowser(url, { waitMs = 2_500, gotoTimeoutMs = 20_000 } = {}) {
  if (used >= MAX_PAGES) throw new Error('browser page budget exhausted');
  used += 1;
  let page;
  let context;
  try {
    const browser = await getBrowser();
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });
    const sessionId = process.env.IG_SESSIONID;
    if (sessionId && /instagram\.com/.test(new URL(url).hostname)) {
      await context.addCookies([
        { name: 'sessionid', value: sessionId, domain: '.instagram.com', path: '/' },
      ]);
    }
    page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: gotoTimeoutMs });
    await page.waitForTimeout(waitMs);
    const html = await page.content();
    const text = await page.evaluate(() => (document.body?.innerText || '').slice(0, 4000));
    return { html, text };
  } finally {
    await page?.close().catch(() => {});
    await context?.close().catch(() => {});
  }
}

export function browserAvailable() {
  return true;
}

export async function closeBrowser() {
  const p = browserPromise;
  browserPromise = null;
  if (p) {
    try {
      const b = await p;
      await b.close();
    } catch {
      // already gone
    }
  }
}

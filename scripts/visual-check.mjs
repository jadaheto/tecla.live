import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(`console: ${msg.text().slice(0,300)}`); });
page.on('pageerror', err => errors.push(`pageerror: ${String(err).slice(0,300)}`));
const routes = [
  ['/', 'home'],
  ['/ai', 'ai'],
  ['/settings', 'settings'],
  ['/youtube', 'youtube'],
  ['/radio', 'radio'],
  ['/podcasts', 'podcasts'],
  ['/navigate', 'navigate'],
  ['/favorites', 'favorites'],
  ['/iptv', 'iptv'],
  ['/twitch', 'twitch'],
  ['/music', 'music'],
  ['/apps', 'apps'],
  ['/search?q=tecnologia', 'search'],
  ['/watch/dQw4w9WgXcQ', 'watch'],
];
for (const [path, name] of routes) {
  const before = errors.length;
  const response = await page.goto('http://localhost:3000' + path, { waitUntil: 'networkidle', timeout: 45000 }).catch(e => null);
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `/tmp/tecla-${name}.png`, fullPage: false });
  console.log(`${path} status=${response?.status() ?? 'ERR'} newErrors=${errors.length - before}`);
}
console.log('--- ERRORS ---');
console.log(errors.slice(0, 40).join('\n'));
await browser.close();

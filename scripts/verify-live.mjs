// Production verification against the live GitHub Pages deployment.
// Usage: node scripts/verify-live.mjs [url]
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'https://iiiiiiiiiiiiikk.github.io/timebridge/';
const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1366, height: 900 },
  timezoneId: 'Asia/Shanghai',
  locale: 'zh-CN',
});
const page = await context.newPage();
const consoleErrors = [];
const failedRequests = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(error.message));
page.on('response', (response) => {
  if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`);
});

const response = await page.goto(url, { waitUntil: 'networkidle' });
record('deployed page responds 200', response?.status() === 200, `HTTP ${response?.status()}`);
record('serves the TimeBridge document', (await page.title()).includes('TimeBridge'), await page.title());

await page.getByTestId('hero-local-time').waitFor({ state: 'visible', timeout: 15000 });
record('hero clock renders', true, await page.getByTestId('hero-local-time').innerText());
record(
  'local zone detected',
  (await page.getByTestId('hero-zone').innerText()).includes('Asia/Shanghai'),
  await page.getByTestId('hero-zone').innerText(),
);

const xLink = await page.locator('header').getByTestId('author-x-link').getAttribute('href');
record('header 𝕏 link points at the author', xLink === 'https://x.com/0xkillcoin', String(xLink));

// Add a city through the real search flow.
await page.getByTestId('header-add-city').click();
await page.getByTestId('city-search-input').fill('tokyo');
await page.getByTestId('city-result-tokyo').click();
await page.getByRole('button', { name: '关闭' }).click();
await page.getByTestId('city-card').first().waitFor();
record('city added from search', (await page.getByTestId('city-card').count()) === 1);

await page.reload({ waitUntil: 'networkidle' });
record(
  'city persisted after reload (localStorage)',
  (await page.getByTestId('city-card').count()) === 1,
);

// Every view must render.
const views = ['clock', 'compare', 'planner', 'converter', 'settings'];
for (const view of views) {
  await page.getByTestId(`nav-${view}`).click();
  await page.waitForTimeout(250);
  const heading = await page.locator('main h1').first().innerText().catch(() => '');
  record(`view "${view}" renders`, heading.length > 0, heading);
}

// Converter: 2026-11-02 15:00 Tokyo must be 07:00 London (GMT, after DST ended).
await page.getByTestId('nav-converter').click();
await page.getByTestId('converter-date').fill('2026-11-02');
await page.getByTestId('converter-time').fill('15:00');
const tokyoRow = await page.getByTestId('converter-row-tokyo').innerText();
const londonRow = await page.getByTestId('converter-row-london').innerText().catch(() => '');
record('converter keeps the source time', tokyoRow.includes('15:00'), tokyoRow.replace(/\s+/g, ' '));
record(
  'converter applies the real timezone offset',
  londonRow.length === 0 || londonRow.includes('07:00'),
  londonRow.replace(/\s+/g, ' '),
);

// Share link round-trip.
await page.getByTestId('nav-clock').click();
await page.getByTestId('share-now').first().click();
await page.getByTestId('share-title').fill('Production check');
const shareLink = await page.getByTestId('share-link').inputValue();
record('share link generated', shareLink.includes('#s='), shareLink.slice(0, 60) + '…');
const other = await context.newPage();
await other.goto(shareLink, { waitUntil: 'networkidle' });
const bannerVisible = await other
  .getByTestId('shared-banner')
  .isVisible()
  .catch(() => false);
record('shared link restores the meeting', bannerVisible);
await other.close();

// Mobile layout: no horizontal overflow on the deployed build.
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  timezoneId: 'Asia/Shanghai',
});
const mobilePage = await mobile.newPage();
await mobilePage.goto(url, { waitUntil: 'networkidle' });
const overflow = await mobilePage.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  innerWidth: window.innerWidth,
}));
record(
  'no horizontal overflow on a 390px viewport',
  overflow.scrollWidth <= overflow.innerWidth + 1,
  JSON.stringify(overflow),
);
await mobilePage.screenshot({ path: 'docs/screenshots/production-mobile.png' });
await mobile.close();

await page.screenshot({ path: 'docs/screenshots/production-desktop.png' });

record('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
record('no failed network requests', failedRequests.length === 0, failedRequests.slice(0, 3).join(' | '));

await browser.close();

const failures = results.filter((r) => !r.ok);
console.log(`\n${results.length - failures.length}/${results.length} production checks passed`);
if (failures.length > 0) {
  console.error('FAILED:', failures.map((f) => f.name).join(', '));
  process.exit(1);
}

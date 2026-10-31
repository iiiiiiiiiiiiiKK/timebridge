// Captures the real UI into docs/screenshots/*.png with Playwright.
// Usage: node scripts/screenshots.mjs [baseUrl]
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:4173';
const outDir = path.resolve('docs/screenshots');

const SEED = {
  version: 1,
  settings: {
    language: 'en',
    theme: 'dark',
    hourCycle: 24,
    weekStart: 1,
    defaultDuration: 30,
    workStart: '09:00',
    workEnd: '18:00',
    primaryCityId: 'shanghai',
    showSeconds: false,
    allowWeekend: false,
    allowNonWork: true,
  },
  cityIds: ['shanghai', 'tokyo', 'london', 'new-york', 'san-francisco', 'singapore'],
};

const SEED_ZH = {
  ...SEED,
  settings: { ...SEED.settings, language: 'zh', theme: 'light' },
};

async function seed(page, data) {
  await page.addInitScript((payload) => {
    window.localStorage.setItem('timebridge:state:v1', JSON.stringify(payload));
  }, data);
}

async function shoot(page, name, options = {}) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, name), ...options });
  console.log('saved', name);
}

const browser = await chromium.launch();

try {
  await mkdir(outDir, { recursive: true });

  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    deviceScaleFactor: 2,
    timezoneId: 'Asia/Shanghai',
    locale: 'en-US',
  });
  let page = await desktop.newPage();
  await seed(page, SEED);
  await page.goto(base, { waitUntil: 'networkidle' });
  await shoot(page, 'world-clock-dark.png');

  await page.getByTestId('nav-compare').click();
  await shoot(page, 'time-comparison-dark.png');

  await page.getByTestId('nav-planner').click();
  await shoot(page, 'meeting-planner-dark.png');

  await page.getByTestId('nav-converter').click();
  await shoot(page, 'converter-dark.png');

  await page.getByTestId('header-add-city').click();
  await page.getByTestId('city-search-input').fill('lon');
  await shoot(page, 'city-search-dark.png');
  await page.keyboard.press('Escape');

  await page.getByTestId('nav-clock').click();
  await page.getByTestId('share-now').first().click();
  await shoot(page, 'share-dialog-dark.png');
  await page.keyboard.press('Escape');

  await page.getByTestId('nav-settings').click();
  await shoot(page, 'settings-dark.png');
  await desktop.close();

  const light = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    deviceScaleFactor: 2,
    timezoneId: 'Asia/Shanghai',
    locale: 'zh-CN',
  });
  page = await light.newPage();
  await seed(page, SEED_ZH);
  await page.goto(base, { waitUntil: 'networkidle' });
  await shoot(page, 'world-clock-light-zh.png');

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    timezoneId: 'Asia/Shanghai',
  });
  page = await mobile.newPage();
  await seed(page, SEED);
  await page.goto(base, { waitUntil: 'networkidle' });
  await shoot(page, 'mobile-world-clock.png');

  await page.getByTestId('tab-compare').click();
  await shoot(page, 'mobile-comparison.png');

  await page.getByTestId('tab-planner').click();
  await shoot(page, 'mobile-planner.png');

  await mobile.close();
} finally {
  await browser.close();
}

import { expect, test, type Page } from '@playwright/test';

type ViewId = 'clock' | 'compare' | 'planner' | 'converter' | 'settings';

const BASE_SETTINGS = {
  language: 'zh',
  theme: 'dark',
  hourCycle: 24,
  weekStart: 1,
  defaultDuration: 30,
  workStart: '09:00',
  workEnd: '18:00',
  primaryCityId: null as string | null,
  showSeconds: false,
  allowWeekend: false,
  allowNonWork: true,
};

/** Writes a known state into localStorage before the app boots (first load only). */
async function seed(
  page: Page,
  options: { cityIds?: string[]; settings?: Partial<typeof BASE_SETTINGS> } = {},
) {
  const payload = {
    version: 1,
    cityIds: options.cityIds ?? [],
    settings: { ...BASE_SETTINGS, ...options.settings },
    savedAt: new Date().toISOString(),
  };
  await page.addInitScript((state) => {
    // Seed exactly once per tab so later reloads exercise the real persistence.
    if (window.sessionStorage.getItem('__timebridge_seeded') === '1') return;
    window.localStorage.setItem('timebridge:state:v1', JSON.stringify(state));
    window.sessionStorage.setItem('__timebridge_seeded', '1');
  }, payload);
  await page.goto('/');
  await expect(page.getByTestId('hero-local-time')).toBeVisible();
}

async function goToView(page: Page, view: ViewId) {
  const desktopNav = page.getByTestId(`nav-${view}`);
  if (await desktopNav.isVisible()) {
    await desktopNav.click();
  } else {
    await page.getByTestId(`tab-${view}`).click();
  }
}

async function openSearch(page: Page) {
  await expect(page.getByTestId('hero-local-time')).toBeVisible();
  await page.getByTestId('header-add-city').click({ timeout: 20_000 });
  const input = page.getByTestId('city-search-input');
  await expect(input).toBeVisible();
  return input;
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('renders the world clock, the live local time and the author link', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');

  await expect(page.getByTestId('hero-local-time')).toBeVisible();
  await expect(page.getByTestId('hero-local-time')).toHaveText(/\d{1,2}:\d{2}/);
  await expect(page.getByTestId('hero-zone')).toContainText('Asia/Shanghai');

  const xLink = page.locator('header').getByTestId('author-x-link');
  await expect(xLink).toBeVisible();
  await expect(xLink).toHaveAttribute('href', 'https://x.com/0xkillcoin');
  await expect(xLink).toHaveAttribute('target', '_blank');
  await expect(page.getByTestId('author-x-link').first()).toHaveAttribute(
    'href',
    'https://x.com/0xkillcoin',
  );

  expect(errors).toEqual([]);
});

test('adds a city through the search dialog', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('clock-empty')).toBeVisible();

  const input = await openSearch(page);
  await input.fill('tokyo');
  await expect(input).toHaveValue('tokyo');
  const result = page.getByTestId('city-result-tokyo');
  await expect(result).toBeVisible();
  await result.click();
  await expect(result).toBeDisabled();
  await page.getByRole('button', { name: '关闭' }).click();
  await expect(page.getByTestId('city-card')).toHaveCount(1);
});

test('reorders, persists and removes cities', async ({ page }) => {
  await seed(page, { cityIds: ['tokyo', 'london'] });
  await page.goto('/');

  await expect(page.getByTestId('city-card')).toHaveCount(2);
  await expect(page.getByTestId('city-card').first()).toHaveAttribute('data-city-id', 'tokyo');

  await page.getByTestId('city-card').first().getByTestId('move-down').click();
  await expect(page.getByTestId('city-card').first()).toHaveAttribute('data-city-id', 'london');

  await page.reload();
  await expect(page.getByTestId('city-card')).toHaveCount(2);
  await expect(page.getByTestId('city-card').first()).toHaveAttribute('data-city-id', 'london');

  await page.getByTestId('city-card').first().getByTestId('remove-city').click();
  await expect(page.getByTestId('city-card')).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId('city-card')).toHaveCount(1);
  await expect(page.getByTestId('city-card').first()).toHaveAttribute('data-city-id', 'tokyo');
});

test('searches the city catalogue in Chinese and English', async ({ page }) => {
  await page.goto('/');
  const input = await openSearch(page);

  await input.fill('shang');
  await expect(page.getByTestId('city-result-shanghai')).toBeVisible();

  await input.fill('东京');
  await expect(page.getByTestId('city-result-tokyo')).toBeVisible();

  await input.fill('zzzzzz');
  await expect(page.getByTestId('city-search-results')).toHaveCount(0);
  await expect(page.getByText('没有找到与“zzzzzz”匹配的城市')).toBeVisible();

  await input.fill('new york');
  await expect(page.getByTestId('city-result-new-york')).toBeVisible();
});

test('switches between 12-hour and 24-hour clocks', async ({ page }) => {
  await seed(page, { cityIds: ['tokyo'] });
  await page.goto('/');

  const card = page.getByTestId('city-card').first();
  await expect(card).not.toContainText(/AM|PM/);

  await goToView(page, 'settings');
  await page.getByTestId('settings-hour-cycle').getByRole('radio', { name: /12/ }).click();
  await goToView(page, 'clock');
  await expect(card).toContainText(/AM|PM/);

  await goToView(page, 'settings');
  await page.getByTestId('settings-hour-cycle').getByRole('radio', { name: /24/ }).click();
  await goToView(page, 'clock');
  await expect(card).not.toContainText(/AM|PM/);
});

test('switches language and theme and remembers both', async ({ page }) => {
  await page.goto('/');
  await goToView(page, 'settings');

  await page.getByRole('radio', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  await page.getByRole('radio', { name: 'Light' }).click();
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  expect(isDark).toBe(false);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const darkAfterReload = await page.evaluate(() =>
    document.documentElement.classList.contains('dark'),
  );
  expect(darkAfterReload).toBe(false);
});

test('builds the comparison grid and inspects a cell', async ({ page }) => {
  await seed(page, { cityIds: ['tokyo', 'london'], settings: { primaryCityId: 'tokyo' } });
  await page.goto('/');
  await goToView(page, 'compare');

  await expect(page.getByTestId('compare-table')).toBeVisible();
  await expect(page.getByTestId('compare-date')).not.toBeEmpty();

  await page.getByTestId('cell-tokyo-6').click();
  await expect(page.getByTestId('compare-detail')).toBeVisible();

  const before = await page.getByTestId('compare-date').innerText();
  await page.getByRole('button', { name: '后一天' }).click();
  await expect(page.getByTestId('compare-date')).not.toHaveText(before);
});

test('finds a shared meeting window for Tokyo and London', async ({ page }) => {
  await seed(page, { cityIds: ['tokyo', 'london'], settings: { primaryCityId: 'tokyo' } });
  await page.goto('/');
  await goToView(page, 'planner');

  await expect(page.getByTestId('planner-results')).toBeVisible();
  await page.getByTestId('planner-run').click();
  await expect(page.getByTestId('meeting-slot').first()).toBeVisible();

  const firstSlot = page.getByTestId('meeting-slot').first();
  await expect(firstSlot).toContainText('东京');
  await expect(firstSlot).toContainText('伦敦');
});

test('converts a specific local time for every tracked city', async ({ page }) => {
  await seed(page, { cityIds: ['tokyo', 'london'], settings: { primaryCityId: 'tokyo' } });
  await page.goto('/');
  await goToView(page, 'converter');

  await page.getByTestId('converter-source').selectOption('tokyo');
  await page.getByTestId('converter-date').fill('2026-11-02');
  await page.getByTestId('converter-time').fill('15:00');

  await expect(page.getByTestId('converter-row-tokyo')).toContainText('15:00');
  await expect(page.getByTestId('converter-row-london')).toContainText('06:00');
});

test('creates a share link that restores the shared meeting', async ({ page, context }) => {
  await seed(page, { cityIds: ['tokyo', 'new-york'], settings: { primaryCityId: 'tokyo' } });
  await page.goto('/');

  await page.getByTestId('share-now').first().click();
  await page.getByTestId('share-title').fill('Global standup');
  const link = await page.getByTestId('share-link').inputValue();
  expect(link).toContain('#s=');
  await expect(page.getByTestId('share-preview')).toContainText('Global standup');

  const other = await context.newPage();
  await other.goto(link);
  await expect(other.getByTestId('shared-banner')).toBeVisible();
  await expect(other.getByTestId('shared-banner')).toContainText('Global standup');
  await other.getByTestId('shared-import').click();
  await expect(other.getByTestId('shared-banner')).toHaveCount(0);
  await expect(other.getByTestId('city-card')).toHaveCount(2);
  await other.close();
});

test('recovers from corrupted localStorage data', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('timebridge:state:v1', '{broken json');
  });
  await page.goto('/');
  await expect(page.getByTestId('hero-local-time')).toBeVisible();
  await expect(page.getByTestId('clock-empty')).toBeVisible();
});

test('never overflows horizontally on a small screen', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile-only layout assertion');
  await seed(page, { cityIds: ['tokyo', 'san-francisco'] });
  await page.goto('/');

  for (const view of ['clock', 'compare', 'planner', 'converter', 'settings'] as ViewId[]) {
    await goToView(page, view);
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(metrics.scrollWidth, `${view} must not overflow`).toBeLessThanOrEqual(
      metrics.innerWidth + 1,
    );
  }
});

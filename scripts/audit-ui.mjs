// Automated UI audit: layout, accessibility basics, contrast, console errors.
// Usage: node scripts/audit-ui.mjs [baseUrl]
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://127.0.0.1:4173';
const VIEWS = ['clock', 'compare', 'planner', 'converter', 'settings'];
// Plain (non-emulated) viewports: the audit measures layout, and the mobile
// browser-chrome emulation makes the layout viewport fluctuate mid-run.
const VIEWPORTS = [
  { name: 'mobile-390', context: { viewport: { width: 390, height: 844 } } },
  { name: 'tablet-834', context: { viewport: { width: 834, height: 1112 } } },
  { name: 'desktop-1440', context: { viewport: { width: 1440, height: 950 } } },
];

const SEED = {
  version: 1,
  settings: {
    language: 'zh',
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

const findings = [];
function add(level, message, detail) {
  findings.push({ level, message, detail });
}

const browser = await chromium.launch();
try {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      timezoneId: 'Asia/Shanghai',
      locale: 'zh-CN',
      ...viewport.context,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((state) => {
      window.localStorage.setItem('timebridge:state:v1', JSON.stringify(state));
    }, SEED);
    await page.goto(base, { waitUntil: 'networkidle' });

    // The author link must be reachable from the header on every screen.
    const headerLink = page.locator('header').getByTestId('author-x-link');
    if (!(await headerLink.isVisible())) {
      add('error', `${viewport.name}: header X link not visible`);
    }
    const hasGlobalNav = (await page.getByTestId('nav-clock').isVisible())
      ? 'nav-clock'
      : (await page.getByTestId('tab-clock').isVisible())
        ? 'tab-clock'
        : null;
    if (!hasGlobalNav) add('error', `${viewport.name}: no navigation control visible`);

    for (const view of VIEWS) {
      if (view !== 'clock') {
        const desktopNav = page.getByTestId(`nav-${view}`);
        if (await desktopNav.isVisible()) await desktopNav.click();
        else await page.getByTestId(`tab-${view}`).click();
      }

      const report = await page.evaluate(() => {
        const vw = window.innerWidth;
        const docWidth = document.documentElement.scrollWidth;
        const scrollContainers = Array.from(document.querySelectorAll('.tb-scroll')).length;

        const offenders = [];
        const clippedByAncestor = (el) => {
          let node = el.parentElement;
          while (node) {
            const ov = getComputedStyle(node).overflow + getComputedStyle(node).overflowX;
            if (/hidden|clip|auto|scroll/.test(ov)) return true;
            node = node.parentElement;
          }
          return false;
        };
        for (const el of document.querySelectorAll('body *')) {
          const style = getComputedStyle(el);
          if (style.position === 'fixed' || style.display === 'none') continue;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0) continue;
          if (rect.right > vw + 1.5) {
            const inScroller = el.closest('.tb-scroll');
            if (!inScroller && !clippedByAncestor(el)) {
              offenders.push({
                tag: el.tagName.toLowerCase(),
                cls: (el.className || '').toString().slice(0, 80),
                right: Math.round(rect.right),
              });
            }
          }
        }

        const interactive = Array.from(document.querySelectorAll('button, a[href], input, select'));
        const labelOf = (el) => {
          if (el.labels && el.labels.length) return el.labels[0].textContent?.trim() ?? '';
          const id = el.getAttribute('id');
          if (id) {
            const label = document.querySelector(`label[for="${id}"]`);
            if (label) return label.textContent.trim();
          }
          return '';
        };
        const unnamed = interactive
          .filter((el) => {
            const name =
              el.getAttribute('aria-label') ||
              el.getAttribute('title') ||
              el.textContent?.trim() ||
              el.getAttribute('placeholder') ||
              labelOf(el) ||
              '';
            return name.length === 0;
          })
          .map((el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 40)}`);

        const smallTargets = interactive
          .filter((el) => {
            if (el.tagName === 'A' && el.closest('footer, p')) return false;
            const rect = el.getBoundingClientRect();
            if (rect.width === 0) return false;
            return rect.height < 28;
          })
          .map((el) => {
            const rect = el.getBoundingClientRect();
            return `${el.tagName.toLowerCase()} h=${Math.round(rect.height)} ${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}`;
          });

        const tinyText = Array.from(document.querySelectorAll('body *'))
          .filter((el) => {
            if (!el.childNodes.length) return false;
            const hasTextChild = Array.from(el.childNodes).some(
              (n) => n.nodeType === 3 && n.textContent.trim().length > 1,
            );
            if (!hasTextChild) return false;
            if (el.closest('.sr-only')) return false;
            const size = parseFloat(getComputedStyle(el).fontSize);
            return size < 11;
          })
          .map((el) => `${parseFloat(getComputedStyle(el).fontSize)}px "${el.textContent.trim().slice(0, 24)}"`);

        // Contrast of the primary text against its nearest painted background.
        const parse = (value) => {
          const m = value.match(/rgba?\(([^)]+)\)/);
          if (!m) return null;
          const parts = m[1].split(',').map((p) => parseFloat(p.trim()));
          return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
        };
        const lum = ({ r, g, b }) => {
          const f = (c) => {
            const s = c / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const bgOf = (el) => {
          let node = el;
          while (node && node !== document.documentElement) {
            const bg = parse(getComputedStyle(node).backgroundColor);
            if (bg && bg.a > 0.6) return bg;
            node = node.parentElement;
          }
          const bodyBg = parse(getComputedStyle(document.body).backgroundColor);
          return bodyBg ?? { r: 255, g: 255, b: 255, a: 1 };
        };
        const samples = [];
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, p, span, td, th')).slice(0, 400);
        for (const el of headings) {
          const text = Array.from(el.childNodes)
            .filter((n) => n.nodeType === 3)
            .map((n) => n.textContent.trim())
            .join('');
          if (text.length < 2) continue;
          const fg = parse(getComputedStyle(el).color);
          if (!fg) continue;
          const bg = bgOf(el);
          const l1 = lum(fg);
          const l2 = lum(bg);
          const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          const size = parseFloat(getComputedStyle(el).fontSize);
          const weight = getComputedStyle(el).fontWeight;
          const large = size >= 24 || (size >= 18.66 && Number(weight) >= 700);
          const threshold = large ? 3 : 4.5;
          if (ratio < threshold) {
            samples.push({ text: text.slice(0, 30), ratio: Number(ratio.toFixed(2)), size, threshold });
          }
        }

        return {
          vw,
          docWidth,
          scrollContainers,
          offenders: offenders.slice(0, 8),
          unnamed: unnamed.slice(0, 8),
          smallTargets: smallTargets.slice(0, 8),
          tinyText: tinyText.slice(0, 6),
          lowContrast: samples.slice(0, 8),
          height: document.documentElement.scrollHeight,
        };
      });

      if (report.docWidth > report.vw + 1) {
        add('error', `${viewport.name}/${view}: page overflows horizontally`, report.docWidth);
      }
      if (report.offenders.length) {
        add('warn', `${viewport.name}/${view}: elements past the viewport`, report.offenders);
      }
      if (report.unnamed.length) {
        add('warn', `${viewport.name}/${view}: controls without accessible name`, report.unnamed);
      }
      if (report.smallTargets.length && viewport.name.startsWith('mobile')) {
        add('warn', `${viewport.name}/${view}: tap targets under 28px`, report.smallTargets);
      }
      if (report.tinyText.length) {
        add('info', `${viewport.name}/${view}: text under 11px`, report.tinyText);
      }
      if (report.lowContrast.length) {
        add('warn', `${viewport.name}/${view}: low contrast text`, report.lowContrast);
      }
    }

    if (errors.length) add('error', `${viewport.name}: console errors`, errors.slice(0, 5));
    await context.close();
  }
} finally {
  await browser.close();
}

const counts = findings.reduce((acc, f) => ({ ...acc, [f.level]: (acc[f.level] ?? 0) + 1 }), {});
console.log(JSON.stringify({ counts, findings }, null, 2));

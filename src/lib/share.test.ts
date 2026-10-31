import { describe, expect, it } from 'vitest';
import {
  MAX_SHARE_CITIES,
  SHARE_VERSION,
  buildShareText,
  buildShareUrl,
  decodeSharePayload,
  encodeSharePayload,
  readShareFromHash,
  type SharePayload,
} from './share';

const payload: SharePayload = {
  v: SHARE_VERSION,
  kind: 'moment',
  title: '全球团队同步会',
  instant: Date.UTC(2026, 10, 2, 6, 0, 0),
  duration: 30,
  cities: [
    { name: 'Tokyo', zone: 'Asia/Tokyo' },
    { name: 'London', zone: 'Europe/London' },
    { name: 'New York', zone: 'America/New_York' },
  ],
};

describe('share payload encoding', () => {
  it('round-trips a payload with non-ASCII text', () => {
    const encoded = encodeSharePayload(payload);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    const decoded = decodeSharePayload(encoded);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.payload.title).toBe(payload.title);
    expect(decoded.payload.instant).toBe(payload.instant);
    expect(decoded.payload.duration).toBe(30);
    expect(decoded.payload.cities).toEqual(payload.cities);
  });

  it('rejects malformed, unsupported and invalid payloads', () => {
    expect(decodeSharePayload('')).toEqual({ ok: false, error: 'empty' });
    expect(decodeSharePayload(null).ok).toBe(false);
    expect(decodeSharePayload('!!!!not-base64!!!!').ok).toBe(false);
    const wrongVersion = encodeSharePayload({ ...payload, v: 9 as unknown as 1 });
    expect(decodeSharePayload(wrongVersion)).toEqual({ ok: false, error: 'unsupported' });
    const badZone = encodeSharePayload({
      ...payload,
      cities: [{ name: 'Nowhere', zone: 'Mars/Olympus' }],
    });
    expect(decodeSharePayload(badZone)).toEqual({ ok: false, error: 'invalid' });
    const noCities = encodeSharePayload({ ...payload, cities: [] });
    expect(decodeSharePayload(noCities)).toEqual({ ok: false, error: 'invalid' });
  });

  it('clamps hostile values instead of trusting them', () => {
    const encoded = encodeSharePayload({
      ...payload,
      title: 'x'.repeat(500),
      duration: 999_999,
      cities: Array.from({ length: 40 }, (_, index) => ({
        name: `City ${index}`,
        zone: 'Asia/Tokyo',
      })),
    });
    const decoded = decodeSharePayload(encoded);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.payload.title.length).toBeLessThanOrEqual(120);
    expect(decoded.payload.duration).toBeLessThanOrEqual(1440);
    expect(decoded.payload.cities.length).toBeLessThanOrEqual(MAX_SHARE_CITIES);
  });

  it('reads the payload out of a location hash', () => {
    const encoded = encodeSharePayload(payload);
    expect(readShareFromHash(`#s=${encoded}`)).toBe(encoded);
    expect(readShareFromHash(`#tab=clock&s=${encoded}`)).toBe(encoded);
    expect(readShareFromHash('')).toBeNull();
    expect(readShareFromHash('#tab=clock')).toBeNull();
  });

  it('builds a full share URL that decodes back to the same payload', () => {
    const url = buildShareUrl('https://example.com/timebridge/', payload);
    expect(url.startsWith('https://example.com/timebridge/#s=')).toBe(true);
    const decoded = decodeSharePayload(readShareFromHash(new URL(url).hash));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.payload.cities).toHaveLength(3);
  });

  it('encodes only meeting data (no personal fields)', () => {
    const json = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(encodeSharePayload(payload).replace(/-/g, '+').replace(/_/g, '/')), (c) =>
          c.charCodeAt(0),
        ),
      ),
    );
    expect(Object.keys(json).sort()).toEqual(['cities', 'duration', 'instant', 'kind', 'title', 'v']);
  });
});

describe('share text rendering', () => {
  it('renders consistent plain text and markdown from the same instant', () => {
    const { plain, markdown } = buildShareText(payload, {
      locale: 'en-US',
      hourCycle: 24,
      durationLabel: '30 min',
      fallbackTitle: 'TimeBridge',
    });
    expect(plain).toContain('全球团队同步会');
    expect(plain).toContain('Tokyo: Monday, Nov 2, 2026, 15:00');
    expect(plain).toContain('London: Monday, Nov 2, 2026, 06:00');
    expect(plain).toContain('New York: Monday, Nov 2, 2026, 01:00');
    expect(markdown).toContain('| City | Local time |');
    expect(markdown).toContain('| Tokyo |');
    expect(markdown).toContain('15:00');
  });

  it('renders 12-hour labels when requested', () => {
    const { plain } = buildShareText(payload, {
      locale: 'en-US',
      hourCycle: 12,
      durationLabel: '30 min',
      fallbackTitle: 'TimeBridge',
    });
    expect(plain).toContain('Tokyo: Monday, Nov 2, 2026, 3:00 PM');
  });
});

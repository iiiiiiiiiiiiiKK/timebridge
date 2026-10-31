/**
 * Backend-free share links.
 *
 * Payloads travel in the URL hash (`#s=...`), so they are never sent to a
 * server, never logged by a host and survive on any static host. Only the data
 * the user explicitly shares is encoded: a title, an instant, a duration and
 * the participating cities. No names, e-mails, cookies or identifiers.
 */
import { formatTimeLabel, isValidTimeZone } from './time';

export const SHARE_VERSION = 1;
export const MAX_SHARE_CITIES = 12;
export const MAX_TITLE_LENGTH = 120;

export type ShareCity = {
  /** Display name chosen by the user (city + country label). */
  name: string;
  /** IANA timezone identifier. */
  zone: string;
};

export type SharePayload = {
  v: typeof SHARE_VERSION;
  kind: 'moment';
  title: string;
  /** Epoch milliseconds of the shared moment (UTC instant). */
  instant: number;
  /** Duration in minutes. */
  duration: number;
  cities: ShareCity[];
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function encodeSharePayload(payload: SharePayload): string {
  const json = JSON.stringify(payload);
  return bytesToBase64Url(new TextEncoder().encode(json));
}

export type DecodeResult =
  | { ok: true; payload: SharePayload }
  | { ok: false; error: 'empty' | 'malformed' | 'unsupported' | 'invalid' };

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function decodeSharePayload(encoded: string | null | undefined): DecodeResult {
  if (!encoded || typeof encoded !== 'string') return { ok: false, error: 'empty' };
  if (encoded.length > 4000) return { ok: false, error: 'malformed' };
  let parsed: unknown;
  try {
    const bytes = base64UrlToBytes(encoded);
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return { ok: false, error: 'malformed' };
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'invalid' };
  const raw = parsed as Record<string, unknown>;
  if (raw.v !== SHARE_VERSION) return { ok: false, error: 'unsupported' };
  if (raw.kind !== 'moment') return { ok: false, error: 'invalid' };

  const instant = typeof raw.instant === 'number' ? Math.round(raw.instant) : NaN;
  if (!Number.isFinite(instant) || instant < 0 || instant > 4_102_444_800_000) {
    return { ok: false, error: 'invalid' };
  }
  const duration = clampNumber(raw.duration, 5, 1440, 30);
  const title =
    typeof raw.title === 'string' ? raw.title.slice(0, MAX_TITLE_LENGTH) : '';
  const citiesRaw = Array.isArray(raw.cities) ? raw.cities : [];
  const cities: ShareCity[] = [];
  for (const entry of citiesRaw.slice(0, MAX_SHARE_CITIES)) {
    if (!entry || typeof entry !== 'object') continue;
    const city = entry as Record<string, unknown>;
    const zone = typeof city.zone === 'string' ? city.zone : '';
    if (!isValidTimeZone(zone)) continue;
    const name = typeof city.name === 'string' ? city.name.slice(0, 60) : zone;
    if (cities.some((existing) => existing.zone === zone && existing.name === name)) continue;
    cities.push({ name, zone });
  }
  if (cities.length === 0) return { ok: false, error: 'invalid' };

  return {
    ok: true,
    payload: {
      v: SHARE_VERSION,
      kind: 'moment',
      title: title || 'TimeBridge',
      instant,
      duration,
      cities,
    },
  };
}

/** Extracts a share payload from a location hash such as `#s=abc` or `#tab=clock&s=abc`. */
export function readShareFromHash(hash: string): string | null {
  if (!hash) return null;
  const cleaned = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!cleaned) return null;
  const params = new URLSearchParams(cleaned);
  const value = params.get('s');
  if (value) return value;
  const match = /(?:^|&)?s=([A-Za-z0-9_-]+)/.exec(cleaned);
  return match ? match[1]! : null;
}

export function buildShareUrl(baseUrl: string, payload: SharePayload): string {
  const encoded = encodeSharePayload(payload);
  const url = new URL(baseUrl);
  url.hash = `s=${encoded}`;
  return url.toString();
}

export type ShareTextOptions = {
  locale: string;
  hourCycle: 12 | 24;
  /** Label used for a duration, e.g. "30 min" / "30 分钟". */
  durationLabel: string;
  /** Header when the user did not set a title. */
  fallbackTitle: string;
};

export type ShareTextBundle = { plain: string; markdown: string };

/**
 * Renders the payload as plain text and Markdown. Every local time is computed
 * from the shared instant, so the two outputs can never disagree.
 */
export function buildShareText(payload: SharePayload, options: ShareTextOptions): ShareTextBundle {
  const title = payload.title || options.fallbackTitle;
  const formatter = new Intl.DateTimeFormat(options.locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const rows = payload.cities.map((city) => {
    const time = formatTimeLabel(payload.instant, city.zone, { hourCycle: options.hourCycle });
    const weekday = formatter.format(new Date(payload.instant));
    return { city, time, weekday };
  });

  const plainLines = [
    title,
    `${options.durationLabel}`,
    '',
    ...rows.map((row) => `${row.city.name}: ${row.weekday}, ${row.time}`),
  ];

  const markdownLines = [
    `### ${title}`,
    '',
    `> ${options.durationLabel}`,
    '',
    '| City | Local time |',
    '| --- | --- |',
    ...rows.map((row) => `| ${row.city.name} | ${row.weekday}, ${row.time} |`),
    '',
    '<sub>Shared with TimeBridge — https://x.com/0xkillcoin</sub>',
  ];

  return { plain: plainLines.join('\n'), markdown: markdownLines.join('\n') };
}

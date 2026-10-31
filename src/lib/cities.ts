/** City catalogue: static dataset + search index. */
import rawCities from '../data/cities.json';
import type { Language } from './types';
import { isValidTimeZone } from './time';

export type City = {
  id: string;
  en: string;
  zh: string;
  countryEn: string;
  countryZh: string;
  zone: string;
  popular: boolean;
};

function normalizeCity(entry: unknown): City | null {
  if (!entry || typeof entry !== 'object') return null;
  const raw = entry as Record<string, unknown>;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const zone = typeof raw.zone === 'string' ? raw.zone.trim() : '';
  const en = typeof raw.en === 'string' ? raw.en.trim() : '';
  const zh = typeof raw.zh === 'string' ? raw.zh.trim() : en;
  if (!id || !en || !isValidTimeZone(zone)) return null;
  return {
    id,
    en,
    zh: zh || en,
    countryEn: typeof raw.countryEn === 'string' ? raw.countryEn.trim() : '',
    countryZh: typeof raw.countryZh === 'string' ? raw.countryZh.trim() : '',
    zone,
    popular: raw.popular === true,
  };
}

export const CITIES: City[] = (Array.isArray(rawCities) ? rawCities : [])
  .map(normalizeCity)
  .filter((city): city is City => city !== null);

export const CITY_BY_ID = new Map<string, City>(CITIES.map((city) => [city.id, city]));

export const POPULAR_CITIES: City[] = CITIES.filter((city) => city.popular).sort((a, b) =>
  a.en.localeCompare(b.en),
);

const CITY_BY_ZONE = new Map<string, City>();
for (const city of CITIES) {
  const existing = CITY_BY_ZONE.get(city.zone);
  if (!existing || (!existing.popular && city.popular)) CITY_BY_ZONE.set(city.zone, city);
}

export function isKnownCity(id: string): boolean {
  return CITY_BY_ID.has(id);
}

export function getCity(id: string | null | undefined): City | null {
  if (!id) return null;
  return CITY_BY_ID.get(id) ?? null;
}

export function cityName(city: City, language: Language): string {
  return language === 'zh' ? city.zh || city.en : city.en;
}

export function cityCountry(city: City, language: Language): string {
  return language === 'zh' ? city.countryZh || city.countryEn : city.countryEn;
}

export function cityFullLabel(city: City, language: Language): string {
  const country = cityCountry(city, language);
  const name = cityName(city, language);
  return country ? `${name}, ${country}` : name;
}

export function getLocalTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone && isValidTimeZone(zone)) return zone;
  } catch {
    /* ignore */
  }
  return 'UTC';
}

/**
 * A City object for the visitor's own timezone. Falls back to a synthetic
 * entry when the local zone has no city in the dataset (e.g. "Asia/Yekaterinburg").
 */
export function localCityFor(zone: string): City {
  const match = CITY_BY_ZONE.get(zone);
  if (match) return match;
  return {
    id: `zone:${zone}`,
    en: 'My location',
    zh: '我的位置',
    countryEn: zone.replace(/_/g, ' ').replace(/\//g, ' · '),
    countryZh: zone.replace(/_/g, ' ').replace(/\//g, ' · '),
    zone,
    popular: false,
  };
}

export function findCityByZone(zone: string): City | null {
  return CITY_BY_ZONE.get(zone) ?? null;
}

/** Diacritic-insensitive, lowercase, punctuation-free form used for matching. */
export function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .trim();
}

type IndexedCity = { city: City; haystack: { en: string; zh: string; countryEn: string; countryZh: string; zone: string } };

const index: IndexedCity[] = CITIES.map((city) => ({
  city,
  haystack: {
    en: normalizeForSearch(city.en),
    zh: normalizeForSearch(city.zh),
    countryEn: normalizeForSearch(city.countryEn),
    countryZh: normalizeForSearch(city.countryZh),
    zone: normalizeForSearch(city.zone.replace(/\//g, ' ')),
  },
}));

function scoreEntry(entry: IndexedCity, query: string, tokens: string[]): number {
  const { haystack, city } = entry;
  const primary = [haystack.en, haystack.zh];
  const secondary = [haystack.countryEn, haystack.countryZh, haystack.zone];

  // Every token must appear somewhere (supports "new york", "纽约 美国").
  const all = [...primary, ...secondary].join(' ');
  for (const token of tokens) {
    if (!all.includes(token)) return 0;
  }

  let score = 0;
  if (primary.includes(query)) score = 1000;
  else if (primary.some((value) => value.startsWith(query))) score = 800;
  else if (primary.some((value) => value.split(' ').includes(query))) score = 700;
  else if (primary.some((value) => value.includes(query))) score = 600;
  else if (secondary.some((value) => value.startsWith(query))) score = 450;
  else if (secondary.some((value) => value.includes(query))) score = 350;
  else score = 200;

  if (city.popular) score += 60;
  // Shorter names are usually the ones people mean.
  score -= Math.min(40, haystack.en.length);
  return score;
}

export type CitySearchOptions = {
  limit?: number;
  excludeIds?: Iterable<string>;
};

export function searchCities(
  query: string,
  options: CitySearchOptions = {},
): City[] {
  const limit = options.limit ?? 40;
  const excluded = new Set(options.excludeIds ?? []);
  const normalized = normalizeForSearch(query);
  if (!normalized) {
    return index
      .filter((entry) => entry.city.popular && !excluded.has(entry.city.id))
      .sort((a, b) => a.city.en.localeCompare(b.city.en))
      .slice(0, limit)
      .map((entry) => entry.city);
  }
  const tokens = normalized.split(' ').filter(Boolean);
  const scored: { city: City; score: number }[] = [];
  for (const entry of index) {
    if (excluded.has(entry.city.id)) continue;
    const score = scoreEntry(entry, normalized, tokens);
    if (score > 0) scored.push({ city: entry.city, score });
  }
  scored.sort((a, b) => b.score - a.score || a.city.en.localeCompare(b.city.en));
  return scored.slice(0, limit).map((item) => item.city);
}

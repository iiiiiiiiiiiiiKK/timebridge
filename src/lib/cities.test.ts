import { describe, expect, it } from 'vitest';
import {
  CITIES,
  CITY_BY_ID,
  POPULAR_CITIES,
  cityName,
  findCityByZone,
  getCity,
  localCityFor,
  normalizeForSearch,
  searchCities,
} from './cities';
import { QUICK_CITY_IDS } from './types';
import { getZonedParts, isValidTimeZone } from './time';

const instant = Date.UTC(2026, 10, 2, 6, 0, 0); // 2026-11-02 06:00 UTC

describe('city dataset integrity', () => {
  it('is large enough and free of duplicates', () => {
    expect(CITIES.length).toBeGreaterThan(200);
    const ids = CITIES.map((city) => city.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only uses valid IANA timezones', () => {
    const invalid = CITIES.filter((city) => !isValidTimeZone(city.zone));
    expect(invalid.map((city) => `${city.id}=${city.zone}`)).toEqual([]);
  });

  it('maps known cities to their correct zones', () => {
    const expectations: [string, string][] = [
      ['tokyo', 'Asia/Tokyo'],
      ['shanghai', 'Asia/Shanghai'],
      ['beijing', 'Asia/Shanghai'],
      ['hong-kong', 'Asia/Hong_Kong'],
      ['singapore', 'Asia/Singapore'],
      ['seoul', 'Asia/Seoul'],
      ['london', 'Europe/London'],
      ['paris', 'Europe/Paris'],
      ['berlin', 'Europe/Berlin'],
      ['new-york', 'America/New_York'],
      ['los-angeles', 'America/Los_Angeles'],
      ['san-francisco', 'America/Los_Angeles'],
      ['sydney', 'Australia/Sydney'],
      ['dubai', 'Asia/Dubai'],
    ];
    for (const [id, zone] of expectations) {
      expect(CITY_BY_ID.get(id)?.zone, id).toBe(zone);
    }
  });

  it('exposes every quick-add id and at least 14 popular cities', () => {
    for (const id of QUICK_CITY_IDS) {
      expect(CITY_BY_ID.has(id), id).toBe(true);
    }
    expect(POPULAR_CITIES.length).toBeGreaterThanOrEqual(14);
  });

  it('produces the expected local hour for a shared instant', () => {
    const tokyo = CITY_BY_ID.get('tokyo')!;
    const newYork = CITY_BY_ID.get('new-york')!;
    expect(getZonedParts(instant, tokyo.zone).hour).toBe(15);
    expect(getZonedParts(instant, newYork.zone).hour).toBe(1);
  });
});

describe('city search', () => {
  it('finds cities by English prefix', () => {
    const results = searchCities('toky');
    expect(results[0]?.id).toBe('tokyo');
  });

  it('finds cities by Chinese name', () => {
    const results = searchCities('东京');
    expect(results[0]?.id).toBe('tokyo');
  });

  it('finds cities by country and by timezone id', () => {
    expect(searchCities('japan').some((city) => city.id === 'tokyo')).toBe(true);
    expect(searchCities('Asia/Tokyo').some((city) => city.id === 'tokyo')).toBe(true);
    expect(searchCities('中国').length).toBeGreaterThan(0);
  });

  it('is diacritic insensitive', () => {
    const results = searchCities('sao paulo');
    expect(results.some((city) => city.zone === 'America/Sao_Paulo')).toBe(true);
  });

  it('returns popular cities for an empty query and honours exclusions', () => {
    const all = searchCities('');
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((city) => city.popular)).toBe(true);
    const filtered = searchCities('', { excludeIds: [all[0]!.id] });
    expect(filtered.some((city) => city.id === all[0]!.id)).toBe(false);
  });

  it('returns nothing for nonsense queries', () => {
    expect(searchCities('zzzzqqqq')).toHaveLength(0);
  });

  it('normalises text for matching', () => {
    expect(normalizeForSearch('  São   Paulo ')).toBe('sao paulo');
    expect(normalizeForSearch('北京 Beijing')).toBe('北京 beijing');
  });
});

describe('local zone helpers', () => {
  it('resolves a dataset city for known zones', () => {
    const city = localCityFor('Asia/Tokyo');
    expect(city.id).toBe('tokyo');
    expect(cityName(city, 'zh')).toBe('东京');
    expect(cityName(city, 'en')).toBe('Tokyo');
  });

  it('falls back to a synthetic city for zones without a dataset entry', () => {
    // Legacy tzdata aliases are valid zones but are not dataset city ids.
    const city = localCityFor('Asia/Calcutta');
    expect(city.zone).toBe('Asia/Calcutta');
    expect(city.id).toBe('zone:Asia/Calcutta');
  });

  it('looks up cities by zone', () => {
    expect(findCityByZone('Asia/Shanghai')?.id).toBeTruthy();
    expect(findCityByZone('Mars/Olympus')).toBeNull();
    expect(getCity('does-not-exist')).toBeNull();
  });
});

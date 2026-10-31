import { describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  createDefaultState,
  loadState,
  readState,
  serializeState,
  writeState,
  type StorageLike,
} from './storage';
import { DEFAULT_SETTINGS, MAX_CITIES } from './types';

const known = (id: string) => ['tokyo', 'london', 'new-york', 'shanghai'].includes(id);

function memoryStorage(seed: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = { ...seed };
  return {
    data,
    getItem: (key) => (key in data ? data[key]! : null),
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

describe('state persistence', () => {
  it('returns defaults when nothing is stored', () => {
    const result = loadState(null, known);
    expect(result.status).toBe('empty');
    expect(result.state.cityIds).toEqual([]);
    expect(result.state.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('survives corrupted JSON', () => {
    const result = loadState('{not json', known);
    expect(result.status).toBe('corrupt');
    expect(result.state.cityIds).toEqual([]);
    expect(result.state.settings.language).toBe(DEFAULT_SETTINGS.language);
  });

  it('survives a JSON value that is not an object', () => {
    expect(loadState('42', known).status).toBe('corrupt');
    expect(loadState('"hello"', known).status).toBe('corrupt');
    expect(loadState('[]', known).status).toBe('corrupt');
  });

  it('round-trips a valid state', () => {
    const raw = serializeState({
      settings: { ...DEFAULT_SETTINGS, language: 'en', hourCycle: 12, primaryCityId: 'tokyo' },
      cityIds: ['tokyo', 'london'],
    });
    const result = loadState(raw, known);
    expect(result.status).toBe('ok');
    expect(result.state.settings.language).toBe('en');
    expect(result.state.settings.hourCycle).toBe(12);
    expect(result.state.cityIds).toEqual(['tokyo', 'london']);
  });

  it('drops unknown cities, duplicates and oversized lists', () => {
    const raw = JSON.stringify({
      version: 1,
      settings: DEFAULT_SETTINGS,
      cityIds: ['tokyo', 'tokyo', 'atlantis', 42, null, 'london'],
    });
    const result = loadState(raw, known);
    expect(result.state.cityIds).toEqual(['tokyo', 'london']);
    expect(result.status).toBe('partial');
    expect(result.issues).toContain('cities:unknown');

    const huge = JSON.stringify({
      version: 1,
      settings: DEFAULT_SETTINGS,
      cityIds: Array.from({ length: MAX_CITIES + 20 }, () => 'tokyo'),
    });
    expect(loadState(huge, known).state.cityIds.length).toBeLessThanOrEqual(MAX_CITIES);
  });

  it('repairs hostile setting values', () => {
    const raw = JSON.stringify({
      version: 1,
      cityIds: ['tokyo'],
      settings: {
        language: 'de',
        theme: 'neon',
        hourCycle: 13,
        weekStart: 5,
        defaultDuration: 17,
        workStart: '99:99',
        workEnd: '18:00',
        primaryCityId: 42,
        showSeconds: 'yes',
        allowWeekend: 'maybe',
        allowNonWork: null,
      },
    });
    const result = loadState(raw, known);
    const settings = result.state.settings;
    expect(settings.language).toBe(DEFAULT_SETTINGS.language);
    expect(settings.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(settings.hourCycle).toBe(DEFAULT_SETTINGS.hourCycle);
    expect(settings.weekStart).toBe(DEFAULT_SETTINGS.weekStart);
    expect(settings.defaultDuration).toBe(DEFAULT_SETTINGS.defaultDuration);
    expect(settings.workStart).toBe(DEFAULT_SETTINGS.workStart);
    // An unusable primary city id is dropped; `null` means "follow my local zone".
    expect(settings.primaryCityId).toBeNull();
    expect(settings.showSeconds).toBe(DEFAULT_SETTINGS.showSeconds);
  });

  it('keeps a valid working window but rejects an inverted one', () => {
    const valid = loadState(
      JSON.stringify({
        version: 1,
        cityIds: ['tokyo'],
        settings: { ...DEFAULT_SETTINGS, workStart: '08:30', workEnd: '17:45' },
      }),
      known,
    );
    expect(valid.state.settings.workStart).toBe('08:30');
    expect(valid.state.settings.workEnd).toBe('17:45');

    const inverted = loadState(
      JSON.stringify({
        version: 1,
        cityIds: ['tokyo'],
        settings: { ...DEFAULT_SETTINGS, workStart: '20:00', workEnd: '08:00', hourCycle: 12 },
      }),
      known,
    );
    expect(inverted.state.settings.workStart).toBe(DEFAULT_SETTINGS.workStart);
    expect(inverted.state.settings.workEnd).toBe(DEFAULT_SETTINGS.workEnd);
    // Other, valid fields survive the repair.
    expect(inverted.state.settings.hourCycle).toBe(12);
    expect(inverted.issues).toContain('settings:work-window');
  });

  it('migrates legacy shapes without crashing', () => {
    const legacy = JSON.stringify({
      cities: ['tokyo', 'london', 'nowhere'],
      hourCycle: '12',
      language: 'en',
      theme: 'light',
    });
    const result = loadState(legacy, known);
    expect(result.status).toBe('migrated');
    expect(result.state.cityIds).toEqual(['tokyo', 'london']);
    expect(result.state.settings.hourCycle).toBe(12);
    expect(result.state.settings.language).toBe('en');
    expect(result.state.settings.theme).toBe('light');
  });

  it('picks a sensible primary city when the stored one is gone', () => {
    const result = loadState(
      JSON.stringify({
        version: 1,
        cityIds: ['tokyo'],
        settings: { ...DEFAULT_SETTINGS, primaryCityId: 'atlantis' },
      }),
      known,
    );
    expect(result.state.settings.primaryCityId).toBe('tokyo');
  });

  it('reads and writes through a storage adapter', () => {
    const storage = memoryStorage();
    expect(writeState(storage, { settings: DEFAULT_SETTINGS, cityIds: ['tokyo'] })).toBe(true);
    expect(storage.data[STORAGE_KEY]).toBeTruthy();
    const loaded = readState(storage, known);
    expect(loaded.status).toBe('ok');
    expect(loaded.state.cityIds).toEqual(['tokyo']);
  });

  it('falls back to a legacy key when the current one is missing', () => {
    const storage = memoryStorage({ 'timebridge-v1': JSON.stringify({ cities: ['london'] }) });
    const loaded = readState(storage, known);
    expect(loaded.state.cityIds).toEqual(['london']);
  });

  it('reports failures instead of throwing when storage throws', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readState(broken, known).status).toBe('corrupt');
    expect(writeState(broken, createDefaultState())).toBe(false);
    expect(readState(null, known).status).toBe('empty');
  });
});

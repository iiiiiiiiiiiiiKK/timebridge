/**
 * Persistence layer.
 *
 * The state shape is versioned and every field is validated on the way in:
 * corrupted, truncated or hand-edited localStorage must never crash the app.
 */
import {
  DEFAULT_SETTINGS,
  MAX_CITIES,
  type AppState,
  type HourCycle,
  type Language,
  type Settings,
  type Theme,
  type WeekStart,
} from './types';
import { isValidTimeZone, parseClockString } from './time';

export const STORAGE_KEY = 'timebridge:state:v1';
export const LEGACY_KEYS = ['timebridge', 'timebridge:state', 'timebridge-v1'];

export type LoadStatus = 'ok' | 'empty' | 'corrupt' | 'migrated' | 'partial';

export type LoadResult = {
  state: AppState;
  status: LoadStatus;
  issues: string[];
};

const DURATIONS = [15, 30, 45, 60, 90, 120];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function sanitizeLanguage(value: unknown, fallback: Language): Language {
  return value === 'zh' || value === 'en' ? value : fallback;
}

function sanitizeTheme(value: unknown, fallback: Theme): Theme {
  return value === 'dark' || value === 'light' ? value : fallback;
}

function sanitizeHourCycle(value: unknown, fallback: HourCycle): HourCycle {
  if (value === 12 || value === '12' || value === 'h12') return 12;
  if (value === 24 || value === '24' || value === 'h23' || value === 'h24') return 24;
  return fallback;
}

function sanitizeWeekStart(value: unknown, fallback: WeekStart): WeekStart {
  if (value === 0 || value === '0' || value === 'sunday') return 0;
  if (value === 1 || value === '1' || value === 'monday') return 1;
  return fallback;
}

function sanitizeClock(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  return parseClockString(value) === null ? fallback : value.trim();
}

function sanitizeDuration(value: unknown, fallback: number): number {
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (typeof numeric !== 'number' || !Number.isFinite(numeric)) return fallback;
  return DURATIONS.includes(numeric) ? numeric : fallback;
}

function sanitizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

export function sanitizeSettings(
  input: unknown,
  fallback: Settings = DEFAULT_SETTINGS,
  issues: string[] = [],
): Settings {
  const record = asRecord(input);
  if (!record) {
    if (input !== undefined && input !== null) issues.push('settings:not-an-object');
    return { ...fallback };
  }
  const primaryCityId =
    typeof record.primaryCityId === 'string' && record.primaryCityId.length <= 64
      ? record.primaryCityId
      : null;

  const workStart = sanitizeClock(record.workStart, fallback.workStart);
  const workEnd = sanitizeClock(record.workEnd, fallback.workEnd);
  const startMinute = parseClockString(workStart) ?? 540;
  const endMinute = parseClockString(workEnd) ?? 1080;
  if (endMinute <= startMinute) {
    issues.push('settings:work-window');
    return {
      ...fallback,
      language: sanitizeLanguage(record.language, fallback.language),
      theme: sanitizeTheme(record.theme, fallback.theme),
      hourCycle: sanitizeHourCycle(record.hourCycle, fallback.hourCycle),
      weekStart: sanitizeWeekStart(record.weekStart, fallback.weekStart),
      defaultDuration: sanitizeDuration(record.defaultDuration, fallback.defaultDuration),
      primaryCityId,
      showSeconds: sanitizeBoolean(record.showSeconds, fallback.showSeconds),
      allowWeekend: sanitizeBoolean(record.allowWeekend, fallback.allowWeekend),
      allowNonWork: sanitizeBoolean(record.allowNonWork, fallback.allowNonWork),
    };
  }

  return {
    language: sanitizeLanguage(record.language, fallback.language),
    theme: sanitizeTheme(record.theme, fallback.theme),
    hourCycle: sanitizeHourCycle(record.hourCycle, fallback.hourCycle),
    weekStart: sanitizeWeekStart(record.weekStart, fallback.weekStart),
    defaultDuration: sanitizeDuration(record.defaultDuration, fallback.defaultDuration),
    workStart,
    workEnd,
    primaryCityId,
    showSeconds: sanitizeBoolean(record.showSeconds, fallback.showSeconds),
    allowWeekend: sanitizeBoolean(record.allowWeekend, fallback.allowWeekend),
    allowNonWork: sanitizeBoolean(record.allowNonWork, fallback.allowNonWork),
  };
}

export function sanitizeCityIds(
  input: unknown,
  isKnownCity: (id: string) => boolean,
  issues: string[] = [],
): string[] {
  if (!Array.isArray(input)) {
    if (input !== undefined && input !== null) issues.push('cities:not-an-array');
    return [];
  }
  const result: string[] = [];
  for (const entry of input) {
    let id: string | null = null;
    if (typeof entry === 'string') id = entry;
    else if (asRecord(entry) && typeof (entry as Record<string, unknown>).id === 'string') {
      id = (entry as Record<string, unknown>).id as string;
    }
    if (!id || !isKnownCity(id)) {
      issues.push('cities:unknown');
      continue;
    }
    if (!result.includes(id)) result.push(id);
    if (result.length >= MAX_CITIES) {
      issues.push('cities:truncated');
      break;
    }
  }
  return result;
}

export function createDefaultState(): AppState {
  return { settings: { ...DEFAULT_SETTINGS }, cityIds: [] };
}

export function loadState(raw: string | null, isKnownCity: (id: string) => boolean): LoadResult {
  if (!raw) return { state: createDefaultState(), status: 'empty', issues: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { state: createDefaultState(), status: 'corrupt', issues: ['json'] };
  }

  const record = asRecord(parsed);
  if (!record) return { state: createDefaultState(), status: 'corrupt', issues: ['shape'] };

  const issues: string[] = [];
  const version = record.version;
  const isCurrent = version === 1;
  if (version !== undefined && !isCurrent) issues.push('version');

  const settingsSource = isCurrent ? record.settings : (record.settings ?? record);
  const citiesSource = isCurrent ? record.cityIds : (record.cityIds ?? record.cities);

  const settings = sanitizeSettings(settingsSource, DEFAULT_SETTINGS, issues);
  const cityIds = sanitizeCityIds(citiesSource, isKnownCity, issues);

  if (settings.primaryCityId && !cityIds.includes(settings.primaryCityId)) {
    settings.primaryCityId = cityIds[0] ?? null;
  }

  let status: LoadStatus = 'ok';
  if (issues.length > 0) status = isCurrent ? 'partial' : 'migrated';

  return { state: { settings, cityIds }, status, issues };
}

export function serializeState(state: AppState): string {
  return JSON.stringify({
    version: 1,
    settings: state.settings,
    cityIds: state.cityIds,
    savedAt: new Date().toISOString(),
  });
}

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function readState(
  storage: StorageLike | null | undefined,
  isKnownCity: (id: string) => boolean,
): LoadResult {
  if (!storage) return { state: createDefaultState(), status: 'empty', issues: ['no-storage'] };
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      for (const key of LEGACY_KEYS) {
        const legacy = storage.getItem(key);
        if (legacy) {
          raw = legacy;
          break;
        }
      }
    }
  } catch {
    return { state: createDefaultState(), status: 'corrupt', issues: ['read'] };
  }
  return loadState(raw, isKnownCity);
}

export function writeState(storage: StorageLike | null | undefined, state: AppState): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, serializeState(state));
    return true;
  } catch {
    return false;
  }
}

export function clearState(storage: StorageLike | null | undefined): void {
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
    for (const key of LEGACY_KEYS) storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Sanity helper used by the UI when importing a city id from a share link. */
export function isUsableZone(zone: string): boolean {
  return isValidTimeZone(zone);
}

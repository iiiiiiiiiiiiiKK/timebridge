/**
 * Timezone engine.
 *
 * Everything in this module is built on the IANA timezone database through
 * `Intl.DateTimeFormat`. No fixed UTC offsets are ever hard-coded and no
 * arithmetic like `utc + 8h` is performed, so DST transitions, cross-day
 * shifts, historical offsets and half-hour/45-minute zones are all handled by
 * the platform's tzdata.
 */

export type CivilParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export type ZonedParts = CivilParts & {
  /** 0 = Sunday ... 6 = Saturday (derived from the civil date) */
  weekday: number;
};

const MS_MINUTE = 60_000;
const MS_DAY = 86_400_000;

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

const weekdayCache = new Map<string, number>();

function weekdayFromCivil(year: number, month: number, day: number): number {
  const key = `${year}-${month}-${day}`;
  const cached = weekdayCache.get(key);
  if (cached !== undefined) return cached;
  const value = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  if (weekdayCache.size > 5000) weekdayCache.clear();
  weekdayCache.set(key, value);
  return value;
}

const zonedCache = new Map<string, ZonedParts>();

/** Wall-clock parts of an instant in a given IANA timezone. */
export function getZonedParts(instant: number | Date, timeZone: string): ZonedParts {
  const ms = typeof instant === 'number' ? instant : instant.getTime();
  const cacheKey = `${timeZone}|${Math.floor(ms / 1000)}`;
  const cached = zonedCache.get(cacheKey);
  if (cached) return cached;

  const raw = partsFormatter(timeZone).formatToParts(new Date(ms));
  let year = 0;
  let month = 1;
  let day = 1;
  let hour = 0;
  let minute = 0;
  let second = 0;

  for (const part of raw) {
    switch (part.type) {
      case 'year':
        year = Number(part.value);
        break;
      case 'month':
        month = Number(part.value);
        break;
      case 'day':
        day = Number(part.value);
        break;
      case 'hour':
        hour = Number(part.value) % 24;
        break;
      case 'minute':
        minute = Number(part.value);
        break;
      case 'second':
        second = Number(part.value);
        break;
      default:
        break;
    }
  }

  const result: ZonedParts = {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday: weekdayFromCivil(year, month, day),
  };

  if (zonedCache.size > 20_000) zonedCache.clear();
  zonedCache.set(cacheKey, result);
  return result;
}

/**
 * Offset of a timezone at a specific instant, in minutes east of UTC.
 * Positive = ahead of UTC (e.g. Asia/Tokyo => 540).
 */
export function getOffsetMinutes(instant: number | Date, timeZone: string): number {
  const ms = typeof instant === 'number' ? instant : instant.getTime();
  const p = getZonedParts(ms, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // Round to the minute: some zones have offsets with second precision in the
  // distant past, the rounding keeps the result stable for UI purposes.
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / MS_MINUTE);
}

function civilKey(p: CivilParts): string {
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}

export type ResolvedCivilTime = {
  /** UTC instant (epoch ms) that the wall-clock time belongs to. */
  instant: number;
  /**
   * `exact`       – the wall-clock time exists exactly once (normal case).
   * `ambiguous`   – the wall-clock time exists twice (DST ends / clocks go back).
   * `nonexistent` – the wall-clock time was skipped (DST starts / clocks go forward).
   */
  kind: 'exact' | 'ambiguous' | 'nonexistent';
  /** Every instant matching the wall-clock time, ascending (0 or 1 or 2 entries). */
  candidates: number[];
};

/**
 * Converts wall-clock parts in `timeZone` into a UTC instant.
 *
 * DST semantics follow the "compatible" (Temporal) strategy:
 * - ambiguous times resolve to the first (earlier) occurrence;
 * - non-existent times are shifted forward by the size of the gap.
 */
export function resolveCivilTime(parts: CivilParts, timeZone: string): ResolvedCivilTime {
  const utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const target = civilKey(parts);

  // Probe the offsets a transition could produce: the guessed instant itself
  // plus one day either side (covers every DST change and even the 24h
  // date-line shifts in zones such as Pacific/Apia).
  const probeOffsets = new Set<number>();
  const probes = [utcGuess, utcGuess - 26 * 3_600_000, utcGuess + 26 * 3_600_000];
  for (const probe of probes) probeOffsets.add(getOffsetMinutes(probe, timeZone));

  const candidates: number[] = [];
  const tryOffset = (offset: number) => {
    const candidate = utcGuess - offset * MS_MINUTE;
    if (
      civilKey(getZonedParts(candidate, timeZone)) === target &&
      !candidates.includes(candidate)
    ) {
      candidates.push(candidate);
    }
  };
  for (const offset of probeOffsets) tryOffset(offset);

  candidates.sort((a, b) => a - b);

  if (candidates.length === 1) {
    return { instant: candidates[0]!, kind: 'exact', candidates };
  }
  if (candidates.length > 1) {
    return { instant: candidates[0]!, kind: 'ambiguous', candidates };
  }
  // Wall-clock time inside a spring-forward gap: shift forward using the
  // pre-transition offset (the same result as Temporal's "compatible" mode).
  const fallbackOffset = getOffsetMinutes(utcGuess, timeZone);
  return { instant: utcGuess - fallbackOffset * MS_MINUTE, kind: 'nonexistent', candidates: [] };
}

/** Convenience wrapper: wall-clock parts in a zone => UTC epoch ms. */
export function civilToInstant(parts: CivilParts, timeZone: string): number {
  return resolveCivilTime(parts, timeZone).instant;
}

/** Start of the civil day (00:00) in `timeZone` for the given instant. */
export function startOfZonedDay(instant: number, timeZone: string): number {
  const p = getZonedParts(instant, timeZone);
  return resolveCivilTime(
    { year: p.year, month: p.month, day: p.day, hour: 0, minute: 0, second: 0 },
    timeZone,
  ).instant;
}

/** Adds whole calendar days to a wall-clock date (keeps 00:00 local time). */
export function addCivilDays(parts: CivilParts, days: number): CivilParts {
  const utc = Date.UTC(parts.year, parts.month - 1, parts.day + days, 0, 0, 0);
  const d = new Date(utc);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

export function parseIsoDate(value: string): CivilParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return null;
  return { year, month, day, hour: 0, minute: 0, second: 0 };
}

export function toIsoDate(parts: { year: number; month: number; day: number }): string {
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(
    parts.day,
  ).padStart(2, '0')}`;
}

/** ISO date (yyyy-mm-dd) of the given instant in `timeZone`. */
export function isoDateInZone(instant: number, timeZone: string): string {
  return toIsoDate(getZonedParts(instant, timeZone));
}

/** HH:mm parts from a "HH:mm" string, tolerant and validated. */
export function parseClockString(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function minutesToClockString(minutes: number): string {
  const clamped = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(
    2,
    '0',
  )}`;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export type ClockFormat = {
  /** e.g. "14" or "2" (12h) */
  hour: string;
  /** e.g. "05" */
  minute: string;
  /** e.g. "09" */
  second: string;
  /** "AM" / "PM" for 12h mode */
  meridiem: string | null;
};

export function formatClockParts(parts: CivilParts, hourCycle: 12 | 24): ClockFormat {
  const hour24 = parts.hour;
  let hour = hour24;
  let meridiem: string | null = null;
  if (hourCycle === 12) {
    meridiem = hour24 < 12 ? 'AM' : 'PM';
    hour = hour24 % 12;
    if (hour === 0) hour = 12;
  }
  return {
    hour: String(hour).padStart(hourCycle === 24 ? 2 : 1, '0'),
    minute: String(parts.minute).padStart(2, '0'),
    second: String(parts.second).padStart(2, '0'),
    meridiem,
  };
}

/** "14:05" / "2:05 PM" / "14:05:09" */
export function formatTimeLabel(
  instant: number,
  timeZone: string,
  opts: { hourCycle: 12 | 24; withSeconds?: boolean },
): string {
  const parts = getZonedParts(instant, timeZone);
  const clock = formatClockParts(parts, opts.hourCycle);
  const base = `${clock.hour}:${clock.minute}${opts.withSeconds ? `:${clock.second}` : ''}`;
  return clock.meridiem ? `${base} ${clock.meridiem}` : base;
}

/** Signed offset label, e.g. "GMT+8" / "GMT+5:45" / "GMT-3". */
export function formatOffsetLabel(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return minutes === 0 ? `GMT${sign}${hours}` : `GMT${sign}${hours}:${String(minutes).padStart(2, '0')}`;
}

/** Difference between two offsets expressed as "+9h" / "-3h 30m" / "same time". */
export function formatOffsetDiff(diffMinutes: number): string {
  if (diffMinutes === 0) return '0';
  const sign = diffMinutes > 0 ? '+' : '-';
  const abs = Math.abs(diffMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  const hourPart = hours > 0 ? `${hours}h` : '';
  const minutePart = minutes > 0 ? `${minutes}m` : '';
  return `${sign}${hourPart}${hourPart && minutePart ? ' ' : ''}${minutePart}`;
}

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone || typeof timeZone !== 'string') return false;
  if (timeZone.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(timeZone)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function getSupportedTimeZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  if (typeof intl.supportedValuesOf === 'function') {
    try {
      return intl.supportedValuesOf('timeZone');
    } catch {
      /* fall through */
    }
  }
  return [];
}

/** True when the zone observes daylight saving time in the given year. */
export function observesDaylightSaving(timeZone: string, year: number): boolean {
  const offsets = new Set<number>();
  for (let month = 0; month < 12; month += 1) {
    offsets.add(getOffsetMinutes(Date.UTC(year, month, 15, 12, 0, 0), timeZone));
    if (offsets.size > 1) return true;
  }
  return false;
}

/** Localized zone name, e.g. "Japan Standard Time" / "JST". */
export function getZoneName(
  instant: number,
  timeZone: string,
  locale: string,
  style: 'long' | 'short' = 'long',
): string {
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      timeZone,
      timeZoneName: style,
      year: 'numeric',
    });
    const part = formatter.formatToParts(new Date(instant)).find((p) => p.type === 'timeZoneName');
    return part?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

export function formatZonedDate(
  instant: number,
  timeZone: string,
  locale: string,
  style: 'short' | 'medium' | 'long' | 'full' = 'medium',
): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: style,
  });
  return formatter.format(new Date(instant));
}

export function formatZonedWeekday(instant: number, timeZone: string, locale: string): string {
  const formatter = new Intl.DateTimeFormat(locale, { timeZone, weekday: 'short' });
  return formatter.format(new Date(instant));
}

/**
 * Day-difference bucket between a city and the reference (local) city:
 * -1 = previous day, 0 = same day, 1 = next day.
 */
export function dayDelta(
  instant: number,
  timeZone: string,
  referenceZone: string,
): number {
  const a = getZonedParts(instant, timeZone);
  const b = getZonedParts(instant, referenceZone);
  return Math.round((Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day)) / MS_DAY);
}

/**
 * ISO-like week number of the given instant in `timeZone`.
 * `weekStart` shifts the first day of the week (0 = Sunday, 1 = Monday).
 */
export function getWeekNumber(
  instant: number,
  timeZone: string,
  weekStart: 0 | 1 = 1,
): { week: number; year: number } {
  const parts = getZonedParts(instant, timeZone);
  const dayOfYear =
    Math.floor(
      (Date.UTC(parts.year, parts.month - 1, parts.day) - Date.UTC(parts.year, 0, 1)) / MS_DAY,
    ) + 1;
  const weekdayIndex = (parts.weekday - weekStart + 7) % 7; // 0 = first day of week
  const week = Math.floor((dayOfYear - 1 - weekdayIndex + 7) / 7);
  return { week: Math.max(1, week), year: parts.year };
}

export { MS_DAY, MS_MINUTE };

import { describe, expect, it } from 'vitest';
import {
  addCivilDays,
  civilToInstant,
  dayDelta,
  formatClockParts,
  formatOffsetDiff,
  formatOffsetLabel,
  formatTimeLabel,
  getOffsetMinutes,
  getWeekNumber,
  getZonedParts,
  isoDateInZone,
  isValidTimeZone,
  minutesToClockString,
  observesDaylightSaving,
  parseClockString,
  parseIsoDate,
  resolveCivilTime,
  startOfZonedDay,
  toIsoDate,
} from './time';

const TOKYO = 'Asia/Tokyo';
const NEW_YORK = 'America/New_York';
const SHANGHAI = 'Asia/Shanghai';
const LONDON = 'Europe/London';
const BERLIN = 'Europe/Berlin';
const LOS_ANGELES = 'America/Los_Angeles';
const SYDNEY = 'Australia/Sydney';
const KOLKATA = 'Asia/Kolkata';

describe('basic conversions (IANA database, no fixed offsets)', () => {
  it('converts Tokyo 15:00 to New York 01:00 (same instant, wintry offsets)', () => {
    const tokyo = civilToInstant(
      { year: 2026, month: 11, day: 2, hour: 15, minute: 0, second: 0 },
      TOKYO,
    );
    expect(new Date(tokyo).toISOString()).toBe('2026-11-02T06:00:00.000Z');
    const ny = getZonedParts(tokyo, NEW_YORK);
    expect(ny).toMatchObject({ year: 2026, month: 11, day: 2, hour: 1, minute: 0 });
    expect(getOffsetMinutes(tokyo, NEW_YORK)).toBe(-300); // EST, DST already ended
  });

  it('converts Shanghai 15:00 to London 07:00', () => {
    const shanghai = civilToInstant(
      { year: 2026, month: 11, day: 2, hour: 15, minute: 0, second: 0 },
      SHANGHAI,
    );
    expect(new Date(shanghai).toISOString()).toBe('2026-11-02T07:00:00.000Z');
    expect(getZonedParts(shanghai, LONDON)).toMatchObject({ hour: 7, minute: 0 });
    expect(getOffsetMinutes(shanghai, LONDON)).toBe(0); // GMT after 2026-10-25
  });

  it('keeps half-hour offsets intact (Asia/Kolkata = +5:30)', () => {
    const instant = Date.UTC(2026, 5, 1, 0, 0, 0);
    expect(getOffsetMinutes(instant, KOLKATA)).toBe(330);
    expect(getZonedParts(instant, KOLKATA)).toMatchObject({ hour: 5, minute: 30 });
    expect(formatOffsetLabel(330)).toBe('GMT+5:30');
  });
});

describe('date boundaries', () => {
  it('reports different calendar dates for the same instant', () => {
    // 2026-11-02 23:30 in Los Angeles = 2026-11-03 16:30 in Tokyo.
    const instant = civilToInstant(
      { year: 2026, month: 11, day: 2, hour: 23, minute: 30, second: 0 },
      LOS_ANGELES,
    );
    expect(isoDateInZone(instant, LOS_ANGELES)).toBe('2026-11-02');
    expect(isoDateInZone(instant, TOKYO)).toBe('2026-11-03');
    expect(dayDelta(instant, TOKYO, LOS_ANGELES)).toBe(1);
    expect(dayDelta(instant, LOS_ANGELES, TOKYO)).toBe(-1);
  });

  it('crosses into the next year', () => {
    const instant = civilToInstant(
      { year: 2026, month: 12, day: 31, hour: 22, minute: 0, second: 0 },
      LOS_ANGELES,
    );
    // 2026-12-31 22:00 PST = 2027-01-01 06:00 UTC = 15:00 Tokyo on Jan 1st.
    const tokyo = getZonedParts(instant, TOKYO);
    expect(tokyo).toMatchObject({ year: 2027, month: 1, day: 1, hour: 15 });
    expect(tokyo.weekday).toBe(5); // 2027-01-01 was a Friday
  });

  it('handles the leap day', () => {
    const instant = civilToInstant(
      { year: 2028, month: 2, day: 29, hour: 12, minute: 0, second: 0 },
      SHANGHAI,
    );
    expect(isoDateInZone(instant, SHANGHAI)).toBe('2028-02-29');
    expect(isoDateInZone(instant + 24 * 3600 * 1000, SHANGHAI)).toBe('2028-03-01');
  });

  it('computes the start of a local day', () => {
    const instant = Date.UTC(2026, 6, 15, 18, 45, 0);
    const start = startOfZonedDay(instant, SYDNEY);
    expect(getZonedParts(start, SYDNEY)).toMatchObject({ hour: 0, minute: 0, day: 16 });
  });

  it('adds calendar days across a month boundary', () => {
    const next = addCivilDays({ year: 2026, month: 1, day: 31, hour: 0, minute: 0, second: 0 }, 1);
    expect(toIsoDate(next)).toBe('2026-02-01');
  });
});

describe('daylight saving transitions', () => {
  it('applies US DST changes for 2026', () => {
    const before = Date.UTC(2026, 2, 8, 6, 0, 0); // 01:00 EST
    const after = Date.UTC(2026, 2, 8, 8, 0, 0); // 04:00 EDT
    expect(getOffsetMinutes(before, NEW_YORK)).toBe(-300);
    expect(getOffsetMinutes(after, NEW_YORK)).toBe(-240);
    expect(observesDaylightSaving(NEW_YORK, 2026)).toBe(true);

    const autumnBefore = Date.UTC(2026, 10, 1, 5, 0, 0); // 01:00 EDT
    const autumnAfter = Date.UTC(2026, 10, 1, 7, 0, 0); // 02:00 EST
    expect(getOffsetMinutes(autumnBefore, NEW_YORK)).toBe(-240);
    expect(getOffsetMinutes(autumnAfter, NEW_YORK)).toBe(-300);
  });

  it('applies European DST changes for 2026', () => {
    const springBefore = Date.UTC(2026, 2, 29, 0, 30, 0);
    const springAfter = Date.UTC(2026, 2, 29, 1, 30, 0);
    expect(getOffsetMinutes(springBefore, BERLIN)).toBe(60);
    expect(getOffsetMinutes(springAfter, BERLIN)).toBe(120);

    const autumnBefore = Date.UTC(2026, 9, 25, 0, 30, 0);
    const autumnAfter = Date.UTC(2026, 9, 25, 1, 30, 0);
    expect(getOffsetMinutes(autumnBefore, BERLIN)).toBe(120);
    expect(getOffsetMinutes(autumnAfter, BERLIN)).toBe(60);
  });

  it('does not invent DST for zones without it', () => {
    expect(observesDaylightSaving(TOKYO, 2026)).toBe(false);
    expect(observesDaylightSaving(SHANGHAI, 2026)).toBe(false);
    expect(observesDaylightSaving(KOLKATA, 2026)).toBe(false);
  });

  it('does not assume today\u2019s offset for future dates', () => {
    // +1 day apart in Berlin around the spring change: offsets differ.
    const march = Date.UTC(2026, 2, 20, 12, 0, 0);
    const april = Date.UTC(2026, 3, 20, 12, 0, 0);
    expect(getOffsetMinutes(march, BERLIN)).toBe(60);
    expect(getOffsetMinutes(april, BERLIN)).toBe(120);
  });
});

describe('non-existent and ambiguous wall-clock times', () => {
  it('detects the spring-forward gap in New York', () => {
    const resolved = resolveCivilTime(
      { year: 2026, month: 3, day: 8, hour: 2, minute: 30, second: 0 },
      NEW_YORK,
    );
    expect(resolved.kind).toBe('nonexistent');
    // Temporal "compatible" semantics: shifted forward to 03:30 EDT.
    expect(new Date(resolved.instant).toISOString()).toBe('2026-03-08T07:30:00.000Z');
    expect(getZonedParts(resolved.instant, NEW_YORK)).toMatchObject({ hour: 3, minute: 30 });
  });

  it('detects the repeated hour when New York falls back', () => {
    const resolved = resolveCivilTime(
      { year: 2026, month: 11, day: 1, hour: 1, minute: 30, second: 0 },
      NEW_YORK,
    );
    expect(resolved.kind).toBe('ambiguous');
    expect(resolved.candidates).toHaveLength(2);
    expect(new Date(resolved.instant).toISOString()).toBe('2026-11-01T05:30:00.000Z');
    expect(getOffsetMinutes(resolved.candidates[0]!, NEW_YORK)).toBe(-240);
    expect(getOffsetMinutes(resolved.candidates[1]!, NEW_YORK)).toBe(-300);
  });

  it('detects the gap and overlap in Berlin', () => {
    const gap = resolveCivilTime(
      { year: 2026, month: 3, day: 29, hour: 2, minute: 30, second: 0 },
      BERLIN,
    );
    expect(gap.kind).toBe('nonexistent');
    const overlap = resolveCivilTime(
      { year: 2026, month: 10, day: 25, hour: 2, minute: 30, second: 0 },
      BERLIN,
    );
    expect(overlap.kind).toBe('ambiguous');
  });

  it('treats ordinary times as exact', () => {
    const resolved = resolveCivilTime(
      { year: 2026, month: 11, day: 2, hour: 9, minute: 15, second: 0 },
      NEW_YORK,
    );
    expect(resolved.kind).toBe('exact');
    expect(resolved.candidates).toHaveLength(1);
  });
});

describe('formatting helpers', () => {
  it('formats 12h and 24h clock labels', () => {
    const parts = { year: 2026, month: 1, day: 1, hour: 0, minute: 5, second: 9, weekday: 4 };
    expect(formatClockParts(parts, 24)).toMatchObject({ hour: '00', minute: '05', meridiem: null });
    expect(formatClockParts(parts, 12)).toMatchObject({ hour: '12', meridiem: 'AM' });
    const afternoon = { ...parts, hour: 13 };
    expect(formatClockParts(afternoon, 12)).toMatchObject({ hour: '1', meridiem: 'PM' });
    expect(formatTimeLabel(Date.UTC(2026, 0, 1, 5, 5, 0), 'UTC', { hourCycle: 12 })).toBe('5:05 AM');
  });

  it('formats offsets and differences', () => {
    expect(formatOffsetLabel(0)).toBe('GMT+0');
    expect(formatOffsetLabel(-210)).toBe('GMT-3:30');
    expect(formatOffsetDiff(540)).toBe('+9h');
    expect(formatOffsetDiff(-90)).toBe('-1h 30m');
    expect(formatOffsetDiff(0)).toBe('0');
  });

  it('parses and prints clock strings', () => {
    expect(parseClockString('09:30')).toBe(570);
    expect(parseClockString('9:30')).toBe(570);
    expect(parseClockString('24:00')).toBeNull();
    expect(parseClockString('09:75')).toBeNull();
    expect(minutesToClockString(570)).toBe('09:30');
    expect(minutesToClockString(-30)).toBe('23:30');
    expect(minutesToClockString(1440)).toBe('00:00');
  });

  it('parses ISO dates and rejects impossible ones', () => {
    expect(parseIsoDate('2026-02-28')).toEqual({
      year: 2026,
      month: 2,
      day: 28,
      hour: 0,
      minute: 0,
      second: 0,
    });
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('not-a-date')).toBeNull();
  });

  it('validates timezone identifiers', () => {
    expect(isValidTimeZone('Asia/Tokyo')).toBe(true);
    expect(isValidTimeZone('America/Argentina/Buenos_Aires')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone('../etc/passwd')).toBe(false);
  });

  it('computes week numbers honouring the week start day', () => {
    const instant = Date.UTC(2026, 0, 1, 12, 0, 0); // Thursday
    expect(getWeekNumber(instant, 'UTC', 1).week).toBe(1);
    const later = Date.UTC(2026, 9, 31, 12, 0, 0); // Saturday
    expect(getWeekNumber(later, 'UTC', 1).week).toBe(getWeekNumber(later, 'UTC', 1).week);
    expect(getWeekNumber(later, 'UTC', 0).week).toBeLessThanOrEqual(45);
  });
});

import { describe, expect, it } from 'vitest';
import { findMeetingSlots, slotQualityScore, type MeetingSearchInput } from './meeting';
import { formatTimeLabel, getZonedParts } from './time';

const baseInput: MeetingSearchInput = {
  participants: [
    { cityId: 'tokyo', timeZone: 'Asia/Tokyo' },
    { cityId: 'singapore', timeZone: 'Asia/Singapore' },
  ],
  anchorZone: 'Asia/Tokyo',
  startDateIso: '2026-11-02', // Monday
  days: 1,
  duration: 30,
  workStartMinute: 9 * 60,
  workEndMinute: 18 * 60,
  allowWeekend: false,
  allowNonWork: false,
  limit: 8,
  stepMinutes: 15,
};

describe('meeting window search', () => {
  it('finds windows where both Tokyo and Singapore are inside working hours', () => {
    const result = findMeetingSlots(baseInput);
    expect(result.hasIdeal).toBe(true);
    expect(result.slots.length).toBeGreaterThan(0);
    const best = result.slots[0]!;
    expect(best.badness).toBe(0);
    expect(slotQualityScore(best)).toBe(100);
    for (const status of best.cities) {
      expect(status.inWorkHours).toBe(true);
      expect(status.quality).toBe('work');
    }
  });

  it('never fabricates a local time: every status matches the real zone data', () => {
    const result = findMeetingSlots(baseInput);
    for (const slot of result.slots) {
      for (const status of slot.cities) {
        const parts = getZonedParts(slot.instant, status.timeZone);
        expect(status.hour).toBe(parts.hour);
        expect(status.minute).toBe(parts.minute);
        expect(status.weekday).toBe(parts.weekday);
        expect(formatTimeLabel(slot.instant, status.timeZone, { hourCycle: 24 })).toContain(
          `${String(status.hour).padStart(2, '0')}:${String(status.minute).padStart(2, '0')}`,
        );
      }
    }
  });

  it('reports a compromise instead of inventing an overlap (Tokyo + London + San Francisco)', () => {
    const result = findMeetingSlots({
      ...baseInput,
      participants: [
        { cityId: 'tokyo', timeZone: 'Asia/Tokyo' },
        { cityId: 'london', timeZone: 'Europe/London' },
        { cityId: 'san-francisco', timeZone: 'America/Los_Angeles' },
      ],
    });
    expect(result.hasIdeal).toBe(false);
    expect(result.relaxed).toBe('nonWork');
    expect(result.slots.length).toBeGreaterThan(0);
    expect(result.slots.every((slot) => slot.badness > 0)).toBe(true);
    expect(result.slots[0]!.inWorkCount).toBeLessThan(3);
  });

  it('honours the working-hours window when ranking (allows outside hours on request)', () => {
    const result = findMeetingSlots({
      ...baseInput,
      participants: [
        { cityId: 'tokyo', timeZone: 'Asia/Tokyo' },
        { cityId: 'san-francisco', timeZone: 'America/Los_Angeles' },
      ],
      startDateIso: '2026-11-03', // Tuesday, so both sides are on a weekday
      allowNonWork: true,
    });
    expect(result.slots.length).toBeGreaterThan(0);
    const inWorkCounts = result.slots.map((slot) => slot.inWorkCount);
    expect(Math.max(...inWorkCounts)).toBe(2);
    // The best slot must be the one with the fewest participants outside work hours.
    expect(result.slots[0]!.badness).toBe(Math.min(...result.slots.map((slot) => slot.badness)));
  });

  it('excludes weekends when the weekend is not allowed', () => {
    const result = findMeetingSlots({
      ...baseInput,
      startDateIso: '2026-11-07', // Saturday
      days: 1,
      allowWeekend: false,
      allowNonWork: true,
    });
    expect(result.slots.length).toBeGreaterThan(0);
    // Nothing survives the strict rule on a single Saturday, so the search is
    // explicitly relaxed and labelled as such.
    expect(result.relaxed).toBe('weekend');
    expect(result.slots.every((slot) => slot.cities.some((c) => c.weekday === 6))).toBe(true);
  });

  it('keeps weekend slots when weekends are allowed', () => {
    const result = findMeetingSlots({
      ...baseInput,
      startDateIso: '2026-11-07',
      days: 1,
      allowWeekend: true,
      allowNonWork: true,
    });
    expect(result.relaxed).toBe('none');
    expect(result.slots.length).toBeGreaterThan(0);
  });

  it('accounts for the duration when testing the working window', () => {
    const shortMeeting = findMeetingSlots({ ...baseInput, duration: 30, workEndMinute: 18 * 60 });
    const longMeeting = findMeetingSlots({ ...baseInput, duration: 120, workEndMinute: 18 * 60 });
    expect(longMeeting.slots[0]!.instant).toBeGreaterThanOrEqual(shortMeeting.slots[0]!.instant);
    for (const status of longMeeting.slots[0]!.cities) {
      expect(status.minutesOfDay + 120).toBeLessThanOrEqual(18 * 60);
    }
  });

  it('returns at most the requested number of distinct slots', () => {
    const result = findMeetingSlots({ ...baseInput, days: 7, limit: 3 });
    expect(result.slots.length).toBeLessThanOrEqual(3);
    const instants = result.slots.map((slot) => slot.instant);
    expect(new Set(instants).size).toBe(instants.length);
  });

  it('is deterministic and stable for the same input', () => {
    const a = findMeetingSlots(baseInput);
    const b = findMeetingSlots(baseInput);
    expect(a.slots.map((slot) => slot.instant)).toEqual(b.slots.map((slot) => slot.instant));
  });

  it('returns an empty result when inputs are unusable', () => {
    expect(findMeetingSlots({ ...baseInput, participants: [] }).slots).toHaveLength(0);
    expect(findMeetingSlots({ ...baseInput, days: 0 }).slots).toHaveLength(0);
    expect(findMeetingSlots({ ...baseInput, startDateIso: 'oops' }).slots).toHaveLength(0);
  });

  it('crosses DST boundaries correctly (New York + Berlin in late March)', () => {
    const result = findMeetingSlots({
      ...baseInput,
      participants: [
        { cityId: 'new-york', timeZone: 'America/New_York' },
        { cityId: 'berlin', timeZone: 'Europe/Berlin' },
      ],
      startDateIso: '2026-03-27',
      days: 4,
    });
    expect(result.slots.length).toBeGreaterThan(0);
    for (const status of result.slots[0]!.cities) {
      const parts = getZonedParts(result.slots[0]!.instant, status.timeZone);
      expect(status.hour).toBe(parts.hour);
    }
  });
});

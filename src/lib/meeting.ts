/**
 * Meeting-window search.
 *
 * All comparisons happen on real instants; local wall-clock times are derived
 * per city through the IANA database. Nothing here assumes a fixed offset.
 */
import { getZonedParts, MS_MINUTE } from './time';

export type SlotQuality = 'work' | 'shoulder' | 'night' | 'weekend';

export type CityStatus = {
  /** City id from the dataset (or a synthetic id for the visitor's own zone). */
  cityId: string;
  timeZone: string;
  /** Epoch ms of the slot start. */
  instant: number;
  hour: number;
  minute: number;
  /** Minutes since local midnight. */
  minutesOfDay: number;
  weekday: number;
  isoDate: string;
  quality: SlotQuality;
  /** True when the whole [start, start+duration) window fits inside working hours. */
  inWorkHours: boolean;
};

export type MeetingSlot = {
  instant: number;
  /** 0 = every participant is inside working hours. */
  badness: number;
  inWorkCount: number;
  cities: CityStatus[];
};

export type MeetingSearchInput = {
  participants: { cityId: string; timeZone: string }[];
  /** Reference (anchor) zone used to interpret the date range. */
  anchorZone: string;
  /** First day of the range, "yyyy-mm-dd" in the anchor zone. */
  startDateIso: string;
  /** Number of days to scan, 1..30. */
  days: number;
  /** Meeting duration in minutes. */
  duration: number;
  workStartMinute: number;
  workEndMinute: number;
  allowWeekend: boolean;
  allowNonWork: boolean;
  /** Maximum number of slots to return. */
  limit?: number;
  /** Step of the candidate grid in minutes (default 15). */
  stepMinutes?: number;
};

export type MeetingSearchResult = {
  slots: MeetingSlot[];
  /** True when at least one slot keeps every participant inside working hours. */
  hasIdeal: boolean;
  /** Number of candidate slots that survived the filters. */
  considered: number;
  /** Set when the filters were relaxed because nothing matched. */
  relaxed: 'none' | 'weekend' | 'nonWork';
};

function qualityFor(
  weekday: number,
  startMinute: number,
  endMinute: number,
  workStart: number,
  workEnd: number,
): { quality: SlotQuality; inWorkHours: boolean } {
  const isWeekend = weekday === 0 || weekday === 6;
  const inWork = startMinute >= workStart && endMinute <= workEnd;
  if (inWork && !isWeekend) return { quality: 'work', inWorkHours: true };
  if (inWork && isWeekend) return { quality: 'weekend', inWorkHours: true };
  if (isWeekend) return { quality: 'weekend', inWorkHours: false };
  // Distance to the working window in minutes.
  const distance = startMinute < workStart ? workStart - startMinute : startMinute - workEnd;
  if (distance <= 120) return { quality: 'shoulder', inWorkHours: false };
  return { quality: 'night', inWorkHours: false };
}

function badnessFor(quality: SlotQuality): number {
  switch (quality) {
    case 'work':
      return 0;
    case 'shoulder':
      return 2;
    case 'weekend':
      return 5;
    case 'night':
      return 8;
    default:
      return 8;
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Scans a candidate grid and returns the best shared meeting windows,
 * best first. Only real instants that exist in every participant's calendar
 * are produced — no slots are invented to make the result look better.
 */
export function findMeetingSlots(input: MeetingSearchInput): MeetingSearchResult {
  const {
    participants,
    anchorZone,
    startDateIso,
    days,
    duration,
    workStartMinute,
    workEndMinute,
    limit = 8,
    stepMinutes = 15,
  } = input;

  const empty: MeetingSearchResult = { slots: [], hasIdeal: false, considered: 0, relaxed: 'none' };
  if (participants.length === 0 || days <= 0 || duration <= 0) return empty;

  const [yearStr, monthStr, dayStr] = startDateIso.split('-');
  const baseYear = Number(yearStr);
  const baseMonth = Number(monthStr);
  const baseDay = Number(dayStr);
  if (!Number.isFinite(baseYear) || !Number.isFinite(baseMonth) || !Number.isFinite(baseDay)) {
    return empty;
  }

  // Start of the first day, 00:00 in the anchor zone.
  const anchorNoon = Date.UTC(baseYear, baseMonth - 1, baseDay, 12, 0, 0);
  const anchorParts = getZonedParts(anchorNoon, anchorZone);
  const anchorOffset = Date.UTC(
    anchorParts.year,
    anchorParts.month - 1,
    anchorParts.day,
    anchorParts.hour,
    anchorParts.minute,
  ) - anchorNoon;
  const rangeStart = Date.UTC(baseYear, baseMonth - 1, baseDay, 0, 0, 0) - anchorOffset;
  const rangeEnd = rangeStart + days * 24 * 60 * MS_MINUTE;

  const evaluate = (instant: number): MeetingSlot => {
    const cities: CityStatus[] = participants.map((participant) => {
      const p = getZonedParts(instant, participant.timeZone);
      const minutesOfDay = p.hour * 60 + p.minute;
      const endMinute = minutesOfDay + duration;
      const { quality, inWorkHours } = qualityFor(
        p.weekday,
        minutesOfDay,
        endMinute,
        workStartMinute,
        workEndMinute,
      );
      return {
        cityId: participant.cityId,
        timeZone: participant.timeZone,
        instant,
        hour: p.hour,
        minute: p.minute,
        minutesOfDay,
        weekday: p.weekday,
        isoDate: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
        quality,
        inWorkHours,
      };
    });
    const badness = cities.reduce((sum, city) => sum + badnessFor(city.quality), 0);
    const inWorkCount = cities.filter((city) => city.inWorkHours).length;
    return { instant, badness, inWorkCount, cities };
  };

  const candidates: MeetingSlot[] = [];
  for (let t = rangeStart; t < rangeEnd; t += stepMinutes * MS_MINUTE) {
    candidates.push(evaluate(t));
  }

  const passWeekend = (slot: MeetingSlot): boolean =>
    input.allowWeekend ||
    slot.cities.every((city) => city.weekday !== 0 && city.weekday !== 6);

  const passNonWork = (slot: MeetingSlot): boolean =>
    input.allowNonWork || slot.cities.every((city) => city.inWorkHours);

  let filtered = candidates.filter((slot) => passWeekend(slot) && passNonWork(slot));
  let relaxed: MeetingSearchResult['relaxed'] = 'none';

  if (filtered.length === 0 && candidates.length > 0) {
    // Nothing satisfies the strict filters: relax one constraint at a time and
    // label the result as a compromise instead of fabricating an ideal window.
    const withoutWorkRule = candidates.filter((slot) => passWeekend(slot));
    if (withoutWorkRule.length > 0) {
      filtered = withoutWorkRule;
      relaxed = 'nonWork';
    } else {
      filtered = candidates;
      relaxed = 'weekend';
    }
  }

  const sorted = [...filtered].sort((a, b) => {
    if (a.badness !== b.badness) return a.badness - b.badness;
    return a.instant - b.instant;
  });

  const slots = pickDistinct(sorted, limit, duration);
  return {
    slots,
    hasIdeal: slots.some((slot) => slot.badness === 0),
    considered: filtered.length,
    relaxed,
  };
}

/** Keeps the best slots but avoids returning eight adjacent 15-minute steps. */
function pickDistinct(sorted: MeetingSlot[], limit: number, duration: number): MeetingSlot[] {
  const picked: MeetingSlot[] = [];
  const minGap = Math.max(duration, 60) * MS_MINUTE;
  for (const slot of sorted) {
    if (picked.length >= limit) break;
    const tooClose = picked.some(
      (existing) => Math.abs(existing.instant - slot.instant) < minGap,
    );
    if (!tooClose) picked.push(slot);
  }
  if (picked.length === 0) return sorted.slice(0, limit);
  return picked;
}

/** Human summary of a slot's quality for the given language. */
export function slotQualityScore(slot: MeetingSlot): number {
  return slot.cities.length === 0 ? 0 : Math.round((slot.inWorkCount / slot.cities.length) * 100);
}

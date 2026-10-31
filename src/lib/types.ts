export type Language = 'zh' | 'en';
export type Theme = 'dark' | 'light';
export type HourCycle = 12 | 24;
export type WeekStart = 0 | 1;

export type Settings = {
  language: Language;
  theme: Theme;
  hourCycle: HourCycle;
  weekStart: WeekStart;
  /** Default meeting duration in minutes. */
  defaultDuration: number;
  /** Working window start, "HH:mm". */
  workStart: string;
  /** Working window end, "HH:mm". */
  workEnd: string;
  /** City id used as the reference / "my city". */
  primaryCityId: string | null;
  /** Show seconds in clocks. */
  showSeconds: boolean;
  /** Meeting finder: allow weekend days. */
  allowWeekend: boolean;
  /** Meeting finder: allow slots outside working hours (as a compromise). */
  allowNonWork: boolean;
};

export type AppState = {
  settings: Settings;
  /** Ordered list of IANA-city ids (see src/data/cities.json). */
  cityIds: string[];
};

export const DEFAULT_SETTINGS: Settings = {
  language: 'zh',
  theme: 'dark',
  hourCycle: 24,
  weekStart: 1,
  defaultDuration: 30,
  workStart: '09:00',
  workEnd: '18:00',
  primaryCityId: null,
  showSeconds: false,
  allowWeekend: false,
  allowNonWork: true,
};

export const MAX_CITIES = 24;

/** Cities offered as one-tap shortcuts in the search panel. */
export const QUICK_CITY_IDS = [
  'tokyo',
  'shanghai',
  'beijing',
  'hong-kong',
  'singapore',
  'seoul',
  'london',
  'paris',
  'berlin',
  'new-york',
  'los-angeles',
  'san-francisco',
  'sydney',
  'dubai',
] as const;

export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

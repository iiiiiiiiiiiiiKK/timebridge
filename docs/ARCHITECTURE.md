# Architecture & internals · 架构与实现细节

A short map of how TimeBridge works, aimed at contributors and anyone auditing the
timezone logic. · 面向贡献者与需要审查时区逻辑的人的简要说明。

---

## 1. Layers · 分层

```
UI (components/)  ──React 19, Tailwind v4, lucide icons
   │
state/store.tsx   ──useReducer + localStorage persistence + derived selectors
   │
lib/              ──pure, dependency-free logic (fully unit-tested)
   ├─ time.ts     IANA engine
   ├─ meeting.ts  meeting-window search
   ├─ share.ts    payload codec
   ├─ storage.ts  schema validation / migration
   ├─ cities.ts   dataset + search index
   ├─ i18n.ts     zh/en dictionary
   └─ clock.ts    single 1s ticker (useSyncExternalStore)
   │
data/cities.json  ──295 cities → 264 IANA zones, zh + en names, country, popular flag
```

Nothing in `lib/` touches the DOM, `window`, or network APIs, which is why the test
suite can assert exact instants for DST edge cases.

---

## 2. The timezone engine (`lib/time.ts`)

### 2.1 Wall-clock parts for an instant

```ts
getZonedParts(instant, 'Europe/Berlin')
// → { year, month, day, hour, minute, second, weekday }
```

Implemented with a cached `Intl.DateTimeFormat(locale, { timeZone, hourCycle: 'h23', … })`
and `formatToParts`. Results are memoised per `(zone, second)` because the comparison
grid asks for the same cells on every tick.

### 2.2 Offset of a zone at an instant

```ts
getOffsetMinutes(instant, zone)  // minutes east of UTC, e.g. Tokyo → 540
```

Computed as `civilPartsAsUtc - instant`. Because it is evaluated **at the requested
instant**, historical and future DST rules are respected — the engine never assumes
“today's offset also applies in April”.

### 2.3 Wall-clock → instant (the interesting part)

`resolveCivilTime(parts, zone)` returns `{ instant, kind, candidates }` where `kind` is:

| kind | meaning | behaviour |
|---|---|---|
| `exact` | normal case, one instant matches | returns it |
| `ambiguous` | clocks fell back: the wall time happens twice | returns the **first** (earlier) occurrence, keeps both candidates |
| `nonexistent` | clocks sprang forward: the wall time never happens | returns the instant shifted forward by the gap (Temporal “compatible” semantics) |

Algorithm:

1. `guess = Date.UTC(civil parts)`.
2. Probe the offsets that a transition could produce: offsets at `guess`,
   `guess - 26h` and `guess + 26h` (26 h also covers the 24 h date-line jumps, e.g.
   Samoa 2011).
3. For each distinct offset `o`, candidate `t = guess - o`; keep `t` only when
   `getZonedParts(t, zone)` round-trips to the requested wall-clock parts.
4. 2 candidates → `ambiguous`; 1 → `exact`; 0 → `nonexistent`.

The round-trip check is what makes gaps and overlaps detectable without a tzdata
table of transitions.

### 2.4 Formatting

All time strings are formatted by us (`formatClockParts`, `formatTimeLabel`) instead of
`Intl` so that 12/24-hour rendering, zero-padding and meridiem placement are identical
in every browser and easy to assert in tests. Dates/weekday names use `Intl` with the
active locale, so Chinese shows 周一/星期五 and English shows Mon/Friday.

---

## 3. Meeting-window search (`lib/meeting.ts`)

1. Convert the date range (interpreted in the anchor timezone) into a UTC interval.
2. Walk it in 15-minute steps. For each candidate instant and each participant compute
   local parts, `minutesOfDay`, weekday and the end of the meeting window
   (`start + duration`).
3. Classify: `work` (fully inside working hours, weekday), `weekend`, `shoulder`
   (≤ 2 h outside working hours) or `night`.
4. Score = sum of per-city penalties (`work 0`, `shoulder 2`, `weekend 5`, `night 8`);
   `inWorkCount` counts participants fully inside working hours.
5. Apply the user's filters (weekend / non-working hours). If nothing survives, relax
   one rule and report the relaxation explicitly (`relaxed: 'nonWork' | 'weekend'`) —
   the UI then labels the result as a compromise instead of an ideal window.
6. Sort by `badness`, then by earliest instant, and keep up to 8 slots that are at
   least one meeting-length (min. 60 min) apart.

Because every slot is derived from a real instant, a slot can never show a local time
that the participant's timezone does not actually have — the test suite asserts this
for every returned slot.

---

## 4. Share links (`lib/share.ts`)

```
payload = { v:1, kind:'moment', title, instant, duration, cities:[{name, zone}] }
url     = <origin><path>#s=<base64url(JSON)>
```

- Lives in the **hash**, so no server or redirect rules are involved and the payload is
  never sent to a host or logged by an edge platform.
- Decoding validates the version, the instant range (1970…2100), clamps the duration
  (5…1440 min), truncates the title (120 chars), caps cities at 12 and rejects invalid
  IANA zones. Anything unexpected is dropped rather than rendered.
- The app watches `hashchange`, shows an import banner and can add the shared cities to
  the local list in one tap.

---

## 5. Persistence (`lib/storage.ts`)

Key: `timebridge:state:v1`

```json
{
  "version": 1,
  "settings": { "language": "zh", "theme": "dark", "hourCycle": 24, "weekStart": 1,
                "defaultDuration": 30, "workStart": "09:00", "workEnd": "18:00",
                "primaryCityId": "shanghai", "showSeconds": false,
                "allowWeekend": false, "allowNonWork": true },
  "cityIds": ["shanghai", "tokyo", "london"],
  "savedAt": "2026-10-31T05:00:00.000Z"
}
```

`loadState()` never throws:

- invalid JSON / non-object → defaults, status `corrupt`
- unknown or duplicated city ids → dropped, status `partial`
- hostile values (`hourCycle: 13`, `workStart: "99:99"`, inverted working window,
  `defaultDuration: 17`) → field-level fallback to defaults
- older shapes (`{ cities: [...], hourCycle: '12' }` or legacy keys
  `timebridge` / `timebridge-state` / `timebridge-v1`) → migrated, status `migrated`
- storage that throws (Safari private mode) → status indicating failure, app still boots

`primaryCityId: null` means “follow the visitor's own timezone” (read from
`Intl.DateTimeFormat().resolvedOptions().timeZone`).

---

## 6. Rendering & performance

- **One ticker.** `lib/clock.ts` owns a single `setInterval(1000)` and notifies
  subscribers; components subscribe with `useNow('second' | 'minute' | 'hour')`, so a
  minutes-only clock re-renders once a minute, not 60 times.
- **Memoised zone reads.** `getZonedParts` caches by `(zone, second)` (capped at 20 000
  entries), which keeps the 24 × N comparison grid cheap.
- **No router, no global CSS resets beyond Tailwind base.** Views are plain state; the
  bundle is ~362 kB raw / ~110 kB gzip (React + icons + app).
- **Mobile.** Single column below `sm`, bottom tab bar with safe-area padding, the
  comparison grid scrolls inside its own container (`.tb-scroll`) with a sticky city
  column, and `npm run audit:ui` fails the build if the page itself ever overflows.

---

## 7. Testing strategy

| Layer | Tool | Focus |
|---|---|---|
| time math | Vitest | conversions, offsets, DST gaps/overlaps, half-hour zones, leap day, cross-year |
| meeting search | Vitest | overlap detection, compromise labelling, weekend rules, duration handling, determinism |
| share codec | Vitest | round-trip, tampering, clamping, hash parsing, text/markdown rendering |
| storage | Vitest | corruption, migration, hostile values, throwing storage |
| dataset | Vitest + `verify-cities.mjs` | unique ids, real IANA zones, required quick-add ids, zh names |
| UI flows | Playwright (desktop + iPhone 13) | add/reorder/persist/remove, search, format/language/theme switches, grid inspection, planner, converter, share round-trip, corrupt storage, mobile overflow |
| layout & a11y | `audit-ui.mjs` | overflow, unlabelled controls, tap-target size, contrast, console errors |

Fixtures always pin the browser timezone (`Asia/Shanghai`) and, where the exact result
matters, an explicit instant (e.g. `2026-11-02 15:00 Asia/Tokyo` → `06:00 Europe/London`).

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Share2 } from 'lucide-react';
import { useApp } from '../state/store';
import { useToast } from './Toast';
import { useNow } from '../lib/clock';
import { cityName, localCityFor, type City } from '../lib/cities';
import {
  MS_MINUTE,
  formatTimeLabel,
  formatZonedDate,
  getZonedParts,
  parseClockString,
  resolveCivilTime,
  addCivilDays,
  toIsoDate,
} from '../lib/time';
import { copyText } from '../lib/clipboard';
import { Badge, Button, IconButton, PageHeader, cx } from './ui';

type Quality = 'work' | 'shoulder' | 'night' | 'weekend';

function qualityClass(quality: Quality): string {
  switch (quality) {
    case 'work':
      return 'tb-cell-work';
    case 'shoulder':
      return 'tb-cell-shoulder';
    case 'weekend':
      return 'tb-cell-weekend';
    default:
      return 'tb-cell-night';
  }
}

function hourLabel(parts: { hour: number; minute: number }, hourCycle: 12 | 24): string {
  if (hourCycle === 24) {
    return parts.minute === 0
      ? String(parts.hour).padStart(2, '0')
      : `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
  }
  const hour12 = parts.hour % 12 === 0 ? 12 : parts.hour % 12;
  const suffix = parts.hour < 12 ? 'a' : 'p';
  return parts.minute === 0 ? `${hour12}${suffix}` : `${hour12}:${String(parts.minute).padStart(2, '0')}`;
}

export function CompareView({ onOpenAddCity }: { onOpenAddCity: () => void }) {
  const { cities, settings, primaryCity, primaryZone, language, locale, t, openShare } = useApp();
  const toast = useToast();
  const now = useNow('minute');
  const [dayOffset, setDayOffset] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const workStart = parseClockString(settings.workStart) ?? 540;
  const workEnd = parseClockString(settings.workEnd) ?? 1080;

  const rows = useMemo(() => {
    const list: City[] = [];
    if (primaryCity) list.push(primaryCity);
    for (const city of cities) {
      if (!list.some((entry) => entry.id === city.id)) list.push(city);
    }
    if (list.length === 0) {
      const zone = primaryZone;
      list.push(localCityFor(zone));
    }
    return list;
  }, [cities, primaryCity, primaryZone]);

  const baseInstant = useMemo(() => {
    const p = getZonedParts(now, primaryZone);
    const shifted = addCivilDays({ year: p.year, month: p.month, day: p.day, hour: 0, minute: 0, second: 0 }, dayOffset);
    return resolveCivilTime(shifted, primaryZone).instant;
  }, [now, primaryZone, dayOffset]);

  const columns = useMemo(
    () => Array.from({ length: 24 }, (_, index) => baseInstant + index * 60 * MS_MINUTE),
    [baseInstant],
  );

  const nowIndex = columns.findIndex((instant) => now >= instant && now < instant + 60 * MS_MINUTE);

  const baseParts = getZonedParts(baseInstant, primaryZone);
  const dateLabel = formatZonedDate(baseInstant, primaryZone, locale, 'medium');
  const isToday = toIsoDate(baseParts) === toIsoDate(getZonedParts(now, primaryZone));

  const selectedInstant = selected ?? null;
  const selectedDetails = selectedInstant
    ? rows.map((city) => ({
        city,
        time: formatTimeLabel(selectedInstant, city.zone, {
          hourCycle: settings.hourCycle,
          withSeconds: false,
        }),
        date: formatZonedDate(selectedInstant, city.zone, locale, 'medium'),
        parts: getZonedParts(selectedInstant, city.zone),
      }))
    : [];

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('compare.title')}
        subtitle={t('compare.subtitle')}
        actions={
          <Button variant="outline" size="sm" onClick={onOpenAddCity}>
            {t('action.addCity')}
          </Button>
        }
      />

      <div className="tb-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2.5">
          <div className="flex items-center gap-1">
            <IconButton label={t('action.prevDay')} onClick={() => setDayOffset((value) => value - 1)}>
              <ChevronLeft size={16} />
            </IconButton>
            <span className="min-w-[8.5rem] text-center text-[12.5px] font-medium text-ink" data-testid="compare-date">
              {dateLabel}
            </span>
            <IconButton label={t('action.nextDay')} onClick={() => setDayOffset((value) => value + 1)}>
              <ChevronRight size={16} />
            </IconButton>
            <Button
              variant={dayOffset === 0 ? 'subtle' : 'ghost'}
              size="sm"
              className="ml-1 hidden sm:inline-flex"
              onClick={() => setDayOffset(0)}
            >
              {t('action.today')}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {isToday ? <Badge tone="accent">{t('compare.now')}</Badge> : null}
            <span className="hidden text-[11px] text-muted sm:inline">{t('compare.referenceHint')}</span>
          </div>
        </div>

        <div className="tb-scroll tb-fade-right" data-testid="compare-scroll">
          <table className="w-full border-collapse text-[12px]" data-testid="compare-table">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 w-[104px] min-w-[104px] border-r border-b border-line bg-panel px-2 py-1.5 text-left text-[11px] font-semibold tracking-wide text-muted uppercase sm:w-[136px] sm:min-w-[136px]">
                  {t('clock.zone')}
                </th>
                {columns.map((instant, index) => {
                  const parts = getZonedParts(instant, primaryZone);
                  const isNow = index === nowIndex;
                  return (
                    <th
                      key={instant}
                      scope="col"
                      className={cx(
                        'w-[44px] min-w-[44px] border-b border-line px-0 py-1 text-center align-bottom font-medium',
                        isNow ? 'bg-accent-soft text-accent' : 'text-muted',
                      )}
                    >
                      <span className="tb-time block text-[11.5px] leading-4">
                        {hourLabel(parts, settings.hourCycle)}
                      </span>
                      {parts.hour === 0 || index === 0 ? (
                        <span className="block text-[10px] leading-3 text-muted/80">
                          {toIsoDate(parts).slice(5)}
                        </span>
                      ) : (
                        <span className="block text-[9.5px] leading-3 opacity-0">·</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((city) => (
                <tr key={city.id} className="group/row">
                  <th
                    scope="row"
                    className={cx(
                      'sticky left-0 z-20 border-r border-b border-line bg-panel px-2 py-1.5 text-left align-middle',
                      'group-hover/row:bg-panel-soft',
                    )}
                  >
                    <span className="flex items-center gap-1">
                      <span className="truncate text-[12px] font-medium text-ink">
                        {cityName(city, language)}
                      </span>
                    </span>
                    <span className="block truncate text-[11px] text-muted">{city.zone}</span>
                  </th>
                  {columns.map((instant, index) => {
                    const parts = getZonedParts(instant, city.zone);
                    const minutesOfDay = parts.hour * 60 + parts.minute;
                    const isWeekend = parts.weekday === 0 || parts.weekday === 6;
                    let quality: Quality = 'night';
                    if (minutesOfDay >= workStart && minutesOfDay < workEnd) {
                      quality = isWeekend ? 'weekend' : 'work';
                    } else if (minutesOfDay >= workStart - 180 && minutesOfDay < workEnd + 180) {
                      quality = isWeekend ? 'weekend' : 'shoulder';
                    } else if (isWeekend) {
                      quality = 'weekend';
                    }
                    const isNow = index === nowIndex;
                    const isSelected = selectedInstant !== null && selectedInstant === instant;
                    return (
                      <td
                        key={instant}
                        className={cx(
                          'cursor-pointer border-b border-line/60 py-1 text-center transition-[box-shadow]',
                          qualityClass(quality),
                          isNow && 'shadow-[inset_1px_0_0_0_var(--tb-accent),inset_-1px_0_0_0_var(--tb-accent)]',
                          isSelected && 'ring-1 ring-inset ring-accent',
                        )}
                        onClick={() => setSelected(instant)}
                        data-testid={`cell-${city.id}-${index}`}
                        title={`${cityName(city, language)} · ${formatTimeLabel(instant, city.zone, {
                          hourCycle: settings.hourCycle,
                        })} · ${formatZonedDate(instant, city.zone, locale, 'medium')}`}
                      >
                        <span className="tb-time block text-[11.5px] leading-4">
                          {hourLabel(parts, settings.hourCycle)}
                        </span>
                        {parts.day !== getZonedParts(instant, primaryZone).day ? (
                          <span className="block text-[10px] leading-3 opacity-70">
                            {String(parts.day).padStart(2, '0')}
                          </span>
                        ) : (
                          <span className="block text-[9px] leading-3 opacity-0">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line px-3 py-2 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm tb-cell-work" /> {t('compare.legend.work')}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm tb-cell-shoulder" /> {t('compare.legend.shoulder')}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm tb-cell-night" /> {t('compare.legend.night')}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm tb-cell-weekend" /> {t('compare.legend.weekend')}
          </span>
          <span className="ml-auto hidden sm:inline">{t('compare.cellHint')}</span>
          <span className="sm:hidden">{t('compare.scrollHint')}</span>
        </div>
      </div>

      {selectedInstant !== null ? (
        <div className="tb-card p-3 sm:p-4" data-testid="compare-detail">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[12.5px] font-semibold text-ink">
              {formatTimeLabel(selectedInstant, primaryZone, { hourCycle: settings.hourCycle })} ·{' '}
              {formatZonedDate(selectedInstant, primaryZone, locale, 'medium')}
            </h3>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const text = selectedDetails
                    .map((row) => `${cityName(row.city, language)}: ${row.date}, ${row.time}`)
                    .join('\n');
                  const ok = await copyText(text);
                  toast.show(ok ? t('toast.copied') : t('toast.copyFailed'), ok ? 'ok' : 'error');
                }}
              >
                <Copy size={13} />
                {t('action.copy')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  openShare({
                    title: t('share.sharedTitle'),
                    instant: selectedInstant,
                    duration: settings.defaultDuration,
                    cityIds: rows.map((city) => city.id),
                  })
                }
              >
                <Share2 size={13} />
                {t('action.share')}
              </Button>
            </div>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {selectedDetails.map((row) => (
              <div
                key={row.city.id}
                className="tb-inset flex items-center justify-between gap-2 px-2.5 py-1.5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-medium text-ink">
                    {cityName(row.city, language)}
                  </span>
                  <span className="block text-[10.5px] text-muted">{row.date}</span>
                </span>
                <span className="tb-time text-[12.5px] font-semibold text-ink">{row.time}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

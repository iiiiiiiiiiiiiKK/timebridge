import { useMemo, useState } from 'react';
import { CalendarClock, Check, Share2, Users } from 'lucide-react';
import { useApp } from '../state/store';
import { useNow } from '../lib/clock';
import { cityName } from '../lib/cities';
import { findMeetingSlots, slotQualityScore, type SlotQuality } from '../lib/meeting';
import {
  formatTimeLabel,
  formatZonedDate,
  getZonedParts,
  isoDateInZone,
  parseClockString,
  toIsoDate,
} from '../lib/time';
import { DURATION_OPTIONS } from '../lib/types';
import { Badge, Button, Field, PageHeader, Segmented, Select, TextInput, cx } from './ui';

function qualityTone(quality: SlotQuality): 'work' | 'shoulder' | 'night' | 'weekend' {
  if (quality === 'work') return 'work';
  if (quality === 'shoulder') return 'shoulder';
  if (quality === 'weekend') return 'weekend';
  return 'night';
}

function qualityLabel(quality: SlotQuality, t: ReturnType<typeof useApp>['t']): string {
  switch (quality) {
    case 'work':
      return t('planner.quality.work');
    case 'shoulder':
      return t('planner.quality.shoulder');
    case 'weekend':
      return t('planner.quality.weekend');
    default:
      return t('planner.quality.night');
  }
}

export function PlannerView({ onOpenAddCity }: { onOpenAddCity: () => void }) {
  const { cities, settings, setSettings, primaryZone, language, locale, t, openShare } = useApp();
  const now = useNow('minute');
  const [nonce, setNonce] = useState(0);
  const [participants, setParticipants] = useState<string[]>(() =>
    cities.slice(0, 8).map((city) => city.id),
  );

  const todayIso = isoDateInZone(now, primaryZone);
  const [startDate, setStartDate] = useState(todayIso);
  const [days, setDays] = useState(5);

  const activeParticipants = participants.filter((id) => cities.some((city) => city.id === id));

  const result = useMemo(() => {
    const list = activeParticipants
      .map((id) => cities.find((city) => city.id === id))
      .filter((city): city is NonNullable<typeof city> => Boolean(city))
      .map((city) => ({ cityId: city.id, timeZone: city.zone }));
    if (list.length < 2) return null;
    return findMeetingSlots({
      participants: list,
      anchorZone: primaryZone,
      startDateIso: startDate,
      days,
      duration: settings.defaultDuration,
      workStartMinute: parseClockString(settings.workStart) ?? 540,
      workEndMinute: parseClockString(settings.workEnd) ?? 1080,
      allowWeekend: settings.allowWeekend,
      allowNonWork: settings.allowNonWork,
      limit: 8,
      stepMinutes: 15,
    });
    // `nonce` re-runs the search when the user presses the button again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeParticipants.join(','),
    cities,
    primaryZone,
    startDate,
    days,
    settings.defaultDuration,
    settings.workStart,
    settings.workEnd,
    settings.allowWeekend,
    settings.allowNonWork,
    nonce,
  ]);

  const toggleParticipant = (id: string) => {
    setParticipants((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  };

  if (cities.length < 2) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('planner.title')} subtitle={t('planner.subtitle')} />
        <div className="tb-card flex flex-col items-start gap-3 p-6">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">
            <Users size={18} />
          </span>
          <p className="text-[13.5px] font-medium text-ink">{t('planner.needCities')}</p>
          <Button variant="primary" size="sm" onClick={onOpenAddCity}>
            {t('action.addCity')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('planner.title')} subtitle={t('planner.subtitle')} />

      <div className="tb-card p-4 sm:p-5">
        <Field label={t('planner.participants')} hint={t('planner.participantsHint')}>
          <div className="flex flex-wrap gap-1.5" data-testid="planner-participants">
            {cities.map((city) => {
              const active = activeParticipants.includes(city.id);
              return (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => toggleParticipant(city.id)}
                  aria-pressed={active}
                  data-testid={`participant-${city.id}`}
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors',
                    active
                      ? 'border-accent/50 bg-accent-soft text-accent'
                      : 'border-line bg-panel-soft text-muted hover:text-ink',
                  )}
                >
                  {active ? <Check size={12} /> : null}
                  {cityName(city, language)}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label={t('planner.startDate')} htmlFor="planner-date">
            <TextInput
              id="planner-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value || todayIso)}
              data-testid="planner-date"
            />
          </Field>
          <Field label={t('planner.days')} htmlFor="planner-days">
            <Select
              id="planner-days"
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              data-testid="planner-days"
            >
              {[1, 2, 3, 5, 7, 10, 14].map((value) => (
                <option key={value} value={value}>
                  {value} {t('settings.dayCount')}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('planner.duration')} htmlFor="planner-duration">
            <Select
              id="planner-duration"
              value={settings.defaultDuration}
              onChange={(event) => setSettings({ defaultDuration: Number(event.target.value) })}
              data-testid="planner-duration"
            >
              {DURATION_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value} {t('common.min')}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={t('planner.workHours')}
            htmlFor="planner-work-start"
            className="col-span-2 sm:col-span-1"
          >
            <div className="flex items-center gap-1.5">
              <TextInput
                id="planner-work-start"
                type="time"
                value={settings.workStart}
                onChange={(event) => setSettings({ workStart: event.target.value })}
                aria-label={t('planner.workHours')}
                className="min-w-0 flex-1"
                data-testid="planner-work-start"
              />
              <span className="text-muted">–</span>
              <TextInput
                type="time"
                value={settings.workEnd}
                onChange={(event) => setSettings({ workEnd: event.target.value })}
                aria-label={t('planner.workHours')}
                className="min-w-0 flex-1"
                data-testid="planner-work-end"
              />
            </div>
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Segmented
            label={t('planner.allowWeekend')}
            value={settings.allowWeekend ? 'on' : 'off'}
            onChange={(value) => setSettings({ allowWeekend: value === 'on' })}
            options={[
              { value: 'off' as const, label: t('planner.allowWeekend') },
              { value: 'on' as const, label: `✓ ${t('planner.allowWeekend')}` },
            ]}
          />
          <Segmented
            label={t('planner.allowNonWork')}
            value={settings.allowNonWork ? 'on' : 'off'}
            onChange={(value) => setSettings({ allowNonWork: value === 'on' })}
            options={[
              { value: 'off' as const, label: t('planner.allowNonWork') },
              { value: 'on' as const, label: `✓ ${t('planner.allowNonWork')}` },
            ]}
          />
          <Button
            variant="primary"
            className="ml-auto"
            onClick={() => setNonce((value) => value + 1)}
            data-testid="planner-run"
          >
            <CalendarClock size={15} />
            {t('action.findTimes')}
          </Button>
        </div>
      </div>

      <div className="space-y-2" data-testid="planner-results">
        {result === null ? (
          <p className="tb-card p-4 text-[13px] text-muted">{t('planner.needCities')}</p>
        ) : result.slots.length === 0 ? (
          <div className="tb-card p-6 text-center">
            <p className="text-[14px] font-semibold text-ink">{t('planner.empty.title')}</p>
            <p className="mt-1 text-[12.5px] leading-5 text-muted">{t('planner.empty.body')}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 px-1">
              {result.hasIdeal ? (
                <Badge tone="work">{t('planner.result.ideal')}</Badge>
              ) : (
                <Badge tone="shoulder">{t('planner.result.compromise')}</Badge>
              )}
              {result.relaxed === 'nonWork' ? (
                <Badge tone="night">{t('planner.result.relaxedNonWork')}</Badge>
              ) : null}
              {result.relaxed === 'weekend' ? (
                <Badge tone="night">{t('planner.result.relaxedWeekend')}</Badge>
              ) : null}
              <span className="text-[11.5px] text-muted">
                {t('planner.result.count', { n: result.considered })}
              </span>
            </div>

            {result.slots.map((slot, index) => {
              const score = slotQualityScore(slot);
              return (
                <div key={slot.instant} className="tb-card p-3.5 sm:p-4" data-testid="meeting-slot">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {index === 0 && slot.badness === 0 ? (
                          <Badge tone="work">{t('planner.best')}</Badge>
                        ) : null}
                        <span className="tb-time text-[20px] leading-none font-semibold text-ink">
                          {formatTimeLabel(slot.instant, primaryZone, {
                            hourCycle: settings.hourCycle,
                          })}
                        </span>
                        <span className="text-[12px] text-muted">
                          {formatZonedDate(slot.instant, primaryZone, locale, 'medium')}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted">
                        {cityName(cities.find((city) => city.zone === primaryZone) ?? cities[0]!, language)} ·{' '}
                        {primaryZone} · {settings.defaultDuration} {t('common.min')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={score === 100 ? 'work' : score >= 60 ? 'shoulder' : 'night'}>
                        {t('planner.score', { n: score })}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          openShare({
                            title: t('share.sharedTitle'),
                            instant: slot.instant,
                            duration: settings.defaultDuration,
                            cityIds: activeParticipants,
                          })
                        }
                        aria-label={t('planner.shareThis')}
                      >
                        <Share2 size={13} />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {slot.cities.map((status) => {
                      const city = cities.find((entry) => entry.id === status.cityId);
                      return (
                        <div
                          key={status.cityId}
                          className="tb-inset flex items-center justify-between gap-2 px-2.5 py-1.5"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[12px] font-medium text-ink">
                              {city ? cityName(city, language) : status.cityId}
                            </span>
                            <span className="block text-[11px] text-muted">
                              {toIsoDate(getZonedParts(slot.instant, status.timeZone))}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            <span className="tb-time text-[12.5px] font-semibold text-ink">
                              {formatTimeLabel(slot.instant, status.timeZone, {
                                hourCycle: settings.hourCycle,
                              })}
                            </span>
                            <Badge tone={qualityTone(status.quality)}>
                              {qualityLabel(status.quality, t)}
                            </Badge>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

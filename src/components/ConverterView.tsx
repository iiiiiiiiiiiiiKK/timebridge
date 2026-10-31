import { useMemo, useState } from 'react';
import { Copy, RotateCcw, Share2 } from 'lucide-react';
import { useApp } from '../state/store';
import { useToast } from './Toast';
import { useNow } from '../lib/clock';
import { cityName, localCityFor } from '../lib/cities';
import {
  formatTimeLabel,
  formatZonedDate,
  getZonedParts,
  isoDateInZone,
  parseClockString,
  resolveCivilTime,
  toIsoDate,
} from '../lib/time';
import { copyText } from '../lib/clipboard';
import { Badge, Button, Field, PageHeader, Select, TextInput } from './ui';

export function ConverterView({ onOpenAddCity }: { onOpenAddCity: () => void }) {
  const { cities, settings, primaryZone, language, locale, t, openShare } = useApp();
  const toast = useToast();
  const now = useNow('minute');

  const defaultSourceId = cities.find((city) => city.id === settings.primaryCityId)?.id ?? cities[0]?.id ?? '';
  const [sourceId, setSourceId] = useState(defaultSourceId);

  const sourceCity = useMemo(() => {
    const explicit = cities.find((city) => city.id === sourceId);
    return explicit ?? cities[0] ?? localCityFor(primaryZone);
  }, [cities, sourceId, primaryZone]);

  const [dateValue, setDateValue] = useState(() => isoDateInZone(now, sourceCity.zone));
  const [timeValue, setTimeValue] = useState(() => {
    const p = getZonedParts(now, sourceCity.zone);
    return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
  });

  const parsed = useMemo(() => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
    const minutes = parseClockString(timeValue);
    if (!match || minutes === null) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const check = new Date(Date.UTC(year, month - 1, day));
    if (check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return null;
    const resolved = resolveCivilTime(
      { year, month, day, hour: Math.floor(minutes / 60), minute: minutes % 60, second: 0 },
      sourceCity.zone,
    );
    return { resolved };
  }, [dateValue, timeValue, sourceCity.zone]);

  const rows = useMemo(() => {
    const list = [...cities];
    if (!list.some((city) => city.zone === primaryZone)) list.unshift(localCityFor(primaryZone));
    return list;
  }, [cities, primaryZone]);

  const instant = parsed?.resolved.instant ?? null;

  const syncFieldsToInstant = (value: number, zone: string) => {
    const parts = getZonedParts(value, zone);
    setDateValue(toIsoDate(parts));
    setTimeValue(`${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`);
  };

  const handleSourceChange = (nextId: string) => {
    const next = cities.find((city) => city.id === nextId);
    if (!next) return;
    // Keep the same real moment when switching the source city.
    if (instant !== null) syncFieldsToInstant(instant, next.zone);
    setSourceId(next.id);
  };

  const copyAll = async () => {
    if (instant === null) return;
    const text = rows
      .map(
        (city) =>
          `${cityName(city, language)}: ${formatZonedDate(instant, city.zone, locale, 'medium')}, ${formatTimeLabel(
            instant,
            city.zone,
            { hourCycle: settings.hourCycle },
          )}`,
      )
      .join('\n');
    const ok = await copyText(text);
    toast.show(ok ? t('toast.copied') : t('toast.copyFailed'), ok ? 'ok' : 'error');
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('converter.title')}
        subtitle={t('converter.subtitle')}
        actions={
          <Button variant="outline" size="sm" onClick={onOpenAddCity}>
            {t('action.addCity')}
          </Button>
        }
      />

      <div className="tb-card p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <Field label={t('converter.source')} htmlFor="converter-source">
            <Select
              id="converter-source"
              value={sourceCity.id}
              onChange={(event) => handleSourceChange(event.target.value)}
              data-testid="converter-source"
            >
              {rows.map((city) => (
                <option key={city.id} value={city.id}>
                  {cityName(city, language)} · {city.zone}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('converter.date')} htmlFor="converter-date">
            <TextInput
              id="converter-date"
              type="date"
              value={dateValue}
              onChange={(event) => setDateValue(event.target.value)}
              data-testid="converter-date"
            />
          </Field>
          <Field label={t('converter.time')} htmlFor="converter-time">
            <TextInput
              id="converter-time"
              type="time"
              value={timeValue}
              onChange={(event) => setTimeValue(event.target.value)}
              data-testid="converter-time"
            />
          </Field>
          <Button
            variant="subtle"
            onClick={() => syncFieldsToInstant(Date.now(), sourceCity.zone)}
            data-testid="converter-now"
          >
            <RotateCcw size={14} />
            {t('converter.now')}
          </Button>
        </div>

        {parsed === null ? (
          <p className="mt-3 text-[12.5px] text-danger" data-testid="converter-invalid">
            {t('converter.invalid')}
          </p>
        ) : (
          <div className="mt-3 space-y-1">
            {parsed.resolved.kind === 'nonexistent' ? (
              <p className="text-[12px] text-shoulder" data-testid="converter-gap">
                {t('converter.gap')}
              </p>
            ) : null}
            {parsed.resolved.kind === 'ambiguous' ? (
              <p className="text-[12px] text-night" data-testid="converter-overlap">
                {t('converter.overlap')}
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="tb-card overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <h2 className="text-[12.5px] font-semibold text-ink">{t('converter.results')}</h2>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={copyAll} disabled={instant === null}>
              <Copy size={13} />
              {t('action.copyAll')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={instant === null}
              onClick={() => {
                if (instant === null) return;
                openShare({
                  title: t('share.sharedTitle'),
                  instant,
                  duration: settings.defaultDuration,
                  cityIds: rows.map((city) => city.id),
                });
              }}
            >
              <Share2 size={13} />
              {t('action.share')}
            </Button>
          </div>
        </div>

        {cities.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-muted">{t('converter.empty')}</p>
        ) : (
          <ul className="divide-y divide-line" data-testid="converter-results">
            {rows.map((city) => {
              const isSource = city.id === sourceCity.id;
              const parts = instant === null ? null : getZonedParts(instant, city.zone);
              const sourceParts = instant === null ? null : getZonedParts(instant, sourceCity.zone);
              const sameDayAsSource =
                parts === null || sourceParts === null ? true : toIsoDate(parts) === toIsoDate(sourceParts);
              return (
                <li
                  key={city.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                  data-testid={`converter-row-${city.id}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium text-ink">
                        {cityName(city, language)}
                      </span>
                      {isSource ? <Badge tone="accent">{t('converter.source')}</Badge> : null}
                      {!sameDayAsSource && parts ? (
                        <Badge tone="shoulder">{`${parts.month}/${parts.day}`}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-[11.5px] text-muted">
                      {city.zone}
                      {instant !== null
                        ? ` · ${formatZonedDate(instant, city.zone, locale, 'medium')}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tb-time text-[15px] font-semibold text-ink">
                      {instant === null
                        ? '—'
                        : formatTimeLabel(instant, city.zone, {
                            hourCycle: settings.hourCycle,
                            withSeconds: false,
                          })}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t('converter.copyLine')}
                      disabled={instant === null}
                      onClick={async () => {
                        if (instant === null) return;
                        const text = `${cityName(city, language)}: ${formatZonedDate(
                          instant,
                          city.zone,
                          locale,
                          'medium',
                        )}, ${formatTimeLabel(instant, city.zone, { hourCycle: settings.hourCycle })}`;
                        const ok = await copyText(text);
                        toast.show(ok ? t('toast.copied') : t('toast.copyFailed'), ok ? 'ok' : 'error');
                      }}
                    >
                      <Copy size={13} />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

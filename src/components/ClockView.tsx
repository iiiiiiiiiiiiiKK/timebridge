import { useState } from 'react';
import { Globe, Plus, Share2, Sparkles } from 'lucide-react';
import { useNow } from '../lib/clock';
import { getCity, cityName } from '../lib/cities';
import {
  formatClockParts,
  formatOffsetLabel,
  formatZonedDate,
  getOffsetMinutes,
  getZonedParts,
} from '../lib/time';
import { QUICK_CITY_IDS } from '../lib/types';
import { useApp } from '../state/store';
import { CityClockCard } from './CityClockCard';
import { Button, SectionTitle, cx } from './ui';

export function ClockView({ onOpenAddCity }: { onOpenAddCity: () => void }) {
  const {
    cities,
    settings,
    t,
    locale,
    language,
    localCity,
    primaryCity,
    setPrimaryCity,
    removeCity,
    reorderCities,
    openShare,
    addCity,
  } = useApp();
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const now = useNow(settings.showSeconds ? 'second' : 'minute');
  const heroParts = getZonedParts(now, localCity.zone);
  const heroClock = formatClockParts(heroParts, settings.hourCycle);
  const heroOffset = getOffsetMinutes(now, localCity.zone);

  const quickCities = QUICK_CITY_IDS.map((id) => getCity(id)).filter(
    (city): city is NonNullable<ReturnType<typeof getCity>> => city !== null && !cities.some((c) => c.id === city.id),
  );

  return (
    <div className="space-y-6">
      <section className="tb-card tb-hero-bg relative overflow-hidden p-5 sm:p-7">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
              {t('header.localTime')}
            </p>
            <div
              className="tb-time mt-2 flex items-baseline font-semibold text-ink"
              style={{ fontSize: 'clamp(2.75rem, 8vw, 4.25rem)', lineHeight: 0.95 }}
              data-testid="hero-local-time"
            >
              {heroClock.hour}:{heroClock.minute}
              {settings.showSeconds ? (
                <span className="text-[0.55em]">:{heroClock.second}</span>
              ) : null}
              {heroClock.meridiem ? (
                <span className="ml-2 text-[0.28em] font-medium tracking-wide text-muted">
                  {heroClock.meridiem}
                </span>
              ) : null}
            </div>
            <p className="mt-2.5 text-[13px] font-medium text-ink-soft">
              {formatZonedDate(now, localCity.zone, locale, 'full')}
            </p>
            <p className="mt-1 text-[11.5px] text-muted" data-testid="hero-zone">
              {cityName(localCity, language)} · {localCity.zone} · {formatOffsetLabel(heroOffset)}
            </p>
            <p className="mt-3 max-w-md text-[13px] leading-6 text-muted">{t('app.tagline')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={onOpenAddCity} data-testid="view-add-city">
              <Plus size={15} />
              {t('action.addCity')}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                openShare({
                  title: t('share.sharedTitle'),
                  instant: now,
                  duration: settings.defaultDuration,
                })
              }
              data-testid="share-now"
            >
              <Share2 size={15} />
              {t('action.share')}
            </Button>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-16 -bottom-20 hidden h-56 w-56 rounded-full border border-line/60 sm:block" />
        <div className="pointer-events-none absolute -right-6 -bottom-28 hidden h-64 w-64 rounded-full border border-line/40 sm:block" />
      </section>

      <section>
        <SectionTitle
          action={
            <span className="text-[12px] text-muted" data-testid="city-count">
              {cities.length === 1
                ? t('header.oneCity')
                : t('header.cities', { n: cities.length })}
            </span>
          }
        >
          {t('clock.title')}
        </SectionTitle>

        {cities.length === 0 ? (
          <div className="tb-card flex flex-col items-start gap-4 p-6 sm:p-8" data-testid="clock-empty">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">
                <Globe size={19} />
              </span>
              <div>
                <h3 className="text-[15px] font-semibold text-ink">{t('clock.empty.title')}</h3>
                <p className="mt-0.5 text-[13px] leading-5 text-muted">{t('clock.empty.body')}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_CITY_IDS.slice(0, 10).map((id) => {
                const city = getCity(id);
                if (!city) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => addCity(id)}
                    className="rounded-full border border-line bg-panel-soft px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-accent/40 hover:text-ink"
                  >
                    <span className="mr-1 text-muted">+</span>
                    {cityName(city, language)}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3" data-testid="city-grid">
            {cities.map((city, index) => (
              <CityClockCard
                key={city.id}
                city={city}
                index={index}
                total={cities.length}
                isPrimary={primaryCity.id === city.id}
                isLocal={localCity.zone === city.zone}
                dragging={dragFrom === index}
                onDragStart={() => setDragFrom(index)}
                onDropOn={() => {
                  if (dragFrom !== null && dragFrom !== index) reorderCities(dragFrom, index);
                  setDragFrom(null);
                }}
                onRemove={() => removeCity(city.id)}
                onSetPrimary={() => setPrimaryCity(city.id)}
                onMove={(direction) => reorderCities(index, index + direction)}
                onShare={() =>
                  openShare({
                    title: `${cityName(city, language)} · ${formatZonedDate(now, city.zone, locale, 'medium')}`,
                    instant: now,
                    duration: settings.defaultDuration,
                    cityIds: [city.id],
                  })
                }
              />
            ))}
          </div>
        )}

        {cities.length > 0 && quickCities.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11.5px] text-muted">
              <Sparkles size={12} />
              {t('search.quick')}
            </span>
            {quickCities.slice(0, 8).map((city) => (
              <button
                key={city.id}
                type="button"
                onClick={() => addCity(city.id)}
                className={cx(
                  'rounded-full border border-line bg-panel-soft px-2.5 py-1 text-[12px] font-medium text-muted transition-colors',
                  'hover:border-accent/40 hover:text-ink',
                )}
              >
                + {cityName(city, language)}
              </button>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

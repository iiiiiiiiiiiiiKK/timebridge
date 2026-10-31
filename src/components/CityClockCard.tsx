import { ArrowDown, ArrowUp, GripVertical, Share2, Star, Trash2 } from 'lucide-react';
import { useNow } from '../lib/clock';
import { cityCountry, cityName, type City } from '../lib/cities';
import {
  dayDelta,
  formatClockParts,
  formatOffsetLabel,
  formatOffsetDiff,
  formatZonedDate,
  getOffsetMinutes,
  getZonedParts,
  getZoneName,
  observesDaylightSaving,
} from '../lib/time';
import { useApp } from '../state/store';
import { Badge, IconButton, cx } from './ui';

function relativeDayLabel(delta: number, t: ReturnType<typeof useApp>['t']): string | null {
  if (delta === 0) return null;
  if (delta === 1) return t('clock.tomorrow');
  if (delta === -1) return t('clock.yesterday');
  if (delta > 1) return t('clock.daysAhead', { n: delta });
  return t('clock.daysBehind', { n: Math.abs(delta) });
}

export function CityClockCard({
  city,
  isPrimary,
  index,
  total,
  onRemove,
  onSetPrimary,
  onMove,
  onShare,
  onDragStart,
  onDropOn,
  dragging,
  isLocal,
}: {
  city: City;
  isPrimary: boolean;
  index: number;
  total: number;
  onRemove: () => void;
  onSetPrimary: () => void;
  onMove: (direction: -1 | 1) => void;
  onShare: () => void;
  onDragStart: () => void;
  onDropOn: () => void;
  dragging: boolean;
  isLocal: boolean;
}) {
  const { settings, primaryZone, language, locale, t } = useApp();
  const now = useNow(settings.showSeconds ? 'second' : 'minute');
  const parts = getZonedParts(now, city.zone);
  const clock = formatClockParts(parts, settings.hourCycle);
  const offset = getOffsetMinutes(now, city.zone);
  const refOffset = getOffsetMinutes(now, primaryZone);
  const diff = offset - refOffset;
  const delta = dayDelta(now, city.zone, primaryZone);
  const dayLabel = relativeDayLabel(delta, t);
  const dst = observesDaylightSaving(city.zone, parts.year);
  const zoneAbbrev = getZoneName(now, city.zone, 'en-US', 'short');

  return (
    <article
      className={cx(
        'tb-card group relative min-w-0 overflow-hidden p-4 transition-colors',
        isPrimary && 'ring-1 ring-accent/40',
        dragging && 'opacity-50',
        'cursor-grab active:cursor-grabbing',
      )}
      data-testid="city-card"
      data-city-id={city.id}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', city.id);
        event.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDropOn();
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-1.5">
          <GripVertical
            size={14}
            className="mt-1 hidden shrink-0 text-muted/50 group-hover:text-muted sm:block"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="truncate text-[15px] leading-5 font-semibold text-ink">
                {cityName(city, language)}
              </h3>
              <span className="truncate text-[12px] text-muted">{cityCountry(city, language)}</span>
              {isPrimary ? <Badge tone="accent">{t('action.isDefault')}</Badge> : null}
              {isLocal ? <Badge tone="work">{t('common.you')}</Badge> : null}
            </div>
            <p className="mt-0.5 truncate text-[11.5px] text-muted" title={city.zone}>
              {city.zone} · {zoneAbbrev} · {formatOffsetLabel(offset)}
              {dst ? ` · ${t('clock.dst')}` : ''}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <IconButton
            label={t('a11y.setPrimary', { city: cityName(city, language) })}
            onClick={onSetPrimary}
            disabled={isPrimary}
            className={isPrimary ? 'text-accent' : undefined}
            data-testid="set-primary"
          >
            <Star size={15} className={isPrimary ? 'fill-current' : undefined} />
          </IconButton>
          <IconButton label={t('action.share')} onClick={onShare}>
            <Share2 size={15} />
          </IconButton>
          <IconButton
            label={t('a11y.removeCity', { city: cityName(city, language) })}
            onClick={onRemove}
            className="hover:text-danger"
            data-testid="remove-city"
          >
            <Trash2 size={15} />
          </IconButton>
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="tb-time flex items-baseline text-[30px] leading-none font-semibold text-ink sm:text-[32px]">
          {clock.hour}:{clock.minute}
          {settings.showSeconds ? <span className="text-[22px]">:{clock.second}</span> : null}
          {clock.meridiem ? (
            <span className="ml-1 text-[11px] font-medium tracking-wide text-muted">
              {clock.meridiem}
            </span>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[12px] font-medium text-ink-soft">
            {formatZonedDate(now, city.zone, locale, 'medium')}
          </div>
          <div className="mt-0.5 flex items-center justify-end gap-1">
            {dayLabel ? <Badge tone={delta > 0 ? 'shoulder' : 'night'}>{dayLabel}</Badge> : null}
            <span className="text-[11px] text-muted">
              {diff === 0 ? t('common.sameTime') : formatOffsetDiff(diff)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1 text-muted">
        <IconButton
          label={t('a11y.moveUp', { city: cityName(city, language) })}
          onClick={() => onMove(-1)}
          disabled={index === 0}
          size="icon-sm"
          data-testid="move-up"
        >
          <ArrowUp size={13} />
        </IconButton>
        <IconButton
          label={t('a11y.moveDown', { city: cityName(city, language) })}
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          size="icon-sm"
          data-testid="move-down"
        >
          <ArrowDown size={13} />
        </IconButton>
        <span className="ml-1 hidden text-[11px] text-muted/70 sm:block">{t('clock.dragHint')}</span>
      </div>
    </article>
  );
}

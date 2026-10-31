import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Link2 } from 'lucide-react';
import { useApp } from '../state/store';
import { useToast } from './Toast';
import { cityName } from '../lib/cities';
import { buildShareText, buildShareUrl, type SharePayload } from '../lib/share';
import { formatTimeLabel, formatZonedDate } from '../lib/time';
import { copyText } from '../lib/clipboard';
import { DURATION_OPTIONS } from '../lib/types';
import { Button, Field, Modal, Select, TextInput, cx } from './ui';

export function ShareDialog() {
  const { shareRequest, closeShare, cities, settings, t, language, locale, primaryZone } = useApp();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(settings.defaultDuration);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const open = shareRequest !== null;

  useEffect(() => {
    if (!shareRequest) return;
    setTitle(shareRequest.title);
    setDuration(shareRequest.duration);
    const initial = shareRequest.cityIds?.filter((id) => cities.some((city) => city.id === id));
    setSelectedIds(initial && initial.length > 0 ? initial : cities.map((city) => city.id));
    // Intentionally keyed on the request only: later edits must survive re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareRequest]);

  const payload: SharePayload | null = useMemo(() => {
    if (!shareRequest) return null;
    const chosen = cities.filter((city) => selectedIds.includes(city.id));
    const list = chosen.length > 0 ? chosen : cities;
    if (list.length === 0) return null;
    return {
      v: 1,
      kind: 'moment',
      title: title.trim() || t('share.sharedTitle'),
      instant: shareRequest.instant,
      duration,
      cities: list.map((city) => ({ name: cityName(city, language), zone: city.zone })),
    };
  }, [shareRequest, cities, selectedIds, title, duration, language, t]);

  const text = useMemo(() => {
    if (!payload) return null;
    return buildShareText(payload, {
      locale,
      hourCycle: settings.hourCycle,
      durationLabel: `${payload.duration} ${t('common.min')}`,
      fallbackTitle: t('share.sharedTitle'),
    });
  }, [payload, locale, settings.hourCycle, t]);

  const link = useMemo(() => {
    if (!payload || typeof window === 'undefined') return '';
    return buildShareUrl(window.location.href.split('#')[0]!, payload);
  }, [payload]);

  const copyWith = async (value: string | null | undefined) => {
    if (!value) return;
    const ok = await copyText(value);
    toast.show(ok ? t('toast.copied') : t('toast.copyFailed'), ok ? 'ok' : 'error');
  };

  const toggleCity = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  };

  return (
    <Modal
      open={open}
      onClose={closeShare}
      title={t('share.title')}
      description={t('share.privacy')}
      width="lg"
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => copyWith(text?.plain)} data-testid="share-copy-text">
            <Copy size={13} />
            {t('share.copyText')}
          </Button>
          <Button variant="subtle" size="sm" onClick={() => copyWith(text?.markdown)} data-testid="share-copy-md">
            <Copy size={13} />
            {t('share.copyMarkdown')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => copyWith(link)} data-testid="share-copy-link">
            <Link2 size={13} />
            {t('share.copyLink')}
          </Button>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={closeShare}>
            {t('action.close')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Field label={t('share.meetingTitle')} htmlFor="share-title">
            <TextInput
              id="share-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t('share.titlePlaceholder')}
              maxLength={120}
              data-testid="share-title"
            />
          </Field>
          <Field label={t('share.duration')} htmlFor="share-duration">
            <Select
              id="share-duration"
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
            >
              {DURATION_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value} {t('common.min')}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {shareRequest ? (
          <div className="tb-inset px-3 py-2 text-[12px] text-ink-soft">
            {formatZonedDate(shareRequest.instant, primaryZone, locale, 'full')} ·{' '}
            <span className="tb-time font-semibold">
              {formatTimeLabel(shareRequest.instant, primaryZone, { hourCycle: settings.hourCycle })}
            </span>
          </div>
        ) : null}

        <Field label={t('share.cities')}>
          <div className="flex flex-wrap gap-1.5" data-testid="share-cities">
            {cities.map((city) => {
              const active = selectedIds.includes(city.id);
              return (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => toggleCity(city.id)}
                  aria-pressed={active}
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors',
                    active
                      ? 'border-accent/50 bg-accent-soft text-accent'
                      : 'border-line bg-panel-soft text-muted hover:text-ink',
                  )}
                >
                  {active ? <Check size={11} /> : null}
                  {cityName(city, language)}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label={t('share.preview')}>
          <pre
            className="tb-inset max-h-40 overflow-auto px-3 py-2 text-[11.5px] leading-5 whitespace-pre-wrap text-ink-soft"
            data-testid="share-preview"
          >
            {text?.plain ?? t('converter.empty')}
          </pre>
        </Field>

        <Field label={t('share.link')} htmlFor="share-link">
          <input
            id="share-link"
            readOnly
            value={link}
            onFocus={(event) => event.currentTarget.select()}
            data-testid="share-link"
            className="h-10 w-full rounded-lg border border-line bg-panel-soft px-3 text-[11.5px] text-muted focus:border-accent focus:outline-none"
          />
        </Field>
      </div>
    </Modal>
  );
}

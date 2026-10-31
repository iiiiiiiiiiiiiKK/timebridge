import { useState } from 'react';
import { Download, ShieldCheck, Trash2 } from 'lucide-react';
import { useApp } from '../state/store';
import { useToast } from './Toast';
import { cityName } from '../lib/cities';
import { serializeState } from '../lib/storage';
import { DURATION_OPTIONS } from '../lib/types';
import { Button, PageHeader, Segmented, Select, TextInput, Toggle } from './ui';

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-line py-3.5 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink">{label}</p>
        {hint ? <p className="mt-0.5 text-[11.5px] leading-5 text-muted">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsView() {
  const { settings, setSettings, cities, state, resetSettings, clearAll, t, language } = useApp();
  const toast = useToast();
  const [confirmClear, setConfirmClear] = useState(false);

  const exportSettings = () => {
    const blob = new Blob([serializeState(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'timebridge-settings.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.show(t('settings.saved'));
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <section className="tb-card px-4 sm:px-5">
        <h2 className="pt-4 pb-1 text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
          {t('settings.appearance')}
        </h2>
        <SettingRow label={t('settings.language')}>
          <Segmented
            label={t('settings.language')}
            value={settings.language}
            onChange={(value) => setSettings({ language: value })}
            options={[
              { value: 'zh' as const, label: '中文' },
              { value: 'en' as const, label: 'English' },
            ]}
          />
        </SettingRow>
        <SettingRow label={t('settings.theme')}>
          <Segmented
            label={t('settings.theme')}
            value={settings.theme}
            onChange={(value) => setSettings({ theme: value })}
            options={[
              { value: 'dark' as const, label: t('settings.theme.dark') },
              { value: 'light' as const, label: t('settings.theme.light') },
            ]}
          />
        </SettingRow>
        <SettingRow label={t('settings.timeFormat')}>
          <Segmented
            label={t('settings.timeFormat')}
            testId="settings-hour-cycle"
            value={settings.hourCycle}
            onChange={(value) => setSettings({ hourCycle: value })}
            options={[
              { value: 24 as const, label: t('settings.hourCycle.24') },
              { value: 12 as const, label: t('settings.hourCycle.12') },
            ]}
          />
        </SettingRow>
        <SettingRow label={t('settings.weekStart')}>
          <Segmented
            label={t('settings.weekStart')}
            value={settings.weekStart}
            onChange={(value) => setSettings({ weekStart: value })}
            options={[
              { value: 1 as const, label: t('settings.weekStart.mon') },
              { value: 0 as const, label: t('settings.weekStart.sun') },
            ]}
          />
        </SettingRow>
        <Toggle
          label={t('settings.showSeconds')}
          description={language === 'zh' ? '在每个时钟上显示秒数' : 'Display seconds on every clock'}
          checked={settings.showSeconds}
          onChange={(value) => setSettings({ showSeconds: value })}
        />
      </section>

      <section className="tb-card px-4 sm:px-5">
        <h2 className="pt-4 pb-1 text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
          {t('settings.scheduling')}
        </h2>
        <SettingRow label={t('settings.defaultDuration')}>
          <Select
            value={settings.defaultDuration}
            onChange={(event) => setSettings({ defaultDuration: Number(event.target.value) })}
            aria-label={t('settings.defaultDuration')}
            className="w-32"
            data-testid="settings-duration"
          >
            {DURATION_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value} {t('common.min')}
              </option>
            ))}
          </Select>
        </SettingRow>
        <SettingRow label={t('settings.workHours')} hint={t('settings.workHoursHint')}>
          <div className="flex items-center gap-2">
            <TextInput
              type="time"
              value={settings.workStart}
              onChange={(event) => setSettings({ workStart: event.target.value })}
              aria-label={`${t('settings.workHours')} start`}
              className="w-[7.5rem]"
              data-testid="settings-work-start"
            />
            <span className="text-muted">–</span>
            <TextInput
              type="time"
              value={settings.workEnd}
              onChange={(event) => setSettings({ workEnd: event.target.value })}
              aria-label={`${t('settings.workHours')} end`}
              className="w-[7.5rem]"
              data-testid="settings-work-end"
            />
          </div>
        </SettingRow>
        <SettingRow label={t('settings.primaryCity')} hint={t('settings.primaryCityHint')}>
          <Select
            value={settings.primaryCityId ?? ''}
            onChange={(event) => setSettings({ primaryCityId: event.target.value || null })}
            aria-label={t('settings.primaryCity')}
            className="w-full sm:w-56"
            data-testid="settings-primary-city"
          >
            <option value="">{t('settings.primaryCityAuto')}</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {cityName(city, language)} · {city.zone}
              </option>
            ))}
          </Select>
        </SettingRow>
        <Toggle
          label={t('planner.allowWeekend')}
          checked={settings.allowWeekend}
          onChange={(value) => setSettings({ allowWeekend: value })}
        />
        <Toggle
          label={t('planner.allowNonWork')}
          checked={settings.allowNonWork}
          onChange={(value) => setSettings({ allowNonWork: value })}
        />
      </section>

      <section className="tb-card p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-work/10 text-work">
            <ShieldCheck size={17} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-ink">{t('settings.data')}</h2>
            <p className="mt-1 text-[12px] leading-5 text-muted">{t('settings.dataBody')}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportSettings}>
            <Download size={14} />
            {t('action.export')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetSettings();
              toast.show(t('settings.resetDone'));
            }}
            data-testid="settings-reset"
          >
            {t('action.reset')}
          </Button>
          {confirmClear ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-danger">{t('settings.clearConfirm')}</span>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  clearAll();
                  setConfirmClear(false);
                  toast.show(t('settings.cleared'));
                }}
                data-testid="settings-clear-confirm"
              >
                {t('action.clearData')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>
                {t('action.cancel')}
              </Button>
            </div>
          ) : (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmClear(true)}
              data-testid="settings-clear"
            >
              <Trash2 size={14} />
              {t('action.clearData')}
            </Button>
          )}
        </div>
      </section>

      <p className="px-1 pb-2 text-[11px] text-muted">
        TimeBridge v1.0 · MIT License ·{' '}
        <a
          className="underline underline-offset-2"
          href="https://x.com/0xkillcoin"
          target="_blank"
          rel="noreferrer"
        >
          @0xkillcoin
        </a>
      </p>
    </div>
  );
}

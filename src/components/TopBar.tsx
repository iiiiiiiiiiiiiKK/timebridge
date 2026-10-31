import { Menu, Plus } from 'lucide-react';
import { useApp } from '../state/store';
import { useNow } from '../lib/clock';
import { formatTimeLabel, getOffsetMinutes, formatOffsetLabel } from '../lib/time';
import { IconButton, PageHeader, Segmented } from './ui';
import { Logo, XLink } from './Sidebar';
import { NAV_ITEMS, type ViewId } from './navigation';

function LocalTimeChip() {
  const { localZone, settings, t, locale } = useApp();
  const now = useNow(settings.showSeconds ? 'second' : 'minute');
  const offset = getOffsetMinutes(now, localZone);
  const zoneLabel = localZone.split('/').pop()?.replace(/_/g, ' ');
  return (
    <div className="hidden items-center gap-2 md:flex" data-testid="header-local-time">
      <div className="tb-inset flex items-center gap-2 px-2.5 py-1.5">
        <span className="text-[11px] font-medium tracking-wide text-muted uppercase">
          {t('header.localTime')}
        </span>
        <span className="tb-time text-[13px] font-semibold text-ink">
          {formatTimeLabel(now, localZone, {
            hourCycle: settings.hourCycle,
            withSeconds: settings.showSeconds,
          })}
        </span>
        <span className="text-[11px] text-muted" title={localZone} aria-label={localZone}>
          {zoneLabel} · {formatOffsetLabel(offset)}
        </span>
      </div>
      <span className="sr-only" aria-live="off">
        {locale}
      </span>
    </div>
  );
}

export function TopBar({
  view,
  onOpenMenu,
  onOpenAddCity,
}: {
  view: ViewId;
  onOpenMenu: () => void;
  onOpenAddCity: () => void;
}) {
  const { t, settings, setSettings } = useApp();
  const item = NAV_ITEMS.find((entry) => entry.id === view) ?? NAV_ITEMS[0]!;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center gap-2 px-3 sm:px-5 lg:px-8">
        <IconButton
          label={t('nav.openMenu')}
          onClick={onOpenMenu}
          className="lg:hidden"
          data-testid="open-menu"
        >
          <Menu size={18} />
        </IconButton>
        <div className="lg:hidden">
          <Logo compact />
        </div>

        <div className="hidden min-w-0 items-baseline gap-2 lg:flex">
          <span className="text-[13px] font-semibold text-ink">{t(item.labelKey)}</span>
          <span className="truncate text-[12px] text-muted">TimeBridge</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <LocalTimeChip />
          <Segmented
            label={t('settings.timeFormat')}
            className="hidden sm:inline-flex"
            value={settings.hourCycle}
            onChange={(hourCycle) => setSettings({ hourCycle })}
            options={[
              { value: 24 as const, label: '24h' },
              { value: 12 as const, label: '12h' },
            ]}
          />
          <XLink />
          <button
            type="button"
            onClick={onOpenAddCity}
            data-testid="header-add-city"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-2.5 text-[13px] font-medium text-accent-ink transition-opacity hover:opacity-90"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">{t('action.addCity')}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export function MobileTabBar({ view, onNavigate }: { view: ViewId; onNavigate: (view: ViewId) => void }) {
  const { t } = useApp();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      aria-label={t('nav.workspace')}
    >
      <div className="mx-auto flex max-w-lg items-stretch">
        {NAV_ITEMS.map((item) => {
          const active = item.id === view;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={active ? 'page' : undefined}
              data-testid={`tab-${item.id}`}
              className={
                'flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors ' +
                (active ? 'text-accent' : 'text-muted')
              }
            >
              <Icon size={19} strokeWidth={active ? 2.2 : 1.9} />
              <span className="max-w-full truncate">{t(item.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export { PageHeader };

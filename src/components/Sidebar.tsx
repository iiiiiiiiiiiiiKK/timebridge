import { useApp } from '../state/store';
import { cx } from './ui';
import { AUTHOR_HANDLE, AUTHOR_URL, NAV_ITEMS, type ViewId } from './navigation';
import { Check, Moon, Sun } from 'lucide-react';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink shadow-sm">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="7.2" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
          <path
            d="M4.8 14.4c2.6-2.9 5.2-4.3 7.2-4.3s4.6 1.4 7.2 4.3"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="12" cy="8.1" r="1.7" fill="currentColor" />
        </svg>
      </span>
      {compact ? null : (
        <span className="min-w-0">
          <span className="block text-[15px] leading-tight font-semibold tracking-tight text-ink">
            TimeBridge
          </span>
          <span className="block text-[11px] leading-tight text-muted">Timezone workspace</span>
        </span>
      )}
    </div>
  );
}

export function XLink({ className, showHandle = false }: { className?: string; showHandle?: boolean }) {
  const { t } = useApp();
  return (
    <a
      href={AUTHOR_URL}
      target="_blank"
      rel="noreferrer noopener"
      title={t('app.follow')}
      aria-label={t('app.follow')}
      data-testid="author-x-link"
      className={cx(
        'group inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel-soft px-2 py-1.5 text-ink transition-colors hover:border-line-strong hover:bg-elevated',
        className,
      )}
    >
      <span aria-hidden="true" className="text-[15px] leading-none font-semibold">
        𝕏
      </span>
      {showHandle ? (
        <span className="text-[12px] leading-none text-muted transition-colors group-hover:text-ink">
          {AUTHOR_HANDLE}
        </span>
      ) : null}
    </a>
  );
}

export function SidebarNav({
  view,
  onNavigate,
  onNavigated,
}: {
  view: ViewId;
  onNavigate: (view: ViewId) => void;
  onNavigated?: () => void;
}) {
  const { t } = useApp();
  return (
    <nav className="flex flex-col gap-1" aria-label={t('nav.workspace')}>
      {NAV_ITEMS.map((item) => {
        const active = item.id === view;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onNavigate(item.id);
              onNavigated?.();
            }}
            aria-current={active ? 'page' : undefined}
            data-testid={`nav-${item.id}`}
            className={cx(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-medium transition-colors',
              active
                ? 'bg-elevated text-ink shadow-[inset_0_0_0_1px_var(--tb-line)]'
                : 'text-muted hover:bg-elevated/60 hover:text-ink',
            )}
          >
            <Icon size={16} strokeWidth={1.9} className={active ? 'text-accent' : undefined} />
            <span className="truncate">{t(item.labelKey)}</span>
            {active ? <Check size={13} className="ml-auto text-accent" /> : null}
          </button>
        );
      })}
    </nav>
  );
}

export function SidebarFooter() {
  const { settings, setSettings, t } = useApp();
  const isDark = settings.theme === 'dark';
  return (
    <div className="mt-auto flex flex-col gap-2 border-t border-line pt-3">
      <XLink showHandle className="w-full justify-start" />
      <button
        type="button"
        onClick={() => setSettings({ theme: isDark ? 'light' : 'dark' })}
        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-elevated/60 hover:text-ink"
        data-testid="theme-toggle"
      >
        {isDark ? <Moon size={15} /> : <Sun size={15} />}
        {isDark ? t('settings.theme.dark') : t('settings.theme.light')}
      </button>
      <p className="px-2.5 text-[11px] leading-4 text-muted/80">
        {t('app.author')} · {AUTHOR_HANDLE}
      </p>
    </div>
  );
}

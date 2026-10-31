import { useEffect, useMemo, useState } from 'react';
import { Share2, X } from 'lucide-react';
import { AppProvider, useApp } from './state/store';
import { ToastProvider, useToast } from './components/Toast';
import { ClockView } from './components/ClockView';
import { CompareView } from './components/CompareView';
import { PlannerView } from './components/PlannerView';
import { ConverterView } from './components/ConverterView';
import { SettingsView } from './components/SettingsView';
import { ShareDialog } from './components/ShareDialog';
import { CitySearchDialog } from './components/CitySearchDialog';
import { MobileTabBar, TopBar } from './components/TopBar';
import { Logo, SidebarFooter, SidebarNav } from './components/Sidebar';
import type { ViewId } from './components/navigation';
import { findCityByZone } from './lib/cities';
import { decodeSharePayload, readShareFromHash, type SharePayload } from './lib/share';
import { Button, IconButton } from './components/ui';

function SharedBanner({
  payload,
  onDismiss,
}: {
  payload: SharePayload;
  onDismiss: () => void;
}) {
  const { t, importZones, language } = useApp();
  const toast = useToast();
  const importable = useMemo(() => {
    const entries = payload.cities
      .map((city) => {
        const match = findCityByZone(city.zone);
        return match ? { id: match.id, zone: match.zone } : null;
      })
      .filter((entry): entry is { id: string; zone: string } => entry !== null);
    return entries;
  }, [payload]);

  return (
    <div className="border-b border-accent/25 bg-accent-soft" data-testid="shared-banner">
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center gap-2 px-3 py-2 sm:px-5 lg:px-8">
        <Share2 size={14} className="text-accent" />
        <span className="text-[12.5px] font-medium text-ink">
          {payload.title}
        </span>
        <span className="text-[11.5px] text-muted">
          {payload.cities.map((city) => city.name).join(' · ')} ·{' '}
          {language === 'zh' ? `时长 ${payload.duration} 分钟` : `${payload.duration} min`}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {importable.length > 0 ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                importZones(importable);
                toast.show(t('action.addToMyCities'));
                onDismiss();
              }}
              data-testid="shared-import"
            >
              {t('action.addToMyCities')}
            </Button>
          ) : null}
          <IconButton label={t('action.close')} onClick={onDismiss}>
            <X size={14} />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

function Shell() {
  const { t } = useApp();
  const [view, setView] = useState<ViewId>('clock');
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shared, setShared] = useState<SharePayload | null>(null);

  useEffect(() => {
    const readHash = () => {
      const encoded = readShareFromHash(window.location.hash);
      if (!encoded) {
        setShared(null);
        return;
      }
      const result = decodeSharePayload(encoded);
      setShared(result.ok ? result.payload : null);
    };
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [view]);

  const dismissShare = () => {
    setShared(null);
    if (window.location.hash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  };

  const openAddCity = () => setSearchOpen(true);

  return (
    <div className="min-h-dvh bg-bg">
      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-panel/60 px-3 py-4 lg:flex">
          <div className="px-1.5 pb-4">
            <Logo />
          </div>
          <SidebarNav view={view} onNavigate={setView} />
          <SidebarFooter />
        </aside>

        <div className="min-w-0">
          <TopBar view={view} onOpenMenu={() => setMenuOpen(true)} onOpenAddCity={openAddCity} />
          {shared ? <SharedBanner payload={shared} onDismiss={dismissShare} /> : null}

          <main className="mx-auto w-full max-w-[1280px] px-3 pt-4 pb-24 sm:px-5 sm:pt-6 lg:px-8 lg:pt-8 lg:pb-12">
            {view === 'clock' ? <ClockView onOpenAddCity={openAddCity} /> : null}
            {view === 'compare' ? <CompareView onOpenAddCity={openAddCity} /> : null}
            {view === 'planner' ? <PlannerView onOpenAddCity={openAddCity} /> : null}
            {view === 'converter' ? <ConverterView onOpenAddCity={openAddCity} /> : null}
            {view === 'settings' ? <SettingsView /> : null}

            <footer className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-4 text-[11px] text-muted">
              <span>TimeBridge · MIT</span>
              <span className="hidden sm:inline">{t('app.tagline')}</span>
              <a
                className="ml-auto underline underline-offset-2 hover:text-ink"
                href="https://x.com/0xkillcoin"
                target="_blank"
                rel="noreferrer noopener"
              >
                𝕏 @0xkillcoin
              </a>
            </footer>
          </main>
        </div>
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex w-[78%] max-w-[300px] flex-col border-r border-line bg-panel px-3 py-4">
            <div className="mb-4 flex items-center justify-between px-1">
              <Logo />
              <IconButton label={t('nav.closeMenu')} onClick={() => setMenuOpen(false)}>
                <X size={16} />
              </IconButton>
            </div>
            <SidebarNav view={view} onNavigate={setView} onNavigated={() => setMenuOpen(false)} />
            <SidebarFooter />
          </div>
        </div>
      ) : null}

      <MobileTabBar view={view} onNavigate={setView} />
      <CitySearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ShareDialog />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </ToastProvider>
  );
}

import { useMemo, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import { useApp } from '../state/store';
import { useToast } from './Toast';
import { cityName, cityCountry, searchCities, type City } from '../lib/cities';
import { MAX_CITIES } from '../lib/types';
import { Badge, Button, Modal, cx } from './ui';

export function CitySearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, language, addCity, cities } = useApp();
  const toast = useToast();
  const [query, setQuery] = useState('');

  const results = useMemo(() => searchCities(query, { limit: 60 }), [query]);
  const atLimit = cities.length >= MAX_CITIES;

  const handleAdd = (city: City) => {
    const result = addCity(city.id);
    const name = cityName(city, language);
    if (result === 'added') toast.show(t('toast.cityAdded', { city: name }));
    else if (result === 'duplicate') toast.show(t('toast.duplicate', { city: name }));
    else if (result === 'limit') toast.show(t('toast.cityLimit', { n: MAX_CITIES }), 'error');
    else toast.show(t('search.empty', { q: name }), 'error');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('search.title')}
      description={t('search.hint')}
      width="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11.5px] text-muted">
            {t('header.cities', { n: cities.length })} / {MAX_CITIES}
          </span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('action.close')}
          </Button>
        </div>
      }
    >
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && results[0] && !atLimit) handleAdd(results[0]);
          }}
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
          data-testid="city-search-input"
          className="h-11 w-full rounded-lg border border-line bg-panel pr-3 pl-9 text-sm text-ink placeholder:text-muted/70 hover:border-line-strong focus:border-accent focus:outline-none"
        />
      </div>

      <div className="mt-3">
        <p className="mb-2 text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
          {query.trim() ? t('search.results') : t('search.quick')}
        </p>
        {results.length === 0 ? (
          <div className="tb-inset px-4 py-6 text-center">
            <p className="text-sm font-medium text-ink">{t('search.empty', { q: query.trim() })}</p>
            <p className="mt-1 text-[12px] text-muted">{t('search.emptyHint')}</p>
          </div>
        ) : (
          <ul className="max-h-[46vh] space-y-1 overflow-y-auto pr-0.5" data-testid="city-search-results">
            {results.map((city) => {
              const added = cities.some((entry) => entry.id === city.id);
              return (
                <li key={city.id}>
                  <button
                    type="button"
                    onClick={() => handleAdd(city)}
                    disabled={added || atLimit}
                    data-testid={`city-result-${city.id}`}
                    className={cx(
                      'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                      added ? 'opacity-60' : 'hover:bg-elevated',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-[13.5px] font-medium text-ink">
                          {cityName(city, language)}
                        </span>
                        <span className="truncate text-[11.5px] text-muted">
                          {cityCountry(city, language)}
                        </span>
                        {city.popular ? <Badge tone="accent">{t('search.quick')}</Badge> : null}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted">{city.zone}</span>
                    </span>
                    <span
                      className={cx(
                        'grid h-7 w-7 shrink-0 place-items-center rounded-md border',
                        added
                          ? 'border-work/40 bg-work/10 text-work'
                          : 'border-line bg-panel-soft text-muted',
                      )}
                    >
                      {added ? <Check size={14} /> : <Plus size={14} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}

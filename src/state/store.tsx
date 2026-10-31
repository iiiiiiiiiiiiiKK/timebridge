import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';
import { CITY_BY_ID, getCity, getLocalTimeZone, isKnownCity, localCityFor, type City } from '../lib/cities';
import { createDefaultState, clearState, readState, writeState } from '../lib/storage';
import { DEFAULT_SETTINGS, MAX_CITIES, type AppState, type Settings } from '../lib/types';
import { createTranslator, localeFor, type Translate } from '../lib/i18n';

export type AddCityResult = 'added' | 'duplicate' | 'limit' | 'unknown';

export type ShareRequest = {
  title: string;
  instant: number;
  duration: number;
  /** City ids to pre-select; defaults to every tracked city. */
  cityIds?: string[];
};

type Action =
  | { type: 'set-settings'; patch: Partial<Settings> }
  | { type: 'add-city'; id: string }
  | { type: 'remove-city'; id: string }
  | { type: 'reorder'; from: number; to: number }
  | { type: 'reset-settings' }
  | { type: 'clear-all' }
  | { type: 'import-share'; zoneCities: { id: string; zone: string }[] };

function withPrimaryFallback(state: AppState): AppState {
  const { primaryCityId } = state.settings;
  // `null` means "follow the visitor's local timezone" and must stay null.
  if (primaryCityId === null) return state;
  if (state.cityIds.includes(primaryCityId)) return state;
  const nextPrimary = state.cityIds[0] ?? null;
  return { ...state, settings: { ...state.settings, primaryCityId: nextPrimary } };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'set-settings':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'add-city': {
      if (state.cityIds.includes(action.id) || state.cityIds.length >= MAX_CITIES) return state;
      return withPrimaryFallback({
        ...state,
        cityIds: [...state.cityIds, action.id],
      });
    }
    case 'remove-city': {
      if (!state.cityIds.includes(action.id)) return state;
      return withPrimaryFallback({
        ...state,
        cityIds: state.cityIds.filter((id) => id !== action.id),
      });
    }
    case 'reorder': {
      const { from, to } = action;
      if (from === to || from < 0 || to < 0 || from >= state.cityIds.length || to >= state.cityIds.length) {
        return state;
      }
      const next = [...state.cityIds];
      const [moved] = next.splice(from, 1);
      if (!moved) return state;
      next.splice(to, 0, moved);
      return { ...state, cityIds: next };
    }
    case 'reset-settings':
      return { ...state, settings: { ...DEFAULT_SETTINGS, primaryCityId: null } };
    case 'clear-all':
      return createDefaultState();
    case 'import-share': {
      const extra: string[] = [];
      for (const entry of action.zoneCities) {
        if (CITY_BY_ID.has(entry.id) && !state.cityIds.includes(entry.id) && !extra.includes(entry.id)) {
          extra.push(entry.id);
        }
      }
      if (extra.length === 0) return state;
      const merged = [...state.cityIds, ...extra].slice(0, MAX_CITIES);
      return withPrimaryFallback({ ...state, cityIds: merged });
    }
    default:
      return state;
  }
}

type AppContextValue = {
  state: AppState;
  settings: Settings;
  cities: City[];
  /** Resolved city list plus the visitor's own timezone (if it is not tracked). */
  localZone: string;
  localCity: City;
  primaryCity: City;
  primaryZone: string;
  t: Translate;
  language: Settings['language'];
  locale: string;
  addCity: (id: string) => AddCityResult;
  removeCity: (id: string) => void;
  reorderCities: (from: number, to: number) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setPrimaryCity: (id: string | null) => void;
  resetSettings: () => void;
  clearAll: () => void;
  importZones: (cities: { id: string; zone: string }[]) => void;
  shareRequest: ShareRequest | null;
  openShare: (request: ShareRequest) => void;
  closeShare: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const storage = getStorage();
    return readState(storage, isKnownCity).state;
  });
  const [shareRequest, setShareRequest] = useState<ShareRequest | null>(null);

  const storage = useMemo(getStorage, []);

  useEffect(() => {
    writeState(storage, state);
  }, [state, storage]);

  const settings = state.settings;
  const language = settings.language;
  const locale = localeFor(language);
  const t = useMemo(() => createTranslator(language), [language]);

  const localZone = useMemo(() => getLocalTimeZone(), []);
  const localCity = useMemo(() => localCityFor(localZone), [localZone]);

  const cities = useMemo(
    () => state.cityIds.map((id) => CITY_BY_ID.get(id)).filter((city): city is City => Boolean(city)),
    [state.cityIds],
  );

  const primaryCity = useMemo(() => {
    const explicit = getCity(settings.primaryCityId);
    return explicit ?? localCity;
  }, [settings.primaryCityId, localCity]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', settings.theme === 'dark');
    root.lang = language === 'zh' ? 'zh-CN' : 'en';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', settings.theme === 'dark' ? '#08090c' : '#f5f6f8');
  }, [settings.theme, language]);

  const addCity = useCallback(
    (id: string): AddCityResult => {
      if (!isKnownCity(id)) return 'unknown';
      if (state.cityIds.includes(id)) return 'duplicate';
      if (state.cityIds.length >= MAX_CITIES) return 'limit';
      dispatch({ type: 'add-city', id });
      return 'added';
    },
    [state.cityIds],
  );

  const removeCity = useCallback((id: string) => dispatch({ type: 'remove-city', id }), []);
  const reorderCities = useCallback(
    (from: number, to: number) => dispatch({ type: 'reorder', from, to }),
    [],
  );
  const setSettings = useCallback(
    (patch: Partial<Settings>) => dispatch({ type: 'set-settings', patch }),
    [],
  );
  const setPrimaryCity = useCallback(
    (id: string | null) => dispatch({ type: 'set-settings', patch: { primaryCityId: id } }),
    [],
  );
  const resetSettings = useCallback(() => dispatch({ type: 'reset-settings' }), []);
  const clearAll = useCallback(() => {
    clearState(storage);
    dispatch({ type: 'clear-all' });
  }, [storage]);
  const importZones = useCallback(
    (entries: { id: string; zone: string }[]) => dispatch({ type: 'import-share', zoneCities: entries }),
    [],
  );

  const openShare = useCallback((request: ShareRequest) => setShareRequest(request), []);
  const closeShare = useCallback(() => setShareRequest(null), []);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      settings,
      cities,
      localZone,
      localCity,
      primaryCity,
      primaryZone: primaryCity.zone,
      t,
      language,
      locale,
      addCity,
      removeCity,
      reorderCities,
      setSettings,
      setPrimaryCity,
      resetSettings,
      clearAll,
      importZones,
      shareRequest,
      openShare,
      closeShare,
    }),
    [
      state,
      settings,
      cities,
      localZone,
      localCity,
      primaryCity,
      t,
      language,
      locale,
      addCity,
      removeCity,
      reorderCities,
      setSettings,
      setPrimaryCity,
      resetSettings,
      clearAll,
      importZones,
      shareRequest,
      openShare,
      closeShare,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside <AppProvider>');
  return value;
}

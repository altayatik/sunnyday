import { AlertCircle, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header } from '../components/Header';
import { HeroSummary } from '../components/HeroSummary';
import { TodayBento } from '../components/bento/TodayBento';
import { RadarPanel } from '../components/RadarPanel';
import { DailyOutlook } from '../components/DailyOutlook';
import { AtmosphereCanvas } from '../components/AtmosphereCanvas';
import { fetchSunnyForecast } from '../lib/api/openMeteo';
import { fetchRainViewer } from '../lib/api/rainViewer';
import { fetchNwsAlerts } from '../lib/api/nws';
import { fetchModelForecasts } from '../lib/api/modelForecasts';
import { fetchAirQuality } from '../lib/api/airQuality';
import { reverseGeocodeFallback } from '../lib/api/geocoding';
import { readStorage, writeStorage } from '../lib/cache';
import type { LocationResult, SourceState, SunnyDaySources, SunnyDaySummary } from '../types/weather';
import { addDaysToDateKey, dateKeyInTimeZone } from '../lib/date';
import { applyAirQuality, applyNwsAlerts } from '../lib/weather/normalizeOpenMeteo';
import { applyModelConsensus } from '../lib/weather/forecastConsensus';
import { scenePrefersDark } from '../lib/weather/weatherScene';

const LAST_LOCATION_KEY = 'sunnyday:last-location';

const defaultLocation: LocationResult = {
  name: 'Chicago',
  admin1: 'Illinois',
  country: 'United States',
  latitude: 41.85003,
  longitude: -87.65005,
  timezone: 'America/Chicago',
};

const loadingSources: SunnyDaySources = {
  openMeteo: 'loading',
  models: 'loading',
  rainViewer: 'loading',
  nws: 'loading',
  airQuality: 'loading',
};

/**
 * Details is no longer a page. Every chart on Today opens its own detail
 * sheet, so the numbers live next to the visual that raised the question
 * instead of on a tab you had to know to visit.
 */
type AppPage = 'today' | 'radar' | 'outlook';

const pages: Array<{ id: AppPage; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'radar', label: 'Radar' },
  { id: 'outlook', label: 'Outlook' },
];

function App() {
  const [summary, setSummary] = useState<SunnyDaySummary | null>(null);
  const [sources, setSources] = useState<SunnyDaySources>(loadingSources);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocating, setIsLocating] = useState(false);
  const [activePage, setActivePage] = useState<AppPage>('today');
  const [selectedDate, setSelectedDate] = useState(() => dateKeyInTimeZone());
  const [activeLocation, setActiveLocation] = useState<LocationResult | null>(null);
  /**
   * True until the model consensus lands.
   *
   * The score used to be painted from the primary run and then rewritten as
   * consensus, air quality, and alerts arrived - so the headline number
   * visibly changed three or four times within a couple of seconds. That is
   * precisely the "this app is guessing" feeling we are trying to avoid, so
   * the score is withheld until the models have been compared and then
   * revealed once, counting up to its settled value.
   */
  const [isSettling, setIsSettling] = useState(true);
  const hasLoadedInitialLocation = useRef(false);

  /**
   * Every load gets a monotonically increasing token, and only the newest
   * token is allowed to write to state.
   *
   * Without this, the slower background fetches (seven model runs, radar,
   * alerts, air quality) could resolve after the person had already switched
   * city or date, and apply a consensus score, an alert, or an AQI reading
   * from the previous place onto the new forecast. That is the worst class of
   * bug this app can have: silent, and it produces a number that looks
   * authoritative while being simply wrong.
   */
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;

  const activeSources = useMemo(() => summary?.sources ?? sources, [summary?.sources, sources]);
  const minDate = useMemo(() => dateKeyInTimeZone(), []);
  const maxDate = useMemo(() => addDaysToDateKey(minDate, 6), [minDate]);
  const scene = summary?.scene ?? 'clear-day';

  const loadLocation = useCallback(async (location: LocationResult, date?: string) => {
    const targetDate = date ?? selectedDateRef.current;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const isCurrent = () => requestIdRef.current === requestId;

    setIsLoading(true);
    setIsSettling(true);
    setError(null);
    setSources(loadingSources);
    setActiveLocation(location);

    // Failsafe: if the model comparison stalls, reveal the primary-run score
    // rather than leaving the ring blank indefinitely.
    const settleTimer = setTimeout(() => {
      if (isCurrent()) setIsSettling(false);
    }, 4000);

    /** Applies a patch only if this request is still the active one. */
    const patchSummary = (
      key: keyof SunnyDaySources,
      state: SourceState,
      transform?: (current: SunnyDaySummary) => SunnyDaySummary,
    ) => {
      if (!isCurrent()) return;
      setSources((current) => ({ ...current, [key]: state }));
      setSummary((current) => {
        if (!current || !isCurrent()) return current;
        const next = transform ? transform(current) : current;
        return { ...next, sources: { ...next.sources, [key]: state } };
      });
    };

    try {
      const forecast = await fetchSunnyForecast(location, targetDate, controller.signal);
      if (!isCurrent()) return;

      setSummary(forecast);
      setSources(forecast.sources);
      writeStorage(LAST_LOCATION_KEY, forecast.location);

      void fetchModelForecasts(forecast.location, targetDate, controller.signal)
        .then((modelForecasts) => {
          const status: SourceState =
            modelForecasts.length >= 2 ? 'ok' : modelForecasts.length ? 'unavailable' : 'error';
          patchSummary('models', status, (current) => applyModelConsensus(current, modelForecasts));
        })
        .catch(() => patchSummary('models', 'error'))
        .finally(() => {
          clearTimeout(settleTimer);
          if (isCurrent()) setIsSettling(false);
        });

      void fetchAirQuality(forecast.location, targetDate)
        .then((airQuality) => {
          patchSummary('airQuality', 'ok', (current) => applyAirQuality(current, airQuality));
        })
        .catch(() => patchSummary('airQuality', 'unavailable'));

      void fetchRainViewer()
        .then((rainViewer) => {
          patchSummary('rainViewer', rainViewer.latestFrame ? 'ok' : 'unavailable', (current) => ({
            ...current,
            rainViewer,
          }));
        })
        .catch(() => patchSummary('rainViewer', 'error'));

      void fetchNwsAlerts(forecast.location)
        .then((nwsAlerts) => {
          patchSummary('nws', 'ok', (current) => applyNwsAlerts(current, nwsAlerts));
        })
        .catch(() => patchSummary('nws', 'unavailable'));
    } catch (caught) {
      // An abort only ever means a newer request superseded this one, and
      // that newer request owns the loading state from here. Bailing out
      // without touching state is correct; setting an error would flash a
      // failure for a request nobody is waiting on any more.
      if (!isCurrent() || controller.signal.aborted) return;
      setSummary(null);
      setSources({
        openMeteo: 'error',
        models: 'unavailable',
        rainViewer: 'unavailable',
        nws: 'unavailable',
        airQuality: 'unavailable',
      });
      setError(caught instanceof Error ? caught.message : 'Forecast unavailable.');
    } finally {
      if (isCurrent() && !controller.signal.aborted) setIsLoading(false);
    }
  }, []);

  /**
   * Initial load.
   *
   * The guard ref must be cleared on cleanup. React StrictMode mounts every
   * component twice in development, and refs survive that simulated remount -
   * so a guard that is only ever set would let the first mount start a load,
   * let the cleanup tear it down, and then skip the retry on the second
   * mount, leaving the app on a permanently empty screen.
   */
  useEffect(() => {
    if (hasLoadedInitialLocation.current) return;
    hasLoadedInitialLocation.current = true;
    const saved = readStorage<LocationResult>(LAST_LOCATION_KEY);
    void loadLocation(saved ?? defaultLocation);

    return () => {
      hasLoadedInitialLocation.current = false;
    };
  }, [loadLocation]);

  const changeDate = (date: string) => {
    if (!date) return;
    setSelectedDate(date);
    void loadLocation(activeLocation ?? summary?.location ?? defaultLocation, date);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Browser geolocation is not available.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        void loadLocation(reverseGeocodeFallback(position.coords.latitude, position.coords.longitude));
      },
      () => {
        setIsLocating(false);
        setError('Location permission was denied or unavailable.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  };

  const changePage = (page: AppPage) => {
    setActivePage(page);

    if (!window.matchMedia('(max-width: 767px)').matches) return;
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.hero-summary')?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    });
  };

  return (
    <div
      className={`weather-shell scene-${scene}`}
      data-night={scenePrefersDark(scene) ? 'true' : 'false'}
      data-page={activePage}
    >
      <AtmosphereCanvas scene={scene} />

      <Header
        sources={activeSources}
        onSelectLocation={loadLocation}
        onUseCurrentLocation={useCurrentLocation}
        selectedDate={selectedDate}
        minDate={minDate}
        maxDate={maxDate}
        onDateChange={changeDate}
        isLocating={isLocating}
      />

      <main className="weather-main mx-auto flex w-full min-h-0 max-w-6xl flex-1 flex-col gap-3 px-3 pb-2 sm:px-5 lg:px-7 2xl:max-w-[84rem]">
        {error ? (
          <section className="surface-panel shrink-0 p-5" role="alert">
            <div className="flex gap-3 text-left">
              <AlertCircle aria-hidden="true" className="mt-1 size-5 shrink-0 text-rose-200" />
              <div>
                <h1 className="text-xl font-black text-white">Forecast could not load</h1>
                <p className="mt-2 text-sm text-white/64">{error}</p>
              </div>
            </div>
          </section>
        ) : null}

        {isLoading && !summary ? (
          <section className="surface-panel grid min-h-0 flex-1 place-items-center p-8">
            <div className="text-center">
              <Loader2 aria-hidden="true" className="mx-auto size-10 animate-spin text-cyan-100" />
              <h1 className="mt-4 text-2xl font-black text-white">Reading the sky</h1>
              <p className="mt-2 text-sm text-white/58">Comparing seven national forecast models.</p>
            </div>
          </section>
        ) : null}

        {/* Dead-state backstop: no forecast, nothing loading, nothing to
            explain it. This should be unreachable, but the failure mode when
            it is reached is a completely blank page, which looks like the app
            is broken rather than like something went wrong. */}
        {!summary && !isLoading && !error ? (
          <section className="surface-panel grid min-h-0 flex-1 place-items-center p-8">
            <div className="text-center">
              <h1 className="text-2xl font-black text-white">No forecast loaded</h1>
              <p className="mt-2 text-sm text-white/58">The last request did not complete.</p>
              <button
                type="button"
                className="focus-ring mt-5 rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-950"
                onClick={() => void loadLocation(activeLocation ?? defaultLocation)}
              >
                Try again
              </button>
            </div>
          </section>
        ) : null}

        {summary ? (
          <>
            <HeroSummary summary={summary} />

            <nav className="app-page-nav surface-panel grid shrink-0 grid-cols-3 gap-1 p-1" aria-label="SunnyDay pages">
              {pages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  className={`focus-ring rounded-xl px-3 py-2 text-sm font-black transition ${
                    activePage === page.id
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-white/72 hover:bg-white/16 hover:text-white'
                  }`}
                  onClick={() => changePage(page.id)}
                  aria-current={activePage === page.id ? 'page' : undefined}
                >
                  {page.label}
                </button>
              ))}
            </nav>

            {/*
              Breakpoint ladder. Both pages used to stay single-column until
              1024px (Today) or 1280px (Details), so every common laptop and
              tablet width produced one very long scroll. Columns now start at
              768px, and Today resolves to an explicit 12-column layout at
              1280px so the panels align instead of leaving ragged whitespace
              beside the shorter cards.
            */}
            {activePage === 'today' ? (
              <div className="today-page min-h-0 flex-1">
                <TodayBento summary={summary} settling={isSettling} />
              </div>
            ) : null}

            {activePage === 'radar' ? (
              <div className="radar-page min-h-0 flex-1">
                <RadarPanel summary={summary} />
              </div>
            ) : null}

            {activePage === 'outlook' ? (
              <div className="outlook-page min-h-0 flex-1">
                <DailyOutlook summary={summary} />
              </div>
            ) : null}
          </>
        ) : null}
      </main>

      <footer className="site-footer mx-auto w-full max-w-6xl shrink-0 px-3 pb-2 text-[0.625rem] leading-tight text-white/40 sm:px-5 lg:px-7 2xl:max-w-[84rem]">
        Forecasts from Open-Meteo (ECMWF, GFS, ICON, UKMO, Météo-France, GEM, JMA) · air quality from CAMS · radar from
        RainViewer · alerts from NWS
      </footer>

    </div>
  );
}

export default App;

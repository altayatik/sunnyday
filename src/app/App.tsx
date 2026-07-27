import { AlertCircle, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header } from '../components/Header';
import { HeroSummary } from '../components/HeroSummary';
import { SunnyScoreCard } from '../components/SunnyScoreCard';
import { HourlyTimeline } from '../components/HourlyTimeline';
import { PrecipitationPanel } from '../components/PrecipitationPanel';
import { CloudSunPanel } from '../components/CloudSunPanel';
import { ComfortPanel } from '../components/ComfortPanel';
import { RadarPanel } from '../components/RadarPanel';
import { DailyOutlook } from '../components/DailyOutlook';
import { fetchSunnyForecast } from '../lib/api/openMeteo';
import { fetchRainViewer } from '../lib/api/rainViewer';
import { fetchNwsAlerts } from '../lib/api/nws';
import { reverseGeocodeFallback } from '../lib/api/geocoding';
import { readStorage, writeStorage } from '../lib/cache';
import type { LocationResult, SunnyDaySources, SunnyDaySummary } from '../types/weather';
import { addDaysToDateKey, dateKeyInTimeZone } from '../lib/date';
import { applyNwsAlerts } from '../lib/weather/normalizeOpenMeteo';

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
  rainViewer: 'loading',
  nws: 'loading',
};

type AppPage = 'today' | 'details' | 'radar' | 'outlook';

const pages: Array<{ id: AppPage; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'details', label: 'Details' },
  { id: 'radar', label: 'Radar' },
  { id: 'outlook', label: 'Outlook' },
];

const atmosphereFor = (summary: SunnyDaySummary | null) => {
  if (!summary) return 'atmosphere-sunny';

  const label = summary.current.conditionLabel.toLowerCase();
  const rainy = /rain|shower|drizzle|thunder/.test(label) || (summary.current.precipitationProbability ?? 0) >= 45;
  const storm = /thunder/.test(label);
  const cloudy = /cloud|overcast|fog/.test(label) || (summary.current.cloudCover ?? 0) >= 70;
  const night = summary.current.isDay === false;

  if (storm) return 'atmosphere-storm';
  if (rainy) return 'atmosphere-rain';
  if (night) return cloudy ? 'atmosphere-cloud-night' : 'atmosphere-night';
  if (cloudy) return 'atmosphere-cloud';
  return 'atmosphere-sunny';
};

function App() {
  const [summary, setSummary] = useState<SunnyDaySummary | null>(null);
  const [sources, setSources] = useState<SunnyDaySources>(loadingSources);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocating, setIsLocating] = useState(false);
  const [activePage, setActivePage] = useState<AppPage>('today');
  const [selectedDate, setSelectedDate] = useState(() => dateKeyInTimeZone());
  const [activeLocation, setActiveLocation] = useState<LocationResult | null>(null);
  const hasLoadedInitialLocation = useRef(false);

  const activeSources = useMemo(() => summary?.sources ?? sources, [summary?.sources, sources]);
  const minDate = useMemo(() => dateKeyInTimeZone(), []);
  const maxDate = useMemo(() => addDaysToDateKey(minDate, 6), [minDate]);
  const atmosphere = atmosphereFor(summary);

  const loadLocation = useCallback(
    async (location: LocationResult, date = selectedDate) => {
      setIsLoading(true);
      setError(null);
      setSources(loadingSources);
      setActiveLocation(location);

      try {
        const forecast = await fetchSunnyForecast(location, date);
        setSummary(forecast);
        setSources(forecast.sources);
        writeStorage(LAST_LOCATION_KEY, forecast.location);

        fetchRainViewer()
          .then((rainViewer) => {
            const rainViewerStatus = rainViewer.latestFrame ? 'ok' : 'unavailable';
            setSources((current) => ({ ...current, rainViewer: rainViewerStatus }));
            setSummary((current) => {
              if (!current) return current;
              return {
                ...current,
                rainViewer,
                sources: {
                  ...current.sources,
                  rainViewer: rainViewerStatus,
                },
              };
            });
          })
          .catch(() => {
            setSources((current) => ({ ...current, rainViewer: 'error' }));
            setSummary((current) => {
              if (!current) return current;
              return {
                ...current,
                sources: {
                  ...current.sources,
                  rainViewer: 'error',
                },
              };
            });
          });

        fetchNwsAlerts(forecast.location)
          .then((nwsAlerts) => {
            setSources((current) => ({ ...current, nws: 'ok' }));
            setSummary((current) => {
              if (!current) return current;
              const rescored = applyNwsAlerts(current, nwsAlerts);
              return {
                ...rescored,
                sources: {
                  ...rescored.sources,
                  nws: 'ok',
                },
              };
            });
          })
          .catch(() => {
            setSources((current) => ({ ...current, nws: 'unavailable' }));
            setSummary((current) => {
              if (!current) return current;
              return {
                ...current,
                sources: {
                  ...current.sources,
                  nws: 'unavailable',
                },
              };
            });
          });
      } catch (caught) {
        setSummary(null);
        setSources({ openMeteo: 'error', rainViewer: 'unavailable', nws: 'unavailable' });
        setError(caught instanceof Error ? caught.message : 'Forecast unavailable.');
      } finally {
        setIsLoading(false);
      }
    },
    [selectedDate],
  );

  useEffect(() => {
    if (hasLoadedInitialLocation.current) return;
    hasLoadedInitialLocation.current = true;
    const saved = readStorage<LocationResult>(LAST_LOCATION_KEY);
    void loadLocation(saved ?? defaultLocation);
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

  return (
    <div className={`weather-shell ${atmosphere}`}>
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

      <main className="mx-auto grid w-full max-w-6xl gap-4 px-4 pb-8 sm:px-6 lg:px-8">
        {error ? (
          <section className="glass rounded-2xl p-5" role="alert">
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
          <section className="glass grid min-h-[28rem] place-items-center rounded-2xl p-8">
            <div className="text-center">
              <Loader2 aria-hidden="true" className="mx-auto size-10 animate-spin text-cyan-100" />
              <h1 className="mt-4 text-2xl font-black text-white">Reading the sky</h1>
              <p className="mt-2 text-sm text-white/58">Pulling live Open-Meteo forecast data.</p>
            </div>
          </section>
        ) : null}

        {summary ? (
          <>
            <HeroSummary summary={summary} />

            <nav className="glass grid grid-cols-4 gap-1 rounded-2xl p-1" aria-label="SunnyDay pages">
              {pages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  className={`focus-ring rounded-xl px-3 py-2 text-sm font-black transition ${
                    activePage === page.id ? 'bg-white text-slate-950 shadow-sm' : 'text-white/72 hover:bg-white/16 hover:text-white'
                  }`}
                  onClick={() => setActivePage(page.id)}
                  aria-current={activePage === page.id ? 'page' : undefined}
                >
                  {page.label}
                </button>
              ))}
            </nav>

            {activePage === 'today' ? (
              <div className="grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
                <SunnyScoreCard summary={summary} />
                <HourlyTimeline summary={summary} />
              </div>
            ) : null}

            {activePage === 'details' ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <PrecipitationPanel summary={summary} />
                <CloudSunPanel summary={summary} />
                <div className="xl:col-span-2">
                  <ComfortPanel summary={summary} />
                </div>
              </div>
            ) : null}

            {activePage === 'radar' ? (
              <div className="grid gap-4">
                <RadarPanel summary={summary} />
                {summary.nwsAlerts?.length ? (
                  <section className="glass rounded-2xl p-5">
                    <h2 className="panel-title">NWS Alerts</h2>
                    <div className="mt-4 grid gap-3">
                      {summary.nwsAlerts.map((alert) => (
                        <article key={alert.id} className="rounded-xl border border-amber-200/30 bg-amber-200/18 p-4">
                          <p className="font-bold text-white">{alert.event}</p>
                          <p className="mt-1 text-sm text-white/72">{alert.headline ?? alert.severity ?? 'Active weather alert'}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : null}

            {activePage === 'outlook' ? (
              <DailyOutlook summary={summary} />
            ) : null}
          </>
        ) : null}
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs text-white/58 sm:px-6 lg:px-8">
        Weather data from{' '}
        <a className="text-cyan-100 underline-offset-4 hover:underline" href="https://open-meteo.com/" rel="noreferrer">
          Open-Meteo
        </a>
        . Radar data from{' '}
        <a className="text-cyan-100 underline-offset-4 hover:underline" href="https://www.rainviewer.com/" rel="noreferrer">
          RainViewer
        </a>{' '}
        when available. NWS alerts are optional for supported U.S. locations.
      </footer>
    </div>
  );
}

export default App;

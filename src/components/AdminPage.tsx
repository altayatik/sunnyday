import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Clipboard,
  CloudCog,
  Database,
  Download,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ModelForecastDiagnostic } from '../lib/api/modelForecasts';
import type { AdminSettings } from '../lib/adminSettings';
import type { LocationResult, SourceState, SunnyDaySources, SunnyDaySummary, WeatherSceneId } from '../types/weather';

export type SourceDiagnostic = {
  status: SourceState;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  message: string;
};

type AdminPageProps = {
  summary: SunnyDaySummary | null;
  sources: SunnyDaySources;
  diagnostics: Record<keyof SunnyDaySources, SourceDiagnostic>;
  modelDiagnostics: ModelForecastDiagnostic[];
  settings: AdminSettings;
  onSettingsChange: (settings: AdminSettings) => void;
  onRefresh: () => void;
  onClearCache: () => number;
  onLoadLocation: (location: LocationResult, date: string) => void;
  minDate: string;
  maxDate: string;
};

const SESSION_KEY = 'sunnyday:admin-unlocked';
// Static deployments cannot read the ignored local env file. The fallback
// keeps the configured passcode working on GitHub Pages; an environment
// variable can replace it in any future hosted build.
const DEFAULT_ADMIN_PASSCODE_HASH = '9371cfbc5153ba53268288612ec5880033aa400781d0b81482abdca95678f59e';
const sourceLabels: Record<keyof SunnyDaySources, string> = {
  openMeteo: 'Primary forecast',
  models: '7-model consensus',
  airQuality: 'Air quality',
  rainViewer: 'Radar',
  nws: 'NWS alerts',
};

const scenes: WeatherSceneId[] = [
  'clear-day',
  'partly-cloudy-day',
  'cloudy',
  'overcast',
  'fog',
  'rain',
  'showers',
  'storm',
  'snow',
  'heat',
  'clear-night',
  'partly-cloudy-night',
];

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const exitAdmin = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete('admin');
  window.location.assign(`${url.pathname}${url.search}${url.hash}`);
};

export function AdminPage({
  summary,
  sources,
  diagnostics,
  modelDiagnostics,
  settings,
  onSettingsChange,
  onRefresh,
  onClearCache,
  onLoadLocation,
  minDate,
  maxDate,
}: AdminPageProps) {
  const configuredHash =
    import.meta.env.VITE_ADMIN_PASSCODE_HASH?.trim().toLowerCase() || DEFAULT_ADMIN_PASSCODE_HASH;
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === 'true');
  const [passcode, setPasscode] = useState('');
  const [gateError, setGateError] = useState('');
  const [notice, setNotice] = useState('');
  const [targetName, setTargetName] = useState(summary?.location.name ?? 'Chicago');
  const [targetLatitude, setTargetLatitude] = useState(String(summary?.location.latitude ?? 41.85003));
  const [targetLongitude, setTargetLongitude] = useState(String(summary?.location.longitude ?? -87.65005));
  const [targetDate, setTargetDate] = useState(summary?.selectedDate ?? minDate);
  const hasSyncedTarget = useRef(Boolean(summary));

  useEffect(() => {
    if (!summary || hasSyncedTarget.current) return;
    hasSyncedTarget.current = true;
    setTargetName(summary.location.name);
    setTargetLatitude(String(summary.location.latitude));
    setTargetLongitude(String(summary.location.longitude));
    setTargetDate(summary.selectedDate);
  }, [summary]);

  const payload = useMemo(
    () => ({
      exportedAt: new Date().toISOString(),
      location: summary?.location ?? null,
      selectedDate: summary?.selectedDate ?? null,
      generatedAt: summary?.generatedAt ?? null,
      score: summary?.sunnyDayScore ?? null,
      accuracy: summary?.accuracy ?? null,
      current: summary?.current ?? null,
      sources,
      diagnostics,
      models: modelDiagnostics,
      settings,
      runtime: {
        online: navigator.onLine,
        language: navigator.language,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        viewport: `${window.innerWidth}×${window.innerHeight}`,
        userAgent: navigator.userAgent,
      },
    }),
    [diagnostics, modelDiagnostics, settings, sources, summary],
  );

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!configuredHash) {
      setGateError('No admin passcode is configured for this build.');
      return;
    }
    if ((await sha256(passcode)) !== configuredHash) {
      setGateError('Incorrect passcode.');
      return;
    }
    sessionStorage.setItem(SESSION_KEY, 'true');
    setUnlocked(true);
    setPasscode('');
    setGateError('');
  };

  const update = <Key extends keyof AdminSettings>(key: Key, value: AdminSettings[Key]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const downloadDiagnostics = () => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sunnyday-diagnostics-${new Date().toISOString().replaceAll(':', '-')}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (!unlocked) {
    return (
      <main className="admin-gate">
        <form className="admin-gate-card" onSubmit={unlock}>
          <div className="admin-icon"><LockKeyhole aria-hidden="true" /></div>
          <p className="label-caps">SunnyDay control room</p>
          <h1>Admin access</h1>
          <p>Enter the private passcode to view diagnostics and local controls.</p>
          <label htmlFor="admin-passcode">Passcode</label>
          <div className="admin-passcode-row">
            <KeyRound aria-hidden="true" />
            <input
              id="admin-passcode"
              type="password"
              autoComplete="current-password"
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
              autoFocus
            />
          </div>
          {gateError ? <p className="admin-error" role="alert">{gateError}</p> : null}
          <button type="submit" className="admin-primary">Unlock diagnostics</button>
          <button type="button" className="admin-quiet" onClick={exitAdmin}>Return to weather</button>
          <p className="admin-security-note">
            <ShieldAlert aria-hidden="true" />
            This static-site gate protects casual access. Server-enforced roles require a backend.
          </p>
        </form>
      </main>
    );
  }

  const healthyCount = Object.values(sources).filter((source) => source === 'ok').length;

  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <div>
          <p className="label-caps">SunnyDay control room</p>
          <h1>Diagnostics & controls</h1>
          <p>{summary ? `${summary.location.name} · ${summary.current.conditionLabel} · ${summary.current.temperatureF ?? '—'}°` : 'Waiting for forecast data'}</p>
        </div>
        <div className="admin-top-actions">
          <button type="button" onClick={onRefresh}><RefreshCw aria-hidden="true" /> Refresh data</button>
          <button type="button" onClick={exitAdmin}><ArrowLeft aria-hidden="true" /> Weather</button>
        </div>
      </header>

      {notice ? <div className="admin-notice">{notice}</div> : null}

      <section className="admin-overview">
        <article><Activity aria-hidden="true" /><span>Sources healthy</span><strong>{healthyCount}/5</strong></article>
        <article><CloudCog aria-hidden="true" /><span>Models reporting</span><strong>{modelDiagnostics.filter((model) => model.status === 'ok').length}/7</strong></article>
        <article><Database aria-hidden="true" /><span>Forecast score</span><strong>{summary?.sunnyDayScore ?? '—'}</strong></article>
        <article><CheckCircle2 aria-hidden="true" /><span>Accuracy</span><strong>{summary?.accuracy?.score ?? '—'}</strong></article>
      </section>

      <div className="admin-grid">
        <section className="admin-card">
          <div className="admin-card-heading"><div><p className="label-caps">Live health</p><h2>Data sources</h2></div><Activity aria-hidden="true" /></div>
          <div className="admin-source-list">
            {(Object.keys(sourceLabels) as Array<keyof SunnyDaySources>).map((key) => {
              const diagnostic = diagnostics[key];
              const isHealthy = sources[key] === 'ok';
              return (
                <article key={key}>
                  {isHealthy ? <CheckCircle2 className="status-ok" aria-hidden="true" /> : <XCircle className="status-bad" aria-hidden="true" />}
                  <div><strong>{sourceLabels[key]}</strong><span>{diagnostic.message}</span></div>
                  <time>{diagnostic.durationMs === undefined ? sources[key] : `${diagnostic.durationMs} ms`}</time>
                </article>
              );
            })}
          </div>
        </section>

        <section className="admin-card">
          <div className="admin-card-heading"><div><p className="label-caps">No-code preview</p><h2>Appearance & score</h2></div><CloudCog aria-hidden="true" /></div>
          <p className="admin-help">Overrides persist on this browser only. “Auto” always uses live weather.</p>
          <div className="admin-fields">
            <label>Night mode
              <select value={settings.nightMode} onChange={(event) => update('nightMode', event.target.value as AdminSettings['nightMode'])}>
                <option value="auto">Automatic</option><option value="day">Force day</option><option value="night">Force night</option>
              </select>
            </label>
            <label>Sky scene
              <select value={settings.sceneOverride} onChange={(event) => update('sceneOverride', event.target.value as AdminSettings['sceneOverride'])}>
                <option value="auto">Automatic</option>
                {scenes.map((scene) => <option key={scene} value={scene}>{scene.replaceAll('-', ' ')}</option>)}
              </select>
            </label>
            <label>Displayed score
              <input
                type="number"
                min="0"
                max="100"
                placeholder="Live score"
                value={settings.scoreOverride ?? ''}
                onChange={(event) => update('scoreOverride', event.target.value === '' ? null : Math.max(0, Math.min(100, Number(event.target.value))))}
              />
            </label>
            <label className="admin-toggle"><input type="checkbox" checked={settings.debugLogging} onChange={(event) => update('debugLogging', event.target.checked)} /> Browser debug logging</label>
          </div>
          <button type="button" className="admin-secondary" onClick={() => {
            onSettingsChange({ nightMode: 'auto', sceneOverride: 'auto', scoreOverride: null, debugLogging: false });
            setNotice('Local preview overrides reset.');
          }}><RotateCcw aria-hidden="true" /> Reset overrides</button>
        </section>

        <section className="admin-card admin-card-wide">
          <div className="admin-card-heading"><div><p className="label-caps">Forecast target</p><h2>Location & date</h2></div><RefreshCw aria-hidden="true" /></div>
          <p className="admin-help">Load exact coordinates when search results are ambiguous or you need to reproduce a report.</p>
          <div className="admin-target-fields">
            <label>Display name<input value={targetName} onChange={(event) => setTargetName(event.target.value)} /></label>
            <label>Latitude<input type="number" min="-90" max="90" step="0.0001" value={targetLatitude} onChange={(event) => setTargetLatitude(event.target.value)} /></label>
            <label>Longitude<input type="number" min="-180" max="180" step="0.0001" value={targetLongitude} onChange={(event) => setTargetLongitude(event.target.value)} /></label>
            <label>Forecast date<input type="date" min={minDate} max={maxDate} value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></label>
          </div>
          <button type="button" className="admin-secondary" onClick={() => {
            const latitude = Number(targetLatitude);
            const longitude = Number(targetLongitude);
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
              setNotice('Enter valid latitude and longitude values.');
              return;
            }
            onLoadLocation({ name: targetName.trim() || 'Custom location', latitude, longitude }, targetDate);
            setNotice(`Loading ${targetName.trim() || 'custom location'} for ${targetDate}.`);
          }}><RefreshCw aria-hidden="true" /> Load target</button>
        </section>

        <section className="admin-card admin-card-wide">
          <div className="admin-card-heading"><div><p className="label-caps">Consensus detail</p><h2>Forecast models</h2></div><CloudCog aria-hidden="true" /></div>
          <div className="admin-model-grid">
            {modelDiagnostics.length ? modelDiagnostics.map((model) => (
              <article key={model.id} className={model.status === 'ok' ? 'is-ok' : 'is-error'}>
                <div>{model.status === 'ok' ? <CheckCircle2 aria-hidden="true" /> : <XCircle aria-hidden="true" />}<strong>{model.label}</strong></div>
                <span>{model.agency}</span><small>{model.message} · {model.durationMs} ms</small>
              </article>
            )) : <p className="admin-help">Model diagnostics will appear after the current comparison finishes.</p>}
          </div>
        </section>

        <section className="admin-card admin-card-wide">
          <div className="admin-card-heading"><div><p className="label-caps">Maintenance</p><h2>Tools & export</h2></div><Database aria-hidden="true" /></div>
          <div className="admin-tool-row">
            <button type="button" onClick={async () => { await navigator.clipboard.writeText(JSON.stringify(payload, null, 2)); setNotice('Diagnostics copied to clipboard.'); }}><Clipboard aria-hidden="true" /> Copy diagnostics</button>
            <button type="button" onClick={downloadDiagnostics}><Download aria-hidden="true" /> Download JSON</button>
            <button type="button" onClick={() => { const count = onClearCache(); setNotice(`Cleared ${count} cached forecast records.`); }}><Trash2 aria-hidden="true" /> Clear forecast cache</button>
            <button type="button" onClick={() => { sessionStorage.removeItem(SESSION_KEY); setUnlocked(false); }}><LockKeyhole aria-hidden="true" /> Lock admin</button>
          </div>
        </section>
      </div>
    </main>
  );
}

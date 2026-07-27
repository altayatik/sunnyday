import { AlertTriangle, BellRing, MapPin, Satellite } from 'lucide-react';
import { CircleMarker, MapContainer, Pane, TileLayer, ZoomControl } from 'react-leaflet';
import type { NwsAlert, SunnyDaySummary } from '../types/weather';

type RadarPanelProps = {
  summary: SunnyDaySummary;
};

const frameLabel = (unixTime: number | undefined, timeZone?: string) => {
  if (!unixTime) return 'Latest available frame';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  }).format(new Date(unixTime * 1000));
};

const alertTone = (alert: NwsAlert) => {
  const event = alert.event.toLowerCase();
  if (event.includes('tornado') || event.includes('severe thunderstorm')) {
    return 'border-rose-300/30 bg-rose-300/12';
  }
  if (event.includes('flood')) return 'border-sky-300/30 bg-sky-300/12';
  return 'border-amber-200/24 bg-amber-200/10';
};

/**
 * Radar and alerts share one bounded surface. The map owns the flexible space
 * and alerts get a compact side rail, so neither can collapse the other or
 * push the fixed-viewport app into a scroll state.
 */
export function RadarPanel({ summary }: RadarPanelProps) {
  const frame = summary.rainViewer?.latestFrame;
  const hasRadar = summary.sources.rainViewer === 'ok' && summary.rainViewer?.host && frame;
  const radarUrl = hasRadar ? `${summary.rainViewer?.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png` : null;
  const alerts = summary.nwsAlerts ?? [];
  const visibleAlerts = alerts.slice(0, 3);

  return (
    <section className="bento h-full min-h-0 p-0" style={{ '--tile-glow': 'rgba(56, 189, 248, 0.2)' } as React.CSSProperties}>
      <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_19rem] md:grid-rows-1">
        <div className="relative min-h-0 overflow-hidden">
          {radarUrl ? (
            <MapContainer
              key={`${summary.location.latitude},${summary.location.longitude}`}
              center={[summary.location.latitude, summary.location.longitude]}
              zoom={7}
              zoomControl={false}
              scrollWheelZoom={false}
              className="z-0 h-full w-full"
            >
              <TileLayer
                attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                opacity={0.72}
              />
              <Pane name="sunnyday-radar" style={{ zIndex: 350 }}>
                <TileLayer
                  attribution='Radar © <a href="https://www.rainviewer.com/">RainViewer</a>'
                  url={radarUrl}
                  opacity={0.78}
                />
              </Pane>
              <CircleMarker
                center={[summary.location.latitude, summary.location.longitude]}
                radius={7}
                pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#22d3ee', fillOpacity: 1 }}
              />
              <ZoomControl position="bottomright" />
            </MapContainer>
          ) : (
            <div className="grid h-full min-h-52 place-items-center bg-slate-950/30 p-6 text-center">
              <div>
                <AlertTriangle aria-hidden="true" className="mx-auto size-8 text-amber-200" />
                <p className="mt-3 font-semibold text-white">Radar unavailable</p>
                <p className="mt-1 text-sm text-white/58">Forecast and alert data are still available.</p>
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-xl border border-white/18 bg-slate-950/68 px-3 py-2 shadow-xl backdrop-blur-md sm:left-4 sm:top-4">
            <p className="flex items-center gap-2 text-sm font-black text-white">
              <Satellite aria-hidden="true" className="size-4 text-cyan-200" />
              Live radar
            </p>
            <p className="mt-0.5 text-[0.6875rem] font-bold text-white/54">
              {frameLabel(frame?.time, summary.location.timezone)}
            </p>
          </div>

          <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex items-center gap-2 rounded-full border border-white/16 bg-slate-950/66 px-2.5 py-1.5 text-[0.6875rem] font-bold text-white/72 backdrop-blur-md sm:bottom-4 sm:left-4">
            <MapPin aria-hidden="true" className="size-3.5 text-cyan-200" />
            {summary.location.name}
          </div>
        </div>

        <aside className="flex min-h-0 flex-col border-t border-white/12 bg-slate-950/18 p-3 md:border-l md:border-t-0 md:p-4">
          <div className="flex shrink-0 items-center justify-between gap-3">
            <div>
              <p className="tile-label">NWS alerts</p>
              <p className="mt-1 text-sm font-black text-white">
                {alerts.length ? `${alerts.length} active` : 'All clear'}
              </p>
            </div>
            <span className="surface-accent grid size-9 place-items-center">
              <BellRing aria-hidden="true" className="size-4" />
            </span>
          </div>

          {visibleAlerts.length ? (
            <div className="mt-3 grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-1">
              {visibleAlerts.map((alert) => (
                <article
                  key={alert.id}
                  className={`surface-tile flex min-h-0 flex-col justify-center overflow-hidden p-2.5 ${alertTone(alert)}`}
                >
                  <p className="truncate text-xs font-black text-white">{alert.event}</p>
                  <p className="mt-1 hidden overflow-hidden text-[0.6875rem] leading-snug text-white/52 md:block">
                    {alert.headline ?? alert.severity ?? 'Active weather alert'}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-3 grid min-h-0 flex-1 place-items-center rounded-xl border border-emerald-200/14 bg-emerald-200/8 p-3 text-center">
              <p className="text-xs font-bold text-emerald-100/74">No active alerts for this location.</p>
            </div>
          )}

          {alerts.length > visibleAlerts.length ? (
            <p className="mt-2 shrink-0 text-[0.6875rem] font-bold text-white/44">
              +{alerts.length - visibleAlerts.length} more active
            </p>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

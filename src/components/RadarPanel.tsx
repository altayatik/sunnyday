import { AlertTriangle, Satellite } from 'lucide-react';
import { MapContainer, TileLayer } from 'react-leaflet';
import type { SunnyDaySummary } from '../types/weather';

type RadarPanelProps = {
  summary: SunnyDaySummary;
};

export function RadarPanel({ summary }: RadarPanelProps) {
  const frame = summary.rainViewer?.latestFrame;
  const hasRadar = summary.sources.rainViewer === 'ok' && summary.rainViewer?.host && frame;
  const radarUrl = hasRadar ? `${summary.rainViewer?.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png` : null;

  return (
    <section className="glass overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-cyan-300/10 text-cyan-100">
            <Satellite aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="panel-title">Radar</h2>
            <p className="subtle mt-1 text-sm">RainViewer latest frame</p>
          </div>
        </div>
      </div>

      <div className="h-[24rem] border-t border-white/10">
        {radarUrl ? (
          <MapContainer
            center={[summary.location.latitude, summary.location.longitude]}
            zoom={7}
            scrollWheelZoom={false}
            className="z-0"
          >
            <TileLayer
              attribution='Radar data © <a href="https://www.rainviewer.com/">RainViewer</a>'
              url={radarUrl}
              opacity={0.72}
            />
            <TileLayer
              attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              opacity={0.42}
            />
          </MapContainer>
        ) : (
          <div className="grid h-full place-items-center p-6 text-center">
            <div>
              <AlertTriangle aria-hidden="true" className="mx-auto size-8 text-amber-200" />
              <p className="mt-3 font-semibold text-white">Radar unavailable</p>
              <p className="mt-1 text-sm text-white/58">Forecast data is still available.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

import { motion } from 'framer-motion';
import { useState } from 'react';
import type { SunnyDaySummary } from '../../types/weather';
import { bentoContainer } from '../../lib/motion';
import { formatHour } from '../../lib/date';
import { inches, mph, percent, temp } from '../../lib/weather/units';
import { Tile } from './Tile';
import { ScoreRing } from '../charts/ScoreRing';
import { Sparkline } from '../charts/Sparkline';
import { BarSeries } from '../charts/BarSeries';
import { GaugeArc } from '../charts/GaugeArc';
import { DayTimeline } from '../charts/DayTimeline';
import { DetailSheet } from './DetailSheet';
import { detailDefinitions, type DetailId } from './detailContent';

type TodayBentoProps = {
  summary: SunnyDaySummary;
  /** True until the model consensus lands, so the score reveals once. */
  settling: boolean;
};

const glow = {
  score: 'rgba(125, 211, 252, 0.20)',
  rain: 'rgba(56, 189, 248, 0.20)',
  cloud: 'rgba(148, 163, 184, 0.20)',
  uv: 'rgba(245, 158, 11, 0.20)',
  heat: 'rgba(251, 146, 60, 0.20)',
  air: 'rgba(74, 222, 128, 0.20)',
  wind: 'rgba(45, 212, 191, 0.20)',
  window: 'rgba(167, 243, 208, 0.20)',
};

/**
 * The Today screen.
 *
 * Deliberate size hierarchy rather than a uniform grid: the score occupies a
 * 2x2 block, the window and hourly strips are wide, and the single-value
 * metrics are small squares. That asymmetry is what stops it reading as a
 * spreadsheet - and it means the eye lands on the score first every time.
 */
export function TodayBento({ summary, settling }: TodayBentoProps) {
  const [openDetail, setOpenDetail] = useState<DetailId | null>(null);
  const detail = openDetail ? detailDefinitions[openDetail] : null;

  /** Shared props that make a tile open its sheet and hand over its surface. */
  const opens = (id: DetailId) => ({
    layoutId: `bento-${id}`,
    onOpen: () => setOpenDetail(id),
    expanded: openDetail === id,
  });

  const timeZone = summary.location.timezone;
  const hours = summary.hourly.slice(0, 12);
  const current = summary.current;
  const today = summary.daily.find((day) => day.date === summary.selectedDate) ?? summary.daily[0];
  const air = summary.airQuality;
  const window = summary.insights.bestWindow;

  const sunshineRatio =
    today?.sunshineDurationSeconds && today.daylightDurationSeconds
      ? Math.round((today.sunshineDurationSeconds / today.daylightDurationSeconds) * 100)
      : null;

  return (
    <>
      <motion.div
      variants={bentoContainer}
      initial="hidden"
      animate="show"
      className="grid h-full auto-rows-fr grid-cols-2 gap-2 sm:gap-2.5 md:grid-cols-4 xl:grid-cols-6"
    >
      {/* Score — the one thing that reads first */}
      <Tile
        label="SunnyDay Score"
        glow={glow.score}
        feature
        {...opens('score')}
        className="col-span-2 row-span-2 items-center justify-center xl:col-span-2"
      >
        <div className="flex flex-1 items-center justify-center">
          <ScoreRing
            score={summary.sunnyDayScore}
            label={summary.scoreLabel}
            low={summary.accuracy?.coveredCount && summary.accuracy.coveredCount >= 2 ? summary.accuracy.scoreLow : undefined}
            high={summary.accuracy?.coveredCount && summary.accuracy.coveredCount >= 2 ? summary.accuracy.scoreHigh : undefined}
            settling={settling}
          />
        </div>
      </Tile>

      {/* Best window — a strip, not a sentence */}
      <Tile label="Best window" glow={glow.window} className="col-span-2 md:col-span-2 xl:col-span-4" {...opens('window')}>
        <div className="flex flex-1 flex-col justify-center">
          {window ? (
            <p className="mb-3 flex flex-wrap items-baseline gap-x-2">
              <span className="tile-figure">
                {formatHour(window.startTime, timeZone)}–{formatHour(window.endTime, timeZone)}
              </span>
              <span className="text-[0.8125rem] font-bold text-white/50">
                {window.hours}h · {window.score}
              </span>
            </p>
          ) : (
            <p className="mb-3 tile-figure text-white/40">—</p>
          )}
          <DayTimeline hours={summary.hourly} window={window} timeZone={timeZone} />
        </div>
      </Tile>

      {/* Rain */}
      <Tile label="Rain chance" glow={glow.rain} className="col-span-2 xl:col-span-2" {...opens('rain')}>
        <div className="flex flex-1 flex-col justify-between">
          <p className="flex items-baseline gap-2">
            <span className="tile-figure" style={{ color: 'var(--rain-2)' }}>
              {percent(current.precipitationProbability)}
            </span>
            <span className="text-[0.8125rem] font-bold text-white/45">{inches(current.precipitationInches)}</span>
          </p>
          <BarSeries
            values={hours.map((hour) => hour.precipitationProbability)}
            base="rgba(56, 189, 248, 0.32)"
            emphasis="var(--rain-1)"
            className="mt-2 shrink-0"
          />
        </div>
      </Tile>

      {/* Temperature */}
      <Tile label="Feels like" glow={glow.heat} className="col-span-2 xl:col-span-2" {...opens('temperature')}>
        <div className="flex flex-1 flex-col justify-between">
          <p className="flex items-baseline gap-2">
            <span className="tile-figure" style={{ color: 'var(--heat-2)' }}>
              {temp(current.apparentTemperatureF)}
            </span>
            <span className="text-[0.8125rem] font-bold text-white/45">
              {temp(today?.temperatureMaxF ?? null)} / {temp(today?.temperatureMinF ?? null)}
            </span>
          </p>
          <Sparkline
            values={hours.map((hour) => hour.apparentTemperatureF ?? hour.temperatureF)}
            from="var(--heat-1)"
            to="var(--heat-2)"
            className="mt-2 shrink-0"
          />
        </div>
      </Tile>

      {/* Cloud */}
      <Tile label="Cloud cover" glow={glow.cloud} className="col-span-2 xl:col-span-2" {...opens('cloud')}>
        <div className="flex flex-1 flex-col justify-between">
          <p className="flex items-baseline gap-2">
            <span className="tile-figure" style={{ color: 'var(--cloud-2)' }}>
              {percent(current.cloudCover)}
            </span>
            {sunshineRatio !== null ? (
              <span className="text-[0.8125rem] font-bold text-white/45">{sunshineRatio}% sun</span>
            ) : null}
          </p>
          <Sparkline
            values={hours.map((hour) => hour.cloudCover)}
            min={0}
            max={100}
            from="var(--cloud-1)"
            to="var(--cloud-2)"
            className="mt-2 shrink-0"
          />
        </div>
      </Tile>

      {/* UV */}
      <Tile label="UV index" glow={glow.uv} className="items-center" {...opens('uv')}>
        <div className="flex flex-1 items-center justify-center">
          <GaugeArc
            value={today?.uvIndexMax ?? current.uvIndex}
            max={12}
            from="var(--uv-1)"
            to="var(--uv-2)"
            caption="peak"
          />
        </div>
      </Tile>

      {/* Air quality */}
      <Tile label="Air quality" glow={glow.air} className="items-center" {...opens('air')}>
        <div className="flex flex-1 items-center justify-center">
          <GaugeArc
            value={air?.usAqi ?? air?.peakAqi ?? null}
            max={200}
            from="var(--air-1)"
            to="var(--air-2)"
            caption={air ? air.category.split(' ')[0] : 'AQI'}
          />
        </div>
      </Tile>

      {/* Wind */}
      <Tile label="Wind" glow={glow.wind} {...opens('wind')}>
        <div className="flex flex-1 flex-col justify-between">
          <p className="tile-figure" style={{ color: 'var(--wind-2)' }}>
            {mph(current.windSpeedMph)}
          </p>
          <div className="hidden min-h-0 flex-1 sm:flex sm:flex-col sm:justify-end">
            <BarSeries
              values={hours.map((hour) => hour.windGustMph)}
              max={45}
              threshold={28}
              base="rgba(45, 212, 191, 0.3)"
              emphasis="var(--wind-1)"
              height={28}
            />
          </div>
          <p className="mt-1 text-[0.6875rem] font-bold text-white/40">gusts {mph(current.windGustMph)}</p>
        </div>
      </Tile>

      {/* Humidity */}
      <Tile label="Humidity" glow={glow.rain} {...opens('humidity')}>
        <div className="flex flex-1 flex-col justify-between">
          <p className="tile-figure" style={{ color: 'var(--rain-2)' }}>
            {percent(current.humidity)}
          </p>
          <div className="hidden min-h-0 flex-1 sm:flex sm:flex-col sm:justify-end">
            <Sparkline
              values={hours.map((hour) => hour.humidity)}
              min={0}
              max={100}
              from="var(--rain-1)"
              to="var(--rain-2)"
              height={28}
            />
          </div>
        </div>
      </Tile>
    </motion.div>

      <DetailSheet
        open={detail !== null}
        onClose={() => setOpenDetail(null)}
        title={detail?.title ?? ''}
        layoutId={`bento-${openDetail ?? 'none'}`}
        accent={detail?.accent}
      >
        {detail && openDetail ? detail.render(summary) : null}
      </DetailSheet>
    </>
  );
}

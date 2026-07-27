import type { ReactNode } from 'react';
import type { SunnyDaySummary } from '../../types/weather';
import { SunnyScoreCard } from '../SunnyScoreCard';
import { ScoreBreakdownPanel } from '../ScoreBreakdownPanel';
import { ScoreFactorsPanel } from '../ScoreFactorsPanel';
import { BestWindowPanel } from '../BestWindowPanel';
import { PrecipitationPanel } from '../PrecipitationPanel';
import { CloudSunPanel } from '../CloudSunPanel';
import { ComfortPanel } from '../ComfortPanel';
import { AirQualityPanel } from '../AirQualityPanel';
import { HourlyTimeline } from '../HourlyTimeline';

/** Identifiers shared between a tile, its layout animation, and its sheet. */
export type DetailId = 'score' | 'window' | 'rain' | 'temperature' | 'cloud' | 'uv' | 'air' | 'wind' | 'humidity';

export type DetailDefinition = {
  title: string;
  accent: string;
  render: (summary: SunnyDaySummary) => ReactNode;
};

const stack = (children: ReactNode) => <div className="grid gap-3">{children}</div>;

/**
 * What each tile expands into.
 *
 * These reuse the existing panels rather than inventing a second set of
 * detail views - the panels were already the right content, they were just on
 * a page nobody wanted to navigate to. Opening them from the tile that shows
 * the same number keeps the relationship obvious.
 */
export const detailDefinitions: Record<DetailId, DetailDefinition> = {
  score: {
    title: 'SunnyDay Score',
    accent: 'rgba(125, 211, 252, 0.18)',
    render: (summary) =>
      stack(
        <>
          <SunnyScoreCard summary={summary} />
          <ScoreBreakdownPanel summary={summary} />
          <ScoreFactorsPanel summary={summary} />
        </>,
      ),
  },
  window: {
    title: 'Best window',
    accent: 'rgba(167, 243, 208, 0.18)',
    render: (summary) =>
      stack(
        <>
          <BestWindowPanel summary={summary} />
          <HourlyTimeline summary={summary} />
        </>,
      ),
  },
  rain: {
    title: 'Precipitation',
    accent: 'rgba(56, 189, 248, 0.18)',
    render: (summary) => <PrecipitationPanel summary={summary} />,
  },
  temperature: {
    title: 'Comfort',
    accent: 'rgba(251, 146, 60, 0.18)',
    render: (summary) => <ComfortPanel summary={summary} />,
  },
  cloud: {
    title: 'Cloud & sun',
    accent: 'rgba(148, 163, 184, 0.18)',
    render: (summary) => <CloudSunPanel summary={summary} />,
  },
  uv: {
    title: 'UV & sun exposure',
    accent: 'rgba(245, 158, 11, 0.18)',
    render: (summary) => <CloudSunPanel summary={summary} />,
  },
  air: {
    title: 'Air quality',
    accent: 'rgba(74, 222, 128, 0.18)',
    render: (summary) => <AirQualityPanel summary={summary} />,
  },
  wind: {
    title: 'Wind & comfort',
    accent: 'rgba(45, 212, 191, 0.18)',
    render: (summary) => <ComfortPanel summary={summary} />,
  },
  humidity: {
    title: 'Humidity & comfort',
    accent: 'rgba(56, 189, 248, 0.18)',
    render: (summary) => <ComfortPanel summary={summary} />,
  },
};

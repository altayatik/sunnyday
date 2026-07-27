# SunnyDay

SunnyDay is a polished static weather dashboard for deciding whether it is actually a good outside day. It emphasizes precipitation, cloud cover, sunshine quality, UV, humidity, wind, radar, and short-term sky conditions rather than making temperature the main event.

## Features

- React, TypeScript, Vite, Tailwind CSS, Framer Motion, Leaflet, and lucide icons.
- Seven independent global forecast models compared on every load: ECMWF IFS, NOAA GFS, DWD ICON, UKMO, Météo-France, ECCC GEM, and JMA GSM.
- A weighted consensus SunnyDay score plus a separate accuracy-confidence score, shown with the model spread as an explicit uncertainty band rather than a single false-precision number.
- Air quality and pollen from the Open-Meteo Air Quality API (CAMS), scored as its own category and able to cap an otherwise perfect day.
- Transparent 0-100 SunnyDay Score across five bounded categories: precipitation (32%), sky (22%), comfort (22%), safety (14%), and air (10%).
- Rule-based insights: a dominant-reason headline, a connected paragraph, ranked positives and negatives, actionable recommendations, a best-outdoor-window finder, and a better-day suggestion when today is poor.
- Twelve derived weather scenes with a canvas particle layer — rain, snow, drifting cloud, starfield, fog, lightning, heat shimmer — that honours `prefers-reduced-motion` and stops entirely when the tab is hidden.
- U.S.-preferred city search through Open-Meteo Geocoding.
- Browser geolocation support with graceful fallback.
- Date selection for the current forecast range, defaulting to the current day.
- A chart-led bento Today screen: an animated score ring with the model consensus drawn as a band behind it, plus rain, temperature, cloud, UV, air, wind, and humidity tiles.
- Tapping any tile morphs it into a detail sheet via a shared-element transition, so the numbers appear next to the chart that raised the question. There is no separate Details page.
- Today, Radar, and Outlook pages for a mobile-app-style flow.
- RainViewer radar map when metadata is available.
- Optional NWS alert lookup for U.S. points. The app continues normally if NWS is unavailable.
- Short localStorage cache for forecast/geocoding/radar responses to reduce repeated API calls.

## Data Accuracy

Weather apps fail quietly: a wrong number renders exactly as well as a right one. A few things this codebase does deliberately about that.

- **Stale responses cannot land.** Every load carries a request token and an `AbortController`. The slow background fetches (seven model runs, radar, alerts, air quality) are discarded if the person has since changed city or date, so a consensus score from the previous location can never be painted onto the current forecast.
- **Missing data is not zero.** Averages and spreads across models return `null` for an empty set. A model that carries no gust series is excluded from the gust spread rather than being treated as forecasting 0 mph, which previously manufactured a huge disagreement and collapsed the confidence score.
- **Confidence is capped by coverage.** Two models agreeing is much weaker evidence than six agreeing, so the accuracy ceiling scales with how many models actually returned data for the selected day. Models with no data are shown dimmed rather than hidden.
- **The consensus is trimmed and weighted, not a bare median.** The most extreme model is dropped once five or more report, and the rest are weighted by rough model skill. When the models disagree sharply, the result is pulled back toward the primary blended run, because that is exactly when an aggregate means least.
- **One recompute path.** Consensus, alerts, and air quality all funnel through `rescoreSummary`, so the score, label, breakdown, prose, and background scene are always derived from the same inputs and cannot drift apart.
- **Absent data scores neutral.** No air-quality coverage scores 100, not 0. Pollen is only modelled over Europe, and the UI says so rather than implying an all-clear.
- **The score is revealed once, not progressively.** It used to be painted from the primary run and then rewritten as consensus, air quality, and alerts landed - four different numbers in about two seconds. The ring now waits for the model comparison and counts up once.
- **Sub-noise movement is damped.** A change of two points or less within a two-hour window keeps the number you were already shown; anything larger passes straight through. Every model run shifts the arithmetic slightly, and surfacing that verbatim is what makes weather apps feel like they are guessing.
- **Confidence accounts for lead time and normal spread.** Each metric has a tolerance band, because two models disagreeing by 3°F about tomorrow is excellent agreement, not a problem. Score spread is de-weighted since it restates disagreement already charged on the inputs it derives from.

Run `npm run verify` to execute the scoring, consensus, insight, and scene assertions (70 checks, no extra dependencies).

## Insights

The insight text is deterministic and rule-based, not a model call. That is a considered choice, not a limitation to be fixed later:

- The app ships as a static bundle with no backend, so a hosted model would need either an embedded API key (extractable by anyone) or a new proxy service, which ends the "deploy `dist/` anywhere" property.
- The insight sits directly beside the metric tiles and the score. A model restating those numbers will occasionally get one wrong, and a wrong number next to a right one is worse than plainer prose.
- Rule-based renders instantly, works offline, and never contradicts the score.

`buildInsights` in `src/lib/weather/insights.ts` is the single seam. Replacing its body is the entire integration if a hosted model is added — most plausibly as a separate opt-in "ask about this forecast" feature rather than as the score explanation.

## Run Locally

```bash
npm install
npm run dev
```

Then open the local Vite URL, usually `http://127.0.0.1:5173/`.

## Build

```bash
npm run build
```

The static output is written to `dist/`.

## GitHub Pages Deployment

The app is fully static and does not need a backend or API keys.

`vite.config.ts` uses:

```ts
base: process.env.VITE_BASE_PATH ?? './'
```

For a Pages route such as `/sunnyday/`:

```bash
VITE_BASE_PATH=/sunnyday/ npm run build
```

For `/weather/`:

```bash
VITE_BASE_PATH=/weather/ npm run build
```

Deploy the generated `dist/` directory with your preferred GitHub Pages workflow.

## Data Sources

- Forecast and daily/hourly weather: [Open-Meteo Forecast API](https://open-meteo.com/)
- Model ensemble, all served through Open-Meteo but each a separate national model run: ECMWF IFS, NOAA GFS, DWD ICON, UKMO, Météo-France, ECCC GEM, JMA GSM
- Air quality and pollen: [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) (CAMS)
- Location search: [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api)
- Radar metadata and radar tiles: [RainViewer](https://www.rainviewer.com/api.html)
- Optional U.S. alerts: [NWS API](https://www.weather.gov/documentation/services-web-api)

## Known Limitations

- The NWS API is optional because static browser clients can run into availability or request-policy issues.
- RainViewer radar is best-effort. If metadata or tiles fail, SunnyDay still shows the forecast panels.
- Not every model covers every point or lead time. Models that return nothing are dropped from the consensus and shown dimmed in the accuracy chip rather than silently disappearing.
- Pollen is only modelled over Europe. Outside that domain the pollen section says the data is unavailable rather than showing zero.
- Open-Meteo weather codes can occasionally indicate current weather that appears stricter than precipitation probability alone. SunnyDay accounts for this in scoring, but live model data can still be imperfect.
- No paid APIs, no frontend API keys, and no backend are used in v1.

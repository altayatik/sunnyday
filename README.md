# SunnyDay

SunnyDay is a polished static weather dashboard for deciding whether it is actually a good outside day. It emphasizes precipitation, cloud cover, sunshine quality, UV, humidity, wind, radar, and short-term sky conditions rather than making temperature the main event.

## Features

- React, TypeScript, Vite, Tailwind CSS, Framer Motion, Leaflet, and lucide icons.
- Multi-model live forecasts combining NOAA GFS, ECMWF IFS, and DWD ICON guidance through Open-Meteo.
- A consensus SunnyDay score plus a separate accuracy-confidence score based on model agreement.
- U.S.-preferred city search through Open-Meteo Geocoding.
- Browser geolocation support with graceful fallback.
- Date selection for the current forecast range, defaulting to the current day.
- Transparent 0-100 SunnyDay Score tuned toward rain, clouds, sun, humidity, wind, and UV.
- Compact Today, Details, Radar, and Outlook pages for a mobile-app-style flow.
- Adaptive weather atmosphere backgrounds for sunny, cloudy, rainy, stormy, and night conditions.
- RainViewer radar map when metadata is available.
- Optional NWS alert lookup for U.S. points. The app continues normally if NWS is unavailable.
- Short localStorage cache for forecast/geocoding/radar responses to reduce repeated API calls.

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
- Location search: [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api)
- Radar metadata and radar tiles: [RainViewer](https://www.rainviewer.com/api.html)
- Optional U.S. alerts: [NWS API](https://www.weather.gov/documentation/services-web-api)

## Known Limitations

- The NWS API is optional because static browser clients can run into availability or request-policy issues.
- RainViewer radar is best-effort. If metadata or tiles fail, SunnyDay still shows the forecast panels.
- Open-Meteo weather codes can occasionally indicate current weather that appears stricter than precipitation probability alone. SunnyDay accounts for this in scoring, but live model data can still be imperfect.
- No paid APIs, no frontend API keys, and no backend are used in v1.

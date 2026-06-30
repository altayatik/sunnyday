import type { LocationResult, NwsAlert } from '../../types/weather';

type NwsPointResponse = {
  properties?: {
    forecastHourly?: string;
    forecastZone?: string;
    county?: string;
  };
};

type NwsAlertsResponse = {
  features?: Array<{
    id?: string;
    properties?: {
      event?: string;
      severity?: string;
      headline?: string;
    };
  }>;
};

const zoneIdFromUrl = (url?: string) => url?.split('/').at(-1) ?? null;

export const fetchNwsAlerts = async (location: LocationResult): Promise<NwsAlert[]> => {
  const pointResponse = await fetch(
    `https://api.weather.gov/points/${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`,
    {
      headers: {
        Accept: 'application/geo+json',
      },
    },
  );

  if (!pointResponse.ok) throw new Error('NWS point lookup unavailable.');

  const point = (await pointResponse.json()) as NwsPointResponse;
  const zone = zoneIdFromUrl(point.properties?.forecastZone) ?? zoneIdFromUrl(point.properties?.county);
  if (!zone) return [];

  const alertsResponse = await fetch(`https://api.weather.gov/alerts/active?zone=${zone}`, {
    headers: {
      Accept: 'application/geo+json',
    },
  });

  if (!alertsResponse.ok) throw new Error('NWS alerts unavailable.');

  const alerts = (await alertsResponse.json()) as NwsAlertsResponse;
  return (alerts.features ?? []).map((feature, index) => ({
    id: feature.id ?? `nws-${index}`,
    event: feature.properties?.event ?? 'Weather alert',
    severity: feature.properties?.severity,
    headline: feature.properties?.headline,
  }));
};

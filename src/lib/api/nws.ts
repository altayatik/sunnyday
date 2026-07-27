import type { LocationResult, NwsAlert } from '../../types/weather';

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

export const fetchNwsAlerts = async (location: LocationResult): Promise<NwsAlert[]> => {
  const point = `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`;
  const alertsResponse = await fetch(`https://api.weather.gov/alerts/active?point=${point}`, {
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

type Condition = {
  label: string;
  icon: string;
};

const codeMap = (weatherCode: number | null): Condition => {
  if (weatherCode === null) return { label: 'Unknown', icon: 'cloud-sun' };

  if (weatherCode === 0) return { label: 'Clear sky', icon: 'sun' };
  if ([1, 2].includes(weatherCode)) return { label: 'Partly cloudy', icon: 'cloud-sun' };
  if (weatherCode === 3) return { label: 'Cloudy', icon: 'cloud' };
  if ([45, 48].includes(weatherCode)) return { label: 'Fog', icon: 'cloud-fog' };
  if ([51, 53, 55, 56, 57].includes(weatherCode)) return { label: 'Drizzle', icon: 'cloud-drizzle' };
  if ([61, 63, 65, 66, 67].includes(weatherCode)) return { label: 'Rain', icon: 'cloud-rain' };
  if ([80, 81, 82].includes(weatherCode)) return { label: 'Showers', icon: 'cloud-rain' };
  if ([95, 96, 99].includes(weatherCode)) return { label: 'Thunderstorms', icon: 'cloud-lightning' };
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) return { label: 'Snow', icon: 'cloud-snow' };

  return { label: 'Mixed precipitation', icon: 'cloud-hail' };
};

export const conditionFromWeather = (
  weatherCode: number | null,
  cloudCover: number | null,
  isDay: boolean | null,
): Condition => {
  const base = codeMap(weatherCode);

  if (weatherCode === 0 || weatherCode === 1 || weatherCode === 2 || weatherCode === 3) {
    if (cloudCover !== null) {
      if (cloudCover > 85) return { label: isDay === false ? 'Overcast night' : 'Overcast', icon: 'cloud' };
      if (cloudCover > 70) return { label: isDay === false ? 'Cloudy night' : 'Mostly cloudy', icon: 'cloud' };
      if (cloudCover >= 40) return { label: 'Partly cloudy', icon: isDay === false ? 'cloud-moon' : 'cloud-sun' };
      if (isDay === false) return { label: 'Clear night', icon: 'moon' };
      return { label: 'Mostly sunny', icon: 'sun' };
    }
  }

  if (isDay === false && base.label === 'Clear sky') return { label: 'Clear night', icon: 'moon' };

  return base;
};

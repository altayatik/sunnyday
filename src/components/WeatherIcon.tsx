import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react';

const icons: Record<string, LucideIcon> = {
  sun: Sun,
  moon: Moon,
  cloud: Cloud,
  'cloud-sun': CloudSun,
  'cloud-moon': CloudMoon,
  'cloud-fog': CloudFog,
  'cloud-drizzle': CloudDrizzle,
  'cloud-rain': CloudRain,
  'cloud-lightning': CloudLightning,
  'cloud-snow': CloudSnow,
  'cloud-hail': CloudHail,
};

type WeatherIconProps = {
  name: string;
  className?: string;
};

export function WeatherIcon({ name, className }: WeatherIconProps) {
  const Icon = icons[name] ?? CloudSun;
  return <Icon aria-hidden="true" className={className} strokeWidth={1.8} />;
}

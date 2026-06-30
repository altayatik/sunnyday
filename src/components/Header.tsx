import { CalendarDays, LocateFixed, Sparkles } from 'lucide-react';
import { SearchBar } from './SearchBar';
import { SourceStatus } from './SourceStatus';
import type { LocationResult, SunnyDaySources } from '../types/weather';

type HeaderProps = {
  sources: SunnyDaySources;
  onSelectLocation: (location: LocationResult) => void;
  onUseCurrentLocation: () => void;
  selectedDate: string;
  minDate: string;
  maxDate: string;
  onDateChange: (date: string) => void;
  isLocating: boolean;
};

export function Header({
  sources,
  onSelectLocation,
  onUseCurrentLocation,
  selectedDate,
  minDate,
  maxDate,
  onDateChange,
  isLocating,
}: HeaderProps) {
  return (
    <header className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <a className="focus-ring group flex items-center gap-3 rounded-lg text-left" href=".">
          <span className="grid size-10 place-items-center rounded-xl border border-white/35 bg-white/24 text-amber-100 shadow-lg shadow-white/10">
            <Sparkles aria-hidden="true" className="size-5" />
          </span>
          <span>
            <span className="block text-xl font-black text-white">SunnyDay</span>
            <span className="block text-xs font-medium text-white/68">Know if it’s actually a good outside day.</span>
          </span>
        </a>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center lg:w-[45rem]">
          <SearchBar onSelect={onSelectLocation} />
          <label className="focus-within:border-white/50 flex items-center justify-center gap-2 rounded-xl border border-white/22 bg-white/16 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition">
            <CalendarDays aria-hidden="true" className="size-4" />
            <span className="sr-only">Forecast date</span>
            <input
              type="date"
              className="w-[8.7rem] bg-transparent text-white [color-scheme:dark] focus:outline-none"
              value={selectedDate}
              min={minDate}
              max={maxDate}
              onChange={(event) => onDateChange(event.target.value)}
              onInput={(event) => onDateChange(event.currentTarget.value)}
              aria-label="Forecast date"
            />
          </label>
          <button
            type="button"
            className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-white/22 bg-white/16 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-white/24"
            onClick={onUseCurrentLocation}
            disabled={isLocating}
          >
            <LocateFixed aria-hidden="true" className={isLocating ? 'size-4 animate-pulse' : 'size-4'} />
            <span>{isLocating ? 'Locating' : 'Current'}</span>
          </button>
        </div>
      </div>
      <SourceStatus sources={sources} />
    </header>
  );
}

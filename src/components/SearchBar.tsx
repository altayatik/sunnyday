import { Loader2, MapPin, Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { searchLocations } from '../lib/api/geocoding';
import type { LocationResult } from '../types/weather';

type SearchBarProps = {
  onSelect: (location: LocationResult) => void;
};

const labelLocation = (location: LocationResult) =>
  [location.name, location.admin1, location.country].filter(Boolean).join(', ');

export function SearchBar({ onSelect }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const listId = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setIsOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    const handle = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const next = await searchLocations(trimmed);
        setResults(next);
        setIsOpen(true);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => window.clearTimeout(handle);
  }, [query]);

  const selectLocation = (location: LocationResult) => {
    onSelect(location);
    setQuery(labelLocation(location));
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative min-w-0 flex-1">
      <label className="sr-only" htmlFor="location-search">
        Search location
      </label>
      <div className="flex items-center gap-2 rounded-xl border border-white/22 bg-white/16 px-3 py-2.5 shadow-sm transition focus-within:border-white/55">
        <Search aria-hidden="true" className="size-4 shrink-0 text-white/75" />
        <input
          id="location-search"
          className="w-full min-w-0 bg-transparent text-sm text-white placeholder:text-white/58 focus:outline-none"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Search city or state"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          autoComplete="off"
        />
        {isSearching ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin text-white/75" />
        ) : query ? (
          <button
            type="button"
            className="focus-ring rounded-md p-1 text-white/55 transition hover:text-white"
            onClick={() => {
              setQuery('');
              setResults([]);
            }}
            aria-label="Clear search"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>

      {isOpen && results.length > 0 ? (
        <div
          id={listId}
          className="glass absolute left-0 right-0 top-[calc(100%+0.55rem)] z-30 overflow-hidden rounded-xl p-1 text-left"
          role="listbox"
        >
          {results.map((location) => (
            <button
              type="button"
              key={`${location.latitude}-${location.longitude}-${labelLocation(location)}`}
              className="focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-white/86 transition hover:bg-white/10"
              onClick={() => selectLocation(location)}
              role="option"
            >
              <MapPin aria-hidden="true" className="size-4 shrink-0 text-amber-200" />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{location.name}</span>
                <span className="block truncate text-xs text-white/52">
                  {[location.admin1, location.country].filter(Boolean).join(', ')}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

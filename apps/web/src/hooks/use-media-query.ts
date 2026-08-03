'use client';

import { useEffect, useState } from 'react';

/** Reactive media-query hook (e.g. `useMediaQuery('(min-width: 768px)')`). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const update = (): void => setMatches(mediaQueryList.matches);
    update();
    mediaQueryList.addEventListener('change', update);
    return () => mediaQueryList.removeEventListener('change', update);
  }, [query]);

  return matches;
}

'use client';

import { useEffect, useState } from 'react';

/**
 * True after the component has mounted on the client. Guards store values that
 * are hydrated from localStorage from causing SSR hydration mismatches.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}

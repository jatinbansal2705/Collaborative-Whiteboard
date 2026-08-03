'use client';

import { useEffect } from 'react';
import { authService } from '@/lib/api/services/auth-service';

/** Revalidate the persisted session once on mount (see `authService.init`). */
export function useAuthInit(): void {
  useEffect(() => {
    void authService.init();
  }, []);
}

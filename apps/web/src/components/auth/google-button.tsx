'use client';

import { Button } from '@/components/ui/button';
import { getApiBaseUrl } from '@/lib/api/http-client';

interface GoogleButtonProps {
  label?: string;
}

/**
 * Server-side Google OAuth button (see ADR-0011). Navigating the browser to
 * `GET /auth/google` starts the passport redirect flow; tokens never touch the
 * URL — the callback hands back a single-use code on `/auth/oauth/complete`.
 */
export function GoogleButton({
  label = 'Continue with Google',
}: GoogleButtonProps) {
  const href = `${getApiBaseUrl()}/auth/google`;

  return (
    <Button asChild variant="outline" className="w-full">
      <a href={href} aria-label={`${label} (Google)`}>
        <svg
          className="size-4"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            fill="#4285F4"
            d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.1 3.57-5.18 3.57-8.81z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3c-1.08.73-2.46 1.16-4.06 1.16-3.12 0-5.77-2.11-6.72-4.94H1.29v3.1A12 12 0 0 0 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.31a7.2 7.2 0 0 1 0-4.62v-3.1H1.29a12 12 0 0 0 0 10.82l3.99-3.1z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.29 6.59l3.99 3.1C6.23 6.86 8.88 4.75 12 4.75z"
          />
        </svg>
        {label}
      </a>
    </Button>
  );
}

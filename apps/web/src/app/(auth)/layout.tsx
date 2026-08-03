'use client';

import { RedirectAuthenticated } from '@/components/auth/route-guard';

/** Auth pages bounce already-authenticated visitors back to the dashboard. */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <RedirectAuthenticated>{children}</RedirectAuthenticated>;
}

'use client';

import { ThemeProvider } from 'next-themes';
import { useAuthInit } from '@/hooks/use-auth-init';

export function Providers({ children }: { children: React.ReactNode }) {
  useAuthInit();

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="whiteboard-theme"
    >
      {children}
    </ThemeProvider>
  );
}

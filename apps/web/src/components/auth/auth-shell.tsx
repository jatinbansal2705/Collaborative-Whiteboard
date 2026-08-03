'use client';

import { PenLine } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface AuthShellProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Centered card layout shared by every authentication page. */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-label="Collaborative Whiteboard home"
          >
            <PenLine className="size-5" aria-hidden="true" />
            <span className="font-semibold">Whiteboard</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{title}</CardTitle>
              {description ? (
                <CardDescription>{description}</CardDescription>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-6">{children}</CardContent>
          </Card>
          {footer ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {footer}
            </p>
          ) : null}
        </div>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6 text-sm text-muted-foreground">
          <span>Collaborative Whiteboard</span>
          <span>Secure realtime collaboration</span>
        </div>
      </footer>
    </div>
  );
}

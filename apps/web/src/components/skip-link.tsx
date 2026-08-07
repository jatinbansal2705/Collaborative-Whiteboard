'use client';

/** Keyboard-first skip link (WCAG 2.4.1) shown on first focus. */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only z-[100] rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
    >
      Skip to main content
    </a>
  );
}

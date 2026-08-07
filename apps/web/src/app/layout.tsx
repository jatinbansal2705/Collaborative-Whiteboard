import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import { SkipLink } from '@/components/skip-link';
import { Providers } from '@/app/providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Collaborative Whiteboard',
    template: '%s · Collaborative Whiteboard',
  },
  description:
    'A real-time collaborative whiteboard for distributed teams — drawing, sticky notes, comments, chat, and version history.',
  applicationName: 'Collaborative Whiteboard',
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  keywords: [
    'whiteboard',
    'collaboration',
    'realtime',
    'diagramming',
    'drawing',
  ],
  authors: [{ name: 'Collaborative Whiteboard' }],
  creator: 'Collaborative Whiteboard',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    type: 'website',
    url: appUrl,
    siteName: 'Collaborative Whiteboard',
    title: 'Collaborative Whiteboard',
    description: 'A real-time collaborative whiteboard for distributed teams.',
  },
  twitter: {
    card: 'summary',
    title: 'Collaborative Whiteboard',
    description: 'A real-time collaborative whiteboard for distributed teams.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          <SkipLink />
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}

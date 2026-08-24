import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Sweeper.lol — Minesweeper Company Bidding Game',
  description:
    'A real-time Minesweeper-style company bidding game where companies discover positions and compete through auctions to claim territory.',
  icons: {
    icon: [
      { url: '/99usd.ico', type: 'image/x-icon' },
      { url: '/favicon.ico', type: 'image/x-icon' },
    ],
    shortcut: '/99usd.ico',
    apple: '/99usd.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-neutral-950 text-neutral-100 min-h-screen antialiased selection:bg-amber-400 selection:text-black`}>
        <AuthProvider>{children}</AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

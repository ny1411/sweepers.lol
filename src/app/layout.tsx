import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://www.sweepers.lol'),
  title: 'Sweeper.lol — Minesweeper Company Bidding Game',
  description:
    'A real-time Minesweeper-style company bidding game where companies discover positions and compete through auctions to claim territory.',
  applicationName: 'Sweeper.lol',
  authors: [{ name: 'Sweeper.lol', url: 'https://www.sweepers.lol' }],
  creator: 'Sweeper.lol',
  publisher: 'Sweeper.lol',
  keywords: [
    'Sweeper.lol',
    'Minesweeper',
    'Minesweeper Bidding Game',
    'Multiplayer Minesweeper',
    'Startup Advertising',
    'Minesweeper Advertising',
    'Ad Grid',
    'Territory Auction',
    'Web Game',
    'Gamified Outbid.lol',
    'Outbid.lol Game',
    'Outbid.lol alternatives',
    'Outbid.lol for founders',
    'Outbid.lol for startups',
    'Outbid.lol for investors',
    'Outbid.lol for VC',
    'Outbid.lol vs outbid.io'
  ],
  alternates: {
    canonical: 'https://www.sweepers.lol/',
  },
  openGraph: {
    title: 'Sweeper.lol — Multiplayer Minesweeper Bidding Game',
    description:
      'A real-time multiplayer Minesweeper-style bidding game where companies discover positions and compete through auctions to claim territory.',
    url: 'https://www.sweepers.lol/',
    siteName: 'Sweeper.lol',
    images: [
      {
        url: '/banner_image.png',
        width: 1200,
        height: 630,
        alt: 'Sweeper.lol — Minesweeper Bidding Game',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sweeper.lol — Minesweeper Bidding Game',
    description:
      'A real-time Minesweeper-style bidding game where companies discover positions and compete through auctions to claim territory.',
    images: ['/banner_image.png'],
  },
  icons: {
    icon: [
      { url: '/99usd.ico', type: 'image/x-icon' },
      { url: '/favicon.ico', type: 'image/x-icon' },
    ],
    shortcut: '/99usd.ico',
    apple: '/99usd.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  other: {
    'itemprop:name': 'Sweeper.lol — Minesweeper Company Bidding Game',
    'itemprop:description':
      'A real-time Minesweeper-style company bidding game where companies discover positions and compete through auctions to claim territory.',
    'itemprop:image': 'https://www.sweepers.lol/banner_image.png',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Sweeper.lol',
  url: 'https://www.sweepers.lol',
  description:
    'A real-time Minesweeper-style company bidding game where companies discover positions and compete through auctions to claim territory.',
  applicationCategory: 'GameApplication',
  operatingSystem: 'All',
  image: 'https://www.sweepers.lol/banner_image.png',
  offers: {
    '@type': 'Offer',
    price: '1.00',
    priceCurrency: 'USD',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.className} bg-neutral-950 text-neutral-100 min-h-screen antialiased selection:bg-amber-400 selection:text-black`}>
        <AuthProvider>{children}</AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

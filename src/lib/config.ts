// Centralized game configuration and defaults
export const GAME_CONFIG = {
  APP_NAME: 'Sweeper.lol',
  DEFAULT_BOARD_NAME: 'Main Arena',
  DEFAULT_ROWS: 10,
  DEFAULT_COLUMNS: 10,
  REVEAL_RADIUS: 1, // 3x3 surrounding
  REVEAL_DIAGONALS: true,
  AUTO_REVEAL_EMPTY: true,
  MINIMUM_BID_INCREMENT: 1.0,
  SPECIAL_LOCK_DURATION_HOURS: 168, // 7 days (7 * 24h)
  BASE_VALUES: {
    '0': 1.0,
    '1': 1.0,
    '2': 2.0,
    '3': 3.0,
    '4': 4.0,
    '5': 5.0,
    '6': 6.0,
    '7': 7.0,
    '8': 8.0,
    'SPECIAL': 99.0,
    'MINE': 10.0,
  } as const,
  POSITION_COLORS: {
    '0': {
      text: '#71717a',
      tailwind: 'text-neutral-500 dark:text-neutral-400',
      bg: 'bg-neutral-100 dark:bg-neutral-900/40',
      border: 'border-neutral-400',
    },
    '1': {
      text: '#0000ff', // Classic vibrant Minesweeper blue
      tailwind: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      border: 'border-blue-500',
    },
    '2': {
      text: '#008000', // Classic vibrant Minesweeper green
      tailwind: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-500',
    },
    '3': {
      text: '#ff0000', // Classic vibrant Minesweeper red
      tailwind: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-950/40',
      border: 'border-red-500',
    },
    '4': {
      text: '#000080', // Classic Navy
      tailwind: 'text-indigo-700 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
      border: 'border-indigo-500',
    },
    '5': {
      text: '#800000', // Classic Maroon
      tailwind: 'text-rose-800 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      border: 'border-rose-500',
    },
    '6': {
      text: '#008080', // Classic Teal
      tailwind: 'text-teal-600 dark:text-teal-400',
      bg: 'bg-teal-50 dark:bg-teal-950/40',
      border: 'border-teal-500',
    },
    '7': {
      text: '#000000', // Classic Black
      tailwind: 'text-black dark:text-neutral-200',
      bg: 'bg-neutral-100 dark:bg-neutral-900',
      border: 'border-neutral-900',
    },
    '8': {
      text: '#808080', // Classic Gray
      tailwind: 'text-gray-500 dark:text-gray-400',
      bg: 'bg-gray-100 dark:bg-gray-900',
      border: 'border-gray-500',
    },
    'SPECIAL': {
      text: '#eab308', // Glowing gold
      tailwind: 'text-amber-500 dark:text-amber-400',
      bg: 'bg-amber-100 dark:bg-amber-950/60',
      border: 'border-amber-500',
    },
    'MINE': {
      text: '#ef4444',
      tailwind: 'text-red-500 dark:text-red-400',
      bg: 'bg-red-100 dark:bg-red-950/80',
      border: 'border-red-600',
    },
  },
};

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatTimeRemaining(lockUntil: string | Date): {
  formatted: string;
  isExpired: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const target = new Date(lockUntil).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) {
    return {
      formatted: 'Expired',
      isExpired: true,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  let formatted = '';
  if (days > 0) formatted += `${days}d `;
  if (hours > 0 || days > 0) formatted += `${hours}h `;
  formatted += `${minutes}m ${seconds}s`;

  return {
    formatted: formatted.trim(),
    isExpired: false,
    days,
    hours,
    minutes,
    seconds,
  };
}

export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/**
 * Normalizes user-submitted website input by trimming and ensuring https:// protocol.
 */
export function normalizeWebsiteUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Formats an external website URL to ensure it has a valid protocol (https://)
 * and appends ?utm_source=sweepers.lol for marketing & attribution analytics.
 *
 * Examples:
 * - "apple.com" -> "https://apple.com/?utm_source=sweepers.lol"
 * - "https://google.com" -> "https://google.com/?utm_source=sweepers.lol"
 * - "https://site.org/demo?test=1" -> "https://site.org/demo?test=1&utm_source=sweepers.lol"
 */
export function formatExternalUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withScheme);
    parsed.searchParams.set('utm_source', 'sweepers.lol');
    return parsed.toString();
  } catch {
    const [baseAndQuery, hash] = withScheme.split('#');
    const separator = baseAndQuery.includes('?') ? '&' : '?';
    const utmAdded = `${baseAndQuery}${separator}utm_source=sweepers.lol`;
    return hash ? `${utmAdded}#${hash}` : utmAdded;
  }
}

/**
 * Returns a clean, human-readable display string of a URL for badges and UI labels.
 * Strips http://, https://, www., trailing slash, and search/hash parameters.
 */
export function getDisplayUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withScheme);
    const domain = parsed.hostname.replace(/^www\./i, '');
    const pathname = parsed.pathname !== '/' ? parsed.pathname : '';
    return `${domain}${pathname}`.replace(/\/$/, '');
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('?')[0]
      .split('#')[0]
      .replace(/\/$/, '');
  }
}


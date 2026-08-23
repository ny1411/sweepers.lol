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
    '1': 1.0,
    '2': 3.0,
    '3': 5.0,
    'SPECIAL': 99.0,
  } as const,
  POSITION_COLORS: {
    '1': {
      text: '#0026ff', // Classic vibrant Minesweeper blue
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
    'SPECIAL': {
      text: '#eab308', // Glowing gold
      tailwind: 'text-amber-500 dark:text-amber-400',
      bg: 'bg-amber-100 dark:bg-amber-950/60',
      border: 'border-amber-500',
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

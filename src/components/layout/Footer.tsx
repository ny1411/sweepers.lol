import React from 'react';
import { Shield, Sparkles, Terminal } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-neutral-800/80 bg-neutral-950/80 py-6 mt-12 text-neutral-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-[11px] text-neutral-300">
            Realtime Auction Engine v2.0 • Supabase Verified
          </span>
        </div>

        <div className="flex items-center gap-4 text-[11px] text-neutral-400">
          <span>Base Values: $1, $3, $5</span>
          <span>•</span>
          <span className="text-amber-400 font-semibold">Special: $99 (7-Day Lock)</span>
          <span>•</span>
          <span>Min Increment: $1.00</span>
        </div>
      </div>
    </footer>
  );
};

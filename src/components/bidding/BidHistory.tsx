'use client';

import React from 'react';
import { Bid } from '@/types/game';
import { formatCurrency, formatRelativeTime } from '@/lib/config';
import { Trophy, History } from 'lucide-react';
import Image from 'next/image';

interface BidHistoryProps {
  bids: Bid[];
}

export const BidHistory: React.FC<BidHistoryProps> = ({ bids }) => {
  if (bids.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-neutral-400 bg-neutral-900/50 rounded-lg border border-neutral-800">
        <History className="w-4 h-4 mx-auto mb-1.5 opacity-50" />
        No bids placed on this position yet. Be the first to claim it!
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
      {bids.map((bid, index) => {
        const isWinning = index === 0;
        return (
          <div
            key={bid.id}
            className={`p-2.5 rounded-lg flex items-center justify-between border transition-all ${
              isWinning
                ? 'bg-amber-950/30 border-amber-500/50 shadow-xs'
                : 'bg-neutral-900/60 border-neutral-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {isWinning && (
                <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
              {bid.company?.logo_url ? (
                <div className="w-5 h-5 relative shrink-0 flex items-center justify-center">
                  <Image
                    src={bid.company.logo_url}
                    alt={bid.company.name}
                    width={20}
                    height={20}
                    className="max-h-full max-w-full object-contain"
                    unoptimized
                  />
                </div>
              ) : (
                <div
                  className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: bid.company?.brand_color || '#3b82f6' }}
                >
                  {bid.company?.name?.[0] || 'C'}
                </div>
              )}
              <div>
                <div className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                  <span>{bid.company?.name || 'Unknown Company'}</span>
                  {isWinning && (
                    <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded-sm uppercase tracking-wider font-bold">
                      Winner
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-neutral-400">
                  {formatRelativeTime(bid.created_at)}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div
                className={`font-mono font-bold text-sm ${
                  isWinning ? 'text-amber-400' : 'text-neutral-300'
                }`}
              >
                {formatCurrency(bid.amount)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

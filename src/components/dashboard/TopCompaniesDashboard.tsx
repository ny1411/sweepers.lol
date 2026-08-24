'use client';

import React, { useEffect, useState } from 'react';
import { LeaderboardEntry } from '@/types/game';
import { gameEngine } from '@/lib/game/engine';
import { formatCurrency } from '@/lib/config';
import { Trophy, Crown, ExternalLink, Globe, Sparkles, TrendingUp } from 'lucide-react';
import Image from 'next/image';

interface TopCompaniesDashboardProps {
  onCompanyClick?: (companyId: string) => void;
}

interface PodiumItem {
  entry: LeaderboardEntry;
  rank: number;
  mobileOrderClass: string;
  desktopOrderClass: string;
}

export const TopCompaniesDashboard: React.FC<TopCompaniesDashboardProps> = ({
  onCompanyClick,
}) => {
  const [topCompanies, setTopCompanies] = useState<LeaderboardEntry[]>([]);

  const refreshTopCompanies = () => {
    const top = gameEngine.getTopCompanies(3);
    setTopCompanies(top);
  };

  useEffect(() => {
    refreshTopCompanies();
    const unsubscribe = gameEngine.subscribe(() => {
      refreshTopCompanies();
    });
    return () => unsubscribe();
  }, []);

  // Arrange companies in Olympic podium layout:
  // If 3 companies: 2nd on Left (Rank 2), 1st in Center (Rank 1), 3rd on Right (Rank 3)
  // If 2 companies: 2nd on Left (Rank 2), 1st on Right/Center (Rank 1)
  // If 1 company: 1st centered (Rank 1)
  const getPodiumList = (): PodiumItem[] => {
    if (topCompanies.length === 0) return [];
    if (topCompanies.length === 1) {
      return [
        {
          entry: topCompanies[0],
          rank: 1,
          mobileOrderClass: 'order-1',
          desktopOrderClass: 'sm:order-1',
        },
      ];
    }
    if (topCompanies.length === 2) {
      return [
        {
          entry: topCompanies[1],
          rank: 2,
          mobileOrderClass: 'order-2',
          desktopOrderClass: 'sm:order-1',
        },
        {
          entry: topCompanies[0],
          rank: 1,
          mobileOrderClass: 'order-1',
          desktopOrderClass: 'sm:order-2',
        },
      ];
    }
    // 3 companies: Rank 2 (Left), Rank 1 (Center), Rank 3 (Right)
    return [
      {
        entry: topCompanies[1],
        rank: 2,
        mobileOrderClass: 'order-2',
        desktopOrderClass: 'sm:order-1',
      },
      {
        entry: topCompanies[0],
        rank: 1,
        mobileOrderClass: 'order-1',
        desktopOrderClass: 'sm:order-2',
      },
      {
        entry: topCompanies[2],
        rank: 3,
        mobileOrderClass: 'order-3',
        desktopOrderClass: 'sm:order-3',
      },
    ];
  };

  const podiumItems = getPodiumList();

  return (
    <div className="w-full max-w-3xl mx-auto mb-4 flex flex-col items-center">
      {/* Dashboard Section Title */}
      <div className="w-full flex items-center justify-between mb-2.5 px-1">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Trophy className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>Top 3 Highest Bidders</span>
              <span className="text-[9px] font-mono font-bold bg-amber-400/20 text-amber-300 px-1.5 py-0.2 rounded-full border border-amber-400/30">
                LIVE
              </span>
            </h2>
          </div>
        </div>

        <div className="text-[10px] text-neutral-400 font-mono hidden sm:flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5 text-amber-400" />
          <span>Top bids claim premium grid visibility</span>
        </div>
      </div>

      {/* Top 3 Cards Centered Podium Container */}
      {podiumItems.length === 0 ? (
        <div className="w-full bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 text-center shadow-lg">
          <TrendingUp className="w-6 h-6 text-neutral-600 mx-auto mb-1.5" />
          <p className="text-xs font-bold text-neutral-300">No active bids placed yet.</p>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            Click any block on the board below to place the first bid and claim the #1 spot!
          </p>
        </div>
      ) : (
        <div className="w-full flex flex-col sm:flex-row justify-center items-stretch gap-2.5 sm:gap-3">
          {podiumItems.map(({ entry, rank, mobileOrderClass, desktopOrderClass }) => {
            const isFirst = rank === 1;
            const isSecond = rank === 2;
            const isThird = rank === 3;

            return (
              <div
                key={entry.company.id}
                onClick={() => onCompanyClick && onCompanyClick(entry.company.id)}
                className={`relative rounded-xl p-3 border transition-all duration-200 flex flex-col justify-between items-center text-center overflow-hidden shadow-md group cursor-pointer ${mobileOrderClass} ${desktopOrderClass} ${
                  podiumItems.length === 1
                    ? 'w-full max-w-[280px]'
                    : podiumItems.length === 2
                    ? 'w-full sm:w-1/2 max-w-[250px]'
                    : 'w-full sm:flex-1 max-w-[230px]'
                } ${
                  isFirst
                    ? 'bg-linear-to-b from-amber-950/40 via-neutral-900 to-neutral-900 border-amber-500/70 shadow-amber-500/10 sm:-mt-1 sm:scale-[1.02] z-10'
                    : isSecond
                    ? 'bg-linear-to-b from-slate-900/60 via-neutral-900 to-neutral-900 border-slate-400/40 shadow-slate-500/5 z-0'
                    : 'bg-linear-to-b from-amber-950/20 via-neutral-900 to-neutral-900 border-amber-700/40 shadow-amber-700/5 z-0'
                }`}
              >
                {/* Subtle Ambient Glow */}
                <div
                  className="absolute -top-10 left-1/2 -translate-x-1/2 w-28 h-28 rounded-full blur-xl opacity-20 pointer-events-none"
                  style={{ backgroundColor: entry.company.brand_color || '#f59e0b' }}
                />

                {/* Top Section: Rank Badge & Highest Bid Tag */}
                <div className="w-full flex items-center justify-between mb-2 relative z-10">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[11px] shadow-sm ${
                      isFirst
                        ? 'bg-amber-400 text-neutral-950 ring-2 ring-amber-300'
                        : isSecond
                        ? 'bg-slate-300 text-neutral-950 ring-1 ring-slate-200'
                        : 'bg-amber-700 text-white ring-1 ring-amber-600'
                    }`}
                  >
                    #{rank}
                  </div>

                  {isFirst ? (
                    <span className="text-[9px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full">
                      <Crown className="w-2.5 h-2.5 fill-amber-400 animate-pulse" /> Highest Bid
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                      {isSecond ? '2nd Highest' : '3rd Highest'}
                    </span>
                  )}
                </div>

                {/* Center Section: Centered Logo, Name & Link */}
                <div className="w-full flex flex-col items-center text-center relative z-10 my-0.5">
                  {/* Company Avatar / Logo */}
                  {entry.company.logo_url ? (
                    <div className="w-9 h-9 relative bg-neutral-800/90 border border-neutral-700 rounded-xl p-1 flex items-center justify-center mb-1.5 shadow-inner group-hover:scale-105 transition-transform">
                      <Image
                        src={entry.company.logo_url}
                        alt={entry.company.name}
                        width={28}
                        height={28}
                        className="max-h-full max-w-full object-contain"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white mb-1.5 shadow-sm group-hover:scale-105 transition-transform"
                      style={{ backgroundColor: entry.company.brand_color || '#3b82f6' }}
                    >
                      {entry.company.name[0]}
                    </div>
                  )}

                  {/* Company Name */}
                  <h3 className="font-extrabold text-xs sm:text-sm text-white truncate max-w-full group-hover:text-amber-300 transition-colors">
                    {entry.company.name}
                  </h3>

                  {/* Website Link */}
                  {entry.company.website ? (
                    <a
                      href={entry.company.website}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] text-blue-400 hover:text-blue-300 hover:underline flex items-center justify-center gap-1 truncate max-w-full mt-0.5"
                      title={entry.company.website}
                    >
                      <Globe className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">
                        {entry.company.website.replace(/^https?:\/\//, '')}
                      </span>
                      <ExternalLink className="w-2 h-2 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-[10px] text-neutral-500 mt-0.5">No website</span>
                  )}
                </div>

                {/* Bottom Section: Centered Bid Amount */}
                <div className="w-full mt-2 py-1 px-2 bg-neutral-950/70 rounded-lg border border-neutral-800/80 flex items-center justify-center gap-1.5 relative z-10">
                  <span className="text-[9px] uppercase font-bold text-neutral-400">Bid:</span>
                  <span className="text-sm sm:text-base font-mono font-black text-amber-400">
                    {formatCurrency(entry.highestBid)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


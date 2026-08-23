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

  return (
    <div className="w-full max-w-4xl mx-auto mb-6">
      {/* Dashboard Section Title */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
              <span>Top 3 Highest Bidders</span>
              <span className="text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30">
                LIVE LEADERBOARD
              </span>
            </h2>
          </div>
        </div>

        <div className="text-[11px] text-neutral-400 font-mono hidden sm:flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Top bids claim premium grid visibility</span>
        </div>
      </div>

      {/* Top 3 Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {topCompanies.length === 0 ? (
          <div className="col-span-3 bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 text-center">
            <TrendingUp className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
            <p className="text-sm font-bold text-neutral-300">No active bids placed yet.</p>
            <p className="text-xs text-neutral-500 mt-1">
              Click any block on the board below to place the first bid and claim the #1 spot!
            </p>
          </div>
        ) : (
          topCompanies.map((entry, idx) => {
            const rank = idx + 1;
            const isFirst = rank === 1;
            const isSecond = rank === 2;
            const isThird = rank === 3;

            return (
              <div
                key={entry.company.id}
                onClick={() => onCompanyClick && onCompanyClick(entry.company.id)}
                className={`relative rounded-2xl p-4 border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-xl group ${
                  isFirst
                    ? 'bg-linear-to-b from-amber-950/40 via-neutral-900 to-neutral-900 border-amber-500/60 shadow-amber-500/10'
                    : isSecond
                    ? 'bg-linear-to-b from-slate-900/60 via-neutral-900 to-neutral-900 border-slate-400/40 shadow-slate-500/5'
                    : 'bg-linear-to-b from-amber-950/20 via-neutral-900 to-neutral-900 border-amber-700/40 shadow-amber-700/5'
                }`}
              >
                {/* Subtle Ambient Glow */}
                <div
                  className="absolute -top-12 -right-12 w-28 h-28 rounded-full blur-2xl opacity-20 pointer-events-none"
                  style={{ backgroundColor: entry.company.brand_color || '#f59e0b' }}
                />

                {/* Top Row: Rank Badge & Highest Bid */}
                <div>
                  <div className="flex items-center justify-between mb-3 relative z-10">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shadow-md ${
                          isFirst
                            ? 'bg-amber-400 text-neutral-950 ring-2 ring-amber-300'
                            : isSecond
                            ? 'bg-slate-300 text-neutral-950 ring-2 ring-slate-200'
                            : 'bg-amber-700 text-white ring-2 ring-amber-600'
                        }`}
                      >
                        #{rank}
                      </div>

                      {isFirst && (
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                          <Crown className="w-3 h-3 fill-amber-400 animate-pulse" /> Leader
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] uppercase font-bold text-neutral-400 block leading-tight">
                        Highest Bid
                      </span>
                      <span className="text-base sm:text-lg font-mono font-black text-amber-400 leading-none">
                        {formatCurrency(entry.highestBid)}
                      </span>
                    </div>
                  </div>

                  {/* Company Details */}
                  <div className="flex items-start gap-3 relative z-10 mb-2.5">
                    {/* Company Avatar / Logo */}
                    {entry.company.logo_url ? (
                      <div className="w-10 h-10 relative bg-neutral-800/80 border border-neutral-700/80 rounded-xl p-1.5 flex items-center justify-center shrink-0 shadow-inner">
                        <Image
                          src={entry.company.logo_url}
                          alt={entry.company.name}
                          width={32}
                          height={32}
                          className="max-h-full max-w-full object-contain"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0 shadow-md"
                        style={{ backgroundColor: entry.company.brand_color || '#3b82f6' }}
                      >
                        {entry.company.name[0]}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <h3 className="font-extrabold text-sm sm:text-base text-white truncate group-hover:text-amber-300 transition-colors">
                        {entry.company.name}
                      </h3>

                      {entry.company.website ? (
                        <a
                          href={entry.company.website}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 truncate mt-0.5"
                          title={entry.company.website}
                        >
                          <Globe className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">
                            {entry.company.website.replace(/^https?:\/\//, '')}
                          </span>
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-neutral-500">No website</span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-neutral-300 line-clamp-2 leading-relaxed mb-3 relative z-10 bg-neutral-950/40 p-2 rounded-lg border border-neutral-800/60">
                    {entry.company.description || 'Competing across live grid territory.'}
                  </p>
                </div>

                {/* Bottom Stats Footer */}
                <div className="pt-2.5 border-t border-neutral-800/80 flex items-center justify-between text-[11px] relative z-10">
                  <span className="text-neutral-400">
                    Territory:{' '}
                    <strong className="text-emerald-400 font-mono">
                      {entry.territoryCount} {entry.territoryCount === 1 ? 'cell' : 'cells'}
                    </strong>
                  </span>
                  <span className="text-neutral-400 font-mono">
                    Total: <strong className="text-amber-400">{formatCurrency(entry.totalValuation)}</strong>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

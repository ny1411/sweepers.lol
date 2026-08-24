'use client';

import React, { useEffect, useState } from 'react';
import { LeaderboardEntry, BoardCell } from '@/types/game';
import { gameEngine } from '@/lib/game/engine';
import { formatCurrency } from '@/lib/config';
import { Trophy, Crown, Building2, TrendingUp, Layers, Award } from 'lucide-react';
import Image from 'next/image';

interface LeaderboardViewProps {
  onSelectCompanyPositions?: (companyId: string) => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  onSelectCompanyPositions,
}) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const update = () => {
      setEntries(gameEngine.getLeaderboard());
    };
    update();
    const unsubscribe = gameEngine.subscribe(() => update());
    return () => unsubscribe();
  }, []);

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Title */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
          <Trophy className="w-3.5 h-3.5" />
          <span>Global Territory Rankings</span>
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">
          Company Leaderboard
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Top corporations competing for grid dominance and high-value strategic positions.
        </p>
      </div>

      {/* Podium Cards (Top 3) */}
      {(() => {
        const top3 = entries.slice(0, 3);
        if (top3.length === 0) return null;

        interface PodiumRankItem {
          entry: LeaderboardEntry;
          rank: number;
          mobileOrderClass: string;
          desktopOrderClass: string;
        }

        let podium: PodiumRankItem[] = [];
        if (top3.length === 1) {
          podium = [
            { entry: top3[0], rank: 1, mobileOrderClass: 'order-1', desktopOrderClass: 'md:order-1' },
          ];
        } else if (top3.length === 2) {
          podium = [
            { entry: top3[1], rank: 2, mobileOrderClass: 'order-2', desktopOrderClass: 'md:order-1' },
            { entry: top3[0], rank: 1, mobileOrderClass: 'order-1', desktopOrderClass: 'md:order-2' },
          ];
        } else {
          podium = [
            { entry: top3[1], rank: 2, mobileOrderClass: 'order-2', desktopOrderClass: 'md:order-1' },
            { entry: top3[0], rank: 1, mobileOrderClass: 'order-1', desktopOrderClass: 'md:order-2' },
            { entry: top3[2], rank: 3, mobileOrderClass: 'order-3', desktopOrderClass: 'md:order-3' },
          ];
        }

        return (
          <div className="flex flex-col md:flex-row justify-center items-stretch gap-4 pt-4 w-full">
            {podium.map(({ entry, rank, mobileOrderClass, desktopOrderClass }) => {
              const isFirst = rank === 1;
              const isSecond = rank === 2;

              return (
                <div
                  key={entry.company.id}
                  onClick={() => onSelectCompanyPositions && onSelectCompanyPositions(entry.company.id)}
                  className={`relative bg-neutral-900 rounded-2xl p-5 border flex flex-col items-center text-center shadow-xl transition-all hover:-translate-y-1 cursor-pointer ${mobileOrderClass} ${desktopOrderClass} ${
                    podium.length === 1
                      ? 'w-full max-w-sm'
                      : podium.length === 2
                      ? 'w-full md:w-1/2 max-w-sm'
                      : 'w-full md:flex-1 max-w-sm'
                  } ${
                    isFirst
                      ? 'border-amber-500/70 bg-linear-to-b from-amber-950/40 via-neutral-900 to-neutral-900 md:-mt-3 shadow-amber-500/10 z-10'
                      : isSecond
                      ? 'border-slate-400/40 z-0'
                      : 'border-amber-700/40 z-0'
                  }`}
                >
                  {/* Rank Badge */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm mb-3 shadow-md ${
                      isFirst
                        ? 'bg-amber-400 text-neutral-950 ring-4 ring-amber-400/20'
                        : isSecond
                        ? 'bg-slate-300 text-neutral-950 ring-2 ring-slate-200'
                        : 'bg-amber-700 text-white ring-2 ring-amber-600'
                    }`}
                  >
                    #{rank}
                  </div>

                  {/* Logo */}
                  <div className="w-14 h-14 relative bg-white/5 border border-white/10 rounded-2xl p-2.5 flex items-center justify-center mb-3 shadow-inner">
                    {entry.company.logo_url ? (
                      <Image
                        src={entry.company.logo_url}
                        alt={entry.company.name}
                        width={40}
                        height={40}
                        className="max-h-full max-w-full object-contain"
                        unoptimized
                      />
                    ) : (
                      <span className="font-bold text-lg text-white">
                        {entry.company.name[0]}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-white text-base flex items-center gap-1.5">
                    <span>{entry.company.name}</span>
                    {entry.isSpecialOwner && (
                      <Crown className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
                    )}
                  </h3>

                  {/* Highest Bid Pill */}
                  <div className="w-full my-2.5 py-1.5 px-3 bg-neutral-950/60 rounded-xl border border-neutral-800 flex flex-col items-center justify-center">
                    <span className="text-[9px] uppercase font-bold text-neutral-400">
                      Highest Bid
                    </span>
                    <span className="text-sm sm:text-base font-mono font-bold text-amber-400">
                      {formatCurrency(entry.highestBid)}
                    </span>
                  </div>

                  <div className="w-full grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-neutral-800 text-xs">
                    <div className="bg-neutral-800/40 p-2 rounded-xl">
                      <span className="text-[10px] text-neutral-400 block uppercase font-bold">
                        Territory
                      </span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        {entry.territoryCount} cells
                      </span>
                    </div>
                    <div className="bg-neutral-800/40 p-2 rounded-xl">
                      <span className="text-[10px] text-neutral-400 block uppercase font-bold">
                        Valuation
                      </span>
                      <span className="font-mono font-bold text-amber-400 text-sm">
                        {formatCurrency(entry.totalValuation)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Full Rankings Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-neutral-800 bg-neutral-800/30 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
            Corporation Standings
          </span>
          <span className="text-xs text-neutral-500 font-mono">
            {entries.length} active companies
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-800/50 text-neutral-400 uppercase tracking-wider text-[10px] border-b border-neutral-800">
              <tr>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Company</th>
                <th className="py-3 px-4 text-center">Positions Owned</th>
                <th className="py-3 px-4 text-right">Total Valuation</th>
                <th className="py-3 px-4 text-right">Highest Bid</th>
                <th className="py-3 px-4 text-center">Special Position</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-medium">
              {entries.map((entry, idx) => (
                <tr
                  key={entry.company.id}
                  className="hover:bg-neutral-800/40 transition-colors"
                >
                  <td className="py-3.5 px-4 font-mono font-bold text-neutral-400">
                    #{idx + 1}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      {entry.company.logo_url ? (
                        <div className="w-6 h-6 relative shrink-0 flex items-center justify-center">
                          <Image
                            src={entry.company.logo_url}
                            alt={entry.company.name}
                            width={24}
                            height={24}
                            className="max-h-full max-w-full object-contain"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div
                          className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ backgroundColor: entry.company.brand_color }}
                        >
                          {entry.company.name[0]}
                        </div>
                      )}
                      <span className="font-bold text-white">{entry.company.name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-400">
                    {entry.territoryCount}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-400">
                    {formatCurrency(entry.totalValuation)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-neutral-300">
                    {formatCurrency(entry.highestBid)}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {entry.isSpecialOwner ? (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                        <Crown className="w-3 h-3 text-amber-400" /> $99 Holder
                      </span>
                    ) : (
                      <span className="text-neutral-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { BoardCell, GameNotification } from '@/types/game';
import { gameEngine, DEFAULT_BOARD } from '@/lib/game/engine';
import { formatCurrency, formatRelativeTime, formatExternalUrl, getDisplayUrl } from '@/lib/config';
import {
  Building2,
  Trophy,
  TrendingUp,
  Bell,
  CheckCircle,
  ExternalLink,
  ShieldCheck,
  Zap,
  ArrowRight,
  Globe,
} from 'lucide-react';
import Image from 'next/image';
import special99Img from '@/app/99usd.png';

interface DashboardViewProps {
  onSelectPosition: (cell: BoardCell) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onSelectPosition }) => {
  const { currentCompany, currentUser } = useAuth();
  const [positions, setPositions] = useState<BoardCell[]>([]);
  const [notifications, setNotifications] = useState<GameNotification[]>([]);

  const refreshData = () => {
    if (!currentCompany) return;
    const myPositions = gameEngine.getCompanyPositions(currentCompany.id);
    setPositions(myPositions);
    const notifs = gameEngine.getNotifications(currentCompany.id);
    setNotifications(notifs);
  };

  useEffect(() => {
    refreshData();
    const unsubscribe = gameEngine.subscribe(() => {
      refreshData();
    });
    return () => unsubscribe();
  }, [currentCompany]);

  if (!currentCompany) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center bg-neutral-900 border border-neutral-800 rounded-2xl">
        <Building2 className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">No Company Profile Selected</h3>
        <p className="text-sm text-neutral-400">
          Please choose or register a company to view portfolio territory and activity.
        </p>
      </div>
    );
  }

  const totalValue = positions.reduce((acc, p) => acc + (p.current_bid || 0), 0);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAllRead = () => {
    gameEngine.markAllNotificationsAsRead(currentCompany.id);
    setNotifications(gameEngine.getNotifications(currentCompany.id));
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6 animate-in fade-in duration-200">
      {/* 1. COMPANY HEADER CARD */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-10 pointer-events-none"
          style={{ backgroundColor: currentCompany.brand_color || '#3b82f6' }}
        />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            {currentCompany.logo_url ? (
              <div className="w-16 h-16 relative bg-white/5 border border-white/10 rounded-2xl p-2 flex items-center justify-center shrink-0 shadow-inner">
                <Image
                  src={currentCompany.logo_url}
                  alt={currentCompany.name}
                  width={48}
                  height={48}
                  className="max-h-full max-w-full object-contain"
                  unoptimized
                />
              </div>
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shrink-0 shadow-lg"
                style={{ backgroundColor: currentCompany.brand_color || '#3b82f6' }}
              >
                {currentCompany.name[0]}
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-white tracking-tight">
                  {currentCompany.name}
                </h1>
                <span className="text-[10px] bg-blue-500/20 text-blue-400 font-bold px-2 py-0.5 rounded-full border border-blue-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Active Bidder
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-1 max-w-lg">
                {currentCompany.description || 'Competing across live grid auctions.'}
              </p>
              {currentCompany.website && (
                <a
                  href={formatExternalUrl(currentCompany.website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 mt-1.5"
                  title={formatExternalUrl(currentCompany.website)}
                >
                  <Globe className="w-3 h-3 shrink-0" />
                  <span>{getDisplayUrl(currentCompany.website)}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              )}
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex-1 md:flex-initial bg-neutral-800/60 border border-neutral-700/60 p-3.5 rounded-xl min-w-[110px]">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block mb-1">
                Territory Owned
              </span>
              <span className="text-xl font-mono font-black text-emerald-400">
                {positions.length} cells
              </span>
            </div>

            <div className="flex-1 md:flex-initial bg-neutral-800/60 border border-neutral-700/60 p-3.5 rounded-xl min-w-[130px]">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block mb-1">
                Portfolio Valuation
              </span>
              <span className="text-xl font-mono font-black text-amber-400">
                {formatCurrency(totalValue)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. GRID: MY POSITIONS & ACTIVITY INBOX */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: My Positions */}
        <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Claimed Territory ({positions.length})
              </h2>
            </div>
          </div>

          {positions.length === 0 ? (
            <div className="p-8 text-center bg-neutral-800/20 border border-dashed border-neutral-800 rounded-xl">
              <Zap className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-neutral-300">
                No active positions owned yet.
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Explore the board and place bids on available tiles to claim territory!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
              {positions.map((cell) => (
                <div
                  key={cell.id}
                  onClick={() => onSelectPosition(cell)}
                  className="bg-neutral-800/40 border border-neutral-800 hover:border-neutral-700 p-3.5 rounded-xl cursor-pointer transition-all flex flex-col justify-between group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white text-sm">
                        Position #{cell.position_index}
                      </span>
                      {cell.is_special && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.2 rounded-xs uppercase flex items-center gap-1">
                          <Image
                            src={special99Img}
                            alt="$99"
                            width={12}
                            height={12}
                            className="w-3 h-3 object-contain"
                          />
                          Special $99
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      ${cell.current_bid}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-neutral-400 pt-2 border-t border-neutral-800/60">
                    <span>Base: ${cell.base_value}</span>
                    <span className="text-blue-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-semibold text-[11px]">
                      View / Defend <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Col: Live Notifications Feed */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Live Alerts
              </h2>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-neutral-400 hover:text-neutral-200 underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2.5 max-h-[420px] overflow-y-auto pr-1">
            {notifications.length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-6">
                No activity alerts yet.
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 rounded-xl border transition-all text-xs ${
                    n.type === 'outbid'
                      ? 'bg-red-950/25 border-red-500/40 text-red-100'
                      : n.type === 'special_claimed'
                      ? 'bg-amber-950/25 border-amber-500/40 text-amber-100'
                      : 'bg-neutral-800/40 border-neutral-800 text-neutral-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-[11px]">{n.title}</span>
                    <span className="text-[9px] text-neutral-400">
                      {formatRelativeTime(n.created_at)}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-neutral-300">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

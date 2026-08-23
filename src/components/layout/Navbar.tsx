'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Gamepad2,
  Trophy,
  LayoutDashboard,
  Settings,
  Building2,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import Image from 'next/image';

interface NavbarProps {
  currentTab: 'game' | 'dashboard' | 'leaderboard' | 'admin';
  onTabChange: (tab: 'game' | 'dashboard' | 'leaderboard' | 'admin') => void;
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  onOpenAuth,
}) => {
  const { currentCompany } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full bg-neutral-950/85 backdrop-blur-md border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div
          onClick={() => onTabChange('game')}
          className="flex items-center gap-2.5 cursor-pointer group select-none"
        >
          <div className="w-9 h-9 bg-linear-to-br from-amber-400 to-amber-600 rounded-xl shadow-md flex items-center justify-center border border-amber-300/40 group-hover:scale-105 transition-transform">
            <span className="font-mono font-black text-neutral-950 text-base">
              $
            </span>
          </div>
          <div>
            <span className="font-black text-lg text-white tracking-tight flex items-center gap-1">
              SWEEPER<span className="text-amber-400">.LOL</span>
            </span>
            <span className="text-[10px] text-neutral-400 font-mono hidden sm:block leading-none">
              Minesweeper Company Bidding
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => onTabChange('game')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'game'
                ? 'bg-amber-400 text-neutral-950 shadow-md'
                : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>Arena</span>
          </button>

          <button
            onClick={() => onTabChange('dashboard')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'dashboard'
                ? 'bg-amber-400 text-neutral-950 shadow-md'
                : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => onTabChange('leaderboard')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'leaderboard'
                ? 'bg-amber-400 text-neutral-950 shadow-md'
                : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Rankings</span>
          </button>

          <button
            onClick={() => onTabChange('admin')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'admin'
                ? 'bg-amber-400 text-neutral-950 shadow-md'
                : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Admin</span>
          </button>
        </nav>

        {/* Company Switcher Pill */}
        <div className="flex items-center gap-2">
          {currentCompany ? (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 rounded-xl px-2.5 py-1.5 cursor-pointer transition-all shadow-sm group"
              title="Click to Switch Company or Register"
            >
              {currentCompany.logo_url ? (
                <div className="w-5 h-5 relative flex items-center justify-center shrink-0">
                  <Image
                    src={currentCompany.logo_url}
                    alt={currentCompany.name}
                    width={20}
                    height={20}
                    className="max-h-full max-w-full object-contain"
                    unoptimized
                  />
                </div>
              ) : (
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ backgroundColor: currentCompany.brand_color }}
                >
                  {currentCompany.name[0]}
                </div>
              )}
              <span className="text-xs font-bold text-white max-w-[90px] sm:max-w-[120px] truncate">
                {currentCompany.name}
              </span>
              <ChevronDown className="w-3 h-3 text-neutral-400 group-hover:text-white transition-colors" />
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Select Company</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

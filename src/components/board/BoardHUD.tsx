'use client';

import React, { useState } from 'react';
import { GameStats } from '@/types/game';
import { Volume2, VolumeX, Sparkles, Flag } from 'lucide-react';
import { sounds } from '@/lib/sound';

interface BoardHUDProps {
  stats: GameStats;
  onResetDiscovery?: () => void;
  onAutoDiscoverAll?: () => void;
  statusMood?: 'normal' | 'excited' | 'won' | 'outbid' | 'exploded';
}

export const BoardHUD: React.FC<BoardHUDProps> = ({
  stats,
  onResetDiscovery,
  onAutoDiscoverAll,
  statusMood = 'normal',
}) => {
  const [isMuted, setIsMuted] = useState(sounds.getIsMuted());

  const handleToggleMute = () => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
    if (!muted) sounds.playClick();
  };

  const renderSmileySvg = () => {
    switch (statusMood) {
      case 'exploded':
        return (
          /* Dead / Shocked Exploded Face 😵 */
          <svg viewBox="0 0 24 24" className="w-6 h-6 sm:w-7 sm:h-7 animate-bounce" fill="none">
            <circle cx="12" cy="12" r="10" fill="#EF4444" stroke="#7F1D1D" strokeWidth="1.5" />
            {/* X Eyes */}
            <path d="M7 8l3 3m0-3l-3 3M14 8l3 3m0-3l-3 3" stroke="#000000" strokeWidth="2" strokeLinecap="round" />
            {/* Shocked Mouth */}
            <ellipse cx="12" cy="16" rx="2.5" ry="3" fill="#18181B" stroke="#000000" strokeWidth="1" />
          </svg>
        );
      case 'excited':
        return (
          /* Surprised / Cautious 😮 */
          <svg viewBox="0 0 24 24" className="w-6 h-6 sm:w-7 sm:h-7" fill="none">
            <circle cx="12" cy="12" r="10" fill="#FACC15" stroke="#713F12" strokeWidth="1.5" />
            <circle cx="8.5" cy="9" r="1.5" fill="#1E293B" />
            <circle cx="15.5" cy="9" r="1.5" fill="#1E293B" />
            <ellipse cx="12" cy="15.5" rx="2.5" ry="3.5" fill="#1E293B" />
          </svg>
        );
      case 'won':
        return (
          /* Cool / Victorious 😎 */
          <svg viewBox="0 0 24 24" className="w-6 h-6 sm:w-7 sm:h-7" fill="none">
            <circle cx="12" cy="12" r="10" fill="#FACC15" stroke="#713F12" strokeWidth="1.5" />
            {/* Sunglasses */}
            <path d="M4.5 10h15M5 9h6v3a3 3 0 01-6 0V9zm8 0h6v3a3 3 0 01-6 0V9z" fill="#0F172A" stroke="#0F172A" strokeWidth="1" />
            <path d="M8 16.5c1.5 1.5 6.5 1.5 8 0" stroke="#713F12" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
      case 'outbid':
        return (
          /* Crying / Outbid 😭 */
          <svg viewBox="0 0 24 24" className="w-6 h-6 sm:w-7 sm:h-7" fill="none">
            <circle cx="12" cy="12" r="10" fill="#FACC15" stroke="#713F12" strokeWidth="1.5" />
            <path d="M7 8l3 3m0-3l-3 3M14 8l3 3m0-3l-3 3" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M8.5 16.5c1.5-1.5 5.5-1.5 7 0" stroke="#713F12" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
      default:
        return (
          /* Classic Minesweeper Smile 😊 */
          <svg viewBox="0 0 24 24" className="w-6 h-6 sm:w-7 sm:h-7" fill="none">
            <circle cx="12" cy="12" r="10" fill="#FACC15" stroke="#713F12" strokeWidth="1.5" />
            <circle cx="8.5" cy="9.5" r="1.5" fill="#1E293B" />
            <circle cx="15.5" cy="9.5" r="1.5" fill="#1E293B" />
            <path d="M8 14.5c1.2 2 6.8 2 8 0" stroke="#713F12" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
    }
  };

  const remainingMines = stats.remainingMines ?? Math.max(0, 15 - stats.claimedCells);

  return (
    <div className="w-full ms-sunken-panel p-2 sm:p-3 mb-3 sm:mb-4 flex items-center justify-between gap-2 shadow-inner rounded-xs">
      {/* 1. LEFT LCD: Remaining Mines Counter (Classic 3-Digit Red LED) */}
      <div className="flex items-center gap-1.5">
        <div className="ms-led-display px-2 py-1 text-center min-w-[70px] sm:min-w-[90px]">
          <div className="text-[9px] uppercase tracking-wider text-red-500/70 font-sans font-bold flex items-center justify-center gap-1">
            <span>💣 Mines</span>
          </div>
          <div className="text-sm sm:text-lg font-lcd tracking-widest text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">
            {remainingMines.toString().padStart(3, '0')}
          </div>
        </div>

        <div className="hidden sm:block ms-led-display px-2 py-1 text-center min-w-[75px]">
          <div className="text-[9px] uppercase tracking-wider text-red-500/70 font-sans font-bold">
            Claimed
          </div>
          <div className="text-sm sm:text-lg font-lcd tracking-widest text-red-500">
            {stats.claimedCells.toString().padStart(2, '0')}/100
          </div>
        </div>
      </div>

      {/* 2. CENTER: Classic Minesweeper Smiley Button */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            sounds.playClick();
            if (onResetDiscovery) onResetDiscovery();
          }}
          className="ms-tile-raised w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center cursor-pointer active:ms-tile-pressed transition-transform hover:scale-105"
          title="Reset Fog of War / Covered State"
        >
          {renderSmileySvg()}
        </button>
      </div>

      {/* 3. RIGHT LCD: Total Market Cap & Controls */}
      <div className="flex items-center gap-2">
        <div className="ms-led-display px-2 py-1 text-center min-w-[70px] sm:min-w-[95px]">
          <div className="text-[9px] uppercase tracking-wider text-red-500/70 font-sans font-bold">
            Total Cap
          </div>
          <div className="text-sm sm:text-lg font-lcd tracking-widest text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">
            ${stats.totalMarketCap.toString().padStart(4, '0')}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <button
            onClick={handleToggleMute}
            className="ms-tile-raised p-1 sm:p-1.5 flex items-center justify-center text-gray-800 hover:text-blue-600 transition-colors"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-700" />
            )}
          </button>

          {onAutoDiscoverAll && (
            <button
              onClick={() => {
                sounds.playCascade();
                onAutoDiscoverAll();
              }}
              className="ms-tile-raised p-1 sm:p-1.5 flex items-center justify-center text-gray-800 hover:text-amber-600 transition-colors"
              title="Reveal Full Board (Scout Map)"
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

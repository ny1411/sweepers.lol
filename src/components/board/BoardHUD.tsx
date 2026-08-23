'use client';

import React, { useState } from 'react';
import { GameStats } from '@/types/game';
import { Volume2, VolumeX, Sparkles, RefreshCw } from 'lucide-react';
import { sounds } from '@/lib/sound';

interface BoardHUDProps {
  stats: GameStats;
  onResetDiscovery?: () => void;
  onAutoDiscoverAll?: () => void;
  statusMood?: 'normal' | 'excited' | 'won' | 'outbid';
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

  const getSmiley = () => {
    switch (statusMood) {
      case 'excited':
        return '😮';
      case 'won':
        return '😎';
      case 'outbid':
        return '😵';
      default:
        return '🙂';
    }
  };

  return (
    <div className="w-full ms-sunken-panel p-2 sm:p-3 mb-3 sm:mb-4 flex items-center justify-between gap-2 shadow-inner rounded-xs">
      {/* 1. LEFT LCD: Market Cap / Total Valuation */}
      <div className="flex items-center gap-1.5">
        <div className="ms-led-display px-2 py-1 text-center min-w-[70px] sm:min-w-[95px]">
          <div className="text-[9px] uppercase tracking-wider text-red-500/70 font-sans font-bold">
            Total Cap
          </div>
          <div className="text-sm sm:text-lg font-lcd tracking-widest text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">
            ${stats.totalMarketCap.toString().padStart(4, '0')}
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
          className="ms-tile-raised w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-xl sm:text-2xl cursor-pointer active:ms-tile-pressed transition-transform hover:scale-105"
          title="Reset Fog of War / Covered State"
        >
          <span>{getSmiley()}</span>
        </button>
      </div>

      {/* 3. RIGHT LCD: Discovered Count & Sound Controls */}
      <div className="flex items-center gap-2">
        <div className="ms-led-display px-2 py-1 text-center min-w-[70px] sm:min-w-[95px]">
          <div className="text-[9px] uppercase tracking-wider text-red-500/70 font-sans font-bold">
            Revealed
          </div>
          <div className="text-sm sm:text-lg font-lcd tracking-widest text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">
            {stats.discoveredCells.toString().padStart(3, '0')}
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
                sounds.playReveal(4);
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

'use client';

import React from 'react';
import { BoardCell } from '@/types/game';
import { Lock, Crown } from 'lucide-react';
import Image from 'next/image';
import special99Img from '@/app/99usd.png';
import mineImg from '@/app/mine.png';

interface CellProps {
  cell: BoardCell;
  isSelected: boolean;
  isMyCompanyOwner: boolean;
  onCellClick: (cell: BoardCell) => void;
  onCellRightClick?: (cell: BoardCell) => void;
  staggerIndex?: number;
}

export const Cell: React.FC<CellProps> = ({
  cell,
  isSelected,
  isMyCompanyOwner,
  onCellClick,
  onCellRightClick,
  staggerIndex = 0,
}) => {
  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
  }, [cell.company?.logo_url]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onCellClick(cell);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onCellRightClick) {
      onCellRightClick(cell);
    }
  };

  // 1. UNREVEALED / COVERED CELL
  if (!cell.is_discovered) {
    return (
      <button
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        data-testid={`cell-${cell.row}-${cell.col}`}
        className={`relative aspect-square w-full select-none cursor-pointer rounded-xs ms-tile-raised flex items-center justify-center font-bold text-gray-400/40 text-sm md:text-base transition-transform active:scale-95 group focus:outline-hidden ${
          isSelected ? 'ring-2 ring-blue-400 ring-offset-1' : ''
        }`}
        title={
          cell.is_flagged
            ? `Flagged position (${cell.row + 1}, ${cell.col + 1}) - Right-click to unflag`
            : `Unrevealed block (${cell.row + 1}, ${cell.col + 1}) - Click to uncover, Right-click to flag`
        }
      >
        {cell.is_flagged ? (
          /* Classic Authentic Minesweeper 🚩 Flag */
          <div className="flex items-center justify-center animate-reveal">
            <svg viewBox="0 0 24 24" className="w-5 h-5 sm:w-6 sm:h-6 drop-shadow-sm" fill="none">
              <path d="M5 21h14" stroke="#1f2937" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M7 21v-17" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
              <polygon points="7,4 20,9 7,14" fill="#ef4444" stroke="#991b1b" strokeWidth="1" />
            </svg>
          </div>
        ) : (
          <span className="opacity-0 group-hover:opacity-40 transition-opacity text-xs font-mono">
            ?
          </span>
        )}
      </button>
    );
  }

  // 2. REVEALED CELL
  const isClaimed = Boolean(cell.claim);
  const isSpecial = Boolean(cell.is_special);
  const isMine = Boolean(cell.is_mine);
  const isLocked = Boolean(cell.is_locked);

  const getNumberClass = (num: number) => {
    switch (num) {
      case 1:
        return 'pixel-num-1';
      case 2:
        return 'pixel-num-2';
      case 3:
        return 'pixel-num-3';
      case 4:
        return 'pixel-num-4';
      case 5:
        return 'pixel-num-5';
      case 6:
        return 'pixel-num-6';
      case 7:
        return 'pixel-num-7';
      case 8:
        return 'pixel-num-8';
      default:
        return 'pixel-num-1';
    }
  };

  return (
    <button
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      data-testid={`cell-${cell.row}-${cell.col}`}
      style={{
        animationDelay: `${Math.min(staggerIndex * 20, 300)}ms`,
      }}
      className={`relative aspect-square w-full select-none cursor-pointer rounded-xs flex flex-col items-center justify-between p-0.5 md:p-1 overflow-hidden transition-all focus:outline-hidden animate-reveal ${
        isMine && !isClaimed
          ? 'ms-tile-mine-exploded'
          : 'ms-tile-pressed'
      } ${
        isSelected
          ? 'ring-3 ring-amber-400 shadow-lg scale-105 z-10'
          : isMyCompanyOwner
          ? 'ring-2 ring-emerald-500/80 bg-emerald-50/60 dark:bg-emerald-950/20'
          : ''
      } ${
        isLocked
          ? 'border-amber-500/80 bg-amber-50/50 dark:bg-amber-950/30'
          : ''
      }`}
      title={
        isClaimed
          ? `Position #${cell.position_index}: Claimed by ${cell.company?.name || 'Company'} for $${cell.current_bid}`
          : isMine
          ? `Position #${cell.position_index}: Active Mine! Click to defuse & claim territory for $${cell.base_value || 1}`
          : isSpecial
          ? `Special $99 Territory! Click to bid and claim for 7 days`
          : `Position #${cell.position_index}: $${cell.base_value || 1} (${cell.adjacent_hazards_count || 0} adjacent hazards)`
      }
    >
      {/* Locked Badge */}
      {isLocked && (
        <div className="absolute top-0.5 right-0.5 bg-amber-500 text-black text-[9px] font-bold px-1 rounded-xs flex items-center gap-0.5 z-2 shadow-xs">
          <Lock className="w-2.5 h-2.5" />
          <span className="hidden sm:inline">LOCKED</span>
        </div>
      )}

      {/* Special Crown Icon */}
      {isSpecial && !isLocked && !isClaimed && (
        <div className="absolute top-0.5 right-0.5 text-amber-500 z-2 drop-shadow-xs">
          <Crown className="w-3 h-3 fill-amber-400 text-amber-600 animate-pulse" />
        </div>
      )}

      {/* Cell Content: Claimed vs Mine vs Special vs Numbers */}
      {isClaimed ? (
        <div className="w-full h-full flex flex-col items-center justify-between py-0.5">
          {/* Company Logo or Name */}
          <div className="flex-1 flex items-center justify-center w-full min-h-0">
            {cell.company?.logo_url && !imageError ? (
              <div className="relative w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center">
                <Image
                  src={cell.company.logo_url}
                  alt={cell.company.name}
                  width={32}
                  height={32}
                  className="max-h-full max-w-full object-contain filter drop-shadow-xs"
                  unoptimized
                  onError={() => setImageError(true)}
                />
              </div>
            ) : (
              <span
                className="text-[10px] sm:text-xs font-black uppercase tracking-tight px-1 py-0.5 rounded-xs text-white shadow-xs"
                style={{ backgroundColor: cell.company?.brand_color || '#3b82f6' }}
              >
                {cell.company?.name?.substring(0, 5) || 'CLAIM'}
              </span>
            )}
          </div>

          {/* Current Bid Badge */}
          <div className="w-full text-center">
            <span className="inline-block bg-neutral-900/90 text-white font-mono font-black text-[10px] sm:text-xs px-1 py-0.2 rounded-xs shadow-xs border border-neutral-700/50">
              ${cell.current_bid}
            </span>
          </div>
        </div>
      ) : isMine ? (
        /* Active Classic Mine from mine.png */
        <div className="w-full h-full flex flex-col items-center justify-center relative p-0.5">
          <div className="relative w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center transform transition-transform group-hover:scale-110">
            <Image
              src={mineImg}
              alt="Active Mine"
              width={32}
              height={32}
              className="max-h-full max-w-full object-contain filter drop-shadow-md"
              priority
            />
          </div>
          <span className="text-[9px] font-mono font-black text-white bg-black/85 px-1.5 py-0.5 rounded-xs border border-red-500/70 mt-0.5 leading-none shadow-xs">
            $10
          </span>
        </div>
      ) : isSpecial ? (
        /* Special $99 Gold Coin */
        <div className="flex flex-col items-center justify-center w-full h-full p-0.5 animate-gold-coin">
          <div className="relative w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 flex items-center justify-center">
            <Image
              src={special99Img}
              alt="$99 Special Position"
              width={36}
              height={36}
              className="max-h-full max-w-full object-contain filter drop-shadow-md transition-transform group-hover:scale-105"
              priority
            />
          </div>
        </div>
      ) : (
        /* Unclaimed Numbered or Empty Tile */
        <div className="w-full h-full flex flex-col items-center justify-center">
          {cell.adjacent_hazards_count && cell.adjacent_hazards_count > 0 ? (
            <span className={`${getNumberClass(cell.adjacent_hazards_count)} text-xl sm:text-2xl md:text-3xl leading-none`}>
              ${cell.base_value || cell.adjacent_hazards_count}
            </span>
          ) : (
            /* 0 Hazards: Blank Sunken Tile (Clean Classic Minesweeper 0) */
            <span className="text-[10px] text-gray-500/30 font-mono select-none">
              ·
            </span>
          )}
        </div>
      )}

      {/* Owner Brand Indicator strip */}
      {isClaimed && cell.company && (
        <div
          className="absolute bottom-0 left-0 right-0 h-1"
          style={{ backgroundColor: cell.company.brand_color || '#3b82f6' }}
        />
      )}
    </button>
  );
};

'use client';

import React, { useState, useEffect } from 'react';
import { BoardCell, GameStats } from '@/types/game';
import { Cell } from './Cell';
import { BoardHUD } from './BoardHUD';
import { gameEngine, DEFAULT_BOARD } from '@/lib/game/engine';
import { useAuth } from '@/context/AuthContext';
import { sounds } from '@/lib/sound';
import { ZoomIn, ZoomOut, RotateCcw, Compass } from 'lucide-react';

interface BoardGridProps {
  onSelectCell: (cell: BoardCell) => void;
  selectedCell: BoardCell | null;
  onStatsUpdate?: (stats: GameStats) => void;
}

export const BoardGrid: React.FC<BoardGridProps> = ({
  onSelectCell,
  selectedCell,
  onStatsUpdate,
}) => {
  const { currentUser, currentCompany } = useAuth();
  const [boardId] = useState(DEFAULT_BOARD.id);
  const [cells, setCells] = useState<BoardCell[]>([]);
  const [stats, setStats] = useState<GameStats>({
    totalCells: 100,
    discoveredCells: 0,
    claimedCells: 0,
    totalMarketCap: 0,
    activeBidders: 0,
    highestBid: 0,
    specialLocked: false,
  });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [mood, setMood] = useState<'normal' | 'excited' | 'won' | 'outbid'>('normal');

  const userId = currentUser?.id || 'guest-user';

  // Load board cells and stats
  const refreshBoard = () => {
    const updatedCells = gameEngine.getBoardCells(boardId, userId);
    setCells(updatedCells);
    const newStats = gameEngine.getGameStats(boardId, userId);
    setStats(newStats);
    if (onStatsUpdate) onStatsUpdate(newStats);
  };

  useEffect(() => {
    refreshBoard();

    const unsubscribe = gameEngine.subscribe(({ type, payload }) => {
      refreshBoard();

      if (type === 'BID_PLACED') {
        sounds.playBidPlaced();
        setMood('won');
        setTimeout(() => setMood('normal'), 2500);
      } else if (type === 'OUTBID_ALERT') {
        const p = payload as { targetCompanyId?: string };
        if (currentCompany && p?.targetCompanyId === currentCompany.id) {
          sounds.playOutbid();
          setMood('outbid');
          setTimeout(() => setMood('normal'), 3000);
        }
      }
    });

    return () => unsubscribe();
  }, [boardId, userId, currentCompany]);

  // Click on cell
  const handleCellClick = (cell: BoardCell) => {
    if (!cell.is_discovered) {
      // 1. UNCOVER MECHANIC: Progressive Minesweeper Reveal (Show prices & bidded logos on grid first)
      sounds.playClick();
      setMood('excited');
      setTimeout(() => setMood('normal'), 600);

      const newlyDiscovered = gameEngine.revealCells(boardId, cell.row, cell.col, userId);

      // Play staggered sound if multiple uncovered
      const specialFound = newlyDiscovered.some((c) => c.is_special);
      if (specialFound) {
        sounds.playSpecialReveal();
      } else {
        sounds.playReveal(Math.min(newlyDiscovered.length, 5));
      }

      refreshBoard();
      // Do not open modal on initial discovery click, allow user to view price & bidded logos on board first
    } else {
      // 2. REVEALED CELL: Click revealed cell to open Bidding Modal
      sounds.playClick();
      onSelectCell(cell);
    }
  };

  // Reset Fog of War for current player
  const handleResetDiscovery = () => {
    gameEngine.resetDiscoveries(userId);
    refreshBoard();
  };

  // Scout All Cells
  const handleAutoDiscoverAll = () => {
    // Reveal center and corners
    gameEngine.revealCells(boardId, 2, 2, userId);
    gameEngine.revealCells(boardId, 7, 7, userId);
    gameEngine.revealCells(boardId, 1, 2, userId); // Special position
    gameEngine.revealCells(boardId, 8, 2, userId);
    gameEngine.revealCells(boardId, 2, 8, userId);
    refreshBoard();
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* 3D Window Frame */}
      <div className="ms-window-frame p-2 sm:p-4 rounded-xs w-full max-w-2xl bg-[#c0c0c0] shadow-2xl border-4 border-[#dfdfdf]">
        {/* Minesweeper HUD Header */}
        <BoardHUD
          stats={stats}
          onResetDiscovery={handleResetDiscovery}
          onAutoDiscoverAll={handleAutoDiscoverAll}
          statusMood={mood}
        />

        {/* Board Container with Zoom/Pan Support */}
        <div className="relative overflow-x-auto overflow-y-hidden p-1 sm:p-2 bg-[#808080] ms-sunken-panel rounded-xs">
          <div
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'top center',
              transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            className="w-full min-w-[320px] sm:min-w-[420px] aspect-square"
          >
            {/* 10x10 Grid matching classic Minesweeper */}
            <div className="grid grid-cols-10 gap-0.5 sm:gap-1 w-full h-full bg-[#7b7b7b] p-1 border-2 border-[#505050]">
              {cells.map((cell, idx) => (
                <Cell
                  key={cell.id}
                  cell={cell}
                  isSelected={selectedCell?.id === cell.id}
                  isMyCompanyOwner={cell.claim?.company_id === currentCompany?.id}
                  onCellClick={handleCellClick}
                  staggerIndex={idx % 10}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Board Zoom & Utility Controls */}
        <div className="mt-2.5 flex items-center justify-between text-xs text-neutral-800 font-semibold px-1">
          <div className="flex items-center gap-1.5 text-neutral-700">
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Click grey tiles to discover valuable territory.</span>
            <span className="sm:hidden">Tap tiles to uncover.</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.85, z - 0.1))}
              className="ms-tile-raised p-1 text-gray-800 hover:text-black"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="ms-tile-raised px-1.5 py-0.5 text-[10px] font-mono"
              title="Reset Zoom"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              onClick={() => setZoomLevel((z) => Math.min(1.3, z + 0.1))}
              className="ms-tile-raised p-1 text-gray-800 hover:text-black"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

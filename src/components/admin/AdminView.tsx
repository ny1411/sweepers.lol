'use client';

import React, { useState } from 'react';
import { gameEngine, DEFAULT_BOARD } from '@/lib/game/engine';
import { sounds } from '@/lib/sound';
import {
  Settings,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Database,
  Grid,
} from 'lucide-react';

export const AdminView: React.FC = () => {
  const [rows, setRows] = useState(10);
  const [cols, setCols] = useState(10);
  const [minIncrement, setMinIncrement] = useState(1.0);
  const [lockHours, setLockHours] = useState(168); // 7 days
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleResetBoard = () => {
    try {
      gameEngine.resetBoard(rows, cols, minIncrement, lockHours);
      sounds.playBidPlaced();
      setStatusMessage('Board re-generated and re-seeded successfully with fresh data.');
      setTimeout(() => setStatusMessage(null), 4000);
    } catch {
      setStatusMessage('Failed to reset board.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Title */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-400 text-xs font-bold uppercase tracking-wider mb-2">
          <Settings className="w-3.5 h-3.5" />
          <span>Game Master Console</span>
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          Admin & Game Configuration
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Adjust auction parameters, reveal mechanics, and initialize new board instances.
        </p>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/50 rounded-xl flex items-center gap-2 text-xs text-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Configuration Form */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl flex flex-col gap-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-400" />
          <span>Board & Auction Parameters</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Grid Rows (Height)
            </label>
            <input
              type="number"
              min="5"
              max="20"
              value={rows}
              onChange={(e) => setRows(parseInt(e.target.value) || 10)}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Grid Columns (Width)
            </label>
            <input
              type="number"
              min="5"
              max="20"
              value={cols}
              onChange={(e) => setCols(parseInt(e.target.value) || 10)}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Min Bid Increment ($)
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={minIncrement}
              onChange={(e) => setMinIncrement(parseFloat(e.target.value) || 1.0)}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Special $99 Lock Duration (Hours)
            </label>
            <input
              type="number"
              min="1"
              value={lockHours}
              onChange={(e) => setLockHours(parseInt(e.target.value) || 168)}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-purple-500"
            />
            <span className="text-[10px] text-neutral-500 mt-1 block">
              168 hours = 7 full days
            </span>
          </div>
        </div>

        <div className="pt-4 border-t border-neutral-800 flex items-center justify-between">
          <div className="text-xs text-neutral-400">
            Total Positions: <strong className="text-white font-mono">{rows * cols}</strong>
          </div>

          <button
            onClick={handleResetBoard}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition-all active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Re-Generate & Re-Seed Board</span>
          </button>
        </div>
      </div>
    </div>
  );
};

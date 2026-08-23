'use client';

import React, { useState } from 'react';
import { gameEngine } from '@/lib/game/engine';
import { sounds } from '@/lib/sound';
import {
  Settings,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Database,
  Grid,
  Copy,
  Terminal,
} from 'lucide-react';

export const AdminView: React.FC = () => {
  const [rows, setRows] = useState(10);
  const [cols, setCols] = useState(10);
  const [minIncrement, setMinIncrement] = useState(1.0);
  const [lockHours, setLockHours] = useState(168); // 7 days
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  const handleSyncSupabase = async () => {
    try {
      await gameEngine.loadAllFromSupabase();
      sounds.playBidPlaced();
      setStatusMessage('Synchronized game state with live Supabase database.');
      setTimeout(() => setStatusMessage(null), 4000);
    } catch {
      setStatusMessage('Failed to sync with Supabase.');
    }
  };

  const handleCopyScriptPath = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText('supabase/reset_and_seed.sql');
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
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
          Admin & Database Configuration
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Adjust auction parameters, reveal mechanics, and manage your live Supabase database.
        </p>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/50 rounded-xl flex items-center gap-2 text-xs text-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Supabase Database Reset & Management Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Supabase Database Reset & Initialization</span>
          </h3>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
            Realtime Sync Active
          </span>
        </div>

        <p className="text-xs text-neutral-300 leading-relaxed">
          To reset or initialize all tables, atomic RPC bidding functions, and initial companies in your Supabase project, execute the SQL script in your Supabase Dashboard SQL Editor:
        </p>

        <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 flex items-center justify-between font-mono text-xs text-neutral-200">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-neutral-500" />
            <span>supabase/reset_and_seed.sql</span>
          </div>
          <button
            onClick={handleCopyScriptPath}
            className="flex items-center gap-1.5 px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-[11px] transition-colors cursor-pointer"
          >
            {copiedSql ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-neutral-400" />
                <span>Copy Path</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSyncSupabase}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition-all active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Re-Fetch All From Supabase</span>
          </button>
        </div>
      </div>

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
        </div>
      </div>
    </div>
  );
};

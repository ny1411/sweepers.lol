'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Footer } from '@/components/layout/Footer';
import { BoardGrid } from '@/components/board/BoardGrid';
import { TopCompaniesDashboard } from '@/components/dashboard/TopCompaniesDashboard';
import { BidModal } from '@/components/bidding/BidModal';
import { LiveOutbidToast } from '@/components/bidding/LiveOutbidToast';
import { BoardCell, GameStats } from '@/types/game';
import { gameEngine } from '@/lib/game/engine';
import {
  Sparkles,
  Crown,
  Compass,
  Flame,
  Volume2,
  VolumeX,
  CheckCircle2,
  X,
} from 'lucide-react';
import { sounds } from '@/lib/sound';
import confetti from 'canvas-confetti';

function PaymentSuccessHandler({
  onPaymentSuccess,
}: {
  onPaymentSuccess: (info: { positionId?: string; companyName?: string; amount?: string }) => void;
}) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const paymentSuccess = urlParams.get('payment_success');
    const sessionId = urlParams.get('session_id');
    const positionId = urlParams.get('position_id');
    const positionIndex = urlParams.get('position_index');
    const amount = urlParams.get('amount');

    if (paymentSuccess === 'true' && sessionId) {
      // 1. Verify with backend
      fetch(`/api/payments/verify?session_id=${encodeURIComponent(sessionId)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.verified) {
            sounds.playSpecialReveal();
            confetti({
              particleCount: 100,
              spread: 80,
              origin: { y: 0.6 },
            });

            const meta = data.metadata || {};
            const companyName = meta.company_name || 'Your Company';
            const bidAmount = meta.amount || amount || '0';

            // Also ensure gameEngine reflects this in memory / real-time
            if (meta.position_id && meta.company_name) {
              gameEngine.placeBidWithDetails({
                positionId: meta.position_id,
                amount: parseFloat(bidAmount) || 1,
                name: meta.company_name,
                website: meta.website,
                description: meta.description,
                logoUrl: meta.logo_url,
                brandColor: meta.brand_color,
              }).catch(() => {});
            }

            onPaymentSuccess({
              positionId: meta.position_id || positionId || undefined,
              companyName,
              amount: bidAmount,
            });
          }
        })
        .catch((err) => {
          console.error('Payment verification error:', err);
        })
        .finally(() => {
          // Clean URL without reload
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    }
  }, [onPaymentSuccess]);

  return null;
}

export default function HomePage() {
  const [selectedCell, setSelectedCell] = useState<BoardCell | null>(null);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [isSoundMuted, setIsSoundMuted] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState<{
    companyName?: string;
    amount?: string;
  } | null>(null);

  useEffect(() => {
    // Initial stats load and Supabase sync
    gameEngine.loadAllFromSupabase().then(() => {
      const currentStats = gameEngine.getGameStats('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'guest-user');
      setStats(currentStats);
    });

    const unsubscribe = gameEngine.subscribe(() => {
      const updated = gameEngine.getGameStats('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'guest-user');
      setStats(updated);
    });

    return () => unsubscribe();
  }, []);

  const handleSelectCell = (cell: BoardCell) => {
    setSelectedCell(cell);
  };

  const toggleSound = () => {
    const muted = sounds.toggleMute();
    setIsSoundMuted(muted);
  };

  return (
    <div className="flex flex-col min-h-screen bg-neutral-950 text-neutral-100 selection:bg-amber-400 selection:text-neutral-950">
      <Suspense fallback={null}>
        <PaymentSuccessHandler
          onPaymentSuccess={(info) => {
            setPaymentNotice({
              companyName: info.companyName,
              amount: info.amount,
            });
          }}
        />
      </Suspense>

      {/* Header Banner */}
      <header className="w-full border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <div className="flex items-center gap-2.5 select-none">
            <div className="w-9 h-9 bg-linear-to-br from-amber-400 via-amber-500 to-amber-600 rounded-xl shadow-lg flex items-center justify-center border border-amber-300/40">
              <span className="font-mono font-black text-neutral-950 text-lg">
                $
              </span>
            </div>
            <div>
              <span className="font-black text-lg sm:text-xl text-white tracking-tight flex items-center gap-1">
                SWEEPER<span className="text-amber-400">.LOL</span>
              </span>
              <span className="text-[10px] text-neutral-400 font-mono hidden sm:block leading-none">
                Minesweeper Company Bidding Game
              </span>
            </div>
          </div>

          {/* Quick Stats Pill & Sound Toggle */}
          <div className="flex items-center gap-2 sm:gap-3">
            {stats && (
              <div className="hidden sm:flex items-center gap-3 bg-neutral-900/90 border border-neutral-800 px-3 py-1.5 rounded-full text-xs font-mono">
                <div className="flex items-center gap-1 text-emerald-400">
                  <Flame className="w-3.5 h-3.5" />
                  <span>{stats.claimedCells}/100 Claimed</span>
                </div>
                <div className="h-3 w-px bg-neutral-800" />
                <div className="text-amber-400 font-bold">
                  Top Bid: ${stats.highestBid}
                </div>
              </div>
            )}

            <button
              onClick={toggleSound}
              className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              title={isSoundMuted ? 'Unmute Game Sounds' : 'Mute Game Sounds'}
            >
              {isSoundMuted ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Payment Success Toast Banner */}
      {paymentNotice && (
        <div className="w-full bg-linear-to-r from-emerald-950 via-emerald-900 to-emerald-950 border-b border-emerald-500/40 py-3 px-4 shadow-lg animate-in slide-in-from-top-4 duration-300">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 text-emerald-100 text-sm">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 animate-bounce" />
              <div>
                <span className="font-bold text-white">Payment Confirmed!</span>{' '}
                <span>
                  {paymentNotice.companyName || 'Your bid'} is now live on the grid for{' '}
                  <strong className="text-amber-300">${paymentNotice.amount}</strong> via Dodo Payments.
                </span>
              </div>
            </div>
            <button
              onClick={() => setPaymentNotice(null)}
              className="p-1 rounded-lg hover:bg-emerald-800/50 text-emerald-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Single-Page Gameplay Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col items-center gap-6">
        {/* 1. TOP 3 COMPANIES DASHBOARD (ABOVE GAME BOARD) */}
        <TopCompaniesDashboard
          onCompanyClick={(companyId) => {
            const cells = gameEngine.getBoardCells('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'guest-user');
            const companyCell = cells.find((c) => c.claim?.company_id === companyId);
            if (companyCell) {
              setSelectedCell(companyCell);
            }
          }}
        />

        {/* 2. MAIN MINESWEEPER GAME BOARD */}
        <BoardGrid
          onSelectCell={handleSelectCell}
          selectedCell={selectedCell}
          onStatsUpdate={setStats}
        />

        {/* 3. DYNAMIC VALUE LEGEND & RULES GUIDE */}
        <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-amber-400" />
              <span>Dynamic Territory Pricing & Adjacency Rules</span>
            </h4>
            <span className="text-[10px] text-neutral-500 font-mono hidden sm:inline">
              Minesweeper Adjacency Logic
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            {/* $1: 0 Neighbors */}
            <div className="bg-neutral-800/40 p-2.5 rounded-xl border border-neutral-800 flex items-center gap-2.5">
              <span className="pixel-num-1 text-2xl font-bold">$1</span>
              <div>
                <span className="font-bold text-white block">Isolated</span>
                <span className="text-[10px] text-neutral-400">0 company neighbors</span>
              </div>
            </div>

            {/* $3: 1 Neighbor */}
            <div className="bg-neutral-800/40 p-2.5 rounded-xl border border-neutral-800 flex items-center gap-2.5">
              <span className="pixel-num-2 text-2xl font-bold">$3</span>
              <div>
                <span className="font-bold text-white block">Border Hotzone</span>
                <span className="text-[10px] text-neutral-400">1 company neighbor</span>
              </div>
            </div>

            {/* $5: 2+ Neighbors */}
            <div className="bg-neutral-800/40 p-2.5 rounded-xl border border-neutral-800 flex items-center gap-2.5">
              <span className="pixel-num-3 text-2xl font-bold">$5</span>
              <div>
                <span className="font-bold text-white block">Cluster Apex</span>
                <span className="text-[10px] text-neutral-400">2+ company neighbors</span>
              </div>
            </div>

            {/* $99: Special Position */}
            <div className="bg-amber-950/20 p-2.5 rounded-xl border border-amber-500/30 flex items-center gap-2.5">
              <Crown className="w-6 h-6 text-amber-400 shrink-0" />
              <div>
                <span className="font-bold text-amber-300 block">$99 Special</span>
                <span className="text-[10px] text-amber-400/80">7-Day Lock Protection</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Direct Bidding Modal (Opens on any block click, asking for Bid Amount + Name, Website URL, Description) */}
      <BidModal
        cell={selectedCell}
        onClose={() => setSelectedCell(null)}
        onBidSuccess={() => {
          // Refresh selected cell state
          if (selectedCell) {
            const updated = gameEngine
              .getBoardCells('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'guest-user')
              .find((c: BoardCell) => c.id === selectedCell.id);
            if (updated) setSelectedCell(updated);
          }
        }}
      />

      {/* Real-time Outbid Alert Toast */}
      <LiveOutbidToast
        onSelectPosition={(cell) => {
          setSelectedCell(cell);
        }}
      />

      {/* Footer */}
      <Footer />
    </div>
  );
}

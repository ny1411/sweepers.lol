'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Footer } from '@/components/layout/Footer';
import { BoardGrid } from '@/components/board/BoardGrid';
import { TopCompaniesDashboard } from '@/components/dashboard/TopCompaniesDashboard';
import { BidModal } from '@/components/bidding/BidModal';
import { LiveOutbidToast } from '@/components/bidding/LiveOutbidToast';
import { StatsModal } from '@/components/layout/StatsModal';
import { BoardCell, GameStats } from '@/types/game';
import { gameEngine } from '@/lib/game/engine';
import { createClient } from '@/lib/supabase/client';
import {
  Volume2,
  VolumeX,
  CheckCircle2,
  X,
} from 'lucide-react';
import { sounds } from '@/lib/sound';
import confetti from 'canvas-confetti';
import Image from 'next/image';
import special99Img from '@/app/99usd.png';

function PaymentSuccessHandler({
  onPaymentSuccess,
}: {
  onPaymentSuccess: (info: { positionId?: string; companyName?: string; amount?: string }) => void;
}) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const paymentSuccess = urlParams.get('payment_success');
    const rawSessionId = urlParams.get('session_id');
    const paymentId = urlParams.get('payment_id');
    const paymentStatus = urlParams.get('status');
    const positionId = urlParams.get('position_id');
    const amount = urlParams.get('amount');

    const cleanSessionId = rawSessionId && rawSessionId !== '{CHECKOUT_SESSION_ID}' ? rawSessionId : '';
    const cleanPaymentId = paymentId && paymentId !== '{PAYMENT_ID}' ? paymentId : '';

    const isSuccessRedirect =
      paymentSuccess === 'true' ||
      paymentStatus === 'succeeded' ||
      Boolean(cleanPaymentId) ||
      Boolean(cleanSessionId);

    if (isSuccessRedirect) {
      const verifyParams = new URLSearchParams();
      if (cleanPaymentId) verifyParams.set('payment_id', cleanPaymentId);
      if (cleanSessionId) verifyParams.set('session_id', cleanSessionId);
      if (positionId) verifyParams.set('position_id', positionId);
      if (amount) verifyParams.set('amount', amount);

      // 1. Verify with backend
      fetch(`/api/payments/verify?${verifyParams.toString()}`)
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
              gameEngine
                .placeBidWithDetails({
                  positionId: meta.position_id,
                  amount: parseFloat(bidAmount) || 1,
                  name: meta.company_name,
                  website: meta.website,
                  description: meta.description,
                  logoUrl: meta.logo_url,
                  brandColor: meta.brand_color,
                })
                .catch(() => {});
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

  // 100% Real Live Supabase Realtime Presence & Database Visitors
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [visitorCount, setVisitorCount] = useState<number>(1);
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);

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

  // Real Supabase Presence Channel & Visitors Tracking
  useEffect(() => {
    let sessionId = '';
    try {
      sessionId = localStorage.getItem('sweeper_session_id') || '';
      if (!sessionId) {
        sessionId = `user_${Math.random().toString(36).substring(2, 11)}`;
        localStorage.setItem('sweeper_session_id', sessionId);
      }
    } catch {
      sessionId = `user_${Math.random().toString(36).substring(2, 11)}`;
    }

    // 1. Subscribe to real-time presence channel
    const supabase = createClient();
    const presenceChannel = supabase.channel('sweeper_online_presence', {
      config: {
        presence: {
          key: sessionId,
        },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const activeUsersCount = Object.keys(state).length;
        setOnlineCount(Math.max(1, activeUsersCount));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            online_at: new Date().toISOString(),
          });
        }
      });

    // 2. Fetch verified real visitor count
    const fetchVisitors = async (isInitial = false) => {
      try {
        const res = await fetch(`/api/stats?track=${isInitial ? '1' : '0'}&sessionId=${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          if (typeof data.visitors === 'number') {
            setVisitorCount(data.visitors);
          }
        }
      } catch {
        // Ignore
      }
    };

    fetchVisitors(true);
    const interval = setInterval(() => fetchVisitors(false), 20000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(presenceChannel);
    };
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
            <div className="w-9 h-9 bg-linear-to-br from-amber-400 via-amber-500 to-amber-600 rounded-xl shadow-lg flex items-center justify-center border border-amber-300/40 p-1 overflow-hidden">
              <Image
                src={special99Img}
                alt="Sweeper.lol Icon"
                width={32}
                height={32}
                className="w-full h-full object-contain filter drop-shadow-xs"
                priority
              />
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

          {/* Live Vercel Analytics Stats Text & Sound Toggle */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-mono text-neutral-300 bg-neutral-900/90 border border-neutral-800 px-3 py-1.5 rounded-full shadow-inner">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>{onlineCount} online</span>
              <span className="text-neutral-600">·</span>
              <span className="hidden xs:inline">{visitorCount.toLocaleString()} visitors since launch</span>
              <span className="xs:hidden">{visitorCount.toLocaleString()} visits</span>
              <span className="text-neutral-600">·</span>
              <button
                onClick={() => setShowStatsModal(true)}
                className="text-amber-400 hover:text-amber-300 hover:underline font-semibold cursor-pointer"
              >
                see stats
              </button>
            </div>

            <button
              onClick={toggleSound}
              className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer shrink-0"
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
      </main>

      {/* Direct Bidding Modal */}
      <BidModal
        cell={selectedCell}
        onClose={() => setSelectedCell(null)}
        onBidSuccess={() => {
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

      {/* Live Vercel Analytics Stats Modal */}
      <StatsModal
        isOpen={showStatsModal}
        onClose={() => setShowStatsModal(false)}
        onlineCount={onlineCount}
        visitorCount={visitorCount}
      />

      {/* Footer */}
      <Footer />
    </div>
  );
}

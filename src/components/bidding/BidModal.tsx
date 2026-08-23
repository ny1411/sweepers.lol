'use client';

import React, { useState, useEffect } from 'react';
import { BoardCell, Bid } from '@/types/game';
import { BidHistory } from './BidHistory';
import { gameEngine } from '@/lib/game/engine';
import { formatCurrency, formatTimeRemaining } from '@/lib/config';
import { sounds } from '@/lib/sound';
import confetti from 'canvas-confetti';
import {
  X,
  Lock,
  Crown,
  Building2,
  AlertCircle,
  CheckCircle2,
  Zap,
  TrendingUp,
  Clock,
  ArrowRight,
  Globe,
  FileText,
  User,
} from 'lucide-react';
import Image from 'next/image';

interface BidModalProps {
  cell: BoardCell | null;
  onClose: () => void;
  onBidSuccess?: () => void;
}

export const BidModal: React.FC<BidModalProps> = ({
  cell,
  onClose,
  onBidSuccess,
}) => {
  const [bids, setBids] = useState<Bid[]>([]);
  const [bidAmount, setBidAmount] = useState<string>('');
  
  // 3 Required/Company details
  const [companyName, setCompanyName] = useState<string>('');
  const [websiteUrl, setWebsiteUrl] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  // Calculate minimum valid bid dynamically
  const minIncrement = 1.0;
  const currentBid = cell?.current_bid || 0;
  const baseValue = cell?.base_value || 1.0;
  const minRequiredBid = cell?.claim ? currentBid + minIncrement : baseValue;

  // Load last used bidder details from localStorage on mount
  useEffect(() => {
    try {
      const savedProfile = localStorage.getItem('sweeper_bidder_profile');
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        if (parsed.name) setCompanyName(parsed.name);
        if (parsed.website) setWebsiteUrl(parsed.website);
        if (parsed.description) setDescription(parsed.description);
      }
    } catch {
      // Ignore storage read error
    }
  }, []);

  // Refresh cell bids, minimum bid amount, and lock timer
  useEffect(() => {
    if (!cell) return;

    const cellBids = gameEngine.getBidHistory(cell.id);
    setBids(cellBids);
    setBidAmount(minRequiredBid.toString());
    setErrorMessage(null);
    setSuccessMessage(null);

    // Lock timer countdown
    const updateLockStatus = () => {
      if (cell.claim?.lock_until) {
        const remaining = formatTimeRemaining(cell.claim.lock_until);
        setIsLocked(!remaining.isExpired);
        setCountdown(remaining.formatted);
      } else {
        setIsLocked(false);
        setCountdown(null);
      }
    };

    updateLockStatus();
    const interval = setInterval(updateLockStatus, 1000);
    return () => clearInterval(interval);
  }, [cell, minRequiredBid]);

  if (!cell) return null;

  const isSpecial = Boolean(cell.is_special);

  const handlePlaceBid = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!companyName.trim()) {
      setErrorMessage('Please enter your company or bidder name.');
      return;
    }

    const amountNum = parseFloat(bidAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMessage('Please enter a valid positive bid amount.');
      return;
    }

    if (amountNum < minRequiredBid) {
      setErrorMessage(
        `Bid of $${amountNum} is too low. The minimum acceptable bid is $${minRequiredBid.toFixed(
          2
        )}.`
      );
      sounds.playOutbid();
      return;
    }

    if (isLocked) {
      setErrorMessage(
        `This special position is locked until ${countdown}. Rebidding is currently unavailable.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await gameEngine.placeBidWithDetails({
        positionId: cell.id,
        amount: amountNum,
        name: companyName.trim(),
        website: websiteUrl.trim(),
        description: description.trim(),
      });

      if (result.success) {
        // Save bidder profile to localStorage for fast recurring bids
        try {
          localStorage.setItem(
            'sweeper_bidder_profile',
            JSON.stringify({
              name: companyName.trim(),
              website: websiteUrl.trim(),
              description: description.trim(),
            })
          );
        } catch {
          // Ignore
        }

        sounds.playBidPlaced();
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });
        setSuccessMessage(`Success! ${result.company.name} now leads Position #${cell.position_index} for ${formatCurrency(amountNum)}.`);
        setBids(gameEngine.getBidHistory(cell.id));
        if (onBidSuccess) onBidSuccess();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit bid.';
      setErrorMessage(msg);
      sounds.playOutbid();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick increment chips
  const addIncrement = (inc: number) => {
    const current = parseFloat(bidAmount) || minRequiredBid;
    setBidAmount((current + inc).toString());
    sounds.playClick();
  };

  // Simulate Outbid by Another Company for interactive testing
  const handleSimulateOutbid = async () => {
    const all = gameEngine.getCompanies();
    const rival = all.find((c) => c.name.toLowerCase() !== companyName.toLowerCase()) || all[0];
    if (!rival) return;

    const rivalBid = (cell.current_bid || minRequiredBid) + 2;
    try {
      await gameEngine.placeBid(
        cell.id,
        rivalBid,
        `user-${rival.id}`,
        rival.id
      );
      setBids(gameEngine.getBidHistory(cell.id));
      if (onBidSuccess) onBidSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Simulation failed';
      setErrorMessage(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div
          className={`p-4 border-b flex items-center justify-between ${
            isSpecial
              ? 'bg-linear-to-r from-amber-950/80 via-neutral-900 to-amber-950/80 border-amber-500/30'
              : 'bg-neutral-800/60 border-neutral-800'
          }`}
        >
          <div className="flex items-center gap-3">
            {isSpecial ? (
              <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500 flex items-center justify-center animate-gold-coin">
                <Crown className="w-5 h-5 text-amber-400" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-400" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Position #{cell.position_index}
                </h3>
                {isSpecial ? (
                  <span className="text-[10px] bg-amber-500/20 text-amber-400 font-black px-1.5 py-0.5 rounded-full border border-amber-500/40 uppercase">
                    Special $99
                  </span>
                ) : (
                  <span className="text-[10px] bg-blue-500/20 text-blue-400 font-bold px-1.5 py-0.5 rounded-full border border-blue-500/40">
                    Base: ${cell.base_value}
                  </span>
                )}
                {isLocked && (
                  <span className="text-[10px] bg-red-500/20 text-red-400 font-bold px-1.5 py-0.5 rounded-full border border-red-500/40 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Locked
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400">
                Grid: Row {cell.row + 1}, Col {cell.col + 1}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto flex flex-col gap-4">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="bg-neutral-800/40 border border-neutral-800 p-2.5 rounded-xl">
              <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-0.5">
                Current Status
              </span>
              <span className="text-sm font-bold text-neutral-200">
                {cell.claim ? 'Claimed' : 'Available'}
              </span>
            </div>

            <div className="bg-neutral-800/40 border border-neutral-800 p-2.5 rounded-xl">
              <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-0.5">
                Current Bid
              </span>
              <span className="text-sm font-mono font-bold text-emerald-400">
                {cell.claim ? formatCurrency(cell.claim.current_bid) : 'None'}
              </span>
            </div>

            <div className="bg-neutral-800/40 border border-neutral-800 p-2.5 rounded-xl">
              <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-0.5">
                Min Acceptable
              </span>
              <span className="text-sm font-mono font-bold text-amber-400">
                {formatCurrency(minRequiredBid)}
              </span>
            </div>
          </div>

          {/* Current Owner Card if Claimed */}
          {cell.claim && (
            <div className="bg-neutral-800/30 border border-neutral-800 p-3 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {cell.company?.logo_url ? (
                  <div className="w-7 h-7 relative flex items-center justify-center shrink-0">
                    <Image
                      src={cell.company.logo_url}
                      alt={cell.company.name}
                      width={28}
                      height={28}
                      className="max-h-full max-w-full object-contain"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-neutral-700 flex items-center justify-center shrink-0">
                    <Building2 className="w-3.5 h-3.5 text-neutral-400" />
                  </div>
                )}
                <div>
                  <span className="text-[9px] uppercase font-bold text-neutral-400 block">
                    Current Leader
                  </span>
                  <span className="text-xs font-semibold text-white">
                    {cell.company?.name || 'Company'} (${cell.claim.current_bid})
                  </span>
                </div>
              </div>

              <span className="text-[11px] font-mono text-neutral-400">
                {bids.length} {bids.length === 1 ? 'bid' : 'bids'}
              </span>
            </div>
          )}

          {/* Special Lock Notice */}
          {isSpecial && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                isLocked
                  ? 'bg-red-950/30 border-red-500/40 text-red-300'
                  : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
              }`}
            >
              {isLocked ? (
                <Lock className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              ) : (
                <Clock className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              )}
              <div className="text-xs">
                <span className="font-bold block">
                  {isLocked ? '7-Day Protection Lock Active' : '7-Day Lock Protection'}
                </span>
                {isLocked ? (
                  <p className="mt-0.5 text-neutral-300">
                    Bidding is closed for another{' '}
                    <strong className="text-white font-mono">{countdown}</strong>.
                  </p>
                ) : (
                  <p className="mt-0.5 text-neutral-300">
                    Winning this Special Position locks it exclusively for <strong>7 days</strong>.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="p-3 bg-red-950/40 border border-red-500/50 rounded-xl flex items-start gap-2 text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/50 rounded-xl flex items-start gap-2 text-xs text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* BIDDING FORM: ASKS FOR BID AMOUNT AND ONLY 3 DETAILS (NAME, WEBSITE URL, DESCRIPTION) */}
          {!isLocked ? (
            <form onSubmit={handlePlaceBid} className="flex flex-col gap-3.5">
              {/* 1. Bid Amount */}
              <div>
                <label className="block text-xs font-bold text-neutral-200 mb-1">
                  Your Bid Amount (USD) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-neutral-400 text-lg">
                    $
                  </span>
                  <input
                    type="number"
                    step="1"
                    min={minRequiredBid}
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder={minRequiredBid.toString()}
                    className="w-full pl-8 pr-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-white font-mono font-black text-xl focus:outline-hidden focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                  />
                </div>

                {/* Quick Add Chips */}
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 mr-1">
                    Quick Add:
                  </span>
                  {[1, 5, 10, 25].map((inc) => (
                    <button
                      key={inc}
                      type="button"
                      onClick={() => addIncrement(inc)}
                      className="px-2 py-0.5 text-xs font-mono font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-lg transition-colors cursor-pointer"
                    >
                      +${inc}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Detail 1: Company / Bidder Name */}
              <div>
                <label className="block text-xs font-bold text-neutral-200 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  <span>Name *</span>
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Corp, Solana Labs, Alice"
                  className="w-full px-3.5 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-xs font-medium focus:outline-hidden focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                />
              </div>

              {/* 3. Detail 2: Website URL */}
              <div>
                <label className="block text-xs font-bold text-neutral-200 mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  <span>Website URL</span>
                </label>
                <input
                  type="text"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3.5 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-xs font-medium focus:outline-hidden focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                />
              </div>

              {/* 4. Detail 3: Description */}
              <div>
                <label className="block text-xs font-bold text-neutral-200 mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Description</span>
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short pitch or bio about your company/project"
                  className="w-full px-3.5 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-xs font-medium focus:outline-hidden focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all resize-none"
                />
              </div>

              {/* Submit Bid Button */}
              <button
                type="submit"
                disabled={isSubmitting || !companyName.trim()}
                className="w-full py-3 bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-neutral-950 font-black text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
              >
                {isSubmitting ? (
                  <span>Placing Bid...</span>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-neutral-950" />
                    <span>
                      Place Bid ({formatCurrency(parseFloat(bidAmount) || minRequiredBid)})
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="p-4 bg-neutral-800/40 rounded-xl text-center text-xs text-neutral-400">
              <Lock className="w-5 h-5 mx-auto mb-1 text-amber-500" />
              Bidding is temporarily locked for this position.
            </div>
          )}

          {/* Bid History Section */}
          <div className="pt-2 border-t border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Bid Audit History
              </h4>
              {cell.claim && (
                <button
                  type="button"
                  onClick={handleSimulateOutbid}
                  className="text-[10px] text-neutral-400 hover:text-amber-400 transition-colors underline cursor-pointer"
                  title="Simulate rival outbid to test live updates"
                >
                  ⚡ Simulate Rival Outbid
                </button>
              )}
            </div>
            <BidHistory bids={bids} />
          </div>
        </div>
      </div>
    </div>
  );
};

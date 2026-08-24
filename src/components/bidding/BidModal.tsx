'use client';

import React, { useState, useEffect } from 'react';
import { BoardCell } from '@/types/game';
import { formatCurrency } from '@/lib/config';
import { sounds } from '@/lib/sound';
import {
  X,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  CreditCard,
  Loader2,
  Globe,
} from 'lucide-react';
import Image from 'next/image';
import special99Img from '@/app/99usd.png';
import mineImg from '@/app/mine.png';

interface BidModalProps {
  cell: BoardCell | null;
  onClose: () => void;
  onBidSuccess?: () => void;
}

export const BidModal: React.FC<BidModalProps> = ({
  cell,
  onClose,
}) => {
  const [bidAmount, setBidAmount] = useState<string>('');
  const [websiteUrl, setWebsiteUrl] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [extractedLogo, setExtractedLogo] = useState<string | null>(null);
  const [extractedBrandColor, setExtractedBrandColor] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
        if (parsed.logo) setExtractedLogo(parsed.logo);
        if (parsed.brandColor) setExtractedBrandColor(parsed.brandColor);
      }
    } catch {
      // Ignore storage read error
    }
  }, []);

  // Function to fetch metadata from entered URL
  const fetchUrlMetadata = async (urlToFetch: string) => {
    const trimmed = urlToFetch.trim();
    if (!trimmed) {
      setExtractedLogo(null);
      setCompanyName('');
      setDescription('');
      return;
    }

    if (!trimmed.includes('.') && !trimmed.startsWith('http')) {
      return;
    }

    try {
      const res = await fetch(`/api/metadata?url=${encodeURIComponent(trimmed)}`);
      if (!res.ok) throw new Error('Failed to fetch metadata');
      const data = await res.json();

      if (data.success) {
        if (data.logo) setExtractedLogo(data.logo);
        if (data.brandColor) setExtractedBrandColor(data.brandColor);
        if (data.siteName || data.title) {
          setCompanyName(data.siteName || data.title);
        }
        if (data.description) {
          setDescription(data.description);
        }
      }
    } catch {
      // Fallback: extract domain for high-res Google favicon
      const hostname = trimmed.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
      if (hostname) {
        const fallback = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`;
        setExtractedLogo(fallback);
        const nameFallback = hostname.split('.')[0];
        setCompanyName(nameFallback.charAt(0).toUpperCase() + nameFallback.slice(1));
      }
    }
  };

  // Debounced metadata fetch on URL change
  useEffect(() => {
    if (!websiteUrl.trim()) {
      setExtractedLogo(null);
      setCompanyName('');
      setDescription('');
      return;
    }

    const timer = setTimeout(() => {
      fetchUrlMetadata(websiteUrl);
    }, 500);

    return () => clearTimeout(timer);
  }, [websiteUrl]);

  // Refresh cell bids and minimum bid amount
  useEffect(() => {
    if (!cell) return;
    setBidAmount(minRequiredBid.toString());
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [cell, minRequiredBid]);

  if (!cell) return null;

  const isSpecial = Boolean(cell.is_special);

  const handlePlaceBid = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const amountNum = parseFloat(bidAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMessage('Please enter a valid positive bid amount.');
      return;
    }

    if (amountNum < minRequiredBid) {
      setErrorMessage(
        `Bid of $${amountNum.toFixed(2)} is too low. The minimum acceptable bid is $${minRequiredBid.toFixed(2)}.`
      );
      sounds.playOutbid();
      return;
    }

    if (!websiteUrl.trim()) {
      setErrorMessage('Please enter your website URL.');
      return;
    }

    // Determine resolved company name
    let finalCompanyName = companyName.trim();
    if (!finalCompanyName && websiteUrl.trim()) {
      const hostname = websiteUrl.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
      if (hostname) {
        const namePart = hostname.split('.')[0];
        finalCompanyName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      }
    }
    if (!finalCompanyName) {
      finalCompanyName = 'Bidder';
    }

    setIsSubmitting(true);
    try {
      // 1. Persist profile locally for future bids
      try {
        localStorage.setItem(
          'sweeper_bidder_profile',
          JSON.stringify({
            name: finalCompanyName,
            website: websiteUrl.trim(),
            description: description.trim(),
            logo: extractedLogo,
            brandColor: extractedBrandColor,
          })
        );
      } catch {
        // Ignore
      }

      // 2. Request Dodo Payments checkout session from backend
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          positionId: cell.id,
          positionIndex: cell.position_index,
          amount: amountNum,
          companyName: finalCompanyName,
          website: websiteUrl.trim() || undefined,
          description: description.trim() || undefined,
          logoUrl: extractedLogo || undefined,
          brandColor: extractedBrandColor || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate checkout session.');
      }

      if (data.checkoutUrl) {
        setSuccessMessage('Redirecting to secure checkout...');
        sounds.playClick();
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('No checkout URL returned from payment server.');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/60">
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-bold text-white">
              Position #{cell.position_index}
            </h3>
            {isSpecial ? (
              <span className="text-[10px] bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded-full border border-amber-500/40 uppercase tracking-wider flex items-center gap-1">
                <Image
                  src={special99Img}
                  alt="$99"
                  width={14}
                  height={14}
                  className="w-3.5 h-3.5 object-contain"
                />
                Special $99
              </span>
            ) : cell.is_mine && !cell.claim ? (
              <span className="text-[10px] bg-red-500/20 text-red-400 font-bold px-2 py-0.5 rounded-full border border-red-500/40 uppercase tracking-wider flex items-center gap-1">
                <Image
                  src={mineImg}
                  alt="Mine"
                  width={14}
                  height={14}
                  className="w-3.5 h-3.5 object-contain"
                />
                Defuse & Claim
              </span>
            ) : (
              <span className="text-[10px] bg-neutral-800 text-neutral-400 font-medium px-2 py-0.5 rounded-full border border-neutral-700">
                Min: {formatCurrency(minRequiredBid)}
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handlePlaceBid} className="p-5 flex flex-col gap-4">
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

          {/* 1. Bid Amount Input & Suggested Quick Add Buttons */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-neutral-200">
                Bid Amount (USD)
              </label>
              <span className="text-[11px] font-mono text-neutral-400">
                Min: {formatCurrency(minRequiredBid)}
              </span>
            </div>

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
                className="w-full pl-8 pr-4 py-2.5 bg-neutral-800/80 border border-neutral-700 rounded-xl text-white font-mono font-bold text-lg focus:outline-hidden focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
              />
            </div>

            {/* Suggested Quick Add Buttons */}
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[10px] uppercase font-bold text-neutral-500 mr-1">
                Quick Add:
              </span>
              {[1, 5, 10, 25].map((inc) => (
                <button
                  key={inc}
                  type="button"
                  onClick={() => addIncrement(inc)}
                  className="px-2.5 py-1 text-xs font-mono font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700/80 rounded-lg transition-colors cursor-pointer"
                >
                  +${inc}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Website URL */}
          <div>
            <label className="block text-xs font-bold text-neutral-200 mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-neutral-400" />
              <span>Website URL</span>
            </label>
            <input
              type="text"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3.5 py-2.5 bg-neutral-800/80 border border-neutral-700 rounded-xl text-white text-xs font-medium focus:outline-hidden focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
            />
          </div>

          {/* 3. Extracted Metadata Info */}
          {(extractedLogo || companyName || description) && (
            <div className="bg-neutral-800/40 border border-neutral-700/60 rounded-xl p-3 flex items-start gap-3 animate-in fade-in duration-200">
              {extractedLogo && (
                <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-neutral-700/80 p-1.5 flex items-center justify-center shrink-0 shadow-inner">
                  <Image
                    src={extractedLogo}
                    alt={companyName || 'Logo'}
                    width={28}
                    height={28}
                    className="max-h-full max-w-full object-contain"
                    unoptimized
                    onError={() => {
                      const hostname = websiteUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
                      if (hostname) {
                        setExtractedLogo(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`);
                      }
                    }}
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate">
                  {companyName || websiteUrl.replace(/^https?:\/\//i, '')}
                </div>
                {description && (
                  <p className="text-[11px] text-neutral-400 line-clamp-2 mt-0.5 leading-relaxed">
                    {description}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 4. Place Bid Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-1 py-3 bg-linear-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 disabled:opacity-50 text-neutral-950 font-bold text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-neutral-950" />
                <span>Connecting to Checkout...</span>
              </span>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                <span>
                  Place Bid ({formatCurrency(parseFloat(bidAmount) || minRequiredBid)})
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

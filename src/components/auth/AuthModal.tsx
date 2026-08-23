'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { X, Building2, Plus, Check, ShieldCheck, Sparkles } from 'lucide-react';
import Image from 'next/image';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { currentCompany, allCompanies, loginAsCompany, registerCompany } = useAuth();
  const [tab, setTab] = useState<'switch' | 'register'>('switch');

  // Register Form State
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [brandColor, setBrandColor] = useState('#3B82F6');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFetchWebsiteMetadata = async (urlStr: string) => {
    const trimmed = urlStr.trim();
    if (!trimmed || (!trimmed.includes('.') && !trimmed.startsWith('http'))) return;
    setIsLoadingMetadata(true);
    try {
      const res = await fetch(`/api/metadata?url=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.logo) setLogoUrl(data.logo);
          if (data.brandColor) setBrandColor(data.brandColor);
          if (!name.trim() && (data.siteName || data.title)) setName(data.siteName || data.title);
          if (!description.trim() && data.description) setDescription(data.description);
        }
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Company name is required.');
      return;
    }

    try {
      registerCompany({
        name: name.trim(),
        website: website.trim() || undefined,
        description: description.trim() || undefined,
        brand_color: brandColor,
        logo_url: logoUrl || undefined,
      });
      onClose();
    } catch {
      setError('Failed to create company.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-800/50">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold text-white">Company Authentication</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-800 bg-neutral-900/60 text-xs font-semibold">
          <button
            onClick={() => setTab('switch')}
            className={`flex-1 py-3 text-center transition-colors border-b-2 ${
              tab === 'switch'
                ? 'border-blue-500 text-blue-400 bg-neutral-800/40'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Switch Active Company
          </button>
          <button
            onClick={() => setTab('register')}
            className={`flex-1 py-3 text-center transition-colors border-b-2 ${
              tab === 'register'
                ? 'border-blue-500 text-blue-400 bg-neutral-800/40'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            + Register New Company
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {tab === 'switch' ? (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-neutral-400 mb-1">
                Select a company profile to place bids and represent in real-time auctions:
              </p>

              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                {allCompanies.map((c) => {
                  const isSelected = currentCompany?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        loginAsCompany(c.id);
                        onClose();
                      }}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all text-left ${
                        isSelected
                          ? 'bg-blue-950/40 border-blue-500/80 shadow-xs'
                          : 'bg-neutral-800/40 border-neutral-800 hover:bg-neutral-800/80 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {c.logo_url ? (
                          <div className="w-7 h-7 relative flex items-center justify-center shrink-0">
                            <Image
                              src={c.logo_url}
                              alt={c.name}
                              width={28}
                              height={28}
                              className="max-h-full max-w-full object-contain"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ backgroundColor: c.brand_color }}
                          >
                            {c.name[0]}
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-bold text-white flex items-center gap-1.5">
                            <span>{c.name}</span>
                            {c.slug === 'sweeper-labs' && (
                              <span className="text-[9px] bg-purple-500/20 text-purple-300 font-bold px-1 rounded-sm">
                                Admin
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-neutral-400 line-clamp-1">
                            {c.description || 'Verified bidder'}
                          </p>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="flex flex-col gap-3.5">
              {error && (
                <div className="p-2.5 bg-red-950/40 border border-red-500/40 rounded-lg text-xs text-red-200">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. OpenAI, Meta, Acme Corp"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1 flex items-center justify-between">
                  <span>Website (Auto-fetches Logo)</span>
                  {isLoadingMetadata && <span className="text-[10px] text-amber-400">Loading logo...</span>}
                </label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => {
                    setWebsite(e.target.value);
                  }}
                  onBlur={() => {
                    if (website.trim()) handleFetchWebsiteMetadata(website);
                  }}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {logoUrl && (
                <div className="bg-neutral-800/80 border border-neutral-700 p-2.5 rounded-xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-700 p-1 flex items-center justify-center shrink-0">
                    <Image
                      src={logoUrl}
                      alt="Logo preview"
                      width={24}
                      height={24}
                      className="max-h-full max-w-full object-contain"
                      unoptimized
                    />
                  </div>
                  <div className="text-xs text-neutral-300 truncate">
                    <span className="font-bold text-amber-400 block text-[11px]">Logo Auto-Detected</span>
                    <span className="text-[10px] text-neutral-400">Will be displayed on Minesweeper grid</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Bio / Tagline (Optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. AI infrastructure leaders"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Brand Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="w-10 h-10 rounded-lg bg-transparent border-0 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-neutral-400">{brandColor}</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 mt-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Company & Sign In</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

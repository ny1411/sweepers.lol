'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Company, Profile } from '@/types/game';
import { gameEngine } from '@/lib/game/engine';

interface AuthContextType {
  currentUser: Profile | null;
  currentCompany: Company | null;
  allCompanies: Company[];
  isAuthenticated: boolean;
  isLoading: boolean;
  loginAsCompany: (companyId: string) => void;
  registerCompany: (data: {
    name: string;
    website?: string;
    description?: string;
    brand_color?: string;
    logo_url?: string;
  }) => Promise<Company>;
  logout: () => void;
  refreshCompanies: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const syncUserWithCompany = (target: Company) => {
    setCurrentCompany(target);
    setCurrentUser({
      id: `user-${target.id}`,
      email: `contact@${target.slug || 'company'}.com`,
      company_id: target.id,
      full_name: `${target.name} Representative`,
      avatar_url: target.logo_url,
      role: target.slug === 'sweeper-labs' ? 'admin' : 'user',
      company: target,
    });
  };

  const loadCompaniesAndSession = async () => {
    try {
      setIsLoading(true);
      const companies = await gameEngine.refreshCompanies();
      setAllCompanies(companies);

      const savedCompanyId = typeof window !== 'undefined' ? localStorage.getItem('sweeper_active_company_id') : null;
      const target = companies.find((c) => c.id === savedCompanyId) || companies[0] || null;

      if (target) {
        syncUserWithCompany(target);
      }
    } catch (err) {
      console.error('Error loading companies in AuthContext:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCompaniesAndSession();

    const unsubscribe = gameEngine.subscribe(({ type }) => {
      if (type === 'COMPANIES_UPDATED' || type === 'SYNC_STATE') {
        const companies = gameEngine.getCompanies();
        setAllCompanies(companies);

        // Keep active company in sync
        setCurrentCompany((prev) => {
          if (!prev) return companies[0] || null;
          const updated = companies.find((c) => c.id === prev.id);
          return updated || prev;
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const loginAsCompany = (companyId: string) => {
    const company = allCompanies.find((c) => c.id === companyId);
    if (company) {
      syncUserWithCompany(company);
      if (typeof window !== 'undefined') {
        localStorage.setItem('sweeper_active_company_id', company.id);
      }
    }
  };

  const registerCompany = async (data: {
    name: string;
    website?: string;
    description?: string;
    brand_color?: string;
    logo_url?: string;
  }): Promise<Company> => {
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    let logoUrl = data.logo_url;
    if (!logoUrl && data.website) {
      const hostname = data.website.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
      if (hostname) {
        logoUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`;
      }
    }
    if (!logoUrl) {
      logoUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(data.name)}`;
    }

    const newCompany = await gameEngine.addCompany({
      name: data.name.trim(),
      slug,
      logo_url: logoUrl,
      website: data.website || null,
      description: data.description || null,
      brand_color: data.brand_color || '#3B82F6',
    });

    const updatedCompanies = gameEngine.getCompanies();
    setAllCompanies(updatedCompanies);
    loginAsCompany(newCompany.id);
    return newCompany;
  };

  const logout = () => {
    setCurrentCompany(null);
    setCurrentUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sweeper_active_company_id');
    }
  };

  const refreshCompanies = async () => {
    const updated = await gameEngine.refreshCompanies();
    setAllCompanies(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentCompany,
        allCompanies,
        isAuthenticated: Boolean(currentCompany),
        isLoading,
        loginAsCompany,
        registerCompany,
        logout,
        refreshCompanies,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

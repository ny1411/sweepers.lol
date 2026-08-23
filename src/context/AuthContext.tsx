'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Company, Profile } from '@/types/game';
import { gameEngine, DEFAULT_COMPANIES } from '@/lib/game/engine';

interface AuthContextType {
  currentUser: Profile | null;
  currentCompany: Company | null;
  allCompanies: Company[];
  isAuthenticated: boolean;
  loginAsCompany: (companyId: string) => void;
  registerCompany: (data: { name: string; website?: string; description?: string; brand_color?: string }) => Company;
  logout: () => void;
  refreshCompanies: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [allCompanies, setAllCompanies] = useState<Company[]>(DEFAULT_COMPANIES);

  useEffect(() => {
    // Load companies and active session
    const companies = gameEngine.getCompanies();
    setAllCompanies(companies);

    const savedCompanyId = localStorage.getItem('sweeper_active_company_id');
    const target = companies.find((c) => c.id === savedCompanyId) || companies[0]; // Default to Apple for instant gameplay

    if (target) {
      setCurrentCompany(target);
      setCurrentUser({
        id: `user-${target.id}`,
        email: `ceo@${target.slug}.com`,
        company_id: target.id,
        full_name: `${target.name} Representative`,
        avatar_url: target.logo_url,
        role: target.slug === 'sweeper-labs' ? 'admin' : 'user',
        company: target,
      });
    }

    const unsubscribe = gameEngine.subscribe(({ type }) => {
      if (type === 'COMPANIES_UPDATED' || type === 'SYNC_STATE') {
        setAllCompanies(gameEngine.getCompanies());
      }
    });

    return () => unsubscribe();
  }, []);

  const loginAsCompany = (companyId: string) => {
    const company = allCompanies.find((c) => c.id === companyId);
    if (company) {
      setCurrentCompany(company);
      setCurrentUser({
        id: `user-${company.id}`,
        email: `rep@${company.slug}.com`,
        company_id: company.id,
        full_name: `${company.name} Agent`,
        avatar_url: company.logo_url,
        role: company.slug === 'sweeper-labs' ? 'admin' : 'user',
        company,
      });
      localStorage.setItem('sweeper_active_company_id', company.id);
    }
  };

  const registerCompany = (data: {
    name: string;
    website?: string;
    description?: string;
    brand_color?: string;
  }): Company => {
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const newCompany = gameEngine.addCompany({
      name: data.name,
      slug,
      logo_url: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(data.name)}`,
      website: data.website || null,
      description: data.description || null,
      brand_color: data.brand_color || '#3B82F6',
    });

    setAllCompanies(gameEngine.getCompanies());
    loginAsCompany(newCompany.id);
    return newCompany;
  };

  const logout = () => {
    setCurrentCompany(null);
    setCurrentUser(null);
    localStorage.removeItem('sweeper_active_company_id');
  };

  const refreshCompanies = () => {
    setAllCompanies(gameEngine.getCompanies());
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentCompany,
        allCompanies,
        isAuthenticated: Boolean(currentCompany),
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

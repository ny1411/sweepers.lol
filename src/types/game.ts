export type PositionType = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | 'SPECIAL' | 'MINE';

export interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website: string | null;
  description: string | null;
  brand_color: string;
  created_at?: string;
  updated_at?: string;
}

export interface Profile {
  id: string;
  email: string;
  company_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin';
  company?: Company | null;
}

export interface Board {
  id: string;
  name: string;
  slug: string;
  rows: number;
  columns: number;
  status: 'active' | 'paused' | 'archived';
  reveal_radius: number;
  reveal_diagonals: boolean;
  auto_reveal_empty: boolean;
  min_bid_increment: number;
  special_lock_duration_hours: number;
  is_active: boolean;
  created_at?: string;
}

export interface Position {
  id: string;
  board_id: string;
  row: number;
  col: number;
  position_type: PositionType;
  base_value: number;
  is_special: boolean;
  is_mine?: boolean;
  created_at?: string;
}

export interface Bid {
  id: string;
  position_id: string;
  company_id: string;
  user_id?: string | null;
  amount: number;
  previous_bid?: number | null;
  created_at: string;
  company?: Company;
}

export interface PositionClaim {
  id: string;
  position_id: string;
  company_id: string;
  winning_bid_id: string;
  current_bid: number;
  claimed_at: string;
  lock_until?: string | null;
  updated_at?: string;
  company?: Company;
}

export interface BoardCell {
  id: string;
  row: number;
  col: number;
  position_index: number;
  is_discovered: boolean;
  is_newly_discovered?: boolean;
  is_flagged?: boolean;
  is_mine?: boolean;
  adjacent_hazards_count?: number;
  position_type?: PositionType;
  base_value?: number;
  is_special?: boolean;
  current_bid?: number;
  claim?: PositionClaim | null;
  company?: Company | null;
  lock_until?: string | null;
  is_locked?: boolean;
  bid_count?: number;
}

export interface GameNotification {
  id: string;
  user_id?: string | null;
  company_id: string;
  type: 'outbid' | 'bid_placed' | 'position_won' | 'special_claimed' | 'special_unlocked';
  title: string;
  message: string;
  position_id?: string | null;
  amount?: number | null;
  is_read: boolean;
  created_at: string;
}

export interface LeaderboardEntry {
  company: Company;
  territoryCount: number;
  totalValuation: number;
  activeBidsCount: number;
  highestBid: number;
  isSpecialOwner: boolean;
}

export interface GameStats {
  totalCells: number;
  discoveredCells: number;
  claimedCells: number;
  totalMines: number;
  remainingMines: number;
  flaggedCount: number;
  totalMarketCap: number;
  activeBidders: number;
  highestBid: number;
  specialLocked: boolean;
  specialLockTimeLeft?: string | null;
}

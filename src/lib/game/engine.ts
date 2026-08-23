import {
  Company,
  Board,
  Position,
  Bid,
  PositionClaim,
  BoardCell,
  GameNotification,
  LeaderboardEntry,
  GameStats,
  PositionType,
} from '@/types/game';
import { GAME_CONFIG } from '@/lib/config';
import { createClient, isRealSupabaseConfigured } from '@/lib/supabase/client';

export const DEFAULT_BOARD_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

export const DEFAULT_BOARD: Board = {
  id: DEFAULT_BOARD_ID,
  name: 'Main Arena 10x10',
  slug: 'main-arena',
  rows: 10,
  columns: 10,
  status: 'active',
  reveal_radius: 1,
  reveal_diagonals: true,
  auto_reveal_empty: true,
  min_bid_increment: 1.0,
  special_lock_duration_hours: 168, // 7 days
  is_active: true,
};

// Generate standard 10x10 positions helper
export function generateInitialPositions(boardId: string, rows = 10, cols = 10): Position[] {
  const positions: Position[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isSpecial = r === 1 && c === 2; // Position #13 ($99 Coin at (1,2))
      let pType: PositionType = '1';
      let baseVal = 1.0;
      if (isSpecial) {
        pType = 'SPECIAL';
        baseVal = 99.0;
      } else if ((r + c) % 3 === 0) {
        pType = '1';
        baseVal = 1.0;
      } else if ((r + c) % 3 === 1) {
        pType = '2';
        baseVal = 3.0;
      } else {
        pType = '3';
        baseVal = 5.0;
      }

      positions.push({
        id: `pos-${boardId}-${r}-${c}`,
        board_id: boardId,
        row: r,
        col: c,
        position_type: pType,
        base_value: baseVal,
        is_special: isSpecial,
      });
    }
  }
  return positions;
}

class GameEngineService {
  private supabase = createClient();
  private companies: Company[] = [];
  private boards: Board[] = [DEFAULT_BOARD];
  private positions: Position[] = [];
  private bids: Bid[] = [];
  private claims: PositionClaim[] = [];
  private discoveries: Record<string, Set<string>> = {}; // user_id -> Set of position_ids
  private notifications: GameNotification[] = [];
  private listeners: Set<(event: { type: string; payload?: unknown }) => void> = new Set();
  private isInitialized = false;
  private realtimeChannel: ReturnType<typeof this.supabase.channel> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      await this.loadAllFromSupabase();
      this.setupRealtimeSubscription();
    } catch (err) {
      console.error('Failed to initialize Supabase game state:', err);
    }
  }

  // Subscribe to live Postgres changes across all game tables
  private setupRealtimeSubscription() {
    if (typeof window === 'undefined' || this.realtimeChannel) return;

    try {
      this.realtimeChannel = this.supabase
        .channel('sweeper-live-game')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'position_claims' },
          async () => {
            await this.refreshClaims();
            this.notifyListeners('BID_PLACED');
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bids' },
          async () => {
            await this.refreshBids();
            this.notifyListeners('SYNC_STATE');
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'companies' },
          async () => {
            await this.refreshCompanies();
            this.notifyListeners('COMPANIES_UPDATED');
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications' },
          async () => {
            await this.refreshNotifications();
            this.notifyListeners('NOTIFICATIONS_UPDATED');
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Supabase Realtime] Connected to live game channel');
          }
        });
    } catch (err) {
      console.warn('[Supabase Realtime] Could not initialize realtime channel:', err);
    }
  }

  public async loadAllFromSupabase() {
    await Promise.all([
      this.refreshCompanies(),
      this.refreshBoardAndPositions(),
      this.refreshClaims(),
      this.refreshBids(),
      this.refreshNotifications(),
    ]);
    this.notifyListeners('SYNC_STATE');
  }

  public async refreshCompanies(): Promise<Company[]> {
    try {
      const { data, error } = await this.supabase
        .from('companies')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      if (data) {
        this.companies = data as Company[];
      }
    } catch (err) {
      console.error('Error fetching companies from Supabase:', err);
    }
    return this.companies;
  }

  public async refreshBoardAndPositions() {
    try {
      // 1. Fetch Board
      const { data: boardData } = await this.supabase
        .from('boards')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (boardData) {
        this.boards = [boardData as Board];
      }

      const activeBoardId = this.boards[0]?.id || DEFAULT_BOARD_ID;

      // 2. Fetch Positions
      const { data: posData, error } = await this.supabase
        .from('positions')
        .select('*')
        .eq('board_id', activeBoardId)
        .order('row', { ascending: true })
        .order('col', { ascending: true });

      if (error) throw error;

      if (posData && posData.length > 0) {
        this.positions = posData as Position[];
      } else {
        // Fallback positions matching 10x10 if database is not yet seeded
        this.positions = generateInitialPositions(activeBoardId);
      }
    } catch (err) {
      console.error('Error fetching board positions from Supabase:', err);
      if (this.positions.length === 0) {
        this.positions = generateInitialPositions(DEFAULT_BOARD_ID);
      }
    }
  }

  public async refreshClaims(): Promise<PositionClaim[]> {
    try {
      const { data, error } = await this.supabase
        .from('position_claims')
        .select('*, company:companies(*)');

      if (error) throw error;
      if (data) {
        this.claims = data.map((item) => ({
          ...item,
          company: (item.company as unknown as Company) || this.companies.find((c) => c.id === item.company_id),
        }));
      }
    } catch (err) {
      console.error('Error fetching claims from Supabase:', err);
    }
    return this.claims;
  }

  public async refreshBids(): Promise<Bid[]> {
    try {
      const { data, error } = await this.supabase
        .from('bids')
        .select('*, company:companies(*)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      if (data) {
        this.bids = data.map((item) => ({
          ...item,
          company: (item.company as unknown as Company) || this.companies.find((c) => c.id === item.company_id),
        }));
      }
    } catch (err) {
      console.error('Error fetching bids from Supabase:', err);
    }
    return this.bids;
  }

  public async refreshNotifications(): Promise<GameNotification[]> {
    try {
      const { data, error } = await this.supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      if (data) {
        this.notifications = data as GameNotification[];
      }
    } catch (err) {
      console.error('Error fetching notifications from Supabase:', err);
    }
    return this.notifications;
  }

  public subscribe(callback: (event: { type: string; payload?: unknown }) => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(type: string, payload?: unknown) {
    this.listeners.forEach((cb) => {
      try {
        cb({ type, payload });
      } catch {
        // Ignore listener error
      }
    });
  }

  public getCompanies(): Company[] {
    return this.companies;
  }

  public getCompanyById(id: string): Company | undefined {
    return this.companies.find((c) => c.id === id);
  }

  public async addCompany(company: Omit<Company, 'id'>): Promise<Company> {
    try {
      const slug = company.slug || company.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const { data, error } = await this.supabase
        .from('companies')
        .insert({
          name: company.name,
          slug,
          logo_url: company.logo_url || null,
          website: company.website || null,
          description: company.description || null,
          brand_color: company.brand_color || '#3B82F6',
        })
        .select()
        .single();

      if (error) throw error;
      const created = data as Company;
      this.companies.push(created);
      this.notifyListeners('COMPANIES_UPDATED');
      return created;
    } catch (err) {
      console.error('Failed to create company in Supabase:', err);
      // Fallback in-memory object
      const fallback: Company = {
        ...company,
        id: crypto.randomUUID ? crypto.randomUUID() : `company-${Date.now()}`,
      };
      this.companies.push(fallback);
      return fallback;
    }
  }

  public getBoard(boardId?: string): Board {
    if (!boardId) return this.boards[0] || DEFAULT_BOARD;
    return this.boards.find((b) => b.id === boardId) || this.boards[0] || DEFAULT_BOARD;
  }

  public getAllBoards(): Board[] {
    return this.boards;
  }

  // Progressive Minesweeper Cell Discovery (Fog of War)
  public revealCells(boardId: string, centerRow: number, centerCol: number, userId: string): BoardCell[] {
    const board = this.getBoard(boardId);
    const radius = board.reveal_radius ?? 1;

    if (!this.discoveries[userId]) {
      this.discoveries[userId] = new Set();
    }
    const userDiscoveries = this.discoveries[userId];

    const newlyDiscovered: BoardCell[] = [];

    this.positions
      .filter((p) => p.board_id === board.id || !p.board_id)
      .forEach((pos) => {
        const rowDiff = Math.abs(pos.row - centerRow);
        const colDiff = Math.abs(pos.col - centerCol);

        let inRange = false;
        if (board.reveal_diagonals) {
          inRange = rowDiff <= radius && colDiff <= radius;
        } else {
          inRange = rowDiff + colDiff <= radius;
        }

        if (inRange) {
          userDiscoveries.add(pos.id);
          const cell = this.getCellState(pos, true);
          newlyDiscovered.push({ ...cell, is_newly_discovered: true });
        }
      });

    this.notifyListeners('CELLS_REVEALED', { newlyDiscovered });
    return newlyDiscovered;
  }

  // Reset Fog of War discoveries for a user
  public resetDiscoveries(userId?: string) {
    if (userId) {
      delete this.discoveries[userId];
    } else {
      this.discoveries = {};
    }
    this.notifyListeners('CELLS_REVEALED', { newlyDiscovered: [] });
  }

  // Get full board cells for a user
  public getBoardCells(boardId: string, userId: string): BoardCell[] {
    const board = this.getBoard(boardId);
    const userDiscoveries = this.discoveries[userId] || new Set();

    let boardPositions = this.positions.filter((p) => p.board_id === board.id);
    if (boardPositions.length === 0) {
      boardPositions = this.positions;
    }

    return boardPositions.map((pos) => {
      const isDiscovered = userDiscoveries.has(pos.id);
      return this.getCellState(pos, isDiscovered);
    });
  }

  // Calculate dynamic Minesweeper base value: $1 if 0 neighbors, $3 if 1 neighbor, $5 if 2+ neighbors
  public calculateBaseValue(pos: Position): { baseValue: number; positionType: PositionType } {
    if (pos.is_special) {
      return { baseValue: 99.0, positionType: 'SPECIAL' };
    }

    // Count adjacent claimed positions (8 neighbors: dx in [-1,0,1], dy in [-1,0,1], excluding pos itself)
    let adjacentClaimsCount = 0;
    for (const claim of this.claims) {
      const claimedPos = this.positions.find((p) => p.id === claim.position_id);
      if (!claimedPos) continue;
      if (claimedPos.row === pos.row && claimedPos.col === pos.col) continue;

      const rowDiff = Math.abs(claimedPos.row - pos.row);
      const colDiff = Math.abs(claimedPos.col - pos.col);
      if (rowDiff <= 1 && colDiff <= 1) {
        adjacentClaimsCount++;
      }
    }

    if (adjacentClaimsCount === 0) {
      return { baseValue: 1.0, positionType: '1' };
    } else if (adjacentClaimsCount === 1) {
      return { baseValue: 3.0, positionType: '2' };
    } else {
      return { baseValue: 5.0, positionType: '3' };
    }
  }

  private getCellState(pos: Position, isDiscovered: boolean): BoardCell {
    const claim = this.claims.find((c) => c.position_id === pos.id);
    const company = claim ? (claim.company || this.companies.find((c) => c.id === claim.company_id)) : null;
    const positionBids = this.bids.filter((b) => b.position_id === pos.id);

    const isLocked = Boolean(
      claim?.lock_until && new Date(claim.lock_until).getTime() > Date.now()
    );

    const dynamic = this.calculateBaseValue(pos);

    return {
      id: pos.id,
      row: pos.row,
      col: pos.col,
      position_index: pos.row * 10 + pos.col + 1,
      is_discovered: isDiscovered,
      position_type: isDiscovered ? (pos.is_special ? 'SPECIAL' : dynamic.positionType) : undefined,
      base_value: isDiscovered ? (pos.is_special ? 99.0 : dynamic.baseValue) : undefined,
      is_special: isDiscovered ? pos.is_special : undefined,
      current_bid: isDiscovered && claim ? claim.current_bid : undefined,
      claim: isDiscovered && claim ? { ...claim, company: company || undefined } : null,
      company: isDiscovered ? company : null,
      lock_until: isDiscovered ? claim?.lock_until : null,
      is_locked: isDiscovered ? isLocked : false,
      bid_count: isDiscovered ? positionBids.length : 0,
    };
  }

  // ATOMIC PLACE BID FUNCTION VIA SUPABASE RPC
  public async placeBid(
    positionId: string,
    amount: number,
    userId: string,
    companyId: string
  ): Promise<{ success: boolean; message: string; claim?: PositionClaim }> {
    const position = this.positions.find((p) => p.id === positionId);
    if (!position) {
      throw new Error('Position not found on the grid.');
    }

    const company = this.companies.find((c) => c.id === companyId);
    if (!company) {
      throw new Error('Company not found. Please select or register a valid company.');
    }

    // Call atomic Supabase RPC place_bid
    try {
      const { data, error } = await this.supabase.rpc('place_bid', {
        p_position_id: positionId,
        p_amount: amount,
        p_user_id: null,
        p_company_id: companyId,
      });

      if (error) {
        throw new Error(error.message);
      }

      // Re-fetch claims and bids to synchronize state
      await Promise.all([this.refreshClaims(), this.refreshBids(), this.refreshNotifications()]);
      this.notifyListeners('BID_PLACED');

      const updatedClaim = this.claims.find((c) => c.position_id === positionId);
      return {
        success: true,
        message: (data as { message?: string })?.message || 'Bid placed successfully!',
        claim: updatedClaim,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to place bid.';
      throw new Error(message);
    }
  }

  // Seamless Bidding with company fields (Name, Website URL, Description, Logo URL, Brand Color)
  public async placeBidWithDetails(params: {
    positionId: string;
    amount: number;
    name: string;
    website?: string;
    description?: string;
    logoUrl?: string;
    brandColor?: string;
  }): Promise<{ success: boolean; message: string; claim?: PositionClaim; company: Company }> {
    const { positionId, amount, name, website, description, logoUrl, brandColor } = params;
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Please enter a company or bidder name.');
    }

    // Format website URL
    let formattedWebsite = website?.trim() || null;
    if (formattedWebsite && !/^https?:\/\//i.test(formattedWebsite)) {
      formattedWebsite = `https://${formattedWebsite}`;
    }

    // Determine fallback or extracted logo
    let finalLogoUrl = logoUrl?.trim() || null;
    if (!finalLogoUrl && formattedWebsite) {
      const hostname = formattedWebsite.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
      if (hostname) {
        finalLogoUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`;
      }
    }
    if (!finalLogoUrl) {
      finalLogoUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(trimmedName)}`;
    }

    // 1. Query Supabase for existing company by name or insert new
    let company: Company | null = null;
    const { data: existingCompany } = await this.supabase
      .from('companies')
      .select('*')
      .ilike('name', trimmedName)
      .single();

    if (existingCompany) {
      company = existingCompany as Company;
      // Update details if changed
      await this.supabase
        .from('companies')
        .update({
          website: formattedWebsite || company.website,
          description: description?.trim() || company.description,
          logo_url: finalLogoUrl || company.logo_url,
          brand_color: brandColor || company.brand_color,
          updated_at: new Date().toISOString(),
        })
        .eq('id', company.id);
    } else {
      const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const { data: newCompany, error: insertError } = await this.supabase
        .from('companies')
        .insert({
          name: trimmedName,
          slug,
          website: formattedWebsite,
          description: description?.trim() || 'Active grid bidder.',
          logo_url: finalLogoUrl,
          brand_color: brandColor || '#3B82F6',
        })
        .select()
        .single();

      if (insertError) throw insertError;
      company = newCompany as Company;
    }

    await this.refreshCompanies();

    const userId = `user-${company.id}`;
    const result = await this.placeBid(positionId, amount, userId, company.id);
    return { ...result, company };
  }

  // Get Bid History for a cell
  public getBidHistory(positionId: string): Bid[] {
    return this.bids
      .filter((b) => b.position_id === positionId)
      .map((b) => ({
        ...b,
        company: b.company || this.companies.find((c) => c.id === b.company_id),
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  // Get Leaderboard Data
  public getLeaderboard(): LeaderboardEntry[] {
    return this.companies.map((company) => {
      const companyClaims = this.claims.filter((c) => c.company_id === company.id);
      const companyBids = this.bids.filter((b) => b.company_id === company.id);
      const totalValuation = companyClaims.reduce((acc, c) => acc + c.current_bid, 0);
      const highestBid = companyBids.reduce((max, b) => Math.max(max, b.amount), 0);
      const isSpecialOwner = companyClaims.some((c) => {
        const pos = this.positions.find((p) => p.id === c.position_id);
        return pos?.is_special;
      });

      return {
        company,
        territoryCount: companyClaims.length,
        totalValuation,
        activeBidsCount: companyBids.length,
        highestBid,
        isSpecialOwner,
      };
    }).sort((a, b) => {
      if (b.territoryCount !== a.territoryCount) {
        return b.territoryCount - a.territoryCount;
      }
      return b.totalValuation - a.totalValuation;
    });
  }

  // Get Top Companies by Highest Bid Amount Across Entire Board
  public getTopCompanies(limit = 3): LeaderboardEntry[] {
    return this.companies
      .map((company) => {
        const companyClaims = this.claims.filter((c) => c.company_id === company.id);
        const companyBids = this.bids.filter((b) => b.company_id === company.id);
        const totalValuation = companyClaims.reduce((acc, c) => acc + c.current_bid, 0);
        
        const highestFromBids = companyBids.reduce((max, b) => Math.max(max, b.amount), 0);
        const highestFromClaims = companyClaims.reduce((max, c) => Math.max(max, c.current_bid), 0);
        const highestBid = Math.max(highestFromBids, highestFromClaims);

        const isSpecialOwner = companyClaims.some((c) => {
          const pos = this.positions.find((p) => p.id === c.position_id);
          return pos?.is_special;
        });

        return {
          company,
          territoryCount: companyClaims.length,
          totalValuation,
          activeBidsCount: companyBids.length,
          highestBid,
          isSpecialOwner,
        };
      })
      .filter((entry) => entry.highestBid > 0 || entry.territoryCount > 0)
      .sort((a, b) => {
        if (b.highestBid !== a.highestBid) {
          return b.highestBid - a.highestBid;
        }
        if (b.territoryCount !== a.territoryCount) {
          return b.territoryCount - a.territoryCount;
        }
        return b.totalValuation - a.totalValuation;
      })
      .slice(0, limit);
  }

  // Get Company Positions & Stats
  public getCompanyPositions(companyId: string): BoardCell[] {
    const claims = this.claims.filter((c) => c.company_id === companyId);
    return claims.map((c) => {
      const pos = this.positions.find((p) => p.id === c.position_id);
      if (!pos) return null as unknown as BoardCell;
      return this.getCellState(pos, true);
    }).filter(Boolean);
  }

  // Get Notifications
  public getNotifications(companyId?: string): GameNotification[] {
    if (!companyId) return this.notifications.slice(0, 20);
    return this.notifications.filter((n) => n.company_id === companyId).slice(0, 20);
  }

  public async markNotificationAsRead(id: string) {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif) {
      notif.is_read = true;
      await this.supabase.from('notifications').update({ is_read: true }).eq('id', id);
      this.notifyListeners('NOTIFICATIONS_UPDATED');
    }
  }

  public async markAllNotificationsAsRead(companyId: string) {
    this.notifications.forEach((n) => {
      if (n.company_id === companyId) n.is_read = true;
    });
    await this.supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('company_id', companyId);
    this.notifyListeners('NOTIFICATIONS_UPDATED');
  }

  // Get High-Level Game Stats
  public getGameStats(boardId: string, userId: string): GameStats {
    const board = this.getBoard(boardId);
    let boardPositions = this.positions.filter((p) => p.board_id === board.id);
    if (boardPositions.length === 0) {
      boardPositions = this.positions;
    }

    const userDiscoveries = this.discoveries[userId] || new Set();
    const activeClaims = this.claims.filter((c) =>
      boardPositions.some((p) => p.id === c.position_id)
    );
    const totalMarketCap = activeClaims.reduce((sum, c) => sum + c.current_bid, 0);
    const uniqueBidders = new Set(this.bids.map((b) => b.company_id)).size;
    const highestBid = this.bids.reduce((max, b) => Math.max(max, b.amount), 0);

    const specialPos = boardPositions.find((p) => p.is_special);
    const specialClaim = specialPos ? this.claims.find((c) => c.position_id === specialPos.id) : null;
    const specialLocked = Boolean(
      specialClaim?.lock_until && new Date(specialClaim.lock_until).getTime() > Date.now()
    );

    return {
      totalCells: boardPositions.length || 100,
      discoveredCells: userDiscoveries.size,
      claimedCells: activeClaims.length,
      totalMarketCap,
      activeBidders: uniqueBidders,
      highestBid,
      specialLocked,
      specialLockTimeLeft: specialClaim?.lock_until,
    };
  }
}

export const gameEngine = new GameEngineService();

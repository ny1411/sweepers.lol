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

// Generate standard 10x10 positions helper with randomized special $99 coin placement
export function generateInitialPositions(boardId: string, rows = 10, cols = 10, specialRow?: number, specialCol?: number): Position[] {
  const positions: Position[] = [];
  const sRow = typeof specialRow === 'number' ? specialRow : Math.floor(Math.random() * rows);
  const sCol = typeof specialCol === 'number' ? specialCol : Math.floor(Math.random() * cols);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isSpecial = r === sRow && c === sCol;
      positions.push({
        id: `pos-${boardId}-${r}-${c}`,
        board_id: boardId,
        row: r,
        col: c,
        position_type: isSpecial ? 'SPECIAL' : '0',
        base_value: isSpecial ? 99.0 : 1.0,
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
  private flags: Record<string, Set<string>> = {}; // user_id -> Set of flagged position_ids
  private notifications: GameNotification[] = [];
  private listeners: Set<(event: { type: string; payload?: unknown }) => void> = new Set();
  private sessionSeed: number = typeof window !== 'undefined' ? Math.random() : 0.42;
  private isInitialized = false;
  private realtimeChannel: ReturnType<typeof this.supabase.channel> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.sessionSeed = Math.random();
      this.init();
    }
  }

  public async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      this.sessionSeed = Math.random();
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
    this.ensureRandomSpecialPosition();
    this.notifyListeners('SYNC_STATE');
  }

  // Ensure randomized special $99 coin position when no claim is currently holding it
  public ensureRandomSpecialPosition() {
    const hasSpecialClaim = this.claims.some((c) => {
      const pos = this.positions.find((p) => p.id === c.position_id);
      return pos?.is_special;
    });

    if (!hasSpecialClaim && this.positions.length > 0) {
      const claimedIds = new Set(this.claims.map((c) => c.position_id));
      const currentSpecial = this.positions.find((p) => p.is_special);

      // If current special is already claimed or none exists, pick a random unclaimed position
      if (!currentSpecial || claimedIds.has(currentSpecial.id)) {
        const unclaimed = this.positions.filter((p) => !claimedIds.has(p.id));
        if (unclaimed.length > 0) {
          this.positions.forEach((p) => {
            p.is_special = false;
          });
          const randPos = unclaimed[Math.floor(Math.random() * unclaimed.length)];
          randPos.is_special = true;
          randPos.position_type = 'SPECIAL';
          randPos.base_value = 99.0;
        }
      }
    }
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
      this.ensureRandomSpecialPosition();
    } catch (err) {
      console.error('Error fetching board positions from Supabase:', err);
      if (this.positions.length === 0) {
        this.positions = generateInitialPositions(DEFAULT_BOARD_ID);
      }
      this.ensureRandomSpecialPosition();
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

  private pseudoHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private activeMineIds: Set<string> | null = null;

  // Dynamic 15-hazard balance: (claims + mines >= 15).
  // If claims = 0 -> 15 mines. If claims = 5 -> 10 mines. If claims >= 15 -> 0 mines.
  // Randomly scattered across the board with uniform distribution (no chaining).
  public getActiveMinePositionIds(boardId?: string): Set<string> {
    const board = this.getBoard(boardId);
    let boardPositions = this.positions.filter((p) => p.board_id === board.id);
    if (boardPositions.length === 0) {
      boardPositions = this.positions;
    }

    const claimedPosIds = new Set(this.claims.map((c) => c.position_id));
    const claimedCount = boardPositions.filter((p) => claimedPosIds.has(p.id)).length;
    const targetMines = Math.max(0, 15 - claimedCount);

    if (targetMines === 0) {
      this.activeMineIds = new Set();
      return this.activeMineIds;
    }

    // Return cached random mines if still valid and matching target count
    if (this.activeMineIds && this.activeMineIds.size === targetMines) {
      // Ensure none of the cached mines are now claimed
      const hasConflict = Array.from(this.activeMineIds).some((id) => claimedPosIds.has(id));
      if (!hasConflict) {
        return this.activeMineIds;
      }
    }

    const specialPos = boardPositions.find((p) => p.is_special);

    // Candidates: all unclaimed positions that are not the special $99 position
    const candidates = boardPositions.filter(
      (p) => !claimedPosIds.has(p.id) && p.id !== specialPos?.id
    );

    // True Fisher-Yates random shuffle across the whole grid
    const shuffled = [...candidates];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = temp;
    }

    this.activeMineIds = new Set(shuffled.slice(0, targetMines).map((p) => p.id));
    return this.activeMineIds;
  }

  // Calculate dynamic Minesweeper adjacent hazard count and base value
  public calculateBaseValue(pos: Position): {
    baseValue: number;
    positionType: PositionType;
    isMine: boolean;
    adjacentHazardsCount: number;
  } {
    if (pos.is_special) {
      return {
        baseValue: 99.0,
        positionType: 'SPECIAL',
        isMine: false,
        adjacentHazardsCount: 0,
      };
    }

    const activeMines = this.getActiveMinePositionIds(pos.board_id);
    const isMine = activeMines.has(pos.id);

    if (isMine) {
      return {
        baseValue: 10.0, // Fixed $10 base value for active mines as requested
        positionType: 'MINE',
        isMine: true,
        adjacentHazardsCount: 0,
      };
    }

    // Count 8 neighbor hazards (active mines + claimed companies)
    let adjacentHazardsCount = 0;
    const claimedPosIds = new Set(this.claims.map((c) => c.position_id));

    let boardPositions = this.positions.filter((p) => p.board_id === pos.board_id);
    if (boardPositions.length === 0) {
      boardPositions = this.positions;
    }

    for (const other of boardPositions) {
      if (other.id === pos.id) continue;
      const rowDiff = Math.abs(other.row - pos.row);
      const colDiff = Math.abs(other.col - pos.col);

      if (rowDiff <= 1 && colDiff <= 1) {
        const isNeighborHazard = activeMines.has(other.id) || claimedPosIds.has(other.id);
        if (isNeighborHazard) {
          adjacentHazardsCount++;
        }
      }
    }

    const pType = String(Math.min(adjacentHazardsCount, 8)) as PositionType;
    const baseValue = adjacentHazardsCount === 0 ? 1.0 : Math.max(1.0, adjacentHazardsCount);

    return {
      baseValue,
      positionType: pType,
      isMine: false,
      adjacentHazardsCount,
    };
  }

  private getCellState(pos: Position, isDiscovered: boolean, userId?: string): BoardCell {
    const claim = this.claims.find((c) => c.position_id === pos.id);
    const company = claim ? (claim.company || this.companies.find((c) => c.id === claim.company_id)) : null;
    const positionBids = this.bids.filter((b) => b.position_id === pos.id);

    const isLocked = Boolean(
      claim?.lock_until && new Date(claim.lock_until).getTime() > Date.now()
    );

    const dynamic = this.calculateBaseValue(pos);
    const userFlags = userId && this.flags[userId] ? this.flags[userId] : new Set();
    const isFlagged = !isDiscovered && userFlags.has(pos.id);

    return {
      id: pos.id,
      row: pos.row,
      col: pos.col,
      position_index: pos.row * 10 + pos.col + 1,
      is_discovered: isDiscovered,
      is_flagged: isFlagged,
      is_mine: isDiscovered ? dynamic.isMine : undefined,
      adjacent_hazards_count: isDiscovered ? dynamic.adjacentHazardsCount : undefined,
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

  // Progressive Minesweeper Cell Discovery with Cascade Flood-Fill for 0-hazard tiles
  public revealCells(boardId: string, centerRow: number, centerCol: number, userId: string): {
    newlyDiscovered: BoardCell[];
    hitMine: boolean;
    hitSpecial: boolean;
  } {
    const board = this.getBoard(boardId);
    let boardPositions = this.positions.filter((p) => p.board_id === board.id);
    if (boardPositions.length === 0) {
      boardPositions = this.positions;
    }

    if (!this.discoveries[userId]) {
      this.discoveries[userId] = new Set();
    }
    const userDiscoveries = this.discoveries[userId];
    const userFlags = this.flags[userId] || new Set();

    const clickedPos = boardPositions.find((p) => p.row === centerRow && p.col === centerCol);
    if (!clickedPos) {
      return { newlyDiscovered: [], hitMine: false, hitSpecial: false };
    }

    // Unflag if user uncovers this cell
    if (userFlags.has(clickedPos.id)) {
      userFlags.delete(clickedPos.id);
    }

    const dynamicClicked = this.calculateBaseValue(clickedPos);
    const hitMine = dynamicClicked.isMine;
    const hitSpecial = Boolean(clickedPos.is_special);

    const newlyDiscoveredIds = new Set<string>();

    if (hitMine || hitSpecial || dynamicClicked.adjacentHazardsCount > 0) {
      // Direct reveal of single tile
      if (!userDiscoveries.has(clickedPos.id)) {
        userDiscoveries.add(clickedPos.id);
        newlyDiscoveredIds.add(clickedPos.id);
      }
    } else {
      // BFS Cascade Flood-Fill for 0-hazard tiles
      const queue: Position[] = [clickedPos];
      userDiscoveries.add(clickedPos.id);
      newlyDiscoveredIds.add(clickedPos.id);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        const currDynamic = this.calculateBaseValue(curr);

        if (currDynamic.adjacentHazardsCount === 0 && !currDynamic.isMine && !curr.is_special) {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const nRow = curr.row + dr;
              const nCol = curr.col + dc;

              const neighbor = boardPositions.find((p) => p.row === nRow && p.col === nCol);
              if (neighbor && !userDiscoveries.has(neighbor.id)) {
                userDiscoveries.add(neighbor.id);
                newlyDiscoveredIds.add(neighbor.id);
                userFlags.delete(neighbor.id);

                const nDynamic = this.calculateBaseValue(neighbor);
                if (nDynamic.adjacentHazardsCount === 0 && !nDynamic.isMine && !neighbor.is_special) {
                  queue.push(neighbor);
                }
              }
            }
          }
        }
      }
    }

    const newlyDiscoveredCells: BoardCell[] = [];
    newlyDiscoveredIds.forEach((id) => {
      const pos = boardPositions.find((p) => p.id === id);
      if (pos) {
        newlyDiscoveredCells.push({
          ...this.getCellState(pos, true, userId),
          is_newly_discovered: true,
        });
      }
    });

    this.notifyListeners('CELLS_REVEALED', {
      newlyDiscovered: newlyDiscoveredCells,
      hitMine,
      hitSpecial,
    });

    return {
      newlyDiscovered: newlyDiscoveredCells,
      hitMine,
      hitSpecial,
    };
  }

  // Toggle flag on an unrevealed cell
  public toggleFlag(boardId: string, row: number, col: number, userId: string): boolean {
    const board = this.getBoard(boardId);
    let boardPositions = this.positions.filter((p) => p.board_id === board.id);
    if (boardPositions.length === 0) {
      boardPositions = this.positions;
    }

    const targetPos = boardPositions.find((p) => p.row === row && p.col === col);
    if (!targetPos) return false;

    const userDiscoveries = this.discoveries[userId] || new Set();
    if (userDiscoveries.has(targetPos.id)) {
      return false; // Cannot flag revealed cell
    }

    if (!this.flags[userId]) {
      this.flags[userId] = new Set();
    }

    let isFlagged = false;
    if (this.flags[userId].has(targetPos.id)) {
      this.flags[userId].delete(targetPos.id);
      isFlagged = false;
    } else {
      this.flags[userId].add(targetPos.id);
      isFlagged = true;
    }

    this.notifyListeners('FLAG_TOGGLED', { positionId: targetPos.id, isFlagged });
    return isFlagged;
  }

  public getFlaggedPositions(userId: string): Set<string> {
    return this.flags[userId] || new Set();
  }

  // Reset Fog of War discoveries and flags for a user
  public resetDiscoveries(userId?: string) {
    if (userId) {
      delete this.discoveries[userId];
      delete this.flags[userId];
    } else {
      this.discoveries = {};
      this.flags = {};
    }
    this.sessionSeed = Math.random();
    this.activeMineIds = null;
    this.ensureRandomSpecialPosition();
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
      return this.getCellState(pos, isDiscovered, userId);
    });
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
    const userFlags = this.flags[userId] || new Set();
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

    const activeMines = this.getActiveMinePositionIds(board.id);
    const totalMines = activeMines.size;
    const remainingMines = Math.max(0, totalMines - userFlags.size);

    return {
      totalCells: boardPositions.length || 100,
      discoveredCells: userDiscoveries.size,
      claimedCells: activeClaims.length,
      totalMines,
      remainingMines,
      flaggedCount: userFlags.size,
      totalMarketCap,
      activeBidders: uniqueBidders,
      highestBid,
      specialLocked,
      specialLockTimeLeft: specialClaim?.lock_until,
    };
  }
}

export const gameEngine = new GameEngineService();

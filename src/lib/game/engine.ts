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

// Initial Demo Companies
export const DEFAULT_COMPANIES: Company[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Apple',
    slug: 'apple',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg',
    website: 'https://apple.com',
    description: 'Cupertino tech giant claiming premium territory.',
    brand_color: '#111827',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Google',
    slug: 'google',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg',
    website: 'https://google.com',
    description: 'Search & AI powerhouse expanding market presence.',
    brand_color: '#4285F4',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Microsoft',
    slug: 'microsoft',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg',
    website: 'https://microsoft.com',
    description: 'Software and enterprise cloud leader.',
    brand_color: '#00A4EF',
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'NVIDIA',
    slug: 'nvidia',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Nvidia_logo.svg',
    website: 'https://nvidia.com',
    description: 'Accelerated computing & AI chips.',
    brand_color: '#76B900',
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    name: 'Tesla',
    slug: 'tesla',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Tesla_Motors.svg',
    website: 'https://tesla.com',
    description: 'Electric vehicles and clean energy.',
    brand_color: '#E82127',
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    name: 'Sweeper Labs',
    slug: 'sweeper-labs',
    logo_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=SweeperLabs',
    website: 'https://sweeper.lol',
    description: 'The pioneer guild of grid auction strategists.',
    brand_color: '#8B5CF6',
  },
];

export const DEFAULT_BOARD: Board = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
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

// Generate standard 10x10 positions
export function generateInitialPositions(boardId: string, rows = 10, cols = 10): Position[] {
  const positions: Position[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isSpecial = r === 1 && c === 2; // Match reference image ($100 coin at (1,2))
      positions.push({
        id: `pos-${boardId}-${r}-${c}`,
        board_id: boardId,
        row: r,
        col: c,
        position_type: isSpecial ? 'SPECIAL' : '1',
        base_value: isSpecial ? 99.0 : 1.0,
        is_special: isSpecial,
      });
    }
  }
  return positions;
}

// Generate Initial Sample Claims & Bids (Apple, Google, Nvidia)
function generateInitialClaimsAndBids(positions: Position[], companies: Company[]) {
  const bids: Bid[] = [];
  const claims: PositionClaim[] = [];
  const now = new Date();

  const apple = companies.find((c) => c.slug === 'apple')!;
  const google = companies.find((c) => c.slug === 'google')!;
  const msft = companies.find((c) => c.slug === 'microsoft')!;

  // 1. Apple on Row 2, Col 0 (Position #20)
  const posApple = positions.find((p) => p.row === 2 && p.col === 0);
  if (posApple) {
    const bidApple: Bid = {
      id: `bid-seed-apple-1`,
      position_id: posApple.id,
      company_id: apple.id,
      amount: 4.0,
      previous_bid: null,
      created_at: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
      company: apple,
    };
    bids.push(bidApple);
    claims.push({
      id: `claim-${posApple.id}`,
      position_id: posApple.id,
      company_id: apple.id,
      winning_bid_id: bidApple.id,
      current_bid: 4.0,
      claimed_at: bidApple.created_at,
      company: apple,
    });
  }

  // 2. Google on Row 3, Col 2 (Position #32) - was Microsoft for $5, outbid by Google for $8
  const posGoogle = positions.find((p) => p.row === 3 && p.col === 2);
  if (posGoogle) {
    const bidMsft: Bid = {
      id: `bid-seed-msft-1`,
      position_id: posGoogle.id,
      company_id: msft.id,
      amount: 5.0,
      previous_bid: null,
      created_at: new Date(now.getTime() - 1000 * 60 * 90).toISOString(),
      company: msft,
    };
    const bidGoogle: Bid = {
      id: `bid-seed-google-1`,
      position_id: posGoogle.id,
      company_id: google.id,
      amount: 8.0,
      previous_bid: 5.0,
      created_at: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
      company: google,
    };
    bids.push(bidMsft, bidGoogle);
    claims.push({
      id: `claim-${posGoogle.id}`,
      position_id: posGoogle.id,
      company_id: google.id,
      winning_bid_id: bidGoogle.id,
      current_bid: 8.0,
      claimed_at: bidGoogle.created_at,
      company: google,
    });
  }

  return { bids, claims };
}

class GameEngineService {
  private companies: Company[] = DEFAULT_COMPANIES;
  private boards: Board[] = [DEFAULT_BOARD];
  private positions: Position[] = generateInitialPositions(DEFAULT_BOARD.id);
  private bids: Bid[] = [];
  private claims: PositionClaim[] = [];
  private discoveries: Record<string, Set<string>> = {}; // user_id -> Set of position_ids
  private notifications: GameNotification[] = [];
  private broadcastChannel: BroadcastChannel | null = null;
  private listeners: Set<(event: { type: string; payload?: unknown }) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.initBroadcastChannel();
      this.loadFromStorage();
    }
  }

  private initBroadcastChannel() {
    try {
      this.broadcastChannel = new BroadcastChannel('sweeper_game_channel');
      this.broadcastChannel.onmessage = (event) => {
        if (event.data?.type === 'SYNC_STATE') {
          this.loadFromStorage();
          this.notifyListeners('SYNC_STATE');
        } else if (event.data?.type === 'OUTBID_ALERT') {
          this.notifyListeners('OUTBID_ALERT', event.data.payload);
        }
      };
    } catch {
      // BroadcastChannel not available
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('sweeper_companies', JSON.stringify(this.companies));
      localStorage.setItem('sweeper_boards', JSON.stringify(this.boards));
      localStorage.setItem('sweeper_positions', JSON.stringify(this.positions));
      localStorage.setItem('sweeper_bids', JSON.stringify(this.bids));
      localStorage.setItem('sweeper_claims', JSON.stringify(this.claims));
      localStorage.setItem('sweeper_notifications', JSON.stringify(this.notifications));

      const discoveriesObj: Record<string, string[]> = {};
      for (const [uid, set] of Object.entries(this.discoveries)) {
        discoveriesObj[uid] = Array.from(set);
      }
      localStorage.setItem('sweeper_discoveries', JSON.stringify(discoveriesObj));

      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({ type: 'SYNC_STATE' });
      }
    } catch {
      // Storage error
    }
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const storedCompanies = localStorage.getItem('sweeper_companies');
      if (storedCompanies) this.companies = JSON.parse(storedCompanies);

      const storedBoards = localStorage.getItem('sweeper_boards');
      if (storedBoards) this.boards = JSON.parse(storedBoards);

      const storedPositions = localStorage.getItem('sweeper_positions');
      if (storedPositions) this.positions = JSON.parse(storedPositions);
      else {
        this.positions = generateInitialPositions(DEFAULT_BOARD.id);
        const { bids, claims } = generateInitialClaimsAndBids(this.positions, this.companies);
        this.bids = bids;
        this.claims = claims;
        this.saveToStorage();
      }

      const storedBids = localStorage.getItem('sweeper_bids');
      if (storedBids) this.bids = JSON.parse(storedBids);

      const storedClaims = localStorage.getItem('sweeper_claims');
      if (storedClaims) this.claims = JSON.parse(storedClaims);

      const storedNotifications = localStorage.getItem('sweeper_notifications');
      if (storedNotifications) this.notifications = JSON.parse(storedNotifications);

      const storedDiscoveries = localStorage.getItem('sweeper_discoveries');
      if (storedDiscoveries) {
        const parsed: Record<string, string[]> = JSON.parse(storedDiscoveries);
        this.discoveries = {};
        for (const [uid, arr] of Object.entries(parsed)) {
          this.discoveries[uid] = new Set(arr);
        }
      }
    } catch {
      // Fallback
    }
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

  public addCompany(company: Omit<Company, 'id'>): Company {
    const newCompany: Company = {
      ...company,
      id: crypto.randomUUID ? crypto.randomUUID() : `company-${Date.now()}`,
    };
    this.companies.push(newCompany);
    this.saveToStorage();
    this.notifyListeners('COMPANIES_UPDATED');
    return newCompany;
  }

  public getBoard(boardId: string): Board | undefined {
    return this.boards.find((b) => b.id === boardId) || this.boards[0];
  }

  public getAllBoards(): Board[] {
    return this.boards;
  }

  // Progressive Minesweeper Cell Discovery
  public revealCells(boardId: string, centerRow: number, centerCol: number, userId: string): BoardCell[] {
    const board = this.getBoard(boardId) || DEFAULT_BOARD;
    const radius = board.reveal_radius ?? 1;

    if (!this.discoveries[userId]) {
      this.discoveries[userId] = new Set();
    }
    const userDiscoveries = this.discoveries[userId];

    const newlyDiscovered: BoardCell[] = [];

    this.positions
      .filter((p) => p.board_id === boardId)
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

    this.saveToStorage();
    this.notifyListeners('CELLS_REVEALED', { newlyDiscovered });
    return newlyDiscovered;
  }

  // Get full board cells for a user
  public getBoardCells(boardId: string, userId: string): BoardCell[] {
    const userDiscoveries = this.discoveries[userId] || new Set();

    return this.positions
      .filter((p) => p.board_id === boardId)
      .map((pos) => {
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
      if (!claimedPos || claimedPos.board_id !== pos.board_id) continue;
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
    const company = claim ? this.companies.find((c) => c.id === claim.company_id) : null;
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
      position_type: isDiscovered ? dynamic.positionType : undefined,
      base_value: isDiscovered ? dynamic.baseValue : undefined,
      is_special: isDiscovered ? pos.is_special : undefined,
      current_bid: isDiscovered && claim ? claim.current_bid : undefined,
      claim: isDiscovered && claim ? { ...claim, company: company || undefined } : null,
      company: isDiscovered ? company : null,
      lock_until: isDiscovered ? claim?.lock_until : null,
      is_locked: isDiscovered ? isLocked : false,
      bid_count: isDiscovered ? positionBids.length : 0,
    };
  }

  // ATOMIC PLACE BID FUNCTION
  public async placeBid(
    positionId: string,
    amount: number,
    userId: string,
    companyId: string
  ): Promise<{ success: boolean; message: string; claim?: PositionClaim }> {
    const position = this.positions.find((p) => p.id === positionId);
    if (!position) {
      throw new Error('Position not found.');
    }

    const company = this.companies.find((c) => c.id === companyId);
    if (!company) {
      throw new Error('Company not found. Please select or register a valid company.');
    }

    const board = this.getBoard(position.board_id) || DEFAULT_BOARD;
    const minIncrement = board.min_bid_increment || 1.0;
    const existingClaim = this.claims.find((c) => c.position_id === positionId);

    // 1. Check Special Position Lock
    if (existingClaim?.lock_until) {
      const lockEnd = new Date(existingClaim.lock_until).getTime();
      if (lockEnd > Date.now()) {
        const remaining = Math.ceil((lockEnd - Date.now()) / (1000 * 60 * 60));
        throw new Error(
          `This Special Position is locked for another ${remaining} hours. Rebidding is currently disabled.`
        );
      }
    }

    // 2. Check Minimum Bid against dynamic base value or existing claim
    const dynamic = this.calculateBaseValue(position);
    const minBid = existingClaim ? existingClaim.current_bid + minIncrement : dynamic.baseValue;
    if (amount < minBid) {
      throw new Error(
        `Bid of $${amount} is invalid. The minimum acceptable bid is $${minBid.toFixed(2)}.`
      );
    }

    // 3. Create Immutable Bid Record
    const prevCompanyId = existingClaim?.company_id;
    const prevAmount = existingClaim?.current_bid || null;

    const newBidId = `bid-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newBid: Bid = {
      id: newBidId,
      position_id: positionId,
      company_id: companyId,
      user_id: userId,
      amount,
      previous_bid: prevAmount,
      created_at: new Date().toISOString(),
      company,
    };
    this.bids.unshift(newBid);

    // 4. Calculate Lock Until if Special
    let lockUntil: string | null = null;
    if (position.is_special) {
      const lockHours = board.special_lock_duration_hours || 168;
      lockUntil = new Date(Date.now() + lockHours * 60 * 60 * 1000).toISOString();
    }

    // 5. Upsert Claim
    const updatedClaim: PositionClaim = {
      id: existingClaim?.id || `claim-${positionId}`,
      position_id: positionId,
      company_id: companyId,
      winning_bid_id: newBidId,
      current_bid: amount,
      claimed_at: new Date().toISOString(),
      lock_until: lockUntil,
      updated_at: new Date().toISOString(),
      company,
    };

    const claimIdx = this.claims.findIndex((c) => c.position_id === positionId);
    if (claimIdx >= 0) {
      this.claims[claimIdx] = updatedClaim;
    } else {
      this.claims.push(updatedClaim);
    }

    // 6. Generate Outbid Notification for Previous Winner if different
    if (prevCompanyId && prevCompanyId !== companyId) {
      const outbidNotif: GameNotification = {
        id: `notif-${Date.now()}-outbid`,
        company_id: prevCompanyId,
        type: 'outbid',
        title: `Outbid on Position #${position.row * 10 + position.col + 1}`,
        message: `${company.name} placed a higher bid of $${amount} on Position #${
          position.row * 10 + position.col + 1
        }.`,
        position_id: positionId,
        amount,
        is_read: false,
        created_at: new Date().toISOString(),
      };
      this.notifications.unshift(outbidNotif);

      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'OUTBID_ALERT',
          payload: { outbidNotif, targetCompanyId: prevCompanyId },
        });
      }
    }

    // 7. Generate Winning/Confirmation Notification
    const successNotif: GameNotification = {
      id: `notif-${Date.now()}-success`,
      company_id: companyId,
      type: position.is_special ? 'special_claimed' : 'bid_placed',
      title: position.is_special ? '🌟 Special $99 Position Acquired!' : 'Bid Placed Successfully',
      message: position.is_special
        ? `Congratulations! ${company.name} claimed the Special Position for $${amount}. Locked for 7 days.`
        : `Your bid of $${amount} on Position #${
            position.row * 10 + position.col + 1
          } is now the winning bid!`,
      position_id: positionId,
      amount,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    this.notifications.unshift(successNotif);

    this.saveToStorage();
    this.notifyListeners('BID_PLACED', { claim: updatedClaim, bid: newBid });

    return {
      success: true,
      message: 'Bid accepted!',
      claim: updatedClaim,
    };
  }

  // Seamless Bidding with 3 company fields (Name, Website URL, Description)
  public async placeBidWithDetails(params: {
    positionId: string;
    amount: number;
    name: string;
    website?: string;
    description?: string;
  }): Promise<{ success: boolean; message: string; claim?: PositionClaim; company: Company }> {
    const { positionId, amount, name, website, description } = params;
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Please enter a company or bidder name.');
    }

    // Find existing company or create new
    let company = this.companies.find(
      (c) => c.name.toLowerCase() === trimmedName.toLowerCase()
    );

    let formattedWebsite = website?.trim() || null;
    if (formattedWebsite && !/^https?:\/\//i.test(formattedWebsite)) {
      formattedWebsite = `https://${formattedWebsite}`;
    }

    if (!company) {
      const brandColors = [
        '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#EC4899', '#06B6D4', '#6366F1', '#14B8A6', '#F97316'
      ];
      let hash = 0;
      for (let i = 0; i < trimmedName.length; i++) {
        hash = trimmedName.charCodeAt(i) + ((hash << 5) - hash);
      }
      const colorIndex = Math.abs(hash) % brandColors.length;
      const brandColor = brandColors[colorIndex];

      const logoUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(trimmedName)}`;

      company = {
        id: crypto.randomUUID ? crypto.randomUUID() : `company-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: trimmedName,
        slug: trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        logo_url: logoUrl,
        website: formattedWebsite,
        description: description?.trim() || 'Active grid bidder.',
        brand_color: brandColor,
      };
      this.companies.push(company);
    } else {
      if (formattedWebsite) company.website = formattedWebsite;
      if (description?.trim()) company.description = description.trim();
    }

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
        company: this.companies.find((c) => c.id === b.company_id),
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
        
        // Calculate highest bid across claims and bids
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

  public markNotificationAsRead(id: string) {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif) {
      notif.is_read = true;
      this.saveToStorage();
      this.notifyListeners('NOTIFICATIONS_UPDATED');
    }
  }

  public markAllNotificationsAsRead(companyId: string) {
    this.notifications.forEach((n) => {
      if (n.company_id === companyId) n.is_read = true;
    });
    this.saveToStorage();
    this.notifyListeners('NOTIFICATIONS_UPDATED');
  }

  // Get High-Level Game Stats
  public getGameStats(boardId: string, userId: string): GameStats {
    const boardPositions = this.positions.filter((p) => p.board_id === boardId);
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
      totalCells: boardPositions.length,
      discoveredCells: userDiscoveries.size,
      claimedCells: activeClaims.length,
      totalMarketCap,
      activeBidders: uniqueBidders,
      highestBid,
      specialLocked,
      specialLockTimeLeft: specialClaim?.lock_until,
    };
  }

  // Admin: Reset & Re-Seed Board
  public resetBoard(rows = 10, cols = 10, minIncrement = 1.0, lockDurationHours = 168) {
    const boardId = DEFAULT_BOARD.id;
    this.boards = [
      {
        ...DEFAULT_BOARD,
        rows,
        columns: cols,
        min_bid_increment: minIncrement,
        special_lock_duration_hours: lockDurationHours,
      },
    ];
    this.positions = generateInitialPositions(boardId, rows, cols);
    const { bids, claims } = generateInitialClaimsAndBids(this.positions, this.companies);
    this.bids = bids;
    this.claims = claims;
    this.discoveries = {};
    this.notifications = [];
    this.saveToStorage();
    this.notifyListeners('BOARD_RESET');
  }
}

export const gameEngine = new GameEngineService();

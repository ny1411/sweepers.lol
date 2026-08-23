-- ==============================================================================
-- MINESWEEPER COMPANY BIDDING GAME (SWEEPER.LOL)
-- Migration 01: Core Tables, Indexes, and Constraints
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. COMPANIES TABLE
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    website TEXT,
    description TEXT,
    brand_color TEXT DEFAULT '#3B82F6',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. USER PROFILES TABLE (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. BOARDS TABLE (Configurable game boards)
CREATE TABLE IF NOT EXISTS public.boards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    rows INT NOT NULL DEFAULT 10 CHECK (rows >= 3 AND rows <= 50),
    columns INT NOT NULL DEFAULT 10 CHECK (columns >= 3 AND columns <= 50),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    reveal_radius INT NOT NULL DEFAULT 1,
    reveal_diagonals BOOLEAN NOT NULL DEFAULT true,
    auto_reveal_empty BOOLEAN NOT NULL DEFAULT true,
    min_bid_increment NUMERIC(10, 2) NOT NULL DEFAULT 1.00 CHECK (min_bid_increment > 0),
    special_lock_duration_hours INT NOT NULL DEFAULT 168 CHECK (special_lock_duration_hours >= 0), -- 7 days = 168 hrs
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. POSITIONS TABLE (Grid cells on the board)
CREATE TABLE IF NOT EXISTS public.positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
    row INT NOT NULL,
    col INT NOT NULL,
    position_type TEXT NOT NULL CHECK (position_type IN ('1', '2', '3', 'SPECIAL')),
    base_value NUMERIC(10, 2) NOT NULL CHECK (base_value > 0),
    is_special BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_board_row_col UNIQUE (board_id, row, col)
);

-- 5. BIDS TABLE (Immutable financial/auction audit log)
CREATE TABLE IF NOT EXISTS public.bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    previous_bid NUMERIC(10, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. POSITION CLAIMS TABLE (Materialized current winning state)
CREATE TABLE IF NOT EXISTS public.position_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    position_id UUID NOT NULL UNIQUE REFERENCES public.positions(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    winning_bid_id UUID NOT NULL REFERENCES public.bids(id) ON DELETE RESTRICT,
    current_bid NUMERIC(10, 2) NOT NULL CHECK (current_bid > 0),
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    lock_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. BOARD DISCOVERIES TABLE (User/Team discovery game state)
CREATE TABLE IF NOT EXISTS public.board_discoveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_user_position_discovery UNIQUE (board_id, user_id, position_id)
);

-- 8. NOTIFICATIONS TABLE (Outbid, claim, and lock event alerts)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('outbid', 'bid_placed', 'position_won', 'special_claimed', 'special_unlocked')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    position_id UUID REFERENCES public.positions(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2),
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. GAME SETTINGS TABLE (Global game configurations)
CREATE TABLE IF NOT EXISTS public.game_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_positions_board ON public.positions(board_id);
CREATE INDEX IF NOT EXISTS idx_positions_board_row_col ON public.positions(board_id, row, col);
CREATE INDEX IF NOT EXISTS idx_bids_position_created ON public.bids(position_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bids_company ON public.bids(company_id);
CREATE INDEX IF NOT EXISTS idx_position_claims_company ON public.position_claims(company_id);
CREATE INDEX IF NOT EXISTS idx_board_discoveries_user ON public.board_discoveries(board_id, user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company_unread ON public.notifications(company_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read);

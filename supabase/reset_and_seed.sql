-- ==============================================================================
-- SWEEPER.LOL: COMPLETE SUPABASE DATABASE RESET & SEED SCRIPT
-- ==============================================================================
-- Run this script in your Supabase Dashboard -> SQL Editor (or via CLI)
-- It will completely reset all tables, schema, functions, triggers, and seed fresh data.
-- ==============================================================================

-- 1. DROP EXISTING OBJECTS (CLEAN RESET)
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.board_discoveries CASCADE;
DROP TABLE IF EXISTS public.position_claims CASCADE;
DROP TABLE IF EXISTS public.bids CASCADE;
DROP TABLE IF EXISTS public.positions CASCADE;
DROP TABLE IF EXISTS public.boards CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;
DROP TABLE IF EXISTS public.game_settings CASCADE;

DROP FUNCTION IF EXISTS public.place_bid(UUID, NUMERIC, UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.reveal_cells(UUID, UUID, UUID, INT, INT) CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. CREATE CORE TABLES
-- ==============================================================================

-- 2.1 COMPANIES TABLE
CREATE TABLE public.companies (
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

-- 2.2 USER PROFILES TABLE (Linked optionally to auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.3 BOARDS TABLE (Configurable 10x10 or custom grid boards)
CREATE TABLE public.boards (
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
    special_lock_duration_hours INT NOT NULL DEFAULT 168 CHECK (special_lock_duration_hours >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.4 POSITIONS TABLE (Individual cells on the grid)
CREATE TABLE public.positions (
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

-- 2.5 BIDS TABLE (Immutable financial & auction log)
CREATE TABLE public.bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    previous_bid NUMERIC(10, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.6 POSITION CLAIMS TABLE (Materialized current winning state per cell)
CREATE TABLE public.position_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    position_id UUID NOT NULL UNIQUE REFERENCES public.positions(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    winning_bid_id UUID NOT NULL REFERENCES public.bids(id) ON DELETE RESTRICT,
    current_bid NUMERIC(10, 2) NOT NULL CHECK (current_bid > 0),
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    lock_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.7 BOARD DISCOVERIES TABLE (Player Fog of War state)
CREATE TABLE public.board_discoveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.8 NOTIFICATIONS TABLE (Outbid, claim, and lock event alerts)
CREATE TABLE public.notifications (
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

-- 2.9 PAYMENTS TABLE (Dodo Payments transactions & verification)
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id TEXT UNIQUE,
    checkout_session_id TEXT UNIQUE,
    position_id UUID REFERENCES public.positions(id) ON DELETE SET NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded', 'cancelled')),
    customer_name TEXT,
    customer_email TEXT,
    payment_link TEXT,
    metadata JSONB,
    raw_event JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.10 GAME SETTINGS TABLE
CREATE TABLE public.game_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 3. CREATE PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX idx_positions_board ON public.positions(board_id);
CREATE INDEX idx_positions_board_row_col ON public.positions(board_id, row, col);
CREATE INDEX idx_bids_position_created ON public.bids(position_id, created_at DESC);
CREATE INDEX idx_bids_company ON public.bids(company_id);
CREATE INDEX idx_position_claims_company ON public.position_claims(company_id);
CREATE INDEX idx_board_discoveries_user ON public.board_discoveries(board_id, user_id);
CREATE INDEX idx_notifications_company_unread ON public.notifications(company_id, is_read);
CREATE INDEX idx_payments_checkout_session_id ON public.payments(checkout_session_id);
CREATE INDEX idx_payments_payment_id ON public.payments(payment_id);
CREATE INDEX idx_payments_position_id ON public.payments(position_id);

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.position_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_discoveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_settings ENABLE ROW LEVEL SECURITY;

-- Public read access for seamless gameplay & real-time board view
CREATE POLICY "Public read companies" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Public insert companies" ON public.companies FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update companies" ON public.companies FOR UPDATE USING (true);

CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Public read boards" ON public.boards FOR SELECT USING (true);
CREATE POLICY "Public read positions" ON public.positions FOR SELECT USING (true);
CREATE POLICY "Public read bids" ON public.bids FOR SELECT USING (true);
CREATE POLICY "Public read position_claims" ON public.position_claims FOR SELECT USING (true);
CREATE POLICY "Public read notifications" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "Public update notifications" ON public.notifications FOR UPDATE USING (true);
CREATE POLICY "Public read payments" ON public.payments FOR SELECT USING (true);
CREATE POLICY "Public insert payments" ON public.payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update payments" ON public.payments FOR UPDATE USING (true);
CREATE POLICY "Public read game_settings" ON public.game_settings FOR SELECT USING (true);
CREATE POLICY "Public read discoveries" ON public.board_discoveries FOR SELECT USING (true);
CREATE POLICY "Public insert discoveries" ON public.board_discoveries FOR INSERT WITH CHECK (true);

-- ==============================================================================
-- 5. ATOMIC STORED PROCEDURE: PLACE_BID
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.place_bid(
    p_position_id UUID,
    p_amount NUMERIC,
    p_user_id UUID,
    p_company_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_position RECORD;
    v_board RECORD;
    v_claim RECORD;
    v_prev_company_id UUID;
    v_prev_bid NUMERIC;
    v_min_bid NUMERIC;
    v_new_bid_id UUID;
    v_lock_until TIMESTAMPTZ := NULL;
    v_company_name TEXT;
BEGIN
    -- 1. Verify Company
    SELECT name INTO v_company_name FROM public.companies WHERE id = p_company_id;
    IF v_company_name IS NULL THEN
        RAISE EXCEPTION 'Invalid company ID: Company does not exist.';
    END IF;

    -- 2. Lock Position and Get Board details
    SELECT p.*, b.min_bid_increment, b.special_lock_duration_hours, b.status as board_status
    INTO v_position
    FROM public.positions p
    JOIN public.boards b ON p.board_id = b.id
    WHERE p.id = p_position_id
    FOR UPDATE OF p;

    IF v_position IS NULL THEN
        RAISE EXCEPTION 'Position not found.';
    END IF;

    IF v_position.board_status != 'active' THEN
        RAISE EXCEPTION 'Board is currently paused or inactive.';
    END IF;

    -- 3. Lock Existing Claim if any
    SELECT * INTO v_claim
    FROM public.position_claims
    WHERE position_id = p_position_id
    FOR UPDATE;

    -- 4. Check Special Position Lock
    IF v_claim IS NOT NULL AND v_claim.lock_until IS NOT NULL AND v_claim.lock_until > timezone('utc'::text, now()) THEN
        RAISE EXCEPTION 'This special position is locked until % UTC. Rebidding is unavailable during the lock period.', v_claim.lock_until;
    END IF;

    -- 5. Calculate Minimum Required Bid
    IF v_claim IS NULL THEN
        v_min_bid := v_position.base_value;
        v_prev_bid := NULL;
        v_prev_company_id := NULL;
    ELSE
        v_prev_bid := v_claim.current_bid;
        v_prev_company_id := v_claim.company_id;
        v_min_bid := v_claim.current_bid + COALESCE(v_position.min_bid_increment, 1.00);
    END IF;

    -- 6. Validate Bid Amount
    IF p_amount < v_min_bid THEN
        RAISE EXCEPTION 'Bid amount ($%) is below the minimum required bid of $%.', p_amount, v_min_bid;
    END IF;

    -- 7. Determine Lock Duration if Special
    IF v_position.is_special THEN
        v_lock_until := timezone('utc'::text, now()) + (v_position.special_lock_duration_hours || ' hours')::INTERVAL;
    END IF;

    -- 8. Insert Immutable Bid Log
    INSERT INTO public.bids (position_id, company_id, user_id, amount, previous_bid, created_at)
    VALUES (p_position_id, p_company_id, p_user_id, p_amount, v_prev_bid, timezone('utc'::text, now()))
    RETURNING id INTO v_new_bid_id;

    -- 9. Upsert Position Claim
    INSERT INTO public.position_claims (position_id, company_id, winning_bid_id, current_bid, claimed_at, lock_until, updated_at)
    VALUES (p_position_id, p_company_id, v_new_bid_id, p_amount, timezone('utc'::text, now()), v_lock_until, timezone('utc'::text, now()))
    ON CONFLICT (position_id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        winning_bid_id = EXCLUDED.winning_bid_id,
        current_bid = EXCLUDED.current_bid,
        claimed_at = EXCLUDED.claimed_at,
        lock_until = EXCLUDED.lock_until,
        updated_at = timezone('utc'::text, now());

    -- 10. Generate Outbid Notification for Previous Winner if applicable
    IF v_prev_company_id IS NOT NULL AND v_prev_company_id != p_company_id THEN
        INSERT INTO public.notifications (company_id, type, title, message, position_id, amount, created_at)
        VALUES (
            v_prev_company_id,
            'outbid',
            'Outbid on Position #' || (v_position.row * 10 + v_position.col + 1),
            v_company_name || ' placed a higher bid of $' || p_amount || ' on Position #' || (v_position.row * 10 + v_position.col + 1) || '.',
            p_position_id,
            p_amount,
            timezone('utc'::text, now())
        );
    END IF;

    -- 11. Generate Winning Notification
    IF v_position.is_special THEN
        INSERT INTO public.notifications (company_id, type, title, message, position_id, amount, created_at)
        VALUES (
            p_company_id,
            'special_claimed',
            'Special $99 Position Claimed!',
            'Your company successfully claimed the Special Position for $' || p_amount || '. It is now locked for ' || (v_position.special_lock_duration_hours / 24) || ' days.',
            p_position_id,
            p_amount,
            timezone('utc'::text, now())
        );
    ELSE
        INSERT INTO public.notifications (company_id, type, title, message, position_id, amount, created_at)
        VALUES (
            p_company_id,
            'bid_placed',
            'Bid Placed Successfully',
            'You are now the highest bidder for $' || p_amount || ' on Position #' || (v_position.row * 10 + v_position.col + 1) || '.',
            p_position_id,
            p_amount,
            timezone('utc'::text, now())
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'bid_id', v_new_bid_id,
        'position_id', p_position_id,
        'company_id', p_company_id,
        'amount', p_amount,
        'lock_until', v_lock_until,
        'message', 'Bid placed successfully!'
    );
END;
$$;

-- ==============================================================================
-- 6. ATOMIC STORED PROCEDURE: REVEAL_CELLS (MINESWEEPER FOG OF WAR)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.reveal_cells(
    p_board_id UUID,
    p_user_id UUID,
    p_company_id UUID,
    p_center_row INT,
    p_center_col INT
)
RETURNS TABLE (
    id UUID,
    board_id UUID,
    "row" INT,
    "col" INT,
    position_type TEXT,
    base_value NUMERIC,
    is_special BOOLEAN,
    current_bid NUMERIC,
    company_id UUID,
    company_name TEXT,
    company_logo TEXT,
    lock_until TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_radius INT := 1;
    v_allow_diagonals BOOLEAN := true;
BEGIN
    SELECT reveal_radius, reveal_diagonals INTO v_radius, v_allow_diagonals
    FROM public.boards WHERE id = p_board_id;

    RETURN QUERY
    SELECT 
        p.id,
        p.board_id,
        p.row,
        p.col,
        p.position_type,
        p.base_value,
        p.is_special,
        pc.current_bid,
        pc.company_id,
        c.name as company_name,
        c.logo_url as company_logo,
        pc.lock_until
    FROM public.positions p
    LEFT JOIN public.position_claims pc ON p.id = pc.position_id
    LEFT JOIN public.companies c ON pc.company_id = c.id
    WHERE p.board_id = p_board_id
      AND ABS(p.row - p_center_row) <= v_radius
      AND ABS(p.col - p_center_col) <= v_radius
      AND (v_allow_diagonals OR (ABS(p.row - p_center_row) + ABS(p.col - p_center_col) <= v_radius));
END;
$$;

-- ==============================================================================
-- 7. SUPABASE REALTIME ENABLEMENT
-- ==============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'position_claims'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.position_claims;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'bids'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'companies'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.companies;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Realtime publication managed gracefully
END $$;

-- ==============================================================================
-- 8. SEED FRESH DATA (COMPANIES, 10x10 BOARD, 100 POSITIONS)
-- ==============================================================================

-- 8.1 SEED COMPANIES
INSERT INTO public.companies (id, name, slug, logo_url, website, description, brand_color) VALUES
('11111111-1111-1111-1111-111111111111', 'Apple', 'apple', 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg', 'https://apple.com', 'Cupertino tech giant claiming premium territory.', '#000000'),
('22222222-2222-2222-2222-222222222222', 'Google', 'google', 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg', 'https://google.com', 'Search & AI powerhouse expanding market presence.', '#4285F4'),
('33333333-3333-3333-3333-333333333333', 'Microsoft', 'microsoft', 'https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg', 'https://microsoft.com', 'Software and enterprise cloud leader.', '#00A4EF'),
('44444444-4444-4444-4444-444444444444', 'NVIDIA', 'nvidia', 'https://upload.wikimedia.org/wikipedia/commons/2/21/Nvidia_logo.svg', 'https://nvidia.com', 'Accelerated computing & AI chips.', '#76B900'),
('55555555-5555-5555-5555-555555555555', 'Tesla', 'tesla', 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Tesla_Motors.svg', 'https://tesla.com', 'Electric vehicles and clean energy.', '#E82127'),
('66666666-6666-6666-6666-666666666666', 'Sweeper Labs', 'sweeper-labs', 'https://api.dicebear.com/7.x/bottts/svg?seed=SweeperLabs', 'https://sweepers.lol', 'The pioneer guild of grid auction strategists.', '#8B5CF6')
ON CONFLICT (id) DO NOTHING;

-- 8.2 SEED ACTIVE 10x10 BOARD
INSERT INTO public.boards (
    id, name, slug, rows, columns, status, reveal_radius, reveal_diagonals, auto_reveal_empty, min_bid_increment, special_lock_duration_hours, is_active
) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Main Arena 10x10',
    'main-arena',
    10,
    10,
    'active',
    1,
    true,
    true,
    1.00,
    168,
    true
) ON CONFLICT (id) DO NOTHING;

-- 8.3 SEED 100 POSITIONS (10x10)
DO $$
DECLARE
    r INT;
    c INT;
    p_type TEXT;
    p_base NUMERIC;
    p_special BOOLEAN;
    board_uuid UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
BEGIN
    FOR r IN 0..9 LOOP
        FOR c IN 0..9 LOOP
            IF r = 1 AND c = 2 THEN
                -- Special Position ($99) at Row 1, Col 2 (Position #13)
                p_type := 'SPECIAL';
                p_base := 99.00;
                p_special := true;
            ELSE
                -- Natural Minesweeper Base Values: $1, $3, $5
                IF (r + c) % 3 = 0 THEN
                    p_type := '1';
                    p_base := 1.00;
                ELSIF (r + c) % 3 = 1 THEN
                    p_type := '2';
                    p_base := 3.00;
                ELSE
                    p_type := '3';
                    p_base := 5.00;
                END IF;
                p_special := false;
            END IF;

            INSERT INTO public.positions (board_id, row, col, position_type, base_value, is_special)
            VALUES (board_uuid, r, c, p_type, p_base, p_special)
            ON CONFLICT (board_id, row, col) DO UPDATE SET
                position_type = EXCLUDED.position_type,
                base_value = EXCLUDED.base_value,
                is_special = EXCLUDED.is_special;
        END LOOP;
    END LOOP;
END $$;

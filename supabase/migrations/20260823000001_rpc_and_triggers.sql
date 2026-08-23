-- ==============================================================================
-- MINESWEEPER COMPANY BIDDING GAME (SWEEPER.LOL)
-- Migration 02: Atomic Functions, Stored Procedures, RLS, and Triggers
-- ==============================================================================

-- 1. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.position_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_discoveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_settings ENABLE ROW LEVEL SECURITY;

-- Read policies (Publicly accessible for viewing the board and market)
CREATE POLICY "Public read companies" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Public read boards" ON public.boards FOR SELECT USING (true);
CREATE POLICY "Public read bids" ON public.bids FOR SELECT USING (true);
CREATE POLICY "Public read position_claims" ON public.position_claims FOR SELECT USING (true);
CREATE POLICY "Public read game_settings" ON public.game_settings FOR SELECT USING (true);

-- User specific policies
CREATE POLICY "Users can view own discoveries" ON public.board_discoveries
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Users can insert own discoveries" ON public.board_discoveries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id OR company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id OR company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- ==============================================================================
-- 2. ATOMIC PLACE_BID FUNCTION (SERIALIZABLE TRANSACTION WITH ROW LOCK)
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
    v_outbid_company_name TEXT;
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

    -- 11. Generate Special Claim Notification
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
-- 3. ATOMIC REVEAL CELLS FUNCTION (PROGRESSIVE MINESWEEPER DISCOVERY)
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
    -- Read board configuration
    SELECT reveal_radius, reveal_diagonals INTO v_radius, v_allow_diagonals
    FROM public.boards WHERE id = p_board_id;

    -- Insert discoveries for target cell and surrounding neighborhood
    IF p_user_id IS NOT NULL THEN
        INSERT INTO public.board_discoveries (board_id, user_id, company_id, position_id, discovered_at)
        SELECT p.board_id, p_user_id, p_company_id, p.id, timezone('utc'::text, now())
        FROM public.positions p
        WHERE p.board_id = p_board_id
          AND ABS(p.row - p_center_row) <= v_radius
          AND ABS(p.col - p_center_col) <= v_radius
          AND (v_allow_diagonals OR (ABS(p.row - p_center_row) + ABS(p.col - p_center_col) <= v_radius))
        ON CONFLICT (board_id, user_id, position_id) DO NOTHING;
    END IF;

    -- Return only the revealed positions and their live market state
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
-- 4. SUPABASE REALTIME ENABLEMENT
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
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Continue gracefully if publication is managed by cloud Supabase
END $$;

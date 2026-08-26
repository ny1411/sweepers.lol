-- ==============================================================================
-- MINESWEEPER COMPANY BIDDING GAME (SWEEPER.LOL)
-- Seed Data: Sample Companies, 10x10 Board, Positions, Bids, Claims
-- ==============================================================================

-- 1. SEED COMPANIES
INSERT INTO public.companies (id, name, slug, logo_url, website, description, brand_color) VALUES
('11111111-1111-1111-1111-111111111111', 'Apple', 'apple', 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg', 'https://apple.com', 'Cupertino tech giant claiming premium territory.', '#000000'),
('22222222-2222-2222-2222-222222222222', 'Google', 'google', 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg', 'https://google.com', 'Search & AI powerhouse expanding market presence.', '#4285F4'),
('33333333-3333-3333-3333-333333333333', 'Microsoft', 'microsoft', 'https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg', 'https://microsoft.com', 'Software and enterprise cloud leader.', '#00A4EF'),
('44444444-4444-4444-4444-444444444444', 'NVIDIA', 'nvidia', 'https://upload.wikimedia.org/wikipedia/commons/2/21/Nvidia_logo.svg', 'https://nvidia.com', 'Accelerated computing & AI chips.', '#76B900'),
('55555555-5555-5555-5555-555555555555', 'Tesla', 'tesla', 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Tesla_Motors.svg', 'https://tesla.com', 'Electric vehicles and clean energy.', '#E82127'),
('66666666-6666-6666-6666-666666666666', 'Sweeper Labs', 'sweeper-labs', 'https://api.dicebear.com/7.x/bottts/svg?seed=SweeperLabs', 'https://sweepers.lol', 'The pioneer guild of grid auction strategists.', '#8B5CF6')
ON CONFLICT (id) DO NOTHING;

-- 2. SEED ACTIVE 10x10 BOARD
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

-- 3. SEED 100 POSITIONS (10x10)
-- Position distribution:
-- Row 1, Col 2 -> SPECIAL ($99)
-- Types 1 ($1), 2 ($3), 3 ($5) distributed naturally across grid
DO $$
DECLARE
    r INT;
    c INT;
    p_type TEXT;
    p_base NUMERIC;
    p_special BOOLEAN;
    p_pos_id UUID;
    board_uuid UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
BEGIN
    FOR r IN 0..9 LOOP
        FOR c IN 0..9 LOOP
            IF r = 1 AND c = 2 THEN
                -- Special Position ($99)
                p_type := 'SPECIAL';
                p_base := 99.00;
                p_special := true;
            ELSE
                -- Distribute 1 ($1), 2 ($3), 3 ($5)
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

-- 4. SEED SAMPLE CLAIMS & IMMUTABLE BIDS (Matching reference aesthetics)
DO $$
DECLARE
    pos_apple UUID;
    pos_google UUID;
    pos_special UUID;
    pos_msft UUID;
    b_apple UUID := '11111111-1111-1111-1111-111111111111';
    b_google UUID := '22222222-2222-2222-2222-222222222222';
    b_msft UUID := '33333333-3333-3333-3333-333333333333';
    b_nvidia UUID := '44444444-4444-4444-4444-444444444444';
    bid1 UUID;
    bid2 UUID;
    bid3 UUID;
    bid4 UUID;
    board_uuid UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
BEGIN
    -- Apple on Row 2, Col 1 (Position 21)
    SELECT id INTO pos_apple FROM public.positions WHERE board_id = board_uuid AND row = 2 AND col = 1;
    IF pos_apple IS NOT NULL THEN
        INSERT INTO public.bids (position_id, company_id, amount, previous_bid, created_at)
        VALUES (pos_apple, b_apple, 3.00, NULL, timezone('utc'::text, now()) - interval '1 hour')
        RETURNING id INTO bid1;

        INSERT INTO public.position_claims (position_id, company_id, winning_bid_id, current_bid, claimed_at)
        VALUES (pos_apple, b_apple, bid1, 3.00, timezone('utc'::text, now()) - interval '1 hour')
        ON CONFLICT (position_id) DO NOTHING;
    END IF;

    -- Google on Row 3, Col 2 (Position 32)
    SELECT id INTO pos_google FROM public.positions WHERE board_id = board_uuid AND row = 3 AND col = 2;
    IF pos_google IS NOT NULL THEN
        -- Prior bid from Microsoft, then outbid by Google
        INSERT INTO public.bids (position_id, company_id, amount, previous_bid, created_at)
        VALUES (pos_google, b_msft, 5.00, NULL, timezone('utc'::text, now()) - interval '2 hours');

        INSERT INTO public.bids (position_id, company_id, amount, previous_bid, created_at)
        VALUES (pos_google, b_google, 7.00, 5.00, timezone('utc'::text, now()) - interval '45 minutes')
        RETURNING id INTO bid2;

        INSERT INTO public.position_claims (position_id, company_id, winning_bid_id, current_bid, claimed_at)
        VALUES (pos_google, b_google, bid2, 7.00, timezone('utc'::text, now()) - interval '45 minutes')
        ON CONFLICT (position_id) DO NOTHING;
    END IF;

    -- NVIDIA on Row 0, Col 0
    SELECT id INTO pos_msft FROM public.positions WHERE board_id = board_uuid AND row = 0 AND col = 0;
    IF pos_msft IS NOT NULL THEN
        INSERT INTO public.bids (position_id, company_id, amount, previous_bid, created_at)
        VALUES (pos_msft, b_nvidia, 4.00, NULL, timezone('utc'::text, now()) - interval '3 hours')
        RETURNING id INTO bid3;

        INSERT INTO public.position_claims (position_id, company_id, winning_bid_id, current_bid, claimed_at)
        VALUES (pos_msft, b_nvidia, bid3, 4.00, timezone('utc'::text, now()) - interval '3 hours')
        ON CONFLICT (position_id) DO NOTHING;
    END IF;
END $$;

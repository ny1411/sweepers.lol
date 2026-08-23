-- ==============================================================================
-- MINESWEEPER COMPANY BIDDING GAME (SWEEPER.LOL)
-- Migration 03: Dodo Payments Transactions Table & Idempotency Logs
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.payments (
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

-- Indexes for lightning fast lookups & idempotency checks
CREATE INDEX IF NOT EXISTS idx_payments_checkout_session_id ON public.payments(checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON public.payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_position_id ON public.payments(position_id);
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON public.payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Public read for payment verification / company receipts
CREATE POLICY "Public read payments" ON public.payments FOR SELECT USING (true);

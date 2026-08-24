import { NextRequest, NextResponse } from 'next/server';
import { createBidCheckoutSession, isDodoConfigured } from '@/lib/payments/dodo';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      positionId,
      positionIndex,
      amount,
      companyName,
      website,
      description,
      logoUrl,
      brandColor,
      userEmail,
    } = body;

    // Strict Input Validations
    if (!positionId || typeof positionId !== 'string') {
      return NextResponse.json(
        { error: 'Position ID is required.' },
        { status: 400 }
      );
    }

    if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
      return NextResponse.json(
        { error: 'Company or Bidder name is required.' },
        { status: 400 }
      );
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { error: 'Valid positive bid amount is required.' },
        { status: 400 }
      );
    }

    // Determine host return URL (Dodo Payments appends payment_id=...&status=... automatically on redirect)
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const returnUrl = `${origin}/?payment_success=true&position_id=${encodeURIComponent(
      positionId
    )}&position_index=${positionIndex || 0}&amount=${encodeURIComponent(numAmount)}`;

    if (!isDodoConfigured()) {
      return NextResponse.json(
        {
          error:
            'Dodo Payments API Key is not configured yet. Please add DODO_PAYMENTS_API_KEY to your environment variables (.env.local).',
          isConfigError: true,
        },
        { status: 503 }
      );
    }

    // Create Dodo Payments Checkout Session
    const session = await createBidCheckoutSession({
      positionId,
      positionIndex: Number(positionIndex) || 0,
      amount: numAmount,
      companyName: companyName.trim(),
      website: website || null,
      description: description || null,
      logoUrl: logoUrl || null,
      brandColor: brandColor || null,
      userEmail: userEmail || null,
      returnUrl,
    });

    // Log pending checkout into Supabase
    try {
      const supabase = await createServerSupabaseClient();
      await supabase.from('payments').insert({
        checkout_session_id: session.sessionId,
        position_id: positionId,
        amount: numAmount,
        currency: 'USD',
        status: 'pending',
        customer_name: companyName.trim(),
        payment_link: session.checkoutUrl,
        metadata: {
          position_id: positionId,
          position_index: positionIndex,
          company_name: companyName.trim(),
          amount: numAmount.toFixed(2),
          website,
          description,
          logo_url: logoUrl,
          brand_color: brandColor,
        },
      });
    } catch (dbErr) {
      console.warn('Could not insert pending payment in Supabase:', dbErr);
    }

    return NextResponse.json({
      success: true,
      checkoutUrl: session.checkoutUrl,
      sessionId: session.sessionId,
    });
  } catch (error: unknown) {
    console.error('Error in /api/checkout:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getCheckoutSessionStatus, isDodoConfigured } from '@/lib/payments/dodo';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required for verification.' },
        { status: 400 }
      );
    }

    if (!isDodoConfigured()) {
      return NextResponse.json(
        {
          verified: false,
          error: 'Dodo Payments is not configured on the server.',
        },
        { status: 503 }
      );
    }

    // Retrieve session from Dodo Payments
    const session = await getCheckoutSessionStatus(sessionId);
    const metadata = (session as unknown as { metadata?: Record<string, string> })?.metadata || {};
    const status = (session as unknown as { status?: string })?.status;

    // Check if session / payment is completed or succeeded
    const isPaid = status === 'succeeded' || status === 'completed' || status === 'paid';

    if (isPaid) {
      const positionId = metadata.position_id;
      const companyName = metadata.company_name;
      const website = metadata.website;
      const description = metadata.description;
      const logoUrl = metadata.logo_url;
      const brandColor = metadata.brand_color;
      const amountDollars = metadata.amount ? parseFloat(metadata.amount) : 0;

      // Update Supabase in case webhook was delayed
      try {
        const supabase = await createServerSupabaseClient();
        if (positionId && companyName) {
          const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          let companyId: string | null = null;

          const { data: existingCompany } = await supabase
            .from('companies')
            .select('id')
            .ilike('name', companyName)
            .single();

          if (existingCompany) {
            companyId = existingCompany.id;
          } else {
            const { data: newCompany } = await supabase
              .from('companies')
              .insert({
                name: companyName,
                slug,
                website: website || null,
                description: description || null,
                logo_url: logoUrl || null,
                brand_color: brandColor || '#3B82F6',
              })
              .select('id')
              .single();
            if (newCompany) companyId = newCompany.id;
          }

          if (companyId) {
            await supabase.rpc('place_bid', {
              p_position_id: positionId,
              p_amount: amountDollars,
              p_user_id: null,
              p_company_id: companyId,
            });
          }
        }
      } catch (dbErr) {
        console.error('Database update error during verification:', dbErr);
      }

      return NextResponse.json({
        verified: true,
        status,
        metadata,
      });
    }

    return NextResponse.json({
      verified: false,
      status,
      metadata,
    });
  } catch (error: unknown) {
    console.error('Error in /api/payments/verify:', error);
    const message = error instanceof Error ? error.message : 'Verification failed';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

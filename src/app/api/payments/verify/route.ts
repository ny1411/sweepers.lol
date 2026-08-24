import { NextRequest, NextResponse } from 'next/server';
import { getCheckoutSessionStatus, getPaymentDetails, isDodoConfigured } from '@/lib/payments/dodo';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawSessionId = searchParams.get('session_id');
    const rawPaymentId = searchParams.get('payment_id');
    const paramPositionId = searchParams.get('position_id');
    const paramAmount = searchParams.get('amount');

    const sessionId =
      rawSessionId && rawSessionId !== '{CHECKOUT_SESSION_ID}' && !rawSessionId.includes('placeholder')
        ? rawSessionId.trim()
        : null;
    const paymentId =
      rawPaymentId && rawPaymentId !== '{PAYMENT_ID}' && !rawPaymentId.includes('placeholder')
        ? rawPaymentId.trim()
        : null;

    if (!sessionId && !paymentId && !paramPositionId) {
      return NextResponse.json(
        { error: 'Session ID or Payment ID is required for verification.' },
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

    let session = null;
    let payment = null;

    // 1. If payment_id is provided directly from redirect or webhook, retrieve payment details
    if (paymentId) {
      try {
        payment = await getPaymentDetails(paymentId);
      } catch (paymentErr) {
        console.warn('[Dodo Verify] Could not retrieve payment details for payment_id:', paymentId, paymentErr);
      }
    }

    // 2. If session_id is provided, retrieve checkout session
    if (sessionId) {
      try {
        session = await getCheckoutSessionStatus(sessionId);
        if (session?.payment_id && !payment) {
          try {
            payment = await getPaymentDetails(session.payment_id);
          } catch (pErr) {
            console.warn('[Dodo Verify] Could not retrieve payment details from session.payment_id:', session.payment_id, pErr);
          }
        }
      } catch (sessionErr) {
        console.warn('[Dodo Verify] Could not retrieve session status for sessionId:', sessionId, sessionErr);
      }
    }

    // 3. Determine if payment succeeded
    const paymentStatus = payment?.status || session?.payment_status;
    const isPaid = paymentStatus === 'succeeded' || payment?.status === 'succeeded';

    // 4. Retrieve pending record from Supabase for metadata fallback
    const supabase = await createServerSupabaseClient();
    let dbPayment = null;
    if (sessionId) {
      const { data } = await supabase
        .from('payments')
        .select('*')
        .eq('checkout_session_id', sessionId)
        .maybeSingle();
      dbPayment = data;
    }
    if (!dbPayment && paymentId) {
      const { data } = await supabase
        .from('payments')
        .select('*')
        .eq('payment_id', paymentId)
        .maybeSingle();
      dbPayment = data;
    }
    if (!dbPayment && paramPositionId) {
      const { data } = await supabase
        .from('payments')
        .select('*')
        .eq('position_id', paramPositionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      dbPayment = data;
    }

    const dbMeta = (dbPayment?.metadata as Record<string, string>) || {};
    const paymentMeta = (payment?.metadata as unknown as Record<string, string>) || {};

    const metadata: Record<string, string> = {
      ...dbMeta,
      ...paymentMeta,
    };

    if (isPaid) {
      const positionId = metadata.position_id;
      const companyName = metadata.company_name || session?.customer_name || 'Anonymous Bidder';
      const website = metadata.website;
      const description = metadata.description;
      const logoUrl = metadata.logo_url;
      const brandColor = metadata.brand_color;
      const amountDollars = metadata.amount
        ? parseFloat(metadata.amount)
        : payment?.total_amount
        ? payment.total_amount / 100
        : dbPayment?.amount
        ? Number(dbPayment.amount)
        : 1.0;

      // Update Supabase in case webhook was delayed
      try {
        if (positionId && companyName) {
          const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          let companyId: string | null = null;

          const { data: existingCompany } = await supabase
            .from('companies')
            .select('id')
            .ilike('name', companyName)
            .maybeSingle();

          if (existingCompany) {
            companyId = existingCompany.id;
            await supabase
              .from('companies')
              .update({
                website: website || undefined,
                description: description || undefined,
                logo_url: logoUrl || undefined,
                brand_color: brandColor || undefined,
                updated_at: new Date().toISOString(),
              })
              .eq('id', companyId);
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

          // Upsert payment status to succeeded
          const finalPaymentId = payment?.payment_id || session?.payment_id || dbPayment?.payment_id || paymentId || undefined;
          const finalSessionId = session?.id || sessionId || dbPayment?.checkout_session_id || undefined;
          const conflictColumn = finalSessionId ? 'checkout_session_id' : 'payment_id';

          await supabase.from('payments').upsert(
            {
              checkout_session_id: finalSessionId,
              payment_id: finalPaymentId,
              position_id: positionId,
              company_id: companyId,
              amount: amountDollars,
              currency: payment?.currency || 'USD',
              status: 'succeeded',
              customer_name: companyName,
              customer_email: session?.customer_email || payment?.customer?.email || null,
              metadata,
              updated_at: new Date().toISOString(),
            },
            { onConflict: conflictColumn }
          );
        }
      } catch (dbErr) {
        console.error('[Dodo Verify] Database update error during verification:', dbErr);
      }

      return NextResponse.json({
        verified: true,
        status: paymentStatus || 'succeeded',
        metadata: {
          ...metadata,
          company_name: companyName,
          amount: amountDollars.toString(),
        },
      });
    }

    return NextResponse.json({
      verified: false,
      status: paymentStatus || 'pending',
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

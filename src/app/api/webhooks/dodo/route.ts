import { NextRequest, NextResponse } from 'next/server';
import { verifyAndUnwrapWebhook } from '@/lib/payments/dodo';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const webhookHeaders: Record<string, string> = {
      'webhook-id': req.headers.get('webhook-id') || req.headers.get('svix-id') || '',
      'webhook-signature': req.headers.get('webhook-signature') || req.headers.get('svix-signature') || '',
      'webhook-timestamp': req.headers.get('webhook-timestamp') || req.headers.get('svix-timestamp') || '',
    };

    let event;
    try {
      event = verifyAndUnwrapWebhook(rawBody, webhookHeaders);
    } catch (err) {
      console.error('Dodo Webhook Signature Verification Failed:', err);
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    const eventType = (event as unknown as { type?: string })?.type;
    const eventData = (event as unknown as { data?: Record<string, unknown> })?.data || {};

    console.log(`[Dodo Webhook] Received event: ${eventType}`, eventData);

    const supabase = await createServerSupabaseClient();
    const paymentId = (eventData.payment_id as string) || '';
    const sessionId = (eventData.checkout_session_id as string) || '';
    const metadata = (eventData.metadata as Record<string, string>) || {};

    if (eventType === 'payment.succeeded') {
      const positionId = metadata.position_id;
      const companyName = metadata.company_name;
      const website = metadata.website;
      const description = metadata.description;
      const logoUrl = metadata.logo_url;
      const brandColor = metadata.brand_color;
      const amountDollars = metadata.amount
        ? parseFloat(metadata.amount)
        : (Number(eventData.total_amount) || 0) / 100;

      // Idempotency check
      if (paymentId) {
        const { data: existingPayment } = await supabase
          .from('payments')
          .select('id, status')
          .eq('payment_id', paymentId)
          .maybeSingle();

        if (existingPayment && existingPayment.status === 'succeeded') {
          console.log(`[Dodo Webhook] Payment ${paymentId} already processed (idempotent)`);
          return NextResponse.json({ received: true, already_processed: true });
        }
      }

      if (positionId && companyName) {
        // 1. Find or create company
        const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        let companyId: string | null = null;

        const { data: existingCompany } = await supabase
          .from('companies')
          .select('id')
          .ilike('name', companyName)
          .maybeSingle();

        if (existingCompany) {
          companyId = existingCompany.id;
          // Update details if provided
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

          if (newCompany) {
            companyId = newCompany.id;
          }
        }

        // 2. Call place_bid RPC to update the board state atomically
        if (companyId) {
          try {
            await supabase.rpc('place_bid', {
              p_position_id: positionId,
              p_amount: amountDollars,
              p_user_id: null,
              p_company_id: companyId,
            });
          } catch (rpcError) {
            console.error('[Dodo Webhook] Error calling place_bid RPC:', rpcError);
          }
        }

        // 3. Upsert payment record
        await supabase.from('payments').upsert(
          {
            payment_id: paymentId || undefined,
            checkout_session_id: sessionId || undefined,
            position_id: positionId,
            company_id: companyId,
            amount: amountDollars,
            currency: (eventData.currency as string) || 'USD',
            status: 'succeeded',
            customer_name: companyName,
            customer_email: ((eventData.customer as Record<string, string>)?.email) || null,
            metadata,
            raw_event: eventData,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'payment_id' }
        );
      }
    } else if (eventType === 'payment.failed' || eventType === 'payment.cancelled') {
      if (paymentId || sessionId) {
        await supabase.from('payments').update({
          status: eventType === 'payment.failed' ? 'failed' : 'cancelled',
          raw_event: eventData,
          updated_at: new Date().toISOString(),
        }).or(`payment_id.eq.${paymentId},checkout_session_id.eq.${sessionId}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error('Unhandled error in Dodo webhook handler:', error);
    return NextResponse.json(
      { error: 'Webhook processing error' },
      { status: 500 }
    );
  }
}

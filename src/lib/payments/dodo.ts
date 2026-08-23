import DodoPayments from 'dodopayments';
import { UnwrapWebhookEvent } from 'dodopayments/resources/webhooks/webhooks';

let dodoClientInstance: DodoPayments | null = null;

export function getDodoClient(): DodoPayments {
  if (!dodoClientInstance) {
    const apiKey = process.env.DODO_PAYMENTS_API_KEY || '';
    const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY || '';
    const environment = (process.env.DODO_PAYMENTS_ENVIRONMENT as 'test_mode' | 'live_mode') || 'test_mode';

    dodoClientInstance = new DodoPayments({
      bearerToken: apiKey,
      webhookKey: webhookKey || undefined,
      environment,
    });
  }
  return dodoClientInstance;
}

export function isDodoConfigured(): boolean {
  const key = process.env.DODO_PAYMENTS_API_KEY;
  return Boolean(
    key &&
    key.trim().length > 0 &&
    !key.includes('your_api_key_here') &&
    !key.includes('placeholder')
  );
}

export interface CreateBidCheckoutParams {
  positionId: string;
  positionIndex: number;
  amount: number; // in USD dollars
  companyName: string;
  website?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  brandColor?: string | null;
  userEmail?: string | null;
  returnUrl: string;
}

export interface BidCheckoutResult {
  checkoutUrl: string;
  sessionId: string;
}

/**
 * Creates a Dodo Payments dynamic checkout session for placing a bid on a Minesweeper tile.
 */
export async function createBidCheckoutSession(
  params: CreateBidCheckoutParams
): Promise<BidCheckoutResult> {
  const dodo = getDodoClient();
  const amountInCents = Math.max(100, Math.round(params.amount * 100)); // Minimum $1.00 (100 cents)
  const productId = process.env.DODO_PAYMENTS_PRODUCT_ID || 'pdt_sweeper_bid';

  const metadata: Record<string, string> = {
    position_id: params.positionId,
    position_index: params.positionIndex.toString(),
    amount: params.amount.toFixed(2),
    company_name: params.companyName.trim(),
    website: params.website || '',
    description: params.description || '',
    logo_url: params.logoUrl || '',
    brand_color: params.brandColor || '#3B82F6',
  };

  try {
    const session = await dodo.checkoutSessions.create({
      product_cart: [
        {
          product_id: productId,
          quantity: 1,
          amount: amountInCents,
        },
      ],
      billing_currency: 'USD',
      return_url: params.returnUrl,
      customer: {
        name: params.companyName.trim(),
        email: params.userEmail || `bidder@${params.companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      },
      metadata,
      feature_flags: {
        redirect_immediately: true,
      },
    });

    if (!session.checkout_url) {
      throw new Error('Dodo Payments did not return a valid checkout URL.');
    }

    return {
      checkoutUrl: session.checkout_url,
      sessionId: session.session_id,
    };
  } catch (error: unknown) {
    // If the error is due to missing product ID or invalid test mode configuration, throw informative error
    console.error('Dodo Payments Checkout Creation Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown payment gateway error';
    throw new Error(`Dodo Payments error: ${message}`);
  }
}

/**
 * Verifies and unwraps incoming webhook events from Dodo Payments.
 */
export function verifyAndUnwrapWebhook(
  rawBody: string,
  headers: Record<string, string>
): UnwrapWebhookEvent {
  const dodo = getDodoClient();
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY;

  if (webhookKey && webhookKey.trim().length > 0) {
    return dodo.webhooks.unwrap(rawBody, {
      headers,
      key: webhookKey,
    });
  }

  // Fallback if webhook key is pending configuration in dev
  return dodo.webhooks.unsafeUnwrap(rawBody) as UnwrapWebhookEvent;
}

/**
 * Retrieves the status of an existing checkout session.
 */
export async function getCheckoutSessionStatus(sessionId: string) {
  const dodo = getDodoClient();
  return await dodo.checkoutSessions.retrieve(sessionId);
}

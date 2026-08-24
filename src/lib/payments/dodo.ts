import DodoPayments from 'dodopayments';
import { UnwrapWebhookEvent } from 'dodopayments/resources/webhooks/webhooks';

export function getDodoClient(): DodoPayments {
  const apiKey = process.env.DODO_PAYMENTS_API_KEY || '';
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY || '';
  const environment = (process.env.DODO_PAYMENTS_ENVIRONMENT as 'test_mode' | 'live_mode') || 'test_mode';

  return new DodoPayments({
    bearerToken: apiKey,
    webhookKey: webhookKey || undefined,
    environment,
  });
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

let cachedProductIds: Record<string, string> = {};

/**
 * Resolves a valid product ID for Dodo Payments checkout.
 * Priority: Memory Cache -> Valid Env Var -> Account Products List -> Auto-Create Dynamic Bid Product.
 */
export async function resolveProductId(dodo: DodoPayments, environment: string): Promise<string> {
  if (cachedProductIds[environment]) {
    return cachedProductIds[environment];
  }

  const envProductId = process.env.DODO_PAYMENTS_PRODUCT_ID;
  if (
    envProductId &&
    envProductId.trim().length > 0 &&
    envProductId !== 'pdt_sweeper_bid' &&
    !envProductId.includes('placeholder')
  ) {
    cachedProductIds[environment] = envProductId.trim();
    return envProductId.trim();
  }

  try {
    // 1. Check if user already has any products created in their Dodo dashboard
    const productList = await dodo.products.list();
    const items = productList.items || [];
    if (items.length > 0) {
      const match = items.find((p) => p.name?.toLowerCase().includes('sweeper')) || items[0];
      if (match?.product_id) {
        cachedProductIds[environment] = match.product_id;
        return match.product_id;
      }
    }

    // 2. If no products exist in this environment, auto-create one
    const newProduct = await dodo.products.create({
      name: 'Sweeper.lol Tile Bid',
      description: 'Dynamic tile claim bid on Sweeper.lol',
      tax_category: 'digital_products',
      price: {
        type: 'one_time_price',
        currency: 'USD',
        price: 100,
        pay_what_you_want: true,
        discount: 0,
        purchasing_power_parity: false,
      },
    });

    if (newProduct?.product_id) {
      cachedProductIds[environment] = newProduct.product_id;
      return newProduct.product_id;
    }
  } catch (err) {
    console.warn('Auto-resolving Dodo product encountered an issue:', err);
  }

  // If env var was provided as a last resort, use it; otherwise throw meaningful error
  if (envProductId && envProductId !== 'pdt_sweeper_bid') {
    return envProductId;
  }

  throw new Error(
    'No valid Dodo Payments product ID found and unable to auto-create product. Please ensure your DODO_PAYMENTS_API_KEY has product creation permissions or provide a valid DODO_PAYMENTS_PRODUCT_ID in .env.local.'
  );
}

/**
 * Creates a Dodo Payments dynamic checkout session for placing a bid on a Minesweeper tile.
 */
export async function createBidCheckoutSession(
  params: CreateBidCheckoutParams
): Promise<BidCheckoutResult> {
  const dodo = getDodoClient();
  const currentEnv = (process.env.DODO_PAYMENTS_ENVIRONMENT as 'test_mode' | 'live_mode') || 'test_mode';
  const amountInCents = Math.max(100, Math.round(params.amount * 100)); // Minimum $1.00 (100 cents)
  let productId = await resolveProductId(dodo, currentEnv);

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

  const createSession = async (pId: string) => {
    return await dodo.checkoutSessions.create({
      product_cart: [
        {
          product_id: pId,
          quantity: 1,
          amount: amountInCents,
        },
      ],
      billing_currency: 'USD',
      return_url: params.returnUrl,
      customer: {
        name: params.companyName.trim(),
        email: params.userEmail || `bidder@${params.companyName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'sweeper'}.com`,
      },
      metadata,
      feature_flags: {
        redirect_immediately: true,
      },
    });
  };

  try {
    let session;
    try {
      session = await createSession(productId);
    } catch (firstErr: unknown) {
      // If product ID didn't exist or is invalid in this environment, clear cache and force auto-creation/lookup
      const errMsg =
        firstErr && typeof firstErr === 'object' && 'message' in firstErr
          ? String((firstErr as { message?: unknown }).message || '')
          : '';
      const status =
        firstErr && typeof firstErr === 'object' && 'status' in firstErr
          ? (firstErr as { status?: number }).status
          : undefined;

      const isProductNotFound =
        status === 404 ||
        status === 422 ||
        errMsg.toLowerCase().includes('product') ||
        errMsg.toLowerCase().includes('does not exist');

      if (isProductNotFound) {
        delete cachedProductIds[currentEnv];
        try {
          const productList = await dodo.products.list();
          const items = productList.items || [];
          if (items.length > 0) {
            productId = items[0].product_id;
          } else {
            const newProduct = await dodo.products.create({
              name: 'Sweeper.lol Tile Bid',
              description: 'Dynamic tile claim bid on Sweeper.lol',
              tax_category: 'digital_products',
              price: {
                type: 'one_time_price',
                currency: 'USD',
                price: 100,
                pay_what_you_want: true,
                discount: 0,
                purchasing_power_parity: false,
              },
            });
            productId = newProduct.product_id;
          }
          cachedProductIds[currentEnv] = productId;
          session = await createSession(productId);
        } catch {
          throw firstErr;
        }
      } else {
        throw firstErr;
      }
    }

    if (!session.checkout_url) {
      throw new Error('Dodo Payments did not return a valid checkout URL.');
    }

    return {
      checkoutUrl: session.checkout_url,
      sessionId: session.session_id,
    };
  } catch (error: unknown) {
    console.error('Dodo Payments Checkout Creation Error:', error);
    if (error && typeof error === 'object' && 'status' in error) {
      const errObj = error as { status?: number; error?: { code?: string; message?: string; error?: string }; message?: string };
      if (errObj.status === 401) {
        throw new Error(
          `Dodo Payments 401 Unauthorized: The API key is invalid for this environment (${currentEnv}). Please ensure you are using your ${currentEnv === 'live_mode' ? 'Live Mode' : 'Test Mode'} API key from the Dodo Payments dashboard.`
        );
      }
      if (errObj.status === 403 && errObj.error?.code === 'MERCHANT_NOT_LIVE') {
        throw new Error(
          'Dodo Payments 403: Live payments are not yet enabled for your merchant account on Dodo Payments. Please complete merchant onboarding or switch back to test_mode.'
        );
      }
    }
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

/**
 * Retrieves full payment details including metadata and customer info.
 */
export async function getPaymentDetails(paymentId: string) {
  const dodo = getDodoClient();
  return await dodo.payments.retrieve(paymentId);
}

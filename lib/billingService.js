import { createLemonSqueezyCheckout } from './lemonsqueezy.js';

const PLAN_TO_VARIANT_ENVS = {
  pro: ['LEMONSQUEEZY_PRO_MONTHLY_VARIANT_ID', 'LEMONSQUEEZY_PRO_VARIANT_ID'],
  pro_monthly: ['LEMONSQUEEZY_PRO_MONTHLY_VARIANT_ID', 'LEMONSQUEEZY_PRO_VARIANT_ID'],
  pro_yearly: ['LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID'],
};

function resolveVariantId(plan) {
  const envNames = PLAN_TO_VARIANT_ENVS[plan];
  if (!envNames) {
    const error = new Error('Invalid plan');
    error.code = 'INVALID_PLAN';
    throw error;
  }

  for (const envName of envNames) {
    const variantId = process.env[envName];
    if (variantId) return variantId;
  }

  const error = new Error(`Missing ${envNames.join(' or ')}`);
  error.code = 'MISSING_ENV';
  throw error;
}

function mapErrorToStatus(error) {
  if (error?.code === 'INVALID_PLAN') return 400;
  if (error?.code === 'MISSING_ENV') return 503;
  if (error?.code === 'INVALID_PROVIDER_RESPONSE') return 502;
  if (error?.code === 'PROVIDER_ERROR') return 502;
  return 500;
}

export async function runCheckoutPipeline(payload = {}, deps = {}) {
  const createCheckoutFn = deps.createCheckoutFn || createLemonSqueezyCheckout;
  const plan = String(payload.plan || '').trim().toLowerCase();
  const email = String(payload.email || '').trim();
  const redirectUrl = String(payload.redirectUrl || '').trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 400, body: { error: 'Valid email is required' } };
  }

  try {
    const variantId = resolveVariantId(plan || 'pro');
    const out = await createCheckoutFn({
      email,
      variantId,
      redirectUrl,
    });
    return { status: 200, body: { url: out.checkoutUrl } };
  } catch (error) {
    return {
      status: mapErrorToStatus(error),
      body: {
        error: 'Failed to create checkout',
        details: error?.message || 'Unknown error',
      },
    };
  }
}

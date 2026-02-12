import { createLemonSqueezyCheckout } from './lemonsqueezy.js';

const PLAN_TO_VARIANT_ENV = {
  pro: 'LEMONSQUEEZY_PRO_VARIANT_ID',
};

function resolveVariantId(plan) {
  const envName = PLAN_TO_VARIANT_ENV[plan];
  if (!envName) {
    const error = new Error('Invalid plan');
    error.code = 'INVALID_PLAN';
    throw error;
  }
  const variantId = process.env[envName];
  if (!variantId) {
    const error = new Error(`Missing ${envName}`);
    error.code = 'MISSING_ENV';
    throw error;
  }
  return variantId;
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

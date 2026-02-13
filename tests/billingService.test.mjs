import test from 'node:test';
import assert from 'node:assert/strict';
import { runCheckoutPipeline } from '../lib/billingService.js';

test('runCheckoutPipeline validates email', async () => {
  const out = await runCheckoutPipeline({ plan: 'pro', email: 'bad' });
  assert.equal(out.status, 400);
});

test('runCheckoutPipeline returns checkout URL for valid request', async () => {
  const prev = process.env.LEMONSQUEEZY_PRO_VARIANT_ID;
  process.env.LEMONSQUEEZY_PRO_VARIANT_ID = '1234';

  try {
    const out = await runCheckoutPipeline(
      { plan: 'pro', email: 'user@example.com' },
      {
        createCheckoutFn: async ({ email, variantId }) => {
          assert.equal(email, 'user@example.com');
          assert.equal(variantId, '1234');
          return { checkoutUrl: 'https://checkout.example.com' };
        },
      }
    );
    assert.equal(out.status, 200);
    assert.equal(out.body.url, 'https://checkout.example.com');
  } finally {
    process.env.LEMONSQUEEZY_PRO_VARIANT_ID = prev;
  }
});

test('runCheckoutPipeline uses yearly variant when yearly plan is selected', async () => {
  const prevYearly = process.env.LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID;
  process.env.LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID = '9999';

  try {
    const out = await runCheckoutPipeline(
      { plan: 'pro_yearly', email: 'user@example.com' },
      {
        createCheckoutFn: async ({ variantId }) => {
          assert.equal(variantId, '9999');
          return { checkoutUrl: 'https://checkout.example.com/yearly' };
        },
      }
    );
    assert.equal(out.status, 200);
    assert.equal(out.body.url, 'https://checkout.example.com/yearly');
  } finally {
    process.env.LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID = prevYearly;
  }
});

test('runCheckoutPipeline maps provider failure', async () => {
  const prev = process.env.LEMONSQUEEZY_PRO_VARIANT_ID;
  process.env.LEMONSQUEEZY_PRO_VARIANT_ID = '1234';

  try {
    const out = await runCheckoutPipeline(
      { plan: 'pro', email: 'user@example.com' },
      {
        createCheckoutFn: async () => {
          const error = new Error('provider down');
          error.code = 'PROVIDER_ERROR';
          throw error;
        },
      }
    );
    assert.equal(out.status, 502);
  } finally {
    process.env.LEMONSQUEEZY_PRO_VARIANT_ID = prev;
  }
});

const LEMONSQUEEZY_API_BASE = 'https://api.lemonsqueezy.com/v1';

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    const error = new Error(`Missing ${name}`);
    error.code = 'MISSING_ENV';
    throw error;
  }
  return value;
}

async function apiRequest(path, payload) {
  const apiKey = getRequiredEnv('LEMONSQUEEZY_API_KEY');
  const response = await fetch(`${LEMONSQUEEZY_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`LemonSqueezy API returned ${response.status}: ${text}`);
    error.code = 'PROVIDER_ERROR';
    throw error;
  }

  return response.json();
}

export async function createLemonSqueezyCheckout({ email, variantId, redirectUrl }) {
  const storeId = getRequiredEnv('LEMONSQUEEZY_STORE_ID');
  const payload = {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_data: {
          email,
        },
        checkout_options: {
          embed: false,
          media: true,
          logo: true,
        },
        product_options: {
          redirect_url: redirectUrl || process.env.NEXT_PUBLIC_APP_URL || '',
        },
      },
      relationships: {
        store: {
          data: {
            type: 'stores',
            id: String(storeId),
          },
        },
        variant: {
          data: {
            type: 'variants',
            id: String(variantId),
          },
        },
      },
    },
  };

  const response = await apiRequest('/checkouts', payload);
  const checkoutUrl = response?.data?.attributes?.url;
  if (!checkoutUrl) {
    const error = new Error('LemonSqueezy checkout URL missing');
    error.code = 'INVALID_PROVIDER_RESPONSE';
    throw error;
  }

  return { checkoutUrl };
}

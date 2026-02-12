export function trackEvent(event, properties = {}) {
  if (!event) return;

  const payload = {
    event,
    ...properties,
    ts: Date.now(),
  };

  if (typeof window === 'undefined') return;

  // Google Analytics style hooks.
  if (typeof window.gtag === 'function') {
    window.gtag('event', event, properties);
  }

  // Plausible style hooks.
  if (typeof window.plausible === 'function') {
    window.plausible(event, { props: properties });
  }

  // Generic data layer hook.
  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push(payload);
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info('[analytics]', payload);
  }
}

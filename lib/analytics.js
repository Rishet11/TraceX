// ---------------------------------------------------------------------------
// Analytics — Vercel Web Analytics + optional legacy providers
// ---------------------------------------------------------------------------
// Page views are tracked automatically by <Analytics /> in layout.js.
// This module handles custom event tracking via Vercel's `track()` API.
//
// Events are also forwarded to Google Analytics / Plausible / dataLayer
// if those providers happen to be loaded on the page.
// ---------------------------------------------------------------------------

import { track } from '@vercel/analytics';

/**
 * Track a named event with optional properties.
 *
 * @param {string} event   - Event name (e.g. 'search_started', 'share_created')
 * @param {Record<string, string | number | boolean>} properties
 */
export function trackEvent(event, properties = {}) {
  if (!event) return;
  if (typeof window === 'undefined') return;

  // ── Primary: Vercel Web Analytics ──────────────────────────────────
  try {
    // Vercel Analytics only accepts string/number/boolean values and
    // limits to 50 properties. Keep payloads lean.
    const clean = {};
    for (const [k, v] of Object.entries(properties)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        clean[k] = v;
      }
    }
    track(event, clean);
  } catch {
    // Silently swallow — analytics should never break the app.
  }

  // ── Legacy: Google Analytics ───────────────────────────────────────
  if (typeof window.gtag === 'function') {
    try { window.gtag('event', event, properties); } catch { /* noop */ }
  }

  // ── Legacy: Plausible ─────────────────────────────────────────────
  if (typeof window.plausible === 'function') {
    try { window.plausible(event, { props: properties }); } catch { /* noop */ }
  }

  // ── Legacy: dataLayer ─────────────────────────────────────────────
  if (Array.isArray(window.dataLayer)) {
    try { window.dataLayer.push({ event, ...properties, ts: Date.now() }); } catch { /* noop */ }
  }

  // ── Dev logging ───────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    console.info('[analytics]', event, properties);
  }
}

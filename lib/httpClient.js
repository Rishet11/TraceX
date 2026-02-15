// ---------------------------------------------------------------------------
// Shared HTTP client — single fetchWithTimeout for all source modules
// ---------------------------------------------------------------------------
// Replaces 5 separate implementations across bing.js, duckduckgo.js,
// jina.js, nitter.js, and syndication.js.
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 8000;

// Pre-defined User-Agent profiles.
// Some endpoints block browser-like UAs, others block curl-like UAs.
export const UA_BROWSER =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
export const UA_CURL = 'curl/8.7.1';

/**
 * Fetch a URL with an AbortController-based timeout.
 *
 * @param {string} url
 * @param {RequestInit & { timeout?: number }} [options]  — standard fetch options + optional `timeout` (ms)
 * @param {number} [timeout]  — timeout override in ms (default 8000). Takes precedence over options.timeout.
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}, timeout) {
  const timeoutMs = timeout ?? options.timeout ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept-Language': 'en-US,en;q=0.8',
        ...options.headers,
      },
      referrerPolicy: options.referrerPolicy || 'no-referrer',
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

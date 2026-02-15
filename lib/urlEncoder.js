// ---------------------------------------------------------------------------
// URL-safe Base64 encoding/decoding for share URLs
// ---------------------------------------------------------------------------
// Uses URL-safe Base64 (RFC 4648 §5): replaces + → -, / → _, strips padding.
// Handles full Unicode via TextEncoder/TextDecoder (no deprecated escape/unescape).
// ---------------------------------------------------------------------------

/**
 * Encode a data object into a URL-safe Base64 string.
 * @param {unknown} data
 * @returns {string | null}
 */
export function encodeShareData(data) {
  try {
    const jsonString = JSON.stringify(data);
    // Convert to UTF-8 bytes, then to standard base64
    const bytes = new TextEncoder().encode(jsonString);
    let base64;
    if (typeof btoa === 'function') {
      // Browser / Edge runtime
      base64 = btoa(String.fromCharCode(...bytes));
    } else {
      // Node.js fallback
      base64 = Buffer.from(bytes).toString('base64');
    }
    // Make URL-safe: + → -, / → _, strip padding =
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (e) {
    console.error('Failed to encode share data', e);
    return null;
  }
}

/**
 * Decode a URL-safe Base64 string back into a data object.
 * @param {string} encodedString
 * @returns {unknown | null}
 */
export function decodeShareData(encodedString) {
  try {
    // Restore standard base64 from URL-safe variant
    let base64 = encodedString.replace(/-/g, '+').replace(/_/g, '/');
    // Restore padding
    const pad = base64.length % 4;
    if (pad === 2) base64 += '==';
    else if (pad === 3) base64 += '=';

    let bytes;
    if (typeof atob === 'function') {
      const binaryString = atob(base64);
      bytes = Uint8Array.from(binaryString, (c) => c.charCodeAt(0));
    } else {
      bytes = Buffer.from(base64, 'base64');
    }
    const jsonString = new TextDecoder().decode(bytes);
    return JSON.parse(jsonString);
  } catch (e) {
    console.error('Failed to decode share data', e);
    return null;
  }
}

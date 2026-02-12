import { normalizeSearchText } from './searchQuery.js';

function extractTweetId(url) {
  const match = String(url || '').match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

function normalizeContentHash(text) {
  return normalizeSearchText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s@#]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getFallbackKey(result) {
  const username = result?.author?.username ? String(result.author.username).toLowerCase() : 'unknown';
  return `${username}:${normalizeContentHash(result?.content || '')}`;
}

function scoreRichness(result) {
  let score = 0;
  if (result?.source === 'nitter') score += 20;
  if (result?.date && result.date !== 'Unknown') score += 5;
  if (result?.author?.avatar) score += 3;
  if ((result?.stats?.likes || 0) > 0) score += 2;
  if ((result?.stats?.retweets || 0) > 0) score += 2;
  if ((result?.stats?.replies || 0) > 0) score += 2;
  return score;
}

export function canonicalizeResults(rawResults = []) {
  const byKey = new Map();

  for (const result of rawResults) {
    const tweetId = extractTweetId(result?.url);
    const key = tweetId ? `id:${tweetId}` : `fallback:${getFallbackKey(result)}`;
    const next = {
      ...result,
      tweetId
    };

    if (!byKey.has(key)) {
      byKey.set(key, next);
      continue;
    }

    const current = byKey.get(key);
    if (scoreRichness(next) > scoreRichness(current)) {
      byKey.set(key, {
        ...next,
        matchedBy: current.matchedBy || next.matchedBy
      });
    }
  }

  return Array.from(byKey.values());
}

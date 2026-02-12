import { getTweetDetailsById } from './nitter.js';
import { fetchSyndicationTweetById } from './syndication.js';

function parseTweetId(urlOrId) {
  if (!urlOrId) return null;
  const asString = String(urlOrId);
  if (/^\d+$/.test(asString)) return asString;
  const match = asString.match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

async function fetchTweetMetrics(tweetId, timeoutMs = 4000) {
  const data = await fetchSyndicationTweetById(tweetId, { timeoutMs });
  return {
    tweetId,
    likes: Number(data?.stats?.likes) || 0,
    retweets: Number(data?.stats?.retweets) || 0,
    replies: Number(data?.stats?.replies) || 0,
    createdAt: data?.date || null,
  };
}

async function fetchTweetMetricsViaNitter(tweetId, timeoutMs = 5000) {
  const details = await getTweetDetailsById(tweetId, { timeoutMs });
  return {
    tweetId,
    likes: Number(details?.stats?.likes) || 0,
    retweets: Number(details?.stats?.retweets) || 0,
    replies: Number(details?.stats?.replies) || 0,
    createdAt: details?.date || null,
  };
}

async function withConcurrency(items, limit, iterator) {
  const output = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      output[current] = await iterator(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return output;
}

export async function enrichTweetMetrics(results = [], options = {}) {
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 4000;
  const limit = Number(options.maxItems) > 0 ? Number(options.maxItems) : 20;
  const concurrency = Number(options.concurrency) > 0 ? Number(options.concurrency) : 4;

  const targets = results
    .map((result, index) => ({
      result,
      index,
      tweetId: parseTweetId(result.tweetId || result.url),
    }))
    .filter((entry) => {
      if (!entry.tweetId) return false;
      const stats = entry.result?.stats || {};
      const hasUsefulStats = (stats.likes || 0) > 0 || (stats.retweets || 0) > 0 || (stats.replies || 0) > 0;
      const missingDate = !entry.result?.date || entry.result.date === 'Unknown';
      return !hasUsefulStats || missingDate;
    })
    .slice(0, limit);

  const merged = [...results];
  const metricsById = new Map();

  await withConcurrency(targets, concurrency, async (entry) => {
    if (metricsById.has(entry.tweetId)) {
      return metricsById.get(entry.tweetId);
    }
    try {
      const metrics = await fetchTweetMetrics(entry.tweetId, timeoutMs);
      metricsById.set(entry.tweetId, metrics);
      return metrics;
    } catch {
      try {
        const fallbackMetrics = await fetchTweetMetricsViaNitter(entry.tweetId, timeoutMs);
        metricsById.set(entry.tweetId, fallbackMetrics);
        return fallbackMetrics;
      } catch {
        return null;
      }
    }
  });

  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    const metrics = metricsById.get(target.tweetId);
    if (!metrics) continue;

    const current = merged[target.index];
    const currentStats = current.stats || {};
    merged[target.index] = {
      ...current,
      date: current.date && current.date !== 'Unknown' ? current.date : metrics.createdAt || current.date,
      relativeDate: current.relativeDate === 'Recently found' && metrics.createdAt ? current.relativeDate : current.relativeDate,
      stats: {
        replies: (currentStats.replies || 0) > 0 ? currentStats.replies : metrics.replies,
        retweets: (currentStats.retweets || 0) > 0 ? currentStats.retweets : metrics.retweets,
        likes: (currentStats.likes || 0) > 0 ? currentStats.likes : metrics.likes,
      },
    };
  }

  return merged;
}

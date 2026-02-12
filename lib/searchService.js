import { searchNitter } from './nitter.js';
import { searchDuckDuckGo } from './duckduckgo.js';
import { searchBingRss } from './bing.js';
import { searchJinaMirror } from './jina.js';
import { buildQueryVariants, normalizeSearchText } from './searchQuery.js';
import { canonicalizeResults } from './searchResults.js';
import { enrichTweetMetrics } from './tweetMetrics.js';

const GLOBAL_TIMEOUT_MS = 25000;
const EARLY_STOP_THRESHOLD = 12;
const SOURCE_TIMEOUT_MS = 8000;
const MIN_SOURCE_TIMEOUT_MS = 2500;
const SOURCE_COOLDOWN_MS = 60000;
const MAX_VARIANTS_TOTAL = 6;
const GENERIC_TERMS = new Set([
  'hello',
  'world',
  'gm',
  'good',
  'morning',
  'ai',
  'tools',
  'open',
  'source',
  'thread',
  'ship',
  'fast',
  'build',
  'public',
]);

const FALLBACK_SOURCES = ['duckduckgo', 'bing', 'jina'];
const SOURCE_PRIORITY = { duckduckgo: 0, bing: 1, jina: 2 };
const SOURCE_HEALTH = new Map();

function getSourceState(source) {
  if (!SOURCE_HEALTH.has(source)) {
    SOURCE_HEALTH.set(source, {
      score: 0,
      cooldownUntil: 0,
      lastSuccessAt: 0,
      lastFailureAt: 0,
    });
  }
  return SOURCE_HEALTH.get(source);
}

function clampScore(value) {
  return Math.max(-8, Math.min(8, value));
}

function recordSourceSuccess(source) {
  const state = getSourceState(source);
  state.score = clampScore(state.score + 2);
  state.cooldownUntil = 0;
  state.lastSuccessAt = Date.now();
}

function recordSourceFailure(source, error) {
  const state = getSourceState(source);
  const message = String(error?.message || '').toLowerCase();
  const penalty = /challenge|403|429|rate limit|forbidden/.test(message) ? 4 : 2;
  state.score = clampScore(state.score - penalty);
  state.lastFailureAt = Date.now();
  if (state.score <= -2 || penalty >= 4) {
    state.cooldownUntil = Date.now() + SOURCE_COOLDOWN_MS;
  }
}

function getFallbackOrder(queryProfile = { genericQuery: false }) {
  const now = Date.now();
  const candidates = FALLBACK_SOURCES.map((source) => ({
    source,
    state: getSourceState(source),
  }));

  candidates.sort((a, b) => {
    const aCooling = a.state.cooldownUntil > now;
    const bCooling = b.state.cooldownUntil > now;
    if (aCooling !== bCooling) return aCooling ? 1 : -1;

    // For short/generic queries, prefer more stable broad sources first.
    if (queryProfile.genericQuery) {
      const genericPreference = { bing: 0, jina: 1, duckduckgo: 2 };
      const prefDiff = genericPreference[a.source] - genericPreference[b.source];
      if (prefDiff !== 0) return prefDiff;
    }

    if (a.state.score !== b.state.score) return b.state.score - a.state.score;
    return SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source];
  });

  const hasReady = candidates.some((entry) => entry.state.cooldownUntil <= now);
  return { candidates, hasReady };
}

function computeSourceTimeout(remainingMs, source, failureCount) {
  const state = getSourceState(source);
  const scorePenalty = state.score < 0 ? Math.abs(state.score) * 200 : 0;
  const failurePenalty = Math.max(0, failureCount - 1) * 300;
  const adaptive = SOURCE_TIMEOUT_MS - scorePenalty - failurePenalty;
  const bounded = Math.max(MIN_SOURCE_TIMEOUT_MS, Math.min(adaptive, remainingMs));
  return bounded;
}

function classifyQuery(normalizedQuery) {
  const tokens = normalizedQuery
    .split(/\s+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const shortQuery = tokens.length <= 3 || normalizedQuery.length < 18;
  const genericHits = tokens.filter((t) => GENERIC_TERMS.has(t)).length;
  const genericRatio = tokens.length > 0 ? genericHits / tokens.length : 0;
  const genericQuery = shortQuery || genericRatio >= 0.6;

  return {
    tokens,
    shortQuery,
    genericQuery,
  };
}

function buildAdaptiveVariants(normalizedQuery, queryProfile) {
  const baseVariants = buildQueryVariants(normalizedQuery, { maxVariants: 4 });
  const variants = [...baseVariants];
  const seen = new Set(baseVariants.map((v) => String(v.plain || '').toLowerCase()));

  function addVariant(key, plain, quoted = false) {
    const normalized = normalizeSearchText(plain);
    if (!normalized) return;
    const canonical = normalized.toLowerCase();
    if (seen.has(canonical)) return;
    seen.add(canonical);
    variants.push({
      key,
      plain: normalized,
      query: quoted ? `"${normalized}"` : normalized,
      relaxed: true,
    });
  }

  if (variants.length === 0 && normalizedQuery) {
    addVariant('fallbackQuoted', normalizedQuery, true);
    addVariant('fallbackBroad', normalizedQuery, false);
  }

  if (queryProfile.shortQuery || queryProfile.genericQuery) {
    addVariant('shortBroad', normalizedQuery, false);
    const topTokens = queryProfile.tokens
      .filter((t) => t.length > 2)
      .slice(0, 6)
      .join(' ');
    addVariant('tokenWindow', topTokens, false);
  }

  return variants.slice(0, MAX_VARIANTS_TOTAL);
}

export async function runSearchPipeline(
  { query, queryInputType, excludeTweetId, excludeUsername, excludeContent },
  deps = {}
) {
  const startedAt = Date.now();
  const searchNitterFn = deps.searchNitterFn || searchNitter;
  const searchDuckDuckGoFn = deps.searchDuckDuckGoFn || searchDuckDuckGo;
  const searchBingFn = deps.searchBingFn || searchBingRss;
  const searchJinaFn = deps.searchJinaFn || searchJinaMirror;
  const canonicalizeResultsFn = deps.canonicalizeResultsFn || canonicalizeResults;
  const enrichTweetMetricsFn = deps.enrichTweetMetricsFn || enrichTweetMetrics;
  const normalizedExcludeUsername = String(excludeUsername || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
  const normalizedExcludeContent = normalizeSearchText(excludeContent || '').toLowerCase();

  if (!query) {
    return { status: 400, body: { error: 'Query is required' } };
  }

  const normalized = normalizeSearchText(query);
  const queryProfile = classifyQuery(normalized);
  const variants = buildAdaptiveVariants(normalized, queryProfile);
  const rawResults = [];
  let earlyStopped = false;
  let hadSuccessfulSourceResponse = false;
  let firstSuccessInstance = null;
  const sourceFailureCounts = { duckduckgo: 0, bing: 0, jina: 0 };

  const meta = {
    queryInputType: queryInputType === 'url_text_extracted' ? 'url_text_extracted' : 'text',
    excludeTweetId: typeof excludeTweetId === 'string' ? excludeTweetId : null,
    excludeUsername: normalizedExcludeUsername || null,
    variantsTried: [],
    sources: {
      nitter: { attempts: 0, failures: 0 },
      duckduckgo: { attempts: 0, failures: 0 },
      bing: { attempts: 0, failures: 0 },
      jina: { attempts: 0, failures: 0 }
    },
    preflight: {
      fallbackOrder: [],
      sourceScores: {},
    },
    queryProfile: {
      shortQuery: queryProfile.shortQuery,
      genericQuery: queryProfile.genericQuery,
      tokenCount: queryProfile.tokens.length,
      variantCount: variants.length,
    },
    timingMs: 0,
    earlyStopped: false,
    excludedCount: 0,
    metricsEnriched: 0,
    reason: 'exhausted_variants'
  };

  const preflight = getFallbackOrder(queryProfile);
  meta.preflight.fallbackOrder = preflight.candidates.map((entry) => entry.source);
  for (const entry of preflight.candidates) {
    meta.preflight.sourceScores[entry.source] = entry.state.score;
  }

  for (const variant of variants) {
    const remaining = GLOBAL_TIMEOUT_MS - (Date.now() - startedAt);
    if (remaining <= 0) break;

    const variantInfo = {
      key: variant.key,
      queryLength: variant.plain.length,
        sourceAttempts: {
        nitter: 0,
        duckduckgo: 0,
        bing: 0,
        jina: 0
      },
      hits: 0
    };

    let nitterResults = [];
    variantInfo.sourceAttempts.nitter += 1;
    meta.sources.nitter.attempts += 1;

    try {
      const nitterResponse = await searchNitterFn(variant.query, {
        timeoutMs: Math.min(SOURCE_TIMEOUT_MS, remaining)
      });
      nitterResults = nitterResponse.results || [];
      hadSuccessfulSourceResponse = true;
      if (!firstSuccessInstance && nitterResponse.instance) {
        firstSuccessInstance = nitterResponse.instance;
      }
    } catch {
      meta.sources.nitter.failures += 1;
    }

    if (nitterResults.length > 0) {
      for (const item of nitterResults) {
        rawResults.push({
          ...item,
          source: 'nitter',
          matchedBy: variant.key
        });
      }
    } else {
      const fallbackClients = {
        duckduckgo: { fn: searchDuckDuckGoFn, source: 'duckduckgo' },
        bing: { fn: searchBingFn, source: 'bing' },
        jina: { fn: searchJinaFn, source: 'jina' },
      };

      const order = getFallbackOrder(queryProfile);
      for (const candidate of order.candidates) {
        if (order.hasReady && candidate.state.cooldownUntil > Date.now()) {
          continue;
        }

        const key = candidate.source;
        const client = fallbackClients[key];
        if (!client) continue;
        variantInfo.sourceAttempts[key] += 1;
        meta.sources[key].attempts += 1;

        try {
          const remainingNow = GLOBAL_TIMEOUT_MS - (Date.now() - startedAt);
          if (remainingNow <= 0) break;
          const fallbackResponse = await client.fn(variant.query, {
            timeoutMs: computeSourceTimeout(remainingNow, key, sourceFailureCounts[key]),
          });
          const fallbackResults = fallbackResponse.results || [];
          hadSuccessfulSourceResponse = true;
          recordSourceSuccess(key);

          if (!firstSuccessInstance && fallbackResponse.instance) {
            firstSuccessInstance = fallbackResponse.instance;
          }

          if (fallbackResults.length > 0) {
            for (const item of fallbackResults) {
              rawResults.push({
                ...item,
                source: client.source,
                matchedBy: variant.key
              });
            }
            break;
          }
        } catch (error) {
          sourceFailureCounts[key] += 1;
          meta.sources[key].failures += 1;
          recordSourceFailure(key, error);
        }
      }
    }

    const dedupedSoFar = canonicalizeResultsFn(rawResults);
    variantInfo.hits = dedupedSoFar.length;
    meta.variantsTried.push(variantInfo);

    if (dedupedSoFar.length >= EARLY_STOP_THRESHOLD) {
      earlyStopped = true;
      break;
    }
  }

  const dedupedResults = canonicalizeResultsFn(rawResults);
  const filteredResults = dedupedResults.filter((result) => {
    if (typeof excludeTweetId === 'string' && excludeTweetId && result.tweetId === excludeTweetId) {
      return false;
    }

    if (!normalizedExcludeUsername || !normalizedExcludeContent) {
      return true;
    }

    const resultUsername = String(result?.author?.username || '')
      .trim()
      .replace(/^@+/, '')
      .toLowerCase();
    const resultContent = normalizeSearchText(result?.content || '').toLowerCase();
    return !(resultUsername === normalizedExcludeUsername && resultContent === normalizedExcludeContent);
  });
  meta.excludedCount = dedupedResults.length - filteredResults.length;

  const enrichedResults = await enrichTweetMetricsFn(filteredResults, {
    timeoutMs: 3500,
    maxItems: 10,
    concurrency: 4
  });
  meta.metricsEnriched = enrichedResults.reduce((count, item, idx) => {
    const before = filteredResults[idx]?.stats || {};
    const after = item?.stats || {};
    const beforeTotal = (before.likes || 0) + (before.retweets || 0) + (before.replies || 0);
    const afterTotal = (after.likes || 0) + (after.retweets || 0) + (after.replies || 0);
    return afterTotal > beforeTotal ? count + 1 : count;
  }, 0);

  meta.timingMs = Date.now() - startedAt;
  meta.earlyStopped = earlyStopped;

  if (enrichedResults.length > 0) {
    meta.reason = 'results_found';
    return {
      status: 200,
      body: {
        results: enrichedResults,
        instance: firstSuccessInstance,
        meta
      }
    };
  }

  if (!hadSuccessfulSourceResponse) {
    meta.reason = 'all_sources_failed';
    return {
      status: 500,
      body: {
        error: 'Failed to fetch search results',
        details: 'All automated sources failed',
        meta
      }
    };
  }

  meta.reason = 'exhausted_variants';
  return {
    status: 200,
    body: {
      results: enrichedResults,
      instance: firstSuccessInstance,
      meta
    }
  };
}

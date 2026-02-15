import { searchNitter } from './nitter.js';
import { searchDuckDuckGo } from './duckduckgo.js';
import { searchBingRss } from './bing.js';
import { searchJinaMirror } from './jina.js';
import { buildQueryVariants, normalizeSearchText } from './searchQuery.js';
import { canonicalizeResults } from './searchResults.js';
import { enrichTweetMetrics } from './tweetMetrics.js';
import { calculateSimilarity } from './similarity.js';
import { kvGet, kvSet } from './kv.js';

function envInt(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

const GLOBAL_TIMEOUT_MS = envInt('SEARCH_GLOBAL_TIMEOUT_MS', 15000);
const EARLY_STOP_THRESHOLD = envInt('SEARCH_EARLY_STOP_THRESHOLD', 8);
const SOURCE_TIMEOUT_MS = envInt('SEARCH_SOURCE_TIMEOUT_MS', 4500);
const MIN_SOURCE_TIMEOUT_MS = envInt('SEARCH_SOURCE_TIMEOUT_MIN_MS', 1500);
const SOURCE_COOLDOWN_MS = 60000;
const MAX_VARIANTS_TOTAL = 6;
const METRICS_TIMEOUT_MS = envInt('SEARCH_METRICS_TIMEOUT_MS', 1800);
const METRICS_MAX_ITEMS = envInt('SEARCH_METRICS_MAX_ITEMS', 6);
const METRICS_CONCURRENCY = envInt('SEARCH_METRICS_CONCURRENCY', 3);
const CACHE_TTL_MS = envInt('SEARCH_CACHE_TTL_MS', 120000);
const CACHE_MAX_ENTRIES = envInt('SEARCH_CACHE_MAX_ENTRIES', 200);
const SOURCE_CACHE_TTL_MS = envInt('SEARCH_SOURCE_CACHE_TTL_MS', 90000);
const SOURCE_CACHE_MAX_ENTRIES = envInt('SEARCH_SOURCE_CACHE_MAX_ENTRIES', 600);
const FALLBACK_PARALLEL_SOURCES = envInt('SEARCH_FALLBACK_PARALLEL_SOURCES', 2);
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

// KV key prefixes
const KV_SEARCH_PREFIX = 'cache:search:';
const KV_SOURCE_PREFIX = 'cache:src:';
const KV_HEALTH_PREFIX = 'health:';

// TTLs in seconds for KV storage
const CACHE_TTL_SEC = Math.ceil(CACHE_TTL_MS / 1000);
const SOURCE_CACHE_TTL_SEC = Math.ceil(SOURCE_CACHE_TTL_MS / 1000);
const HEALTH_TTL_SEC = 3600; // 1 hour

function cloneForCache(value) {
  // KV store handles serialization; this is for defensive copying.
  return JSON.parse(JSON.stringify(value));
}

function getCacheKey({
  normalized,
  queryInputType,
  excludeTweetId,
  excludeUsername,
  excludeContent,
}) {
  return JSON.stringify({
    q: normalized,
    mode: queryInputType === 'url_text_extracted' ? 'url' : 'text',
    xId: excludeTweetId || '',
    xUser: String(excludeUsername || '')
      .trim()
      .replace(/^@+/, '')
      .toLowerCase(),
    xContent: normalizeSearchText(excludeContent || '').toLowerCase(),
  });
}

async function readCachedSearch(key) {
  const kvKey = `${KV_SEARCH_PREFIX}${key}`;
  try {
    const hit = await kvGet(kvKey);
    if (!hit) return null;
    return cloneForCache(hit);
  } catch {
    return null;
  }
}

async function writeCachedSearch(key, body) {
  const kvKey = `${KV_SEARCH_PREFIX}${key}`;
  try {
    await kvSet(kvKey, cloneForCache(body), CACHE_TTL_SEC);
  } catch {
    // Non-critical — search still works without caching.
  }
}

function getSourceCacheKey(source, query) {
  return `${KV_SOURCE_PREFIX}${String(source || '').toLowerCase()}:${String(query || '').trim()}`;
}

async function readCachedSourceResult(source, query) {
  const key = getSourceCacheKey(source, query);
  try {
    const hit = await kvGet(key);
    if (!hit) return null;
    return cloneForCache(hit);
  } catch {
    return null;
  }
}

async function writeCachedSourceResult(source, query, body) {
  const key = getSourceCacheKey(source, query);
  try {
    await kvSet(key, cloneForCache(body), SOURCE_CACHE_TTL_SEC);
  } catch {
    // Non-critical.
  }
}

async function runSourceSearch({
  source,
  query,
  timeoutMs,
  fn,
  enableSourceCache = false,
}) {
  if (enableSourceCache) {
    const cached = await readCachedSourceResult(source, query);
    if (cached) return { ...cached, cacheHit: true };
  }

  const response = await fn(query, { timeoutMs });
  const payload = {
    results: response?.results || [],
    instance: response?.instance || null,
  };
  if (enableSourceCache) {
    // Fire-and-forget — don't block the response on cache write.
    writeCachedSourceResult(source, query, payload).catch(() => {});
  }
  return { ...payload, cacheHit: false };
}

const DEFAULT_HEALTH = {
  score: 0,
  cooldownUntil: 0,
  lastSuccessAt: 0,
  lastFailureAt: 0,
};

async function getSourceState(source) {
  const key = `${KV_HEALTH_PREFIX}${source}`;
  try {
    const state = await kvGet(key);
    if (state && typeof state === 'object') return state;
  } catch {
    // fall through to default
  }
  return { ...DEFAULT_HEALTH };
}

async function persistSourceState(source, state) {
  const key = `${KV_HEALTH_PREFIX}${source}`;
  try {
    await kvSet(key, state, HEALTH_TTL_SEC);
  } catch {
    // Non-critical.
  }
}

function clampScore(value) {
  return Math.max(-8, Math.min(8, value));
}

async function recordSourceSuccess(source) {
  const state = await getSourceState(source);
  state.score = clampScore(state.score + 2);
  state.cooldownUntil = 0;
  state.lastSuccessAt = Date.now();
  // Fire-and-forget.
  persistSourceState(source, state).catch(() => {});
}

async function recordSourceFailure(source, error) {
  const state = await getSourceState(source);
  const message = String(error?.message || '').toLowerCase();
  const penalty = /challenge|403|429|rate limit|forbidden/.test(message) ? 4 : 2;
  state.score = clampScore(state.score - penalty);
  state.lastFailureAt = Date.now();
  if (state.score <= -2 || penalty >= 4) {
    state.cooldownUntil = Date.now() + SOURCE_COOLDOWN_MS;
  }
  // Fire-and-forget.
  persistSourceState(source, state).catch(() => {});
}

async function getFallbackOrder(queryProfile = { genericQuery: false }) {
  const now = Date.now();
  const candidates = await Promise.all(
    FALLBACK_SOURCES.map(async (source) => ({
      source,
      state: await getSourceState(source),
    }))
  );

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

async function computeSourceTimeout(remainingMs, source, failureCount) {
  const state = await getSourceState(source);
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
  const useDefaultDeps = Object.keys(deps).length === 0;
  const enableCache =
    typeof deps.enableCache === 'boolean' ? deps.enableCache : useDefaultDeps;
  const enableSourceCache =
    typeof deps.enableSourceCache === 'boolean' ? deps.enableSourceCache : useDefaultDeps;
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
  const cacheKey = getCacheKey({
    normalized,
    queryInputType,
    excludeTweetId,
    excludeUsername,
    excludeContent,
  });
  if (enableCache) {
    const cachedBody = await readCachedSearch(cacheKey);
    if (cachedBody) {
      cachedBody.meta = {
        ...(cachedBody.meta || {}),
        cacheHit: true,
        timingMs: Date.now() - startedAt,
      };
      return { status: 200, body: cachedBody };
    }
  }
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
    cacheHit: false,
    sourceCacheHits: 0,
    reason: 'exhausted_variants'
  };

  const preflight = await getFallbackOrder(queryProfile);
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
      const nitterResponse = await runSourceSearch({
        source: 'nitter',
        query: variant.query,
        timeoutMs: Math.min(SOURCE_TIMEOUT_MS, remaining),
        fn: searchNitterFn,
        enableSourceCache,
      });
      if (nitterResponse.cacheHit) meta.sourceCacheHits += 1;
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

      const order = await getFallbackOrder(queryProfile);
      const orderedFallbackCandidates = order.candidates
        .filter((candidate) => !(order.hasReady && candidate.state.cooldownUntil > Date.now()))
        .map((candidate) => candidate.source)
        .filter((key) => Boolean(fallbackClients[key]));

      for (let i = 0; i < orderedFallbackCandidates.length; i += FALLBACK_PARALLEL_SOURCES) {
        const fallbackBatch = orderedFallbackCandidates.slice(i, i + FALLBACK_PARALLEL_SOURCES);
        if (fallbackBatch.length === 0) break;

        for (const key of fallbackBatch) {
          variantInfo.sourceAttempts[key] += 1;
          meta.sources[key].attempts += 1;
        }

        const fallbackResponses = await Promise.all(
          fallbackBatch.map(async (key) => {
            const client = fallbackClients[key];
            const remainingNow = GLOBAL_TIMEOUT_MS - (Date.now() - startedAt);
            if (remainingNow <= 0) {
              return { key, results: [], ok: false, skipped: true };
            }
            try {
              const fallbackResponse = await runSourceSearch({
                source: key,
                query: variant.query,
                timeoutMs: await computeSourceTimeout(remainingNow, key, sourceFailureCounts[key]),
                fn: client.fn,
                enableSourceCache,
              });
              if (fallbackResponse.cacheHit) meta.sourceCacheHits += 1;
              hadSuccessfulSourceResponse = true;
              recordSourceSuccess(key); // fire-and-forget (already async internally)

              if (!firstSuccessInstance && fallbackResponse.instance) {
                firstSuccessInstance = fallbackResponse.instance;
              }

              return {
                key,
                results: fallbackResponse.results || [],
                ok: true,
              };
            } catch (error) {
              sourceFailureCounts[key] += 1;
              meta.sources[key].failures += 1;
              recordSourceFailure(key, error); // fire-and-forget
              return { key, results: [], ok: false };
            }
          })
        );

        const responseBySource = new Map(fallbackResponses.map((item) => [item.key, item]));
        const selectedResponse = fallbackBatch
          .map((key) => responseBySource.get(key))
          .find((item) => item && item.results && item.results.length > 0);

        if (selectedResponse) {
          const selectedSource = selectedResponse.key;
          for (const item of selectedResponse.results) {
            rawResults.push({
              ...item,
              source: selectedSource,
              matchedBy: variant.key
            });
          }
          break;
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
  const selfDuplicateResults = [];
  const filteredResults = dedupedResults.filter((result) => {
    const resultUrl = String(result?.url || '');
    const resultIdFromUrl = (resultUrl.match(/\/status\/(\d+)/)?.[1] || '').trim();
    const resultUsernameFromUrl = (
      resultUrl.match(/(?:x|twitter)\.com\/([^/\s]+)\/status\/\d+/i)?.[1] || ''
    )
      .trim()
      .replace(/^@+/, '')
      .toLowerCase();

    const isSourceTweetById =
      typeof excludeTweetId === 'string' &&
      excludeTweetId &&
      (result.tweetId === excludeTweetId || resultIdFromUrl === excludeTweetId);
    if (isSourceTweetById) {
      return false;
    }

    if (!normalizedExcludeUsername || !normalizedExcludeContent) {
      return true;
    }

    const resultUsername = String(result?.author?.username || resultUsernameFromUrl || '')
      .trim()
      .replace(/^@+/, '')
      .toLowerCase();
    const resultContent = normalizeSearchText(result?.content || '').toLowerCase();
    const resultComparableId = (result.tweetId || resultIdFromUrl || '').trim();
    const isSourceTweetByContent =
      resultUsername === normalizedExcludeUsername && resultContent === normalizedExcludeContent;
    if (isSourceTweetByContent) {
      if (resultComparableId && excludeTweetId && resultComparableId !== excludeTweetId) {
        selfDuplicateResults.push({
          ...result,
          duplicateType: 'self_author',
          similarityToQuery: 100,
        });
      }
      return false;
    }

    const similarityToQuery = calculateSimilarity(normalized, result?.content || '');
    const isSelfDuplicate = resultUsername === normalizedExcludeUsername && similarityToQuery >= 90;
    if (isSelfDuplicate) {
      selfDuplicateResults.push({
        ...result,
        duplicateType: 'self_author',
        similarityToQuery,
      });
      return false;
    }

    return true;
  });
  meta.excludedCount = dedupedResults.length - filteredResults.length;

  const enrichedResults = await enrichTweetMetricsFn(filteredResults, {
    timeoutMs: METRICS_TIMEOUT_MS,
    maxItems: METRICS_MAX_ITEMS,
    concurrency: METRICS_CONCURRENCY
  });
  const enrichedSelfDuplicates = await enrichTweetMetricsFn(selfDuplicateResults, {
    timeoutMs: Math.max(Math.floor(METRICS_TIMEOUT_MS * 0.75), 1200),
    maxItems: Math.max(Math.floor(METRICS_MAX_ITEMS * 0.5), 4),
    concurrency: Math.max(Math.floor(METRICS_CONCURRENCY * 0.67), 2)
  });
  meta.selfDuplicatesCount = enrichedSelfDuplicates.length;
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
    const body = {
      results: enrichedResults,
      selfDuplicates: enrichedSelfDuplicates,
      instance: firstSuccessInstance,
      meta
    };
    if (enableCache) writeCachedSearch(cacheKey, body).catch(() => {});
    return {
      status: 200,
      body
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
  const body = {
    results: enrichedResults,
    selfDuplicates: enrichedSelfDuplicates,
    instance: firstSuccessInstance,
    meta
  };
  if (enableCache) writeCachedSearch(cacheKey, body).catch(() => {});
  return {
    status: 200,
    body
  };
}

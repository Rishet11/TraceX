import { searchNitter } from './nitter.js';
import { searchDuckDuckGo } from './duckduckgo.js';
import { buildQueryVariants, normalizeSearchText } from './searchQuery.js';
import { canonicalizeResults } from './searchResults.js';
import { enrichTweetMetrics } from './tweetMetrics.js';

const GLOBAL_TIMEOUT_MS = 25000;
const EARLY_STOP_THRESHOLD = 12;
const SOURCE_TIMEOUT_MS = 8000;

export async function runSearchPipeline(
  { query, queryInputType, excludeTweetId, excludeUsername, excludeContent },
  deps = {}
) {
  const startedAt = Date.now();
  const searchNitterFn = deps.searchNitterFn || searchNitter;
  const searchDuckDuckGoFn = deps.searchDuckDuckGoFn || searchDuckDuckGo;
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
  const variants = buildQueryVariants(normalized, { maxVariants: 4 });
  const rawResults = [];
  let earlyStopped = false;
  let hadSuccessfulSourceResponse = false;
  let firstSuccessInstance = null;

  const meta = {
    queryInputType: queryInputType === 'url_text_extracted' ? 'url_text_extracted' : 'text',
    excludeTweetId: typeof excludeTweetId === 'string' ? excludeTweetId : null,
    excludeUsername: normalizedExcludeUsername || null,
    variantsTried: [],
    sources: {
      nitter: { attempts: 0, failures: 0 },
      duckduckgo: { attempts: 0, failures: 0 }
    },
    timingMs: 0,
    earlyStopped: false,
    excludedCount: 0,
    metricsEnriched: 0,
    reason: 'exhausted_variants'
  };

  for (const variant of variants) {
    const remaining = GLOBAL_TIMEOUT_MS - (Date.now() - startedAt);
    if (remaining <= 0) break;

    const variantInfo = {
      key: variant.key,
      queryLength: variant.plain.length,
      sourceAttempts: {
        nitter: 0,
        duckduckgo: 0
      },
      hits: 0
    };

    let nitterResults = [];
    let nitterFailed = false;
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
      nitterFailed = true;
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
      let ddgResults = [];
      variantInfo.sourceAttempts.duckduckgo += 1;
      meta.sources.duckduckgo.attempts += 1;

      try {
        const ddgResponse = await searchDuckDuckGoFn(variant.query, {
          timeoutMs: Math.min(SOURCE_TIMEOUT_MS, remaining)
        });
        ddgResults = ddgResponse.results || [];
        hadSuccessfulSourceResponse = true;
        if (!firstSuccessInstance && ddgResponse.instance) {
          firstSuccessInstance = ddgResponse.instance;
        }
      } catch {
        if (nitterFailed) {
          meta.sources.duckduckgo.failures += 1;
        }
      }

      if (ddgResults.length > 0) {
        for (const item of ddgResults) {
          rawResults.push({
            ...item,
            source: 'duckduckgo',
            matchedBy: variant.key
          });
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

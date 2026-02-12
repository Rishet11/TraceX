import { NextResponse } from 'next/server';
import { searchNitter } from '@/lib/nitter';
import { searchDuckDuckGo } from '@/lib/duckduckgo';
import { buildQueryVariants, normalizeSearchText } from '@/lib/searchQuery';
import { canonicalizeResults } from '@/lib/searchResults';

const GLOBAL_TIMEOUT_MS = 25000;
const EARLY_STOP_THRESHOLD = 12;
const SOURCE_TIMEOUT_MS = 8000;

export async function POST(request) {
  const startedAt = Date.now();

  try {
    const { query, queryInputType, excludeTweetId } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
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
      variantsTried: [],
      sources: {
        nitter: { attempts: 0, failures: 0 },
        duckduckgo: { attempts: 0, failures: 0 }
      },
      timingMs: 0,
      earlyStopped: false,
      excludedCount: 0,
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
        const nitterResponse = await searchNitter(variant.query, {
          timeoutMs: Math.min(SOURCE_TIMEOUT_MS, remaining)
        });
        nitterResults = nitterResponse.results || [];
        hadSuccessfulSourceResponse = true;
        if (!firstSuccessInstance && nitterResponse.instance) {
          firstSuccessInstance = nitterResponse.instance;
        }
      } catch (nitterError) {
        nitterFailed = true;
        meta.sources.nitter.failures += 1;
        console.warn('Nitter search failed for variant:', variant.key, nitterError.message);
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
          const ddgResponse = await searchDuckDuckGo(variant.query, {
            timeoutMs: Math.min(SOURCE_TIMEOUT_MS, remaining)
          });
          ddgResults = ddgResponse.results || [];
          hadSuccessfulSourceResponse = true;
          if (!firstSuccessInstance && ddgResponse.instance) {
            firstSuccessInstance = ddgResponse.instance;
          }
        } catch (ddgError) {
          meta.sources.duckduckgo.failures += 1;
          if (nitterFailed) {
            console.warn('DDG fallback also failed for variant:', variant.key, ddgError.message);
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

      const dedupedSoFar = canonicalizeResults(rawResults);
      variantInfo.hits = dedupedSoFar.length;
      meta.variantsTried.push(variantInfo);

      if (dedupedSoFar.length >= EARLY_STOP_THRESHOLD) {
        earlyStopped = true;
        break;
      }
    }

    const dedupedResults = canonicalizeResults(rawResults);
    const filteredResults =
      typeof excludeTweetId === 'string' && excludeTweetId
        ? dedupedResults.filter((r) => r.tweetId !== excludeTweetId)
        : dedupedResults;
    meta.excludedCount = dedupedResults.length - filteredResults.length;
    meta.timingMs = Date.now() - startedAt;
    meta.earlyStopped = earlyStopped;

    if (filteredResults.length > 0) {
      meta.reason = 'results_found';
    } else if (!hadSuccessfulSourceResponse) {
      meta.reason = 'all_sources_failed';
      return NextResponse.json(
        { error: 'Failed to fetch search results', details: 'All automated sources failed', meta },
        { status: 500 }
      );
    } else {
      meta.reason = 'exhausted_variants';
    }

    return NextResponse.json({
      results: filteredResults,
      instance: firstSuccessInstance,
      meta
    });
  } catch (error) {
    console.error('Search API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch search results', details: error.message }, { status: 500 });
  }
}

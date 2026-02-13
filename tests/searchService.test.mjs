import test from 'node:test';
import assert from 'node:assert/strict';
import { runSearchPipeline } from '../lib/searchService.js';

function makeTweet(id, content = 'copied text') {
  return {
    content,
    author: { fullname: 'User', username: `user${id}`, avatar: null },
    date: 'Unknown',
    relativeDate: 'Recently found',
    url: `https://x.com/user${id}/status/${id}`,
    tweetId: String(id),
    stats: { replies: 0, retweets: 0, likes: 0 }
  };
}

test('returns 400 when query is missing', async () => {
  const res = await runSearchPipeline({}, {});
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Query is required');
});

test('returns success with results and excludes source tweet id', async () => {
  const response = await runSearchPipeline(
    {
      query: 'hello world this is long enough',
      queryInputType: 'url_text_extracted',
      excludeTweetId: '1'
    },
    {
      searchNitterFn: async () => ({ results: [makeTweet(1), makeTweet(2)], instance: 'nitter.test' }),
      searchDuckDuckGoFn: async () => ({ results: [], instance: 'DuckDuckGo' }),
      searchBingFn: async () => ({ results: [], instance: 'Bing RSS' }),
      searchJinaFn: async () => ({ results: [], instance: 'Jina Mirror' }),
      enrichTweetMetricsFn: async (results) => results,
    }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.results.length, 1);
  assert.equal(response.body.results[0].tweetId, '2');
  assert.equal(response.body.meta.excludedCount, 1);
  assert.equal(response.body.meta.reason, 'results_found');
});

test('returns success empty when sources respond but no results', async () => {
  const response = await runSearchPipeline(
    { query: 'hello world this is long enough' },
    {
      searchNitterFn: async () => ({ results: [], instance: 'nitter.test' }),
      searchDuckDuckGoFn: async () => ({ results: [], instance: 'DuckDuckGo' }),
      searchBingFn: async () => ({ results: [], instance: 'Bing RSS' }),
      searchJinaFn: async () => ({ results: [], instance: 'Jina Mirror' }),
      enrichTweetMetricsFn: async (results) => results,
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.results, []);
  assert.equal(response.body.meta.reason, 'exhausted_variants');
});

test('returns 500 when all sources fail', async () => {
  const fail = async () => {
    throw new Error('source down');
  };

  const response = await runSearchPipeline(
    { query: 'hello world this is long enough' },
    {
      searchNitterFn: fail,
      searchDuckDuckGoFn: fail,
      searchBingFn: fail,
      searchJinaFn: fail,
      enrichTweetMetricsFn: async (results) => results,
    }
  );

  assert.equal(response.status, 500);
  assert.equal(response.body.meta.reason, 'all_sources_failed');
});

test('excludes source tweet by username + content fallback when ids are unreliable', async () => {
  const sourceContent = 'Name a career that AI cannot replace.';
  const sameSourceDifferentId = {
    ...makeTweet(999, sourceContent),
    tweetId: '999',
    author: { fullname: 'Aryan', username: 'justbyte_' },
  };
  const trueCopy = {
    ...makeTweet(555, sourceContent),
    tweetId: '555',
    author: { fullname: 'Another', username: 'copycat_user' },
  };

  const response = await runSearchPipeline(
    {
      query: sourceContent,
      queryInputType: 'url_text_extracted',
      excludeTweetId: '123',
      excludeUsername: '@justbyte_',
      excludeContent: sourceContent,
    },
    {
      searchNitterFn: async () => ({ results: [sameSourceDifferentId, trueCopy], instance: 'nitter.test' }),
      searchDuckDuckGoFn: async () => ({ results: [], instance: 'DuckDuckGo' }),
      searchBingFn: async () => ({ results: [], instance: 'Bing RSS' }),
      searchJinaFn: async () => ({ results: [], instance: 'Jina Mirror' }),
      enrichTweetMetricsFn: async (results) => results,
    }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.results.length, 1);
  assert.equal(response.body.results[0].author.username, 'copycat_user');
});

test('excludes source tweet when author username is missing but URL identity matches', async () => {
  const sourceContent = 'Name a career that AI cannot replace.';
  const sameSourceNoUsername = {
    ...makeTweet(999, sourceContent),
    tweetId: '999',
    url: 'https://x.com/justbyte_/status/123',
    author: { fullname: 'Aryan' },
  };
  const trueCopy = {
    ...makeTweet(555, sourceContent),
    tweetId: '555',
    url: 'https://x.com/copycat_user/status/555',
    author: { fullname: 'Another', username: 'copycat_user' },
  };

  const response = await runSearchPipeline(
    {
      query: sourceContent,
      queryInputType: 'url_text_extracted',
      excludeTweetId: '123',
      excludeUsername: '@justbyte_',
      excludeContent: sourceContent,
    },
    {
      searchNitterFn: async () => ({
        results: [sameSourceNoUsername, trueCopy],
        instance: 'nitter.test',
      }),
      searchDuckDuckGoFn: async () => ({ results: [], instance: 'DuckDuckGo' }),
      searchBingFn: async () => ({ results: [], instance: 'Bing RSS' }),
      searchJinaFn: async () => ({ results: [], instance: 'Jina Mirror' }),
      enrichTweetMetricsFn: async (results) => results,
    }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.results.length, 1);
  assert.equal(response.body.results[0].author.username, 'copycat_user');
  assert.equal(response.body.meta.excludedCount, 1);
});

test('separates same-author duplicates from external copy results', async () => {
  const sourceContent = 'Build in public and show your receipts';
  const sameAuthorDuplicate = {
    ...makeTweet(777, sourceContent),
    tweetId: '777',
    url: 'https://x.com/original_author/status/777',
    author: { fullname: 'Original', username: 'original_author' },
  };
  const externalCopy = {
    ...makeTweet(888, sourceContent),
    tweetId: '888',
    url: 'https://x.com/copycat_user/status/888',
    author: { fullname: 'Copycat', username: 'copycat_user' },
  };

  const response = await runSearchPipeline(
    {
      query: sourceContent,
      queryInputType: 'url_text_extracted',
      excludeTweetId: '123',
      excludeUsername: '@original_author',
      excludeContent: sourceContent,
    },
    {
      searchNitterFn: async () => ({
        results: [sameAuthorDuplicate, externalCopy],
        instance: 'nitter.test',
      }),
      searchDuckDuckGoFn: async () => ({ results: [], instance: 'DuckDuckGo' }),
      searchBingFn: async () => ({ results: [], instance: 'Bing RSS' }),
      searchJinaFn: async () => ({ results: [], instance: 'Jina Mirror' }),
      enrichTweetMetricsFn: async (results) => results,
    }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.results.length, 1);
  assert.equal(response.body.results[0].author.username, 'copycat_user');
  assert.equal(response.body.selfDuplicates.length, 1);
  assert.equal(response.body.selfDuplicates[0].author.username, 'original_author');
  assert.equal(response.body.meta.selfDuplicatesCount, 1);
});

test('uses Bing fallback when nitter and ddg return no results', async () => {
  const response = await runSearchPipeline(
    { query: 'hello world this is long enough' },
    {
      searchNitterFn: async () => ({ results: [], instance: 'nitter.test' }),
      searchDuckDuckGoFn: async () => ({ results: [], instance: 'DuckDuckGo' }),
      searchBingFn: async () => ({ results: [makeTweet(3)], instance: 'Bing RSS' }),
      searchJinaFn: async () => ({ results: [], instance: 'Jina Mirror' }),
      enrichTweetMetricsFn: async (results) => results,
    }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.results.length, 1);
  assert.equal(response.body.results[0].source, 'bing');
});

test('uses Jina fallback when nitter, ddg, and bing return no results', async () => {
  const response = await runSearchPipeline(
    { query: 'hello world this is long enough' },
    {
      searchNitterFn: async () => ({ results: [], instance: 'nitter.test' }),
      searchDuckDuckGoFn: async () => ({ results: [], instance: 'DuckDuckGo' }),
      searchBingFn: async () => ({ results: [], instance: 'Bing RSS' }),
      searchJinaFn: async () => ({ results: [makeTweet(4)], instance: 'Jina Mirror' }),
      enrichTweetMetricsFn: async (results) => results,
    }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.results.length, 1);
  assert.equal(response.body.results[0].source, 'jina');
});

test('short query still runs via adaptive variants and exposes query profile', async () => {
  const response = await runSearchPipeline(
    { query: 'gm', queryInputType: 'text' },
    {
      searchNitterFn: async () => ({ results: [], instance: 'nitter.test' }),
      searchDuckDuckGoFn: async () => ({ results: [], instance: 'DuckDuckGo' }),
      searchBingFn: async () => ({ results: [makeTweet(7, 'gm everyone')], instance: 'Bing RSS' }),
      searchJinaFn: async () => ({ results: [], instance: 'Jina Mirror' }),
      enrichTweetMetricsFn: async (results) => results,
    }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.results.length, 1);
  assert.equal(response.body.meta.queryProfile.shortQuery, true);
  assert.ok(response.body.meta.queryProfile.variantCount >= 1);
});

test('generic query routes fallback priority to bing/jina before duckduckgo', async () => {
  const callOrder = [];

  const response = await runSearchPipeline(
    { query: 'good morning', queryInputType: 'text' },
    {
      searchNitterFn: async () => ({ results: [], instance: 'nitter.test' }),
      searchDuckDuckGoFn: async () => {
        callOrder.push('duckduckgo');
        return { results: [], instance: 'DuckDuckGo' };
      },
      searchBingFn: async () => {
        callOrder.push('bing');
        return { results: [makeTweet(8, 'good morning folks')], instance: 'Bing RSS' };
      },
      searchJinaFn: async () => {
        callOrder.push('jina');
        return { results: [], instance: 'Jina Mirror' };
      },
      enrichTweetMetricsFn: async (results) => results,
    }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.results[0].source, 'bing');
  assert.equal(callOrder[0], 'bing');
});

test('returns cached results for repeated identical query in fast mode', async () => {
  let nitterCalls = 0;
  const query = 'cache me please unique tracex query';
  const deps = {
    enableCache: true,
    searchNitterFn: async () => {
      nitterCalls += 1;
      return { results: [makeTweet(901, query)], instance: 'nitter.test' };
    },
    searchDuckDuckGoFn: async () => ({ results: [] }),
    searchBingFn: async () => ({ results: [] }),
    searchJinaFn: async () => ({ results: [] }),
    enrichTweetMetricsFn: async (results) => results,
  };

  const first = await runSearchPipeline({ query, queryInputType: 'text' }, deps);
  const second = await runSearchPipeline({ query, queryInputType: 'text' }, deps);

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(nitterCalls, 1);
  assert.equal(second.body.meta.cacheHit, true);
});

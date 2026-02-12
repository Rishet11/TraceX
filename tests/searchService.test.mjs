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
      enrichTweetMetricsFn: async (results) => results,
    }
  );

  assert.equal(response.status, 500);
  assert.equal(response.body.meta.reason, 'all_sources_failed');
});

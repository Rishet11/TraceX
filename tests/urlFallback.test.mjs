import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchTweetDetailsFromFallbackSources,
  resetUrlFallbackHealthForTests,
} from '../lib/nitter.js';

test('fallback sources retry transient syndication errors and recover', async () => {
  resetUrlFallbackHealthForTests();
  let attempts = 0;

  const result = await fetchTweetDetailsFromFallbackSources('123', {
    timeoutMs: 50,
    retries: 1,
    syndicationFn: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('Syndication returned 429');
      return {
        content: 'hello',
        author: 'User',
        username: '@user',
        date: 'Unknown',
        relativeDate: 'Recently found',
        url: 'https://x.com/user/status/123',
        stats: { replies: 0, retweets: 0, likes: 0 },
        avatar: null,
        source: 'syndication',
      };
    },
    oembedFn: async () => {
      throw new Error('should not be called');
    },
  });

  assert.equal(result.source, 'syndication');
  assert.equal(attempts, 2);
});

test('fallback source cooldown skips repeatedly failing source on subsequent call', async () => {
  resetUrlFallbackHealthForTests();
  let syndicationAttempts = 0;
  let oembedAttempts = 0;

  const syndicationFn = async () => {
    syndicationAttempts += 1;
    throw new Error('Syndication returned 429');
  };

  const oembedFn = async () => {
    oembedAttempts += 1;
    return {
      content: 'hello from oembed',
      author: 'User',
      username: '@user',
      date: 'Unknown',
      relativeDate: 'Recently found',
      url: 'https://x.com/user/status/123',
      stats: { replies: 0, retweets: 0, likes: 0 },
      avatar: null,
      source: 'oembed',
    };
  };

  const first = await fetchTweetDetailsFromFallbackSources('123', {
    timeoutMs: 50,
    retries: 1,
    syndicationFn,
    oembedFn,
  });
  assert.equal(first.source, 'oembed');
  assert.equal(syndicationAttempts, 2);
  assert.equal(oembedAttempts, 1);

  const second = await fetchTweetDetailsFromFallbackSources('123', {
    timeoutMs: 50,
    retries: 1,
    syndicationFn,
    oembedFn,
    jinaStatusFn: async () => {
      throw new Error('should not be called while oembed succeeds');
    },
  });
  assert.equal(second.source, 'oembed');
  assert.equal(syndicationAttempts, 2);
  assert.equal(oembedAttempts, 2);
});

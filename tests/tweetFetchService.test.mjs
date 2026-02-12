import test from 'node:test';
import assert from 'node:assert/strict';
import { runTweetFetchPipeline } from '../lib/tweetFetchService.js';

test('runTweetFetchPipeline returns 400 for missing url', async () => {
  const out = await runTweetFetchPipeline({});
  assert.equal(out.status, 400);
  assert.equal(out.body.error, 'URL is required');
});

test('runTweetFetchPipeline returns 400 for invalid tweet url', async () => {
  const out = await runTweetFetchPipeline({ url: 'https://x.com/home' });
  assert.equal(out.status, 400);
  assert.equal(out.body.error, 'Invalid Tweet URL');
});

test('runTweetFetchPipeline returns tweet payload on success', async () => {
  const out = await runTweetFetchPipeline(
    { url: 'https://x.com/user/status/123' },
    {
      getTweetByIdFn: async (id) => ({
        content: 'hello',
        author: 'User',
        username: '@user',
        id,
      }),
    }
  );

  assert.equal(out.status, 200);
  assert.equal(out.body.tweetId, '123');
  assert.equal(out.body.tweet.content, 'hello');
});

test('runTweetFetchPipeline returns graceful unavailable response on 403/404 style errors', async () => {
  const out = await runTweetFetchPipeline(
    { url: 'https://x.com/user/status/123' },
    {
      getTweetByIdFn: async () => {
        throw new Error('All Nitter instances failed to fetch tweet. Last error: Instance returned 403. Fallback error: oEmbed returned 404');
      },
    }
  );

  assert.equal(out.status, 200);
  assert.equal(out.body.unavailable, true);
  assert.equal(out.body.reason, 'tweet_unavailable');
});

test('runTweetFetchPipeline returns 500 on non-availability errors', async () => {
  const out = await runTweetFetchPipeline(
    { url: 'https://x.com/user/status/123' },
    {
      getTweetByIdFn: async () => {
        throw new Error('socket hang up');
      },
    }
  );

  assert.equal(out.status, 500);
  assert.equal(out.body.error, 'Failed to fetch tweet');
});

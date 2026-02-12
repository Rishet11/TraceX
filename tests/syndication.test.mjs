import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchJinaStatusTweetById, fetchOEmbedTweetById, fetchSyndicationTweetById } from '../lib/syndication.js';

test('fetchSyndicationTweetById maps payload to tweet details', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      text: 'Hello world',
      created_at: 'Mon Feb 12 10:00:00 +0000 2024',
      favorite_count: 42,
      retweet_count: 5,
      conversation_count: 3,
      user: {
        name: 'Alice',
        screen_name: 'alice',
        profile_image_url_https: 'https://example.com/avatar.jpg',
      },
    }),
  });

  try {
    const tweet = await fetchSyndicationTweetById('123');
    assert.equal(tweet.content, 'Hello world');
    assert.equal(tweet.author, 'Alice');
    assert.equal(tweet.username, '@alice');
    assert.equal(tweet.stats.likes, 42);
    assert.equal(tweet.stats.retweets, 5);
    assert.equal(tweet.stats.replies, 3);
    assert.equal(tweet.url, 'https://x.com/alice/status/123');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchSyndicationTweetById throws on bad payload', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      text: '',
      user: { screen_name: '' },
    }),
  });

  try {
    await assert.rejects(
      () => fetchSyndicationTweetById('456'),
      /missing tweet content/i
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchOEmbedTweetById maps payload to tweet details', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      author_name: 'Jane',
      author_url: 'https://x.com/jane',
      html: '<blockquote><p>Hello from oEmbed</p></blockquote>',
    }),
  });

  try {
    const tweet = await fetchOEmbedTweetById('789');
    assert.equal(tweet.content, 'Hello from oEmbed');
    assert.equal(tweet.author, 'Jane');
    assert.equal(tweet.username, '@jane');
    assert.equal(tweet.url, 'https://x.com/jane/status/789');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchJinaStatusTweetById maps text payload to tweet details', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    text: async () => `
Title: X post
URL Source: https://x.com/i/status/777
https://x.com/testuser/status/777
This is a fallback tweet content from mirror source.
`,
  });

  try {
    const tweet = await fetchJinaStatusTweetById('777');
    assert.equal(tweet.content, 'This is a fallback tweet content from mirror source.');
    assert.equal(tweet.username, '@testuser');
    assert.equal(tweet.url, 'https://x.com/testuser/status/777');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

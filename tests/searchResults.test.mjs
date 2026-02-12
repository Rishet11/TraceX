import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeResults } from '../lib/searchResults.js';

test('canonicalizeResults dedupes by tweet id and prefers richer nitter result', () => {
  const input = [
    {
      content: 'same tweet',
      author: { username: 'user1', avatar: null },
      url: 'https://x.com/user1/status/123',
      date: 'Unknown',
      stats: { replies: 0, retweets: 0, likes: 0 },
      source: 'duckduckgo'
    },
    {
      content: 'same tweet',
      author: { username: 'user1', avatar: 'https://img.test/a.jpg' },
      url: 'https://x.com/user1/status/123',
      date: '2026-02-12',
      stats: { replies: 1, retweets: 2, likes: 3 },
      source: 'nitter'
    }
  ];

  const out = canonicalizeResults(input);
  assert.equal(out.length, 1);
  assert.equal(out[0].source, 'nitter');
  assert.equal(out[0].tweetId, '123');
  assert.equal(out[0].stats.likes, 3);
});

test('canonicalizeResults fallback dedupe by username + normalized content', () => {
  const input = [
    {
      content: 'Hello world!!!',
      author: { username: 'sameuser' },
      url: 'https://x.com/sameuser/status/111',
      stats: { replies: 0, retweets: 0, likes: 0 },
      source: 'duckduckgo'
    },
    {
      content: 'Hello world',
      author: { username: 'sameuser' },
      url: 'https://x.com/sameuser/status/111',
      stats: { replies: 0, retweets: 0, likes: 1 },
      source: 'nitter'
    }
  ];

  const out = canonicalizeResults(input);
  assert.equal(out.length, 1);
});

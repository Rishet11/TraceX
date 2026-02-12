import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanSnippetContent, extractStatsFromSnippet, parseCountToken } from '../lib/duckduckgo.js';

test('parseCountToken handles K/M/B and commas', () => {
  assert.equal(parseCountToken('13.1K'), 13100);
  assert.equal(parseCountToken('1,681'), 1681);
  assert.equal(parseCountToken('2M'), 2000000);
  assert.equal(parseCountToken('0'), 0);
});

test('extractStatsFromSnippet reads replies/retweets/likes from text', () => {
  const stats = extractStatsFromSnippet('... 24 Retweets 59 Likes 1,681 Replies ...');
  assert.equal(stats.retweets, 24);
  assert.equal(stats.likes, 59);
  assert.equal(stats.replies, 1681);
});

test('cleanSnippetContent strips reply boilerplate and metadata tails', () => {
  const cleaned = cleanSnippetContent(
    'Merge Machines @mergemachines tweet text here Replying to @user1 and @user2 8:29 AM · Sep 17, 2022 9 Retweets 36 Likes'
  );
  assert.equal(cleaned, 'Merge Machines @mergemachines tweet text here');
});

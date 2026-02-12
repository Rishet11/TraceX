import test from 'node:test';
import assert from 'node:assert/strict';
import { computeResultQualityScore, withQualityScores } from '../lib/ranking.js';

test('computeResultQualityScore favors richer metadata and originality on same similarity', () => {
  const base = {
    similarityScore: 95,
    engagement: 10,
    parsedDate: Date.now(),
    source: 'nitter',
    content: 'Normal tweet content',
    isRetweet: false,
    isQuote: false,
  };
  const weaker = {
    similarityScore: 95,
    engagement: 10,
    parsedDate: null,
    source: 'duckduckgo',
    content: 'RT @someone content',
    isRetweet: true,
    isQuote: false,
  };

  const sortedEngagements = [0, 10, 10, 10, 100];
  const strongScore = computeResultQualityScore(base, sortedEngagements);
  const weakScore = computeResultQualityScore(weaker, sortedEngagements);
  assert.ok(strongScore > weakScore);
});

test('withQualityScores adds numeric qualityScore for each result', () => {
  const scored = withQualityScores([
    { similarityScore: 80, engagement: 0, content: 'A', source: 'duckduckgo' },
    { similarityScore: 90, engagement: 100, content: 'B', source: 'nitter', parsedDate: Date.now() },
  ]);

  assert.equal(scored.length, 2);
  assert.equal(typeof scored[0].qualityScore, 'number');
  assert.equal(typeof scored[1].qualityScore, 'number');
});

test('engagement percentile increases quality score when other factors are equal', () => {
  const common = {
    similarityScore: 85,
    parsedDate: Date.now(),
    source: 'nitter',
    content: 'normal content',
    isRetweet: false,
    isQuote: false,
  };

  const low = computeResultQualityScore({ ...common, engagement: 1 }, [1, 10, 100]);
  const high = computeResultQualityScore({ ...common, engagement: 100 }, [1, 10, 100]);
  assert.ok(high > low);
});

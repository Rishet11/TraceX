import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQueryVariants, normalizeSearchText } from '../lib/searchQuery.js';

test('normalizeSearchText removes zero-width chars and collapses spaces', () => {
  const input = 'Hello\u200B   world!!!   ';
  const normalized = normalizeSearchText(input);
  assert.equal(normalized, 'Hello world!');
});

test('buildQueryVariants returns ordered unique variants capped at 4', () => {
  const variants = buildQueryVariants('  Name a career that AI can\'t replace.  ');
  assert.ok(Array.isArray(variants));
  assert.ok(variants.length > 0);
  assert.ok(variants.length <= 4);
  assert.equal(variants[0].key, 'exactQuoted');
  const uniquePlain = new Set(variants.map((v) => v.plain.toLowerCase()));
  assert.equal(uniquePlain.size, variants.length);
});

test('buildQueryVariants skips too-short inputs', () => {
  const variants = buildQueryVariants('hi');
  assert.equal(variants.length, 0);
});

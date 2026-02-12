import test from 'node:test';
import assert from 'node:assert/strict';
import { runAnalyzePipeline } from '../lib/analyzeService.js';

test('returns 400 for missing input', async () => {
  const out = await runAnalyzePipeline({ original: '', candidate: 'x' });
  assert.equal(out.status, 400);
  assert.equal(out.body.error, 'Missing original or candidate text');
});

test('returns 200 on valid analysis', async () => {
  const out = await runAnalyzePipeline(
    { original: 'hello', candidate: 'hello there' },
    {
      analyzeFn: async () => ({
        score: 91,
        verdict: 'Idea Theft',
        explanation: 'Very close phrasing and structure.',
      }),
    }
  );

  assert.equal(out.status, 200);
  assert.equal(out.body.score, 91);
  assert.equal(out.body.verdict, 'Idea Theft');
});

test('maps missing api key error to 503', async () => {
  const out = await runAnalyzePipeline(
    { original: 'a', candidate: 'b' },
    {
      analyzeFn: async () => {
        const err = new Error('missing key');
        err.code = 'MISSING_API_KEY';
        throw err;
      },
    }
  );

  assert.equal(out.status, 503);
  assert.equal(out.body.code, 'MISSING_API_KEY');
});

test('maps invalid model response to 502', async () => {
  const out = await runAnalyzePipeline(
    { original: 'a', candidate: 'b' },
    {
      analyzeFn: async () => {
        const err = new Error('invalid response');
        err.code = 'INVALID_MODEL_RESPONSE';
        throw err;
      },
    }
  );

  assert.equal(out.status, 502);
  assert.equal(out.body.code, 'INVALID_MODEL_RESPONSE');
});

test('maps provider failure to 502', async () => {
  const out = await runAnalyzePipeline(
    { original: 'a', candidate: 'b' },
    {
      analyzeFn: async () => {
        const err = new Error('provider failed');
        err.code = 'PROVIDER_ERROR';
        throw err;
      },
    }
  );

  assert.equal(out.status, 502);
  assert.equal(out.body.code, 'PROVIDER_ERROR');
});

test('returns 500 for unexpected internal error', async () => {
  const out = await runAnalyzePipeline(
    { original: 'a', candidate: 'b' },
    {
      analyzeFn: async () => {
        throw new Error('boom');
      },
    }
  );

  assert.equal(out.status, 500);
  assert.equal(out.body.error, 'Internal Server Error');
});

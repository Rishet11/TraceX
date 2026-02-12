import { AnalysisError, analyzeTweetSimilarity } from './gemini.js';

function mapAnalysisError(error) {
  const code = error?.code;
  if (code === 'MISSING_API_KEY') {
    return {
      status: 503,
      body: { error: 'AI analysis is not configured on the server.', code },
    };
  }

  if (code === 'INVALID_MODEL_RESPONSE') {
    return {
      status: 502,
      body: { error: 'AI returned an invalid response. Please retry.', code },
    };
  }

  return {
    status: 502,
    body: { error: 'AI provider request failed. Please retry.', code: code || 'PROVIDER_ERROR' },
  };
}

export async function runAnalyzePipeline(payload = {}, deps = {}) {
  const analyzeFn = deps.analyzeFn || analyzeTweetSimilarity;
  const originalText = typeof payload.original === 'string' ? payload.original.trim() : '';
  const candidateText = typeof payload.candidate === 'string' ? payload.candidate.trim() : '';

  if (!originalText || !candidateText) {
    return {
      status: 400,
      body: { error: 'Missing original or candidate text' },
    };
  }

  try {
    const analysis = await analyzeFn(originalText, candidateText);
    return {
      status: 200,
      body: analysis,
    };
  } catch (error) {
    if (error instanceof AnalysisError || error?.code) {
      return mapAnalysisError(error);
    }

    return {
      status: 500,
      body: { error: 'Internal Server Error' },
    };
  }
}

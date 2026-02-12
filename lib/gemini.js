import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_MODEL = 'gemini-2.0-flash';

export class AnalysisError extends Error {
  constructor(message, code = 'ANALYSIS_FAILED') {
    super(message);
    this.name = 'AnalysisError';
    this.code = code;
  }
}

function extractJsonObject(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;

  const withoutFences = trimmed.replace(/```json|```/gi, '').trim();
  if (withoutFences.startsWith('{') && withoutFences.endsWith('}')) {
    return withoutFences;
  }

  const firstBrace = withoutFences.indexOf('{');
  const lastBrace = withoutFences.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  return withoutFences.slice(firstBrace, lastBrace + 1);
}

function normalizeAnalysis(raw) {
  const obj = raw && typeof raw === 'object' ? raw : null;
  if (!obj) {
    throw new AnalysisError('Model response is not a JSON object.', 'INVALID_MODEL_RESPONSE');
  }

  const numericScore = Number(obj.score);
  const boundedScore = Number.isFinite(numericScore)
    ? Math.max(0, Math.min(100, Math.round(numericScore)))
    : NaN;
  const verdict = typeof obj.verdict === 'string' ? obj.verdict.trim() : '';
  const explanation = typeof obj.explanation === 'string' ? obj.explanation.trim() : '';

  if (!Number.isFinite(boundedScore) || !verdict || !explanation) {
    throw new AnalysisError(
      'Model response is missing required fields (score, verdict, explanation).',
      'INVALID_MODEL_RESPONSE'
    );
  }

  return {
    score: boundedScore,
    verdict,
    explanation
  };
}

export async function analyzeTweetSimilarity(originalTweet, candidateTweet) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AnalysisError('GEMINI_API_KEY is not configured.', 'MISSING_API_KEY');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const prompt = `
You are an expert at detecting plagiarism and idea theft on social media.
Compare the following two tweets and determine if the second one is a copy of the first one,
even if wording differs ("idea theft"/engagement-farming style copying).

Original Tweet: "${originalTweet}"
Candidate Tweet: "${candidateTweet}"

Return ONLY valid JSON with exactly these keys:
- score: number from 0 to 100
- verdict: short label
- explanation: concise 1-2 sentence reason
`.trim();

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const jsonStr = extractJsonObject(text);

    if (!jsonStr) {
      throw new AnalysisError('Model did not return JSON.', 'INVALID_MODEL_RESPONSE');
    }

    const parsed = JSON.parse(jsonStr);
    return normalizeAnalysis(parsed);
  } catch (error) {
    if (error instanceof AnalysisError) {
      throw error;
    }

    console.error('Gemini Analysis Error:', error);
    throw new AnalysisError('Gemini provider request failed.', 'PROVIDER_ERROR');
  }
}

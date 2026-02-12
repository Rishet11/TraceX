import { NextResponse } from 'next/server';
import { AnalysisError, analyzeTweetSimilarity } from '@/lib/gemini';

export async function POST(request) {
  try {
    const { original, candidate } = await request.json();

    const originalText = typeof original === 'string' ? original.trim() : '';
    const candidateText = typeof candidate === 'string' ? candidate.trim() : '';

    if (!originalText || !candidateText) {
      return NextResponse.json({ error: 'Missing original or candidate text' }, { status: 400 });
    }

    const analysis = await analyzeTweetSimilarity(originalText, candidateText);

    return NextResponse.json(analysis);
  } catch (error) {
    if (error instanceof AnalysisError) {
      if (error.code === 'MISSING_API_KEY') {
        return NextResponse.json(
          { error: 'AI analysis is not configured on the server.', code: error.code },
          { status: 503 }
        );
      }

      if (error.code === 'INVALID_MODEL_RESPONSE') {
        return NextResponse.json(
          { error: 'AI returned an invalid response. Please retry.', code: error.code },
          { status: 502 }
        );
      }

      return NextResponse.json(
        { error: 'AI provider request failed. Please retry.', code: error.code },
        { status: 502 }
      );
    }

    console.error('Analysis API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

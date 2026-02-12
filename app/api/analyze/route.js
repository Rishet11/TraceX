import { NextResponse } from 'next/server';
import { analyzeTweetSimilarity } from '@/lib/gemini';

export async function POST(request) {
  try {
    const { original, candidate } = await request.json();

    if (!original || !candidate) {
      return NextResponse.json({ error: 'Missing original or candidate text' }, { status: 400 });
    }

    const analysis = await analyzeTweetSimilarity(original, candidate);

    if (!analysis) {
        return NextResponse.json({ 
            error: 'Analysis failed. Make sure GEMINI_API_KEY is set.' 
        }, { status: 500 });
    }

    return NextResponse.json(analysis);

  } catch (error) {
    console.error('Analysis API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { runAnalyzePipeline } from '@/lib/analyzeService';

export async function POST(request) {
  try {
    const payload = await request.json();
    const { status, body } = await runAnalyzePipeline(payload);
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error('Analysis API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

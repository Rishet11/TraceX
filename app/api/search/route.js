import { NextResponse } from 'next/server';
import { runSearchPipeline } from '@/lib/searchService';

export async function POST(request) {
  try {
    const payload = await request.json();
    const { status, body } = await runSearchPipeline(payload);
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error('Search API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch search results', details: error.message }, { status: 500 });
  }
}

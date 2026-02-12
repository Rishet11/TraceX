import { NextResponse } from 'next/server';
import { searchNitter } from '@/lib/nitter';
import { searchDuckDuckGo } from '@/lib/duckduckgo';

export async function POST(request) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    try {
        // Try Nitter first (richer data)
        const { results, instance } = await searchNitter(query);
        return NextResponse.json({ results, instance });
    } catch (nitterError) {
        console.warn('Nitter search failed, trying DuckDuckGo fallback:', nitterError.message);
        
        // Fallback to DuckDuckGo (snippet data)
        try {
            const ddgResults = await searchDuckDuckGo(query);
            return NextResponse.json({ results: ddgResults.results, instance: 'DuckDuckGo (Fallback)' });
        } catch (ddgError) {
             console.error('DuckDuckGo search also failed:', ddgError);
             throw new Error(`All search methods failed. Nitter: ${nitterError.message}, DDG: ${ddgError.message}`);
        }
    }

  } catch (error) {
    console.error('Search API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch search results', details: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { runSearchPipeline } from '@/lib/searchService';

export async function POST(request) {
  try {
    const payload = await request.json();
    const { status, body } = await runSearchPipeline(payload);

    // Lightweight structured logs for source reliability monitoring.
    if (process.env.SEARCH_HEALTH_LOG !== 'false') {
      console.info(
        JSON.stringify({
          event: 'search_health',
          status,
          reason: body?.meta?.reason || null,
          queryInputType: body?.meta?.queryInputType || payload?.queryInputType || 'text',
          queryLength: String(payload?.query || '').length,
          resultsCount: Array.isArray(body?.results) ? body.results.length : 0,
          excludedCount: body?.meta?.excludedCount || 0,
          metricsEnriched: body?.meta?.metricsEnriched || 0,
          sources: body?.meta?.sources || null,
          timingMs: body?.meta?.timingMs || null,
          at: new Date().toISOString(),
        })
      );
    }

    return NextResponse.json(body, { status });
  } catch (error) {
    console.error('Search API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch search results', details: error.message }, { status: 500 });
  }
}

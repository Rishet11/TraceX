import { NextResponse } from 'next/server';
import { runTweetFetchPipeline } from '@/lib/tweetFetchService';

export async function POST(request) {
  try {
    const payload = await request.json();
    const { status, body } = await runTweetFetchPipeline(payload);
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error('Tweet Fetch API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch tweet', details: error.message }, { status: 500 });
  }
}

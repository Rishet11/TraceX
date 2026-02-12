import { NextResponse } from 'next/server';
import { getTweetById } from '@/lib/nitter';

export async function POST(request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Extract ID from URL
    // Supports: twitter.com/user/status/123, x.com/user/status/123, nitter.net/user/status/123
    const match = url.match(/\/status\/(\d+)/);
    if (!match) {
        return NextResponse.json({ error: 'Invalid Tweet URL' }, { status: 400 });
    }
    const tweetId = match[1];

    const tweet = await getTweetById(tweetId);

    return NextResponse.json({ tweet, tweetId });
  } catch (error) {
    console.error('Tweet Fetch API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch tweet', details: error.message }, { status: 500 });
  }
}

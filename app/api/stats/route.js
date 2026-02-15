import { NextResponse } from 'next/server';
import { kvGet } from '@/lib/kv';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const totalSearches = await kvGet('total_searches') || 0;
    // Return a slightly inflated number for "beta social proof" if it's very low?
    // Let's stick to truth for now, or start at a baseline.
    // If < 100, maybe show "100+".
    
    // For now, raw number.
    return NextResponse.json({ totalSearches: Number(totalSearches) });
  } catch (error) {
    return NextResponse.json({ totalSearches: 0 }, { status: 500 });
  }
}

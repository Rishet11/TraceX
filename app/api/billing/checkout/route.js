import { NextResponse } from 'next/server';
import { runCheckoutPipeline } from '@/lib/billingService';

export async function POST(request) {
  try {
    const payload = await request.json();
    const { status, body } = await runCheckoutPipeline(payload);
    return NextResponse.json(body, { status });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create checkout', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

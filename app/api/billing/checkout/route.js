import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: 'Checkout is temporarily disabled during free beta.',
      code: 'BILLING_COMING_SOON',
    },
    { status: 503 }
  );
}

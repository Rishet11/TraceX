'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function PricingPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const startCheckout = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'pro',
          email,
          redirectUrl: `${window.location.origin}/account`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || 'Failed to start checkout');
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e.message || 'Checkout failed');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-4xl font-extrabold text-slate-900 text-center">Simple Pricing</h1>
        <p className="text-center text-slate-600">Try free. Upgrade only when you need more searches.</p>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-slate-900">Free</h2>
            <p className="text-slate-600 mt-1">For quick checks</p>
            <ul className="mt-4 text-sm text-slate-700 space-y-2">
              <li>3 searches/day</li>
              <li>URL + text support</li>
              <li>Basic sharing</li>
            </ul>
          </div>

          <div className="bg-white border-2 border-blue-500 rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Pro</h2>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">$12<span className="text-base font-medium text-slate-500">/mo</span></p>
            <ul className="mt-4 text-sm text-slate-700 space-y-2">
              <li>Unlimited searches</li>
              <li>Priority reliability</li>
              <li>Advanced AI analysis</li>
            </ul>
            <div className="mt-5 space-y-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <button
                onClick={startCheckout}
                disabled={loading}
                className="w-full px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {loading ? 'Starting checkout...' : 'Upgrade with Lemon Squeezy'}
              </button>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
          </div>
        </div>

        <div className="text-center text-sm text-slate-600 space-x-4">
          <Link className="underline" href="/account">Account</Link>
          <Link className="underline" href="/terms">Terms</Link>
          <Link className="underline" href="/privacy">Privacy</Link>
          <Link className="underline" href="/contact">Contact</Link>
        </div>
      </div>
    </main>
  );
}

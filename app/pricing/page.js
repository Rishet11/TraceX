'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Check } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import { trackEvent } from '@/lib/analytics';

export default function PricingPage() {
  useEffect(() => {
    trackEvent('beta_page_viewed', { page: 'pricing' });
  }, []);

  const liveFeatures = [
    'Unlimited searches during beta',
    'Paste tweet URL or text',
    'Shareable result links',
    'AI analysis on result cards',
    'Self-duplicate separation (same author)',
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 section-block">
        <div className="container-main space-y-6">
          <section className="surface px-6 py-8 md:p-10 text-center space-y-3">
            <h1 className="display-xl">Free beta access</h1>
            <p className="text-helper max-w-2xl mx-auto">
              TraceX is fully free to use right now. No checkout, no plans, no paywall.
            </p>
            <div className="chip !bg-[var(--brand-50)] !text-[var(--brand-700)] !border-[var(--brand-100)]">
              Everything currently available is included for all users.
            </div>
          </section>

          <section className="surface p-6 md:p-7 space-y-4 border-[var(--brand-500)] shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold text-[var(--text-title)]">Free beta</h2>
                <p className="text-sm text-[var(--text-muted)]">Live now</p>
              </div>
              <span className="chip !bg-[var(--brand-50)] !text-[var(--brand-700)] !border-[var(--brand-100)]">
                Active
              </span>
            </div>
            <div className="text-3xl font-extrabold text-[var(--text-title)]">$0</div>
            <ul className="space-y-2.5 text-sm text-[var(--text-body)]">
              {liveFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 text-green-600 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            <Link href="/" className="btn btn-primary w-fit px-4 py-2.5">
              Start searching
            </Link>
          </section>

          <section className="surface p-6 space-y-4">
            <h3 className="heading-lg">Free beta FAQ</h3>
            <div className="space-y-3 text-sm text-[var(--text-body)]">
              <div>
                <p className="font-semibold text-[var(--text-title)]">Is TraceX free right now?</p>
                <p className="text-[var(--text-muted)]">
                  Yes. The full current feature set is available for free.
                </p>
              </div>
              <div>
                <p className="font-semibold text-[var(--text-title)]">Do I need an account?</p>
                <p className="text-[var(--text-muted)]">
                  No. You can use the app directly without signing in.
                </p>
              </div>
              <div>
                <p className="font-semibold text-[var(--text-title)]">Where can I see updates?</p>
                <p className="text-[var(--text-muted)]">
                  Follow updates on{' '}
                  <a
                    href="https://x.com/MehraRishe90311"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[var(--text-title)] hover:underline"
                  >
                    X
                  </a>
                  .
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { Check } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import { trackEvent } from '@/lib/analytics';

export default function PricingPage() {
  useEffect(() => {
    trackEvent('pricing_viewed', { page: 'pricing' });
  }, []);

  const liveFeatures = [
    'Unlimited searches during beta',
    'Paste URL or text',
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
            <h1 className="display-xl">Simple pricing</h1>
            <p className="text-helper max-w-2xl mx-auto">
              Currently in free beta. Paid plans are listed for roadmap clarity and are not active
              yet.
            </p>
            <div className="chip !bg-[var(--brand-50)] !text-[var(--brand-700)] !border-[var(--brand-100)]">
              All users currently run on Free plan features.
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <article className="surface p-6 space-y-4 border-[var(--brand-500)] shadow-md">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-title)]">Free</h2>
                  <p className="text-sm text-[var(--text-muted)]">Live now</p>
                </div>
                <span className="chip !bg-[var(--brand-50)] !text-[var(--brand-700)] !border-[var(--brand-100)]">
                  Active
                </span>
              </div>
              <div className="text-3xl font-extrabold text-[var(--text-title)]">$0</div>
              <ul className="space-y-2 text-sm text-[var(--text-body)]">
                {liveFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check size={16} className="mt-0.5 text-green-600 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </article>

            <article className="surface p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-title)]">Pro</h2>
                  <p className="text-sm text-[var(--text-muted)]">Coming soon</p>
                </div>
                <span className="chip">Not active</span>
              </div>
              <div className="text-3xl font-extrabold text-[var(--text-title)]">TBD</div>
              <ul className="space-y-2 text-sm text-[var(--text-body)]">
                <li className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 text-green-600 shrink-0" />
                  Currently includes all Free plan features during beta
                </li>
              </ul>
            </article>

            <article className="surface p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-title)]">Pro+</h2>
                  <p className="text-sm text-[var(--text-muted)]">Coming soon</p>
                </div>
                <span className="chip">Not active</span>
              </div>
              <div className="text-3xl font-extrabold text-[var(--text-title)]">TBD</div>
              <ul className="space-y-2 text-sm text-[var(--text-body)]">
                <li className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 text-green-600 shrink-0" />
                  Currently includes all Free plan features during beta
                </li>
              </ul>
            </article>
          </section>

          <section className="surface p-6 space-y-4">
            <h3 className="heading-lg">Pricing FAQ</h3>
            <div className="space-y-3 text-sm text-[var(--text-body)]">
              <div>
                <p className="font-semibold text-[var(--text-title)]">Can I use the tool for free now?</p>
                <p className="text-[var(--text-muted)]">Yes. The current beta runs on Free plan features for all users.</p>
              </div>
              <div>
                <p className="font-semibold text-[var(--text-title)]">Are Pro and Pro+ available today?</p>
                <p className="text-[var(--text-muted)]">Not yet. They are listed as upcoming tiers and checkout is currently disabled.</p>
              </div>
              <div>
                <p className="font-semibold text-[var(--text-title)]">Will pricing change later?</p>
                <p className="text-[var(--text-muted)]">Yes. Paid tiers will launch after beta with clear limits and feature differences.</p>
              </div>
            </div>
          </section>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}

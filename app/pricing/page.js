'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import { trackEvent } from '@/lib/analytics';

export default function PricingPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [touched, setTouched] = useState(false);

  const emailError = useMemo(() => {
    if (!touched) return '';
    if (!email.trim()) return 'Email is required to start checkout.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return 'Please enter a valid email address.';
    }
    return '';
  }, [email, touched]);

  useEffect(() => {
    trackEvent('pricing_viewed', { page: 'pricing' });
  }, []);

  const startCheckout = async () => {
    setTouched(true);
    setCheckoutError('');
    if (emailError) return;
    trackEvent('checkout_started', {
      plan: 'pro',
      emailDomain: (email.split('@')[1] || 'unknown').toLowerCase(),
    });

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
      if (!res.ok || !data?.url) throw new Error(data?.error || 'Failed to start checkout');
      window.location.href = data.url;
    } catch (e) {
      setCheckoutError(e.message || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 section-block">
        <div className="container-main space-y-6">
          <section className="surface px-6 py-8 md:p-10 text-center space-y-3">
            <h1 className="display-xl">Simple plans for creators</h1>
            <p className="text-helper max-w-2xl mx-auto">
              Start free, validate value quickly, and upgrade only when you need more coverage and
              reliability.
            </p>
            <div className="chip !bg-[var(--brand-50)] !text-[var(--brand-700)] !border-[var(--brand-100)]">
              No lock-in. Cancel anytime.
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
            <article className="surface p-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-[var(--text-title)]">Free</h2>
                <p className="text-sm text-[var(--text-muted)]">For quick checks and occasional audits.</p>
              </div>
              <div className="text-3xl font-extrabold text-[var(--text-title)]">$0</div>
              <ul className="space-y-2 text-sm text-[var(--text-body)]">
                <li className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 text-green-600 shrink-0" />
                  3 searches per day
                </li>
                <li className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 text-green-600 shrink-0" />
                  Paste URL or text
                </li>
                <li className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 text-green-600 shrink-0" />
                  Shareable result links
                </li>
              </ul>
              <p className="text-caption">Best for trying the product before committing.</p>
            </article>

            <article className="surface p-6 border-[var(--brand-500)] shadow-md space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-title)]">Pro</h2>
                  <p className="text-sm text-[var(--text-muted)]">For founders publishing regularly.</p>
                </div>
                <span className="chip !bg-[var(--brand-50)] !text-[var(--brand-700)] !border-[var(--brand-100)]">
                  Most Popular
                </span>
              </div>

              <p className="text-3xl font-extrabold text-[var(--text-title)]">
                $12
                <span className="text-base font-medium text-[var(--text-muted)]"> / month</span>
              </p>

              <ul className="space-y-2 text-sm text-[var(--text-body)]">
                <li className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 text-green-600 shrink-0" />
                  Unlimited searches
                </li>
                <li className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 text-green-600 shrink-0" />
                  Priority search reliability
                </li>
                <li className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 text-green-600 shrink-0" />
                  AI analysis for each match
                </li>
              </ul>

              <div className="space-y-2 pt-2">
                <label htmlFor="checkout-email" className="text-sm font-medium text-slate-700">
                  Work email
                </label>
                <input
                  id="checkout-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder="you@company.com"
                  className="w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-white text-[var(--text-title)]"
                  aria-invalid={Boolean(emailError)}
                />
                {emailError && <p className="text-xs text-[var(--danger-600)]">{emailError}</p>}
                <button
                  onClick={startCheckout}
                  disabled={loading}
                  className="btn btn-primary w-full px-4 py-2.5 disabled:opacity-60"
                >
                  {loading ? 'Starting checkout...' : 'Upgrade with Lemon Squeezy'}
                </button>
                {checkoutError && (
                  <p className="text-xs text-[var(--danger-600)] bg-[var(--danger-50)] border border-red-100 rounded-lg px-3 py-2">
                    {checkoutError}
                  </p>
                )}
              </div>
            </article>
          </section>

          <section className="surface p-6 space-y-4">
            <h3 className="heading-lg">Pricing FAQ</h3>
            <div className="space-y-3 text-sm text-[var(--text-body)]">
              <div>
                <p className="font-semibold text-[var(--text-title)]">Can I cancel anytime?</p>
                <p className="text-[var(--text-muted)]">Yes. You can cancel from your billing portal at any time.</p>
              </div>
              <div>
                <p className="font-semibold text-[var(--text-title)]">Is there a free trial for Pro?</p>
                <p className="text-[var(--text-muted)]">
                  You can use the free tier first and upgrade whenever you are ready.
                </p>
              </div>
              <div>
                <p className="font-semibold text-[var(--text-title)]">How is payment handled?</p>
                <p className="text-[var(--text-muted)]">
                  Checkout, invoices, and subscription management are handled by Lemon Squeezy.
                </p>
              </div>
            </div>
          </section>

          <section className="text-center text-sm text-[var(--text-muted)]">
            Start free now. Need help before upgrading? Visit{' '}
            <Link className="text-[var(--text-title)] font-semibold hover:underline" href="/contact">
              contact
            </Link>
            .
          </section>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}

import Link from 'next/link';
import { ExternalLink, LifeBuoy } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';

export default function AccountPage() {
  const portalUrl = process.env.NEXT_PUBLIC_LEMONSQUEEZY_CUSTOMER_PORTAL_URL || '';

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 page-section">
        <div className="app-container space-y-6">
          <section className="surface-elevated px-6 py-8 md:p-10 space-y-2">
            <h1 className="text-hero text-slate-900">Account and billing</h1>
            <p className="text-helper max-w-2xl">
              Manage your subscription, payment method, and invoices in one place.
            </p>
          </section>

          <section className="surface-card p-6 space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Billing Portal</h2>
              <p className="text-sm text-slate-600 mt-1">
                Use the portal to update your plan and billing details.
              </p>
            </div>

            {portalUrl ? (
              <div className="space-y-2">
                <a
                  href={portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-black transition-colors"
                >
                  Open Billing Portal <ExternalLink size={16} />
                </a>
                <p className="text-caption">You will be redirected to Lemon Squeezy securely.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-1">
                <p className="font-semibold">Billing portal is not configured yet.</p>
                <p>
                  Add <code>NEXT_PUBLIC_LEMONSQUEEZY_CUSTOMER_PORTAL_URL</code> in your environment
                  settings and redeploy.
                </p>
              </div>
            )}
          </section>

          <section className="surface-card p-6 space-y-3">
            <h3 className="text-lg font-bold text-slate-900">Need help?</h3>
            <p className="text-sm text-slate-600">
              For billing questions or account access issues, reach support.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 w-fit px-4 py-2 rounded-lg border border-[var(--border)] bg-white hover:bg-slate-50 font-medium text-slate-700"
            >
              <LifeBuoy size={16} />
              Contact support
            </Link>
          </section>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}

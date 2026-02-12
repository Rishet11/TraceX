import Link from 'next/link';

export default function AccountPage() {
  const portalUrl = process.env.NEXT_PUBLIC_LEMONSQUEEZY_CUSTOMER_PORTAL_URL || '';
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <h1 className="text-3xl font-extrabold text-slate-900">Account</h1>
        <p className="text-slate-600">Manage your billing, subscriptions, and invoices.</p>

        {portalUrl ? (
          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex px-4 py-2.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-black transition-colors"
          >
            Open Billing Portal
          </a>
        ) : (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            Billing portal not configured yet. Set `NEXT_PUBLIC_LEMONSQUEEZY_CUSTOMER_PORTAL_URL`.
          </p>
        )}

        <div className="text-sm text-slate-600">
          Need help? Visit <Link href="/contact" className="underline">contact</Link>.
        </div>
      </div>
    </main>
  );
}

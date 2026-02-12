import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 page-section">
        <div className="app-container space-y-6">
          <section className="surface-elevated px-6 py-8 md:p-10 space-y-2">
            <h1 className="text-hero text-slate-900">Privacy Policy</h1>
            <p className="text-helper max-w-2xl">
              This page explains what data is processed to run searches and billing.
            </p>
          </section>

          <section className="surface-card p-6 space-y-5 text-sm text-slate-700">
            <div>
              <h2 className="text-lg font-bold text-slate-900">What we process</h2>
              <p className="mt-1">
                We process tweet text and tweet URLs you submit to perform similarity search and
                optional AI analysis.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">What not to submit</h2>
              <p className="mt-1">
                Do not submit sensitive personal data, secrets, or private credentials in search
                inputs.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">Payments</h2>
              <p className="mt-1">
                Payments, invoices, and subscriptions are handled by Lemon Squeezy. We do not store
                your full card details in this app.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">Support</h2>
              <p className="mt-1">
                For privacy requests, contact support using the email on the contact page.
              </p>
            </div>
          </section>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}

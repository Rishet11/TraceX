import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 section-block">
        <div className="container-main space-y-6">
          <section className="surface px-6 py-8 md:p-10 space-y-2">
            <h1 className="display-xl text-[var(--text-title)]">Privacy Policy</h1>
            <p className="text-helper max-w-2xl">
              This page explains what data is processed to run searches and related product features.
            </p>
          </section>

          <section className="surface p-6 space-y-5 text-sm text-[var(--text-body)]">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-title)]">What we process</h2>
              <p className="mt-1">
                We process tweet text and tweet URLs you submit to perform similarity search and
                optional AI analysis.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-[var(--text-title)]">What not to submit</h2>
              <p className="mt-1">
                Do not submit sensitive personal data, secrets, or private credentials in search
                inputs.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-[var(--text-title)]">Payment data during beta</h2>
              <p className="mt-1">
                The app currently runs as free beta, so no payment collection flow is active inside
                the product.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-[var(--text-title)]">Support</h2>
              <p className="mt-1">
                For privacy requests, contact support at rishetmehra11@gmail.com.
              </p>
            </div>
          </section>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}

import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 section-block">
        <div className="container-main space-y-6">
          <section className="surface px-6 py-8 md:p-10 space-y-2">
            <h1 className="display-xl text-[var(--text-title)]">Terms of Service</h1>
            <p className="text-helper max-w-2xl">
              By using this service, you agree to use it responsibly and follow platform rules and
              local laws.
            </p>
          </section>

          <section className="surface p-6 space-y-5 text-sm text-[var(--text-body)]">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-title)]">Use of service</h2>
              <p className="mt-1">
                You may use this tool to discover likely copied tweets and review public content. Do
                not use it for harassment, abuse, or unlawful activity.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-[var(--text-title)]">Availability</h2>
              <p className="mt-1">
                Search coverage can vary by source availability. We do not guarantee uninterrupted
                uptime or complete recall for every query.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-[var(--text-title)]">Free beta terms</h2>
              <p className="mt-1">
                The current release is a free beta experience. Feature availability can evolve over
                time as we improve reliability and product quality.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-[var(--text-title)]">Questions</h2>
              <p className="mt-1">
                Contact us at{' '}
                <a href="mailto:rishetmehra11@gmail.com" className="underline hover:text-[var(--brand-700)]">
                  rishetmehra11@gmail.com
                </a>{' '}
                for product or usage questions.
              </p>
            </div>
          </section>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}

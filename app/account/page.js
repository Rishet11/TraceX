import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';

export default function AccountPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 section-block">
        <div className="container-main space-y-6">
          <section className="surface px-6 py-8 md:p-10 space-y-2">
            <h1 className="display-xl">No account needed</h1>
            <p className="text-helper max-w-2xl">
              TraceX currently runs in free beta mode for everyone. You can use all live features
              without creating an account.
            </p>
          </section>

          <section className="surface p-6 space-y-3">
            <h2 className="text-xl font-bold text-[var(--text-title)]">What this means</h2>
            <ul className="text-sm text-[var(--text-body)] space-y-1.5 list-disc pl-5">
              <li>No signup flow</li>
              <li>No account portal required</li>
              <li>No paywall on current features</li>
            </ul>
            <div className="pt-2 flex flex-wrap gap-2">
              <Link href="/" className="btn btn-primary px-4 py-2.5">
                Start searching
              </Link>
              <a
                href="https://x.com/MehraRishe90311"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary px-4 py-2.5"
              >
                Follow updates on X <ExternalLink size={16} />
              </a>
            </div>
          </section>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}

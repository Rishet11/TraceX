import { Mail, MessageSquare } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 section-block">
        <div className="container-main space-y-6">
          <section className="surface px-6 py-8 md:p-10 space-y-2">
            <h1 className="display-xl text-[var(--text-title)]">Contact support</h1>
            <p className="text-helper max-w-2xl">
              Questions about product issues or feature requests? Reach out directly.
            </p>
          </section>

          <section className="surface p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="text-[var(--text-muted)] mt-0.5" size={18} />
              <div>
                <h2 className="text-lg font-bold text-[var(--text-title)]">Email</h2>
                <p className="text-sm text-[var(--text-body)] mt-1">Write to:</p>
                <a
                  href="mailto:rishetmehra11@gmail.com"
                  className="text-[var(--text-title)] font-semibold hover:underline"
                >
                  rishetmehra11@gmail.com
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MessageSquare className="text-[var(--text-muted)] mt-0.5" size={18} />
              <div>
                <h2 className="text-lg font-bold text-[var(--text-title)]">What to include</h2>
                <p className="text-sm text-[var(--text-body)] mt-1">
                  Share what happened and any relevant links/screenshots so issues can be resolved
                  faster.
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

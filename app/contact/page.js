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
            <h1 className="display-xl text-slate-900">Contact support</h1>
            <p className="text-helper max-w-2xl">
              Questions about billing, product bugs, or feature requests? Reach us directly.
            </p>
          </section>

          <section className="surface p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="text-slate-500 mt-0.5" size={18} />
              <div>
                <h2 className="text-lg font-bold text-slate-900">Email</h2>
                <p className="text-sm text-slate-600 mt-1">
                  For support and billing help, write to:
                </p>
                <a
                  href="mailto:support@yourdomain.com"
                  className="text-slate-900 font-semibold hover:underline"
                >
                  support@yourdomain.com
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MessageSquare className="text-slate-500 mt-0.5" size={18} />
              <div>
                <h2 className="text-lg font-bold text-slate-900">What to include</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Include your account email and a short description so we can resolve issues faster.
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

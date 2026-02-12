import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-white/90 backdrop-blur">
      <div className="app-container py-3 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-slate-900 font-semibold tracking-tight min-w-0"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-50)] text-[var(--brand-600)] border border-[var(--brand-100)] shrink-0">
            <Sparkles size={14} />
          </span>
          <span className="truncate">
            Tweet Copy Detector
            <span className="block text-[11px] font-medium text-slate-500 tracking-normal">
              Copy-check for creators
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-1.5 text-sm ml-auto">
          <Link
            href="/pricing"
            className="px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="/account"
            className="px-3 py-2 rounded-lg bg-slate-900 text-white font-medium hover:bg-black transition-colors"
          >
            Account
          </Link>
        </nav>
      </div>
    </header>
  );
}

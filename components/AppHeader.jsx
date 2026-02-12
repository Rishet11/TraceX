'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

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
        <nav className="flex items-center gap-2 text-[15px] ml-auto">
          <Link
            href="/pricing"
            className="px-2 py-1.5 rounded-md text-[#374151] font-medium hover:text-[#2563EB] hover:underline underline-offset-2 transition-colors duration-150"
            onClick={() => trackEvent('pricing_clicked', { source: 'header_nav' })}
          >
            Pricing
          </Link>
          <Link
            href="/account"
            className="px-2 py-1.5 rounded-md text-[#374151] font-medium hover:text-[#2563EB] hover:underline underline-offset-2 transition-colors duration-150"
          >
            Account
          </Link>
        </nav>
      </div>
    </header>
  );
}

'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-white/92 backdrop-blur-md">
      <div className="container-main py-3.5 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-3 text-[var(--text-title)] font-semibold tracking-tight min-w-0"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-50)] text-[var(--brand-700)] border border-[var(--brand-100)] shrink-0">
            <Sparkles size={15} />
          </span>
          <span className="truncate leading-tight">
            TraceX
            <span className="block text-[11px] font-medium text-[var(--text-muted)] tracking-normal">
              Fast tweet copy checking for anyone
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-[15px] ml-auto">
          <Link
            href="/pricing"
            className="btn btn-ghost px-3 py-2 text-sm"
            onClick={() => trackEvent('beta_clicked', { source: 'header_nav' })}
          >
            Free beta
          </Link>
          <a
            href="https://x.com/MehraRishe90311"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary px-3 py-2 text-sm"
          >
            Follow on X
          </a>
        </nav>
      </div>
    </header>
  );
}

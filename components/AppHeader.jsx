'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Moon, Sparkles, Sun } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/utils';

export default function AppHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  // Keep first render deterministic to avoid server/client hydration mismatch.
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const attrTheme = document.documentElement.getAttribute('data-theme');
    const stored = localStorage.getItem('theme');
    const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const resolved =
      attrTheme === 'dark' || attrTheme === 'light'
        ? attrTheme
        : stored === 'dark' || stored === 'light'
          ? stored
          : system;

    document.documentElement.setAttribute('data-theme', resolved);
    const raf = requestAnimationFrame(() => setTheme(resolved));
    return () => cancelAnimationFrame(raf);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
    trackEvent('theme_toggled', { theme: next, source: 'header' });
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b border-[var(--line)] backdrop-blur-xl transition-all duration-200',
        isScrolled
          ? 'bg-[var(--surface)]/96 shadow-[0_8px_24px_rgba(0,0,0,0.18)]'
          : 'bg-[var(--surface)]/86'
      )}
    >
      <div
        className={cn(
          'container-main flex items-center justify-between gap-4 transition-[padding] duration-200',
          isScrolled ? 'py-2.5' : 'py-3.5'
        )}
      >
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
          <button
            type="button"
            onClick={toggleTheme}
            className="btn btn-ghost px-2.5 py-2 text-sm"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
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

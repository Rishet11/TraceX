import Link from 'next/link';

export default function AppFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-white/95">
      <div className="app-container py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <p className="text-xs text-slate-500 max-w-xl">
          Built for creators and founders to protect original ideas, review suspicious copies, and
          keep evidence ready when needed.
        </p>
        <nav className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
          <Link href="/pricing" className="hover:text-slate-700 transition-colors">
            Pricing
          </Link>
          <Link href="/terms" className="hover:text-slate-700 transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-slate-700 transition-colors">
            Privacy
          </Link>
          <Link href="/contact" className="hover:text-slate-700 transition-colors">
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}

import Link from 'next/link';

export default function AppFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-white/95 mt-16 md:mt-20">
      <div className="app-container py-8 md:py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <p className="text-sm text-[#6B7280] max-w-lg leading-relaxed">
            Built for creators and founders to protect original ideas, review suspicious copies, and
            keep evidence ready when needed.
          </p>
          <nav className="text-sm font-medium text-[#6B7280] flex flex-wrap items-center gap-4 md:gap-6">
            <Link href="/pricing" className="hover:text-[#1F2937] hover:underline underline-offset-4 transition-all duration-150">
              Pricing
            </Link>
            <Link href="/terms" className="hover:text-[#1F2937] hover:underline underline-offset-4 transition-all duration-150">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-[#1F2937] hover:underline underline-offset-4 transition-all duration-150">
              Privacy
            </Link>
            <Link href="/contact" className="hover:text-[#1F2937] hover:underline underline-offset-4 transition-all duration-150">
              Contact
            </Link>
          </nav>
        </div>
        <div className="mt-8 pt-8 border-t border-slate-100 text-xs text-slate-400 flex justify-between items-center">
             <span>© {new Date().getFullYear()} TraceX. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}

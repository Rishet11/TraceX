import Link from 'next/link';

export default function AppFooter() {
  return (
    <footer className="border-t border-[var(--line)] bg-white mt-20 md:mt-24">
      <div className="container-main py-9 md:py-11">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <p className="text-sm text-[var(--text-muted)] max-w-lg leading-relaxed">
            Built for creators and founders to protect original ideas, monitor copy risk, and keep
            clean evidence ready when needed.
          </p>
          <nav className="text-sm font-medium text-[var(--text-muted)] flex flex-wrap items-center gap-4 md:gap-6">
            <Link href="/pricing" className="link-ui hover:underline underline-offset-4">
              Pricing
            </Link>
            <Link href="/terms" className="link-ui hover:underline underline-offset-4">
              Terms
            </Link>
            <Link href="/privacy" className="link-ui hover:underline underline-offset-4">
              Privacy
            </Link>
            <Link href="/contact" className="link-ui hover:underline underline-offset-4">
              Contact
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

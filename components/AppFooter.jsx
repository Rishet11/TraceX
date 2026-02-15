import Link from 'next/link';

export default function AppFooter() {
  return (
    <footer className="border-t border-[var(--line)] bg-[var(--surface)] mt-10 md:mt-14">
      <div className="container-main py-9 md:py-11">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <p className="text-sm text-[var(--text-muted)] max-w-lg leading-relaxed">
            A tool for anyone who wants to quickly check whether a tweet was copied.
          </p>
          <nav className="text-sm font-medium text-[var(--text-muted)] flex flex-wrap items-center gap-4 md:gap-6">
            <Link href="/pricing" className="link-ui hover:underline underline-offset-4">
              Free beta
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
            <a
              href="https://x.com/MehraRishe90311"
              target="_blank"
              rel="noopener noreferrer"
              className="link-ui hover:underline underline-offset-4"
            >
              Follow on X
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}

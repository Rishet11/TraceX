import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tracex.vercel.app";

export const metadata = {
  title: "TraceX — Find who copied your tweet",
  description:
    "Paste a tweet URL or text and get proof in seconds. TraceX scans multiple public sources to detect copied tweets with confidence scores.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "TraceX — Find who copied your tweet",
    description:
      "Detect copied tweets with confidence scores. Free, no signup required.",
    url: SITE_URL,
    siteName: "TraceX",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TraceX — Find who copied your tweet",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TraceX — Find who copied your tweet",
    description:
      "Detect copied tweets with confidence scores. Free, no signup required.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body className="antialiased">
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            (function () {
              try {
                var t = localStorage.getItem('theme');
                if (t !== 'light' && t !== 'dark') {
                  t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                }
                document.documentElement.setAttribute('data-theme', t);
              } catch (e) {
                document.documentElement.setAttribute('data-theme', 'light');
              }
            })();
          `}
        </Script>
        {children}
        <Analytics />
      </body>
    </html>
  );
}

import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

export const metadata = {
  title: "TraceX",
  description: "Trace copied tweets and prove originality in seconds.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}

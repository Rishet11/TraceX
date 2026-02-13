import "./globals.css";

export const metadata = {
  title: "TraceX",
  description: "Trace copied tweets and prove originality in seconds.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

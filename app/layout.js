import "./globals.css";

export const metadata = {
  title: "Tweet Copy Detector",
  description: "Find tweet copycats in seconds.",
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

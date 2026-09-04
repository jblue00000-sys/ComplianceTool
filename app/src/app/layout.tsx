import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agentic Risk Command Centre",
  description:
    "See every AI agent your business runs, what it can reach, and where it stands against the OWASP Top 10 for Agentic Applications.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

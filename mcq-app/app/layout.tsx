import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Suspense } from "react";

import { Nav, NavFallback } from "@/components/nav";

import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "MCQ Admission",
  description: "Exam administration and student sittings",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistSans.className} font-sans antialiased`}>
        <div className="flex min-h-svh flex-col bg-background text-foreground">
          <Suspense fallback={<NavFallback />}>
            <Nav />
          </Suspense>
          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 sm:px-8">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}

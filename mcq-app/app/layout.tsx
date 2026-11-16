import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";

import { preferenceBootScript } from "@/lib/preferences/boot";

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
        <Script id="mcq-prefs" strategy="beforeInteractive">
          {preferenceBootScript()}
        </Script>
        {children}
      </body>
    </html>
  );
}

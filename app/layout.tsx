"use client";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/lib/client";
import { Toaster } from "sonner";
import { CartButton } from "@/components/CartButton";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <QueryProvider>
        <body className="min-h-full flex flex-col">{children}</body>
        <Toaster richColors position="top-right" />
        <CartButton />
      </QueryProvider>
    </html>
  );
}

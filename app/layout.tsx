"use client";

import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/lib/client";
import { Toaster } from "sonner";
import { CartButton } from "@/components/CartButton";
import { LocatorJS } from "@/components/LocatorJS";
import { cn } from "@/lib/utils";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

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
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        inter.variable,
      )}
    >
      <QueryProvider>
        <SidebarProvider>
          <AppSidebar />
          <body className="min-h-full flex flex-col">{children}</body>
          <Toaster richColors position="top-right" />
          <CartButton />
          <LocatorJS />
        </SidebarProvider>
      </QueryProvider>
    </html>
  );
}

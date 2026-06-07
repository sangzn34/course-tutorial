import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/lib/client";
import { Toaster } from "sonner";
import { LocatorJS } from "@/components/LocatorJS";
import { cn } from "@/lib/utils";
import { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "My Coffee", template: "%s - My Coffee" },
  description: "ร้านกาแฟออนไลน์ - สั่งง่าย ส่งไว",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        inter.variable,
      )}
    >
      <body className="flex flex-col">
        <ThemeProvider>
          <QueryProvider>
            <SiteHeader />
            <main className="flex flex-1 flex-col">{children}</main>
            <Toaster richColors position="top-right" />
            <LocatorJS />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

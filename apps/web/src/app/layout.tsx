import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { PwaRegister } from "@/components/pwa-register";
import { getTenantBranding } from "@/lib/tenant";
import { Providers } from "@/components/providers";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ArbMind — Signal Community & Financial Terminal",
  description: "Follow top traders, copy trades automatically, and analyze markets with professional tools.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();
  const branding = await getTenantBranding();

  // White-label: a tenant-set brand color overrides --primary inline (wins over
  // both :root and .dark stylesheet rules); default tenant keeps the native theme.
  const htmlStyle = branding?.primaryColor
    ? ({ "--primary": branding.primaryColor, "--primary-foreground": "#ffffff" } as React.CSSProperties)
    : undefined;

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`} style={htmlStyle}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        {branding?.faviconUrl && <link rel="icon" href={branding.faviconUrl} />}
        <meta name="theme-color" content={branding?.primaryColor ?? "#3b82f6"} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ArbMind" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="min-h-full flex flex-col antialiased bg-background text-foreground">
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <PwaRegister />
            <Navbar branding={branding} />
            <main className="flex-1 pb-16 md:pb-0">{children}</main>
            <SiteFooter />
            <MobileNav />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

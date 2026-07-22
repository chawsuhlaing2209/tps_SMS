import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { AppToaster } from "../components/shared/app-toaster";
import { QueryProvider } from "./lib/query-provider";
import "./globals.css";

// Padauk School OS design language: Bricolage Grotesque for confident display
// headings, Hanken Grotesk for clean body text.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap"
});

const body = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
  display: "swap"
});

export const metadata: Metadata = {
  title: "SMS Platform",
  description: "Multi-tenant school management system for Myanmar schools",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }]
  }
};

export default async function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${display.variable} ${body.variable}`}>
      {/* Icon + text fonts are self-hosted (next/font + public/fonts) — no
          runtime Google Fonts dependency, which matters on Myanmar networks. */}
      <body suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <QueryProvider>
            {children}
            <AppToaster />
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

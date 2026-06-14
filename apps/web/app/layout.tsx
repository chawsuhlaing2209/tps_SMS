import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { QueryProvider } from "./lib/query-provider";
import "./globals.css";

// Plus Jakarta Sans stands in for the design's proprietary "Linik Sans":
// a bold, geometric grotesque with the same friendly, rounded character.
const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap"
});

export const metadata: Metadata = {
  title: "SMS Platform",
  description: "Multi-tenant school management system for Myanmar schools"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={display.variable}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <QueryProvider>{children}</QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

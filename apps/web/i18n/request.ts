import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const locales = ["en", "my"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "en";
export const localeCookieName = "locale";

function normalizeLocale(value: string | undefined): AppLocale {
  return value === "my" ? "my" : defaultLocale;
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = normalizeLocale(store.get(localeCookieName)?.value);

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default
  };
});

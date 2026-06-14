import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import enMessages from "../messages/en.json";
import myMessages from "../messages/my.json";

export const locales = ["en", "my"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "en";
export const localeCookieName = "locale";

const messagesByLocale = {
  en: enMessages,
  my: myMessages
} as const satisfies Record<AppLocale, typeof enMessages>;

function normalizeLocale(value: string | undefined): AppLocale {
  return value === "my" ? "my" : defaultLocale;
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = normalizeLocale(store.get(localeCookieName)?.value);

  return {
    locale,
    messages: messagesByLocale[locale]
  };
});

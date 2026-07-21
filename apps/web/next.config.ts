import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Server-side target for the API proxy. The browser always calls the Next.js
// origin under /api/* and Next forwards to the API, avoiding cross-origin/CORS.
const apiProxyTarget =
  process.env.API_PROXY_TARGET ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@sms/shared"],
  async redirects() {
    return [
      {
        source: "/dashboard/settings/discounts",
        destination: "/dashboard/finance/discounts",
        permanent: false
      },
      {
        source: "/login",
        destination: "/",
        permanent: false
      },
      {
        source: "/favicon.ico",
        destination: "/favicon.svg",
        permanent: false
      }
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/:path*`
      }
    ];
  }
};

export default withNextIntl(nextConfig);

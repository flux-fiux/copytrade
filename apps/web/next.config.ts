import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
// @ts-expect-error — next-pwa lacks official TS types
import withPWA from "next-pwa";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

const withPWAConfig = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts-cache",
        expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern: /\/api\/v1\/leaderboard.*/,
      handler: "NetworkFirst",
      options: { cacheName: "api-leaderboard", expiration: { maxAgeSeconds: 60 } },
    },
    {
      urlPattern: /\/api\/v1\/market.*/,
      handler: "NetworkFirst",
      options: { cacheName: "api-market", expiration: { maxAgeSeconds: 10 } },
    },
  ],
});

export default withNextIntl(withPWAConfig(nextConfig));

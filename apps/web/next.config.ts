import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

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
  // Self-host: emit a minimal standalone server for the Docker image. In the
  // Docker build the context is apps/web alone (no monorepo parent), so the
  // standalone output is flat at .next/standalone/server.js.
  output: "standalone",
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

// PWA: the service worker is hand-written at public/sw.js and registered by
// <PwaRegister/>. (next-pwa v5 silently emits no SW under Next 16, so it was
// removed.)
export default withNextIntl(nextConfig);

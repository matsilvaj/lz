import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV !== "production";
const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

function getHostname(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).host;
  } catch {
    return undefined;
  }
}

const allowedServerActionOrigin = getHostname(configuredAppUrl);

const securityHeaders = [
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  ...(isDevelopment
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]),
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: "media.api-sports.io",
        protocol: "https",
      },
    ],
  },
  poweredByHeader: false,
  serverExternalPackages: ["pg"],
  experimental: {
    serverActions: {
      ...(allowedServerActionOrigin
        ? { allowedOrigins: [allowedServerActionOrigin] }
        : {}),
      bodySizeLimit: "256kb",
    },
    viewTransition: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

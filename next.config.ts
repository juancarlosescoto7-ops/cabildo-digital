import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  logging: {
    serverFunctions: false,
    incomingRequests: { ignore: [/\/votar\//] },
  },
  async headers() {
    return [{
      source: "/votar/:codigo",
      headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        { key: "Cache-Control", value: "private, no-store, max-age=0" },
      ],
    }];
  },
};

export default nextConfig;

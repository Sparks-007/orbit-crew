import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  images: {
    // M1 ships no next/image usage (audit: the only consumer of the sharp
    // image-optimizer runtime would be the /_next/image endpoint, which is
    // otherwise unreachable). Disabling it keeps the vulnerable sharp
    // decoder stack out of the production request path. Revisit when image
    // features are actually needed.
    unoptimized: true,
  },
};

export default nextConfig;

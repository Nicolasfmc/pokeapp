import type { NextConfig } from "next";
import { STATIC_SECURITY_HEADERS } from "./lib/security";

// This app lives in a subfolder of the main repo: keep builds scoped to it.
const appRoot = process.cwd();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: appRoot,
  turbopack: { root: appRoot },
  async headers() {
    return [{ source: "/:path*", headers: STATIC_SECURITY_HEADERS }];
  },
};

export default nextConfig;

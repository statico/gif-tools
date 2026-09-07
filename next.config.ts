import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // wasm tools need these off the critical path; nothing here is server-rendered
  reactStrictMode: true,
};

export default nextConfig;

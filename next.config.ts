import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // wasm tools need these off the critical path; nothing here is server-rendered
  reactStrictMode: true,
  // Stop `next dev` appending its own block to AGENTS.md.
  agentRules: false,
};

export default nextConfig;

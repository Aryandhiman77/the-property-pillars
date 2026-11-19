import {existsSync, readFileSync} from "node:fs";
import {resolve} from "node:path";
import {parseEnv} from "node:util";
import createNextIntlPlugin from "next-intl/plugin";
import type {NextConfig} from "next";

const projectEnvPath = resolve(__dirname, "../../.env");
if (existsSync(projectEnvPath)) {
  const projectEnv = parseEnv(readFileSync(projectEnvPath, "utf8"));
  // Only expose values consumed by the web app.
  for (const key of ["API_PROXY_TARGET", "NEXT_PUBLIC_SITE_URL", "NEXT_BUILD_DIR"]) {
    const value = projectEnv[key];
    if (process.env[key] === undefined && value?.trim()) process.env[key] = value;
  }
}

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  distDir: process.env.NEXT_BUILD_DIR ?? (process.env.NODE_ENV === "development" ? ".next-dev" : ".next"),
  reactStrictMode: true,
  async rewrites() {
    const target = (
      process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4000"
    ).replace(/\/+$/, "");
    return [{source: "/api/v1/:path*", destination: target + "/api/v1/:path*"}];
  },
  images: {
    formats: ["image/avif", "image/webp"]
  }
};

export default withNextIntl(nextConfig);

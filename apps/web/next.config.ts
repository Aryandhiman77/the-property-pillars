import {existsSync, readFileSync} from "node:fs";
import {resolve} from "node:path";
import {parseEnv} from "node:util";
import createNextIntlPlugin from "next-intl/plugin";
import type {NextConfig} from "next";

const projectEnvPath = resolve(__dirname, "../../.env");
if (existsSync(projectEnvPath)) {
  const projectEnv = parseEnv(readFileSync(projectEnvPath, "utf8"));
  // Only expose values consumed by the web app.
  for (const key of ["API_PROXY_TARGET", "NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_CKEDITOR_LICENSE_KEY", "NEXT_BUILD_DIR"]) {
    const value = projectEnv[key];
    if (process.env[key] === undefined && value?.trim()) process.env[key] = value;
  }
}

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  turbopack: {root: resolve(__dirname, "../..")},
  poweredByHeader: false,
  devIndicators: false,
  distDir: process.env.NEXT_BUILD_DIR ?? (process.env.NODE_ENV === "development" ? ".next-dev" : ".next"),
  reactStrictMode: true,
  // A 40-file gallery is reviewed in pairs before the API commits a public submission.
  experimental: {proxyTimeout: 10 * 60 * 1000},
  async rewrites() {
    const target = (
      process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4000"
    ).replace(/\/+$/, "");
    const api = {source: "/api/v1/:path*", destination: target + "/api/v1/:path*"};
    if (process.env.NODE_ENV !== "development") return [api];

    const localHost = {type: "host" as const, value: "(?:127\\.0\\.0\\.1|localhost)"};
    const uat = "http://127.0.0.1:4021";
    return {
      beforeFiles: [
        {source: "/__uat/:path*", has: [localHost], destination: uat + "/__uat/:path*"},
        {source: api.source, has: [localHost, {type: "cookie", key: "tpp_uat_mode", value: "1"}], destination: uat + "/api/v1/:path*"},
      ],
      afterFiles: [api],
      fallback: [],
    };
  },
  images: {
    formats: ["image/avif", "image/webp"]
  }
};

export default withNextIntl(nextConfig);

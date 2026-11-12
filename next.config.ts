import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Remotion's renderer/bundler spawn Chrome and webpack at runtime and must
  // not be bundled into the server build.
  // The AI instructions are read from prompts/*.md at runtime; ship them with
  // the routes that generate videos.
  outputFileTracingIncludes: {
    "/api/projects": ["./prompts/**/*"],
    "/api/projects/*": ["./prompts/**/*"],
  },
  serverExternalPackages: [
    "@remotion/bundler",
    "@remotion/renderer",
    "esbuild",
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

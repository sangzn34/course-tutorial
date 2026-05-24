import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // ---- Turbopack mode (`next dev` default ใน Next 16) ----
  // Turbopack รับ webpack loader บางตัวผ่าน `turbopack.rules`
  turbopack: {
    rules: {
      "**/*.{tsx,jsx}": {
        loaders: [
          {
            loader: "@locator/webpack-loader",
            options: { env: "development" },
          },
        ],
      },
    },
  },
};

export default nextConfig;

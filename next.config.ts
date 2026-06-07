import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ---- Turbopack mode (`next dev` default ใน Next 16) ----
  // @locator/webpack-loader เติม data-locatorjs attribute (debug-only) ลง JSX.
  // ไม่จำเป็นใน production build → จำกัดด้วย built-in condition ของ Turbopack
  // (Next 16.0.0+) แทนการรัน loader ทุก build:
  //   - `development` → รันเฉพาะ `next dev`, `next build` ข้าม rule นี้
  //   - `{ not: "foreign" }` → ข้ามไฟล์ใน node_modules (loader วิ่งน้อยลง = เร็วขึ้น)
  turbopack: {
    rules: {
      "**/*.{tsx,jsx}": {
        condition: { all: ["development", { not: "foreign" }] },
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

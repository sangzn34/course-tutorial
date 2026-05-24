"use client";

import { useEffect } from "react";

// LocatorJS — Option/Alt + click element → opens source in editor.
// Dev-only; runtime is dynamic-imported so the prod bundle stays clean.
// `data-locatorjs-*` props are injected at build time by
// @locator/webpack-loader (see next.config.ts), so this works in webpack
// dev mode (`next dev --webpack`).
export const LocatorJS = () => {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    void import("@locator/runtime").then(({ default: setupLocatorUI }) => {
      setupLocatorUI({ showIntro: false });
    });
  }, []);

  return null;
};

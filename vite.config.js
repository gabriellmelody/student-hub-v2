import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const dayloVersion = String(packageJson.version || "0.0.0");

function dayloVersionMetadataPlugin() {
  return {
    name: "daylo-version-metadata",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: `${JSON.stringify({ version: dayloVersion }, null, 2)}\n`,
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __DAYLO_VERSION__: JSON.stringify(dayloVersion),
  },
  plugins: [
    react(),
    dayloVersionMetadataPlugin(),
    VitePWA({
      registerType: "prompt",
      injectRegister: null,
      manifest: {
        id: "/",
        name: "DayLo — Student Hub",
        short_name: "DayLo",
        description:
          "A student hub for tasks, deadlines, calendars and realistic study planning.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#F2F6F8",
        theme_color: "#10213C",
        categories: ["education", "productivity"],
        icons: [
          {
            src: "/icons/daylo-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/daylo-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/daylo-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [
          /^\/api(?:\/|$)/,
          /^\/api\//,
          /^\/google-oauth-popup(?:\/|$)/,
          /\/callback(?:\/|$)/,
          /\/oauth(?:\/|$)/,
        ],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});

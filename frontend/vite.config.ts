import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import htmlToTsxPlugin from "./plugins/html-to-tsx.js";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/setupTests.ts",
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": {
        target: "http://[IP_ADDRESS]",
        secure: false,
        ws: true,
      },
      "/static": {
        target: "http://[IP_ADDRESS]",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
  build: {
    sourcemap: false,
  },
  plugins: [htmlToTsxPlugin(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

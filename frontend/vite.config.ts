import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

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
    rollupOptions: {
      output: {
        // Split the heaviest libraries out of the entry chunk (was 706 kB).
        // Each group is only pulled in by the pages that need it.
        manualChunks: {
          recharts: ["recharts"],
          pdf: ["jspdf", "html2canvas"],
          markdown: ["react-markdown", "remark-gfm"],
        },
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

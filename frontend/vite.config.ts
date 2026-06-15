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
        // Split heavy vendors into separate long-term-cacheable chunks so the
        // initial bundle is smaller and app updates don't bust vendor caches.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          // Keep all React-ecosystem libs in one chunk to avoid createContext
          // being called before React initialises in a separate chunk.
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|@sentry\/react|react-hook-form|react-day-picker|embla-carousel-react|react-markdown|remark|rehype|hast|unist|mdast|micromark|decode-named-character-reference|character-entities)[\\/]/.test(id)) return "react-vendor";
          if (id.includes("recharts") || /[\\/]d3-/.test(id)) return "charts";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("date-fns")) return "date-fns";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("@tanstack")) return "query";
          return "vendor";
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

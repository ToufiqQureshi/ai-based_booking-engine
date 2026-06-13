import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || "https://eb79db8fd73240d0963f08803d7fe1b5@glitchtip-web-production-0327.up.railway.app/2";

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.05, // 5% transactions capture rate
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes cache to avoid redundant fetching
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);

// Automatically reload the page if a dynamically imported module fails to load.
// This typically happens when the site is updated and the user has an old version loaded.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault(); // Prevent the default error logging if desired
  window.location.reload();
});

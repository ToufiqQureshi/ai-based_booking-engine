// Single source of truth for the API base URL.
//
// One production bundle is served on several hostnames (staybooker.ai,
// Cloudflare Pages previews, Railway, and arbitrary third-party hotel sites
// that embed our widgets), so build-time env alone can't decide the URL —
// the hostname check has to happen at runtime. That logic used to be
// copy-pasted in six files and had already drifted; it lives only here now.

const PROD_API = 'https://api.staybooker.ai/api/v1';
const STAGING_API = 'https://api-staging.staybooker.ai/api/v1';
const RAILWAY_API = 'https://ai-basedbooking-engine-production.up.railway.app/api/v1';

function normalize(url: string): string {
  const trimmed = url.replace(/\/$/, '');
  return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
}

/**
 * Resolve the API base URL (always ends in /api/v1).
 *
 * @param embedded  Pass true from code that runs inside a widget embedded on a
 *                  third-party site: there is no same-origin backend to proxy
 *                  to, so the fallback must be an absolute production URL,
 *                  never the relative '/api/v1' used in local dev.
 */
export function getApiBaseUrl(options?: { embedded?: boolean }): string {
  const hostname = window.location.hostname;
  if (hostname.includes('staging')) return STAGING_API;
  if (hostname.includes('staybooker.ai') || hostname.includes('pages.dev')) return PROD_API;
  if (import.meta.env.VITE_API_URL) return normalize(import.meta.env.VITE_API_URL as string);
  if (hostname.includes('railway.app')) return RAILWAY_API;
  return options?.embedded ? RAILWAY_API : '/api/v1';
}

// Helpers for safely redirecting the browser to internal paths.
//
// `window.location.href = userControlledValue` is a classic open-redirect
// vector — if the value ever contains an absolute URL like
// `https://evil.com/`, the browser will navigate there. Even if you only
// intend to navigate within your own app, an attacker can craft a link
// like `?next=//evil.com/login` and trick the redirect.
//
// `safeInternalPath()` validates that the value is a *relative* path
// (starts with a single `/`, not `//`, not a protocol, not `javascript:`)
// before letting it through. Use this whenever a redirect target comes
// from a query string, form input, or any other user-controlled source.

/**
 * Returns the input unchanged if it is a safe internal path, otherwise
 * returns the supplied fallback (default: "/").
 *
 * Safe means:
 *   - non-empty
 *   - starts with exactly one "/"
 *   - does NOT start with "//" (protocol-relative URL to another host)
 *   - does NOT start with "/\" (Windows-path-style escape that some
 *     browsers normalize back to protocol-relative)
 *   - does NOT start with "javascript:" / "data:" / "vbscript:" (case-insensitive)
 */
export function safeInternalPath(value: string | null | undefined, fallback: string = '/'): string {
  if (!value || typeof value !== 'string') return fallback;
  if (value.length > 2048) return fallback;
  // Trim control characters / whitespace.
  const v = value.trim();
  if (v.length === 0) return fallback;
  // Must be a relative path starting with a single forward slash.
  if (v[0] !== '/') return fallback;
  if (v[1] === '/' || v[1] === '\\') return fallback;
  // Disallow protocol-bearing URLs even if prefixed with a slash
  // (browsers ignore leading whitespace before the protocol, so we
  // also reject any whitespace-prefixed protocols).
  const lower = v.toLowerCase();
  if (
    lower.startsWith('/javascript:') ||
    lower.startsWith('/data:') ||
    lower.startsWith('/vbscript:') ||
    lower.startsWith('/file:')
  ) {
    return fallback;
  }
  return v;
}

/**
 * Like `safeInternalPath` but intended for use as the destination of
 * `window.location.assign()` / `location.href = ...`. Performs the same
 * checks and additionally rejects any value containing a CRLF (which
 * some headers, but not location.href, may interpret as a header split).
 */
export function safeLocationHref(value: string | null | undefined, fallback: string = '/'): string {
  const safe = safeInternalPath(value, fallback);
  // CRLF injection guard.
  if (/[\r\n]/.test(safe)) return fallback;
  return safe;
}

"""
Visitor geo-resolution — city-level where possible.

Resolution order (cheapest / most-available first):
1. Cloudflare visitor-location headers (``cf-ipcity`` / ``cf-region`` /
   ``cf-ipcountry``). Free, no dependency — enable the "Add visitor location
   headers" managed transform on the Cloudflare zone. This is the primary
   source in production since the frontend is served via Cloudflare.
2. MaxMind GeoLite2-City offline DB via ``geoip2``, used only when
   ``GEOIP_DB_PATH`` points at a real file and the library is installed. The
   import is lazy so the dependency and the (~60MB) DB file stay optional and a
   missing DB never breaks tracking.

Geo is best-effort enrichment, never a hard requirement: every path is wrapped
so this module never raises into the request handler.
"""
import os
from typing import Optional
from urllib.parse import unquote

# Lazily-initialised GeoLite2 reader. ``_TRIED`` makes the (possibly failing)
# setup run exactly once per process instead of on every request.
_READER = None
_TRIED = False


def _client_ip(request) -> Optional[str]:
    """Best-effort real client IP behind the Cloudflare/Railway proxies."""
    for header in ("cf-connecting-ip", "x-forwarded-for"):
        value = request.headers.get(header)
        if value:
            # X-Forwarded-For is a comma list; the first hop is the client.
            return value.split(",")[0].strip()
    return request.client.host if request.client else None


def _geoip_reader():
    global _READER, _TRIED
    if _TRIED:
        return _READER
    _TRIED = True
    try:
        from app.core.utils.config import settings
        path = getattr(settings, "GEOIP_DB_PATH", "") or ""
        if path and os.path.exists(path):
            import geoip2.database  # lazy, optional dependency
            _READER = geoip2.database.Reader(path)
    except Exception:
        # Missing library / unreadable DB / bad path — fall through to None.
        _READER = None
    return _READER


def _clean(value: Optional[str]) -> Optional[str]:
    """Cloudflare URL-encodes header values (e.g. ``San%20Francisco``)."""
    if not value:
        return None
    value = unquote(value).strip()
    # Cloudflare emits these sentinels for un-geolocatable IPs (Tor, unknown).
    if not value or value.upper() in {"XX", "T1", "UNKNOWN"}:
        return None
    return value


def resolve_geo(request) -> dict:
    """Return ``{"city", "region", "country"}`` best-effort; any field may be None."""
    headers = request.headers
    city = _clean(headers.get("cf-ipcity"))
    region = _clean(headers.get("cf-region"))
    country = _clean(headers.get("cf-ipcountry"))
    if city or region or country:
        return {"city": city, "region": region, "country": country}

    # Fallback: offline GeoLite2-City lookup, only if configured.
    reader = _geoip_reader()
    if reader is not None:
        ip = _client_ip(request)
        if ip:
            try:
                resp = reader.city(ip)
                return {
                    "city": resp.city.name,
                    "region": resp.subdivisions.most_specific.name if resp.subdivisions else None,
                    "country": resp.country.iso_code,
                }
            except Exception:
                pass
    return {"city": None, "region": None, "country": country}

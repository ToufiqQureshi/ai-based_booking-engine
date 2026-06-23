"""
Unit tests for visitor geo-resolution (app/core/utils/geo.py).

Pure unit — no DB, no app. Covers the Cloudflare-header path, URL-decoding,
the sentinel values Cloudflare emits for un-geolocatable IPs, and the
no-signal fallback. The GeoLite2 path is intentionally not exercised (optional,
disabled unless GEOIP_DB_PATH points at a real DB file).
"""
from app.core.utils.geo import resolve_geo, _clean


class _Headers:
    """Minimal case-insensitive headers stand-in (Starlette's Headers.get is
    case-insensitive)."""
    def __init__(self, data=None):
        self._data = {k.lower(): v for k, v in (data or {}).items()}

    def get(self, key, default=None):
        return self._data.get(key.lower(), default)


class _Req:
    def __init__(self, headers=None, client_host=None):
        self.headers = _Headers(headers)
        self.client = type("C", (), {"host": client_host})() if client_host else None


def test_cloudflare_city_headers_are_used():
    geo = resolve_geo(_Req({"cf-ipcity": "Mumbai", "cf-region": "Maharashtra", "cf-ipcountry": "IN"}))
    assert geo == {"city": "Mumbai", "region": "Maharashtra", "country": "IN"}


def test_city_is_url_decoded():
    geo = resolve_geo(_Req({"cf-ipcity": "San%20Francisco", "cf-ipcountry": "US"}))
    assert geo["city"] == "San Francisco"
    assert geo["country"] == "US"


def test_sentinel_values_resolve_to_none():
    # Cloudflare sends XX / T1 for Tor / un-geolocatable IPs.
    geo = resolve_geo(_Req({"cf-ipcity": "", "cf-ipcountry": "XX"}))
    assert geo == {"city": None, "region": None, "country": None}


def test_no_headers_returns_all_none():
    geo = resolve_geo(_Req({}))
    assert geo == {"city": None, "region": None, "country": None}


def test_country_only_still_resolves():
    geo = resolve_geo(_Req({"cf-ipcountry": "IN"}))
    assert geo["country"] == "IN"
    assert geo["city"] is None


def test_clean_helper_strips_sentinels_and_decodes():
    assert _clean("T1") is None
    assert _clean("xx") is None
    assert _clean("unknown") is None
    assert _clean("  ") is None
    assert _clean(None) is None
    assert _clean("Pune") == "Pune"
    assert _clean("New%20Delhi") == "New Delhi"

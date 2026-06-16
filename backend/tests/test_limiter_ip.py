"""
Tests for trusted-proxy aware client-IP extraction (RL-2).

X-Forwarded-For is "client, proxy1, proxy2, ...". The left-most entry is
client-supplied and spoofable. With TRUSTED_PROXY_COUNT set we must take the
entry added by our outermost trusted proxy instead, so IP rate limits can't be
bypassed by a forged header.
"""
from types import SimpleNamespace

import app.core.utils.limiter as limiter


class _Req:
    def __init__(self, xff=None, client_host="9.9.9.9"):
        self.headers = {"X-Forwarded-For": xff} if xff else {}
        self.client = SimpleNamespace(host=client_host) if client_host else None


def _patch_trusted(monkeypatch, n):
    monkeypatch.setattr(limiter, "get_settings", lambda: SimpleNamespace(TRUSTED_PROXY_COUNT=n))


def test_legacy_behavior_when_no_trusted_proxy(monkeypatch):
    _patch_trusted(monkeypatch, 0)
    # Spoofable left-most hop is returned only because no proxy is trusted.
    assert limiter.get_real_ip(_Req("1.1.1.1, 2.2.2.2")) == "1.1.1.1"


def test_one_trusted_proxy_returns_real_client(monkeypatch):
    _patch_trusted(monkeypatch, 1)
    # "real_client, our_edge_proxy" -> real client is the entry left of the proxy.
    assert limiter.get_real_ip(_Req("203.0.113.5, 10.0.0.1")) == "203.0.113.5"


def test_spoofed_prefix_is_ignored_with_trusted_proxy(monkeypatch):
    _patch_trusted(monkeypatch, 1)
    # Attacker prepends a fake IP; with 1 trusted proxy we still pick the entry
    # the proxy actually recorded, not the forged left-most one.
    assert limiter.get_real_ip(_Req("66.66.66.66, 203.0.113.5, 10.0.0.1")) == "203.0.113.5"


def test_two_trusted_proxies(monkeypatch):
    _patch_trusted(monkeypatch, 2)
    assert limiter.get_real_ip(_Req("203.0.113.5, 10.0.0.1, 10.0.0.2")) == "203.0.113.5"


def test_falls_back_to_socket_when_no_header(monkeypatch):
    _patch_trusted(monkeypatch, 1)
    assert limiter.get_real_ip(_Req(xff=None, client_host="8.8.8.8")) == "8.8.8.8"

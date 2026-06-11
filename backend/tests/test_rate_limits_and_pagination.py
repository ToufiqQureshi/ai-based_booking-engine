"""
Tests for authenticated-route rate limits and pagination guards.

- users.py: get_users now accepts limit/offset; create_team_member and
  change_password have rate limits.
- reports.py: get_occupancy_report rejects date ranges > 365 days;
  both report endpoints are rate-limited.
- upload.py: upload_file is rate-limited.
"""
import inspect

import app.api.v1.users as users_mod
import app.api.v1.reports as reports_mod
import app.api.v1.upload as upload_mod


def _src(fn):
    return inspect.getsource(fn)


# ── Users: get_users pagination ──────────────────────────────────────────────

def test_get_users_accepts_limit_and_offset_params():
    sig = inspect.signature(users_mod.get_users)
    assert "limit" in sig.parameters, "get_users must have a 'limit' query param"
    assert "offset" in sig.parameters, "get_users must have an 'offset' query param"


# ── Users: rate limits wired on mutating endpoints ───────────────────────────

def test_create_team_member_has_rate_limit():
    src = _src(users_mod.create_team_member)
    assert "@limiter.limit" in src or "limiter.limit" in src, (
        "create_team_member must be decorated with @limiter.limit"
    )


def test_change_password_has_rate_limit():
    src = _src(users_mod.change_password)
    assert "@limiter.limit" in src or "limiter.limit" in src, (
        "change_password must be decorated with @limiter.limit"
    )


# ── Reports: rate limits ─────────────────────────────────────────────────────

def test_get_occupancy_report_has_rate_limit():
    src = _src(reports_mod.get_occupancy_report)
    assert "@limiter.limit" in src or "limiter.limit" in src, (
        "get_occupancy_report must be decorated with @limiter.limit"
    )


def test_get_dashboard_stats_has_rate_limit():
    src = _src(reports_mod.get_dashboard_stats)
    assert "@limiter.limit" in src or "limiter.limit" in src, (
        "get_dashboard_stats must be decorated with @limiter.limit"
    )


def test_occupancy_rejects_range_over_365_days():
    """The 365-day cap guard must be present in the source."""
    src = _src(reports_mod.get_occupancy_report)
    assert "365" in src, "get_occupancy_report must enforce a 365-day cap"
    assert "HTTPException" in src, "get_occupancy_report must raise HTTPException for over-range"


# ── Upload: rate limit ────────────────────────────────────────────────────────

def test_upload_file_has_rate_limit():
    src = _src(upload_mod.upload_file)
    assert "@limiter.limit" in src or "limiter.limit" in src, (
        "upload_file must be decorated with @limiter.limit"
    )

"""
Feature-flag enforcement dependencies.

Each subscription-plan feature has its own boolean field on the Hotel
model (`feature_ai_agent`, `feature_rate_shopper`, `feature_guest_bot`,
etc.). These dependencies let you gate an entire endpoint on a flag
without sprinkling `if not getattr(hotel, ...)` checks throughout the
codebase.

Usage in a router:
    from app.core.feature_flags import require_feature

    @router.post("/agent/chat")
    @limiter.limit("15/minute")
    async def chat(
        request: Request,
        payload: ChatRequest,
        current_user: CurrentUser = Depends(require_feature("feature_ai_agent")),
    ):
        ...

Or, to check the flag without raising (e.g. for soft-launch UI):
    if hotel_has_feature(current_user.hotel, "feature_ai_agent"):
        ...
"""
from __future__ import annotations

from typing import Iterable, Optional

from fastapi import Depends, HTTPException, status

from app.api.deps import CurrentUser
from app.models.hotel import Hotel


# Default behaviour when a flag isn't set: deny access.
# A future P4 task can add a global kill-switch via env var (e.g.
# AI_AGENT_KILLSWITCH=true) to disable a feature in prod without a deploy.
def hotel_has_feature(hotel: Optional[Hotel], feature: str) -> bool:
    """
    Returns True iff `hotel` exists and the named feature flag is set.

    Unknown feature names return False — fail-closed. This prevents typos
    like `require_feature("feature_ai-agnet")` from silently granting access.
    """
    if hotel is None:
        return False
    if not hasattr(hotel, feature):
        return False
    return bool(getattr(hotel, feature))


def require_feature(feature: str):
    """
    Factory: returns a FastAPI dependency that 403s when the hotel
    associated with the current user does not have the given feature.

    Use as: `current_user: CurrentUser = Depends(require_feature("feature_ai_agent"))`
    """
    if not isinstance(feature, str) or not feature.startswith("feature_"):
        # Fail-fast on programmer error — flag names must follow the
        # `feature_*` convention so we can grep for them.
        raise ValueError(
            f"Feature flag name must start with 'feature_', got: {feature!r}"
        )

    async def _dep(current_user: CurrentUser) -> CurrentUser:
        if not hotel_has_feature(current_user.hotel, feature):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Your subscription plan does not include '{feature}'. "
                    "Please upgrade to access this feature."
                ),
            )
        return current_user

    return _dep


def require_any_feature(*features: str):
    """Like require_feature but grants access if ANY of the listed flags is on."""

    async def _dep(current_user: CurrentUser) -> CurrentUser:
        for feat in features:
            if hotel_has_feature(current_user.hotel, feat):
                return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"This action requires one of: {', '.join(features)}. "
                "Please upgrade your subscription plan."
            ),
        )

    return _dep


def hotel_is_paused(hotel: Optional[Hotel]) -> bool:
    """Returns True if the hotel is in a soft-paused state (P4.1)."""
    if hotel is None:
        return False
    return bool(getattr(hotel, "is_paused", False))


def set_pause(hotel: Hotel, paused: bool, reason: Optional[str] = None) -> None:
    """Mutator that flips the soft-pause flag and stamps `paused_at`
    so super-admin pause actions are auditable. Stamping a `paused_at`
    even on un-pause is a deliberate decision: it preserves the last
    pause event for analytics. Pass `reason=None` to clear it on unpause."""
    hotel.is_paused = bool(paused)
    from app.core.time import utcnow
    hotel.paused_at = utcnow() if paused else None
    if not paused:
        hotel.pause_reason = None
    elif reason is not None:
        hotel.pause_reason = reason.strip() or None


def require_not_paused():
    """
    Factory: returns a FastAPI dependency that 423 (Locked) when the
    current user's hotel is in a soft-paused state. Use this to gate
    the *public* booking flow while leaving the owner dashboard
    reachable so the hotelier can fix whatever caused the pause.
    """

    async def _dep(current_user: CurrentUser) -> CurrentUser:
        if hotel_is_paused(current_user.hotel):
            reason = (current_user.hotel.pause_reason or "").strip() or "Temporarily unavailable"
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=reason,
            )
        return current_user

    return _dep

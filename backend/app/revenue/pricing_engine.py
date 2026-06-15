"""
Pure, deterministic dynamic-pricing engine.

`apply_pricing_rules` takes a resolved base nightly price plus the context for
one (room_type, date) cell and returns the adjusted price along with a
human-readable breakdown of which rules fired. It has NO database or network
access so it is trivially unit-testable and safe to call inside the hot
availability / search loops.

Determinism matters: the same inputs must always yield the same price so that
what the guest sees in search can be re-derived server-side at booking time.
The only non-deterministic input is live occupancy, which the caller supplies.
"""
from __future__ import annotations

from datetime import date
from typing import Iterable, List, Optional, Tuple, Dict, Any


def _rule_matches(
    rule: Any,
    *,
    target_date: date,
    occupancy_pct: Optional[float],
    lead_time_days: Optional[int],
) -> bool:
    """Return True if the rule's condition is satisfied for this date/context."""
    rtype = rule.rule_type

    if rtype == "occupancy":
        if occupancy_pct is None:
            return False
        lo = rule.occupancy_min
        hi = rule.occupancy_max
        if lo is not None and occupancy_pct < lo:
            return False
        if hi is not None and occupancy_pct > hi:
            return False
        # A rule with neither bound set is meaningless — don't fire.
        return lo is not None or hi is not None

    if rtype == "day_of_week":
        return target_date.weekday() in (rule.days_of_week or [])

    if rtype == "lead_time":
        if lead_time_days is None:
            return False
        lo = rule.lead_time_min
        hi = rule.lead_time_max
        if lo is not None and lead_time_days < lo:
            return False
        if hi is not None and lead_time_days > hi:
            return False
        return lo is not None or hi is not None

    if rtype == "seasonal":
        if rule.date_from is not None and target_date < rule.date_from:
            return False
        if rule.date_to is not None and target_date > rule.date_to:
            return False
        return rule.date_from is not None or rule.date_to is not None

    return False


def _apply_one(price: float, rule: Any) -> float:
    """Apply a single rule's adjustment + its own guard rails to the price."""
    if rule.adjustment_type == "fixed_amount":
        price = price + rule.adjustment_value
    else:  # percentage (default)
        price = price * (1.0 + rule.adjustment_value / 100.0)

    if rule.min_price is not None:
        price = max(price, rule.min_price)
    if rule.max_price is not None:
        price = min(price, rule.max_price)
    return price


def apply_pricing_rules(
    base_price: float,
    rules: Iterable[Any],
    *,
    target_date: date,
    room_type_id: Optional[str] = None,
    occupancy_pct: Optional[float] = None,
    lead_time_days: Optional[int] = None,
    deterministic_only: bool = False,
) -> Tuple[float, List[Dict[str, Any]]]:
    """
    Stack matching pricing rules on top of `base_price`.

    Args:
        base_price: resolved nightly rate before dynamic adjustment.
        rules: iterable of PricingRule-like objects (only active ones should be
            passed, but inactive ones are skipped defensively).
        target_date: the stay night being priced.
        room_type_id: the room being priced; a rule scoped to a different room
            is skipped. Hotel-wide rules (room_type_id is None) always apply.
        occupancy_pct: 0-100 live occupancy for this room/date (for occupancy
            rules). None disables occupancy rules.
        lead_time_days: days between today and `target_date` (for lead_time
            rules). None disables them.
        deterministic_only: when True, skip occupancy rules. Used by the
            charged-price path so search and booking always agree regardless of
            rooms booked in between.

    Returns:
        (final_price, applied) where `applied` is a list of
        {"id", "name", "rule_type", "from", "to"} breakdown entries.
    """
    price = float(base_price)
    applied: List[Dict[str, Any]] = []

    # Lower priority first; stable on id to keep ties deterministic.
    ordered = sorted(
        (r for r in rules if getattr(r, "is_active", True)),
        key=lambda r: (r.priority, r.id),
    )

    for rule in ordered:
        # Room scope: hotel-wide (None) always applies; otherwise must match.
        if rule.room_type_id is not None and room_type_id is not None and rule.room_type_id != room_type_id:
            continue
        if deterministic_only and rule.rule_type == "occupancy":
            continue
        if not _rule_matches(
            rule,
            target_date=target_date,
            occupancy_pct=occupancy_pct,
            lead_time_days=lead_time_days,
        ):
            continue

        before = price
        price = _apply_one(price, rule)
        if round(price, 2) != round(before, 2):
            applied.append({
                "id": rule.id,
                "name": rule.name,
                "rule_type": rule.rule_type,
                "from": round(before, 2),
                "to": round(price, 2),
            })

    price = max(0.0, round(price, 2))
    return price, applied

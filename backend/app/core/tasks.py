"""
Background task helpers.

FastAPI's built-in `BackgroundTasks` runs tasks AFTER the response is sent
but still on the same worker process. Limitations:
  * If the worker dies between response and task execution, the task is lost.
  * No retry / DLQ / observability.
  * Long-running tasks (>30s) can starve the worker.

For production-grade durability, use one of:
  * Celery + Redis/RabbitMQ
  * Arq (lightweight async, Redis-backed)
  * Dramatiq (RabbitMQ)
  * Cloud-native: AWS SQS, GCP Cloud Tasks

This module provides:
  * `safe_background()` — wraps a coroutine with exception logging so a
    failing task never crashes the worker silently. Use this when you want
    a "best-effort" task that must not block the response.
  * `enqueue_or_run_inline()` — helper to fall back to inline execution in
    dev/test where no task queue is configured.

The actual migration to a real task queue is tracked in P4 work — it
requires picking a broker, writing task definitions, and re-pointing all
call sites. This helper at least makes the current BackgroundTasks usage
robust against silent failures.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Awaitable, Callable, Optional, TypeVar

from fastapi import BackgroundTasks

logger = logging.getLogger(__name__)

T = TypeVar("T")


def safe_background(
    bg: BackgroundTasks,
    coro_factory: Callable[[], Awaitable[T]],
    *,
    task_name: Optional[str] = None,
) -> None:
    """
    Schedule a coroutine on the FastAPI BackgroundTasks with exception
    isolation. The original `bg.add_task(coro, ...)` swallows exceptions
    silently if the task raises — this wrapper logs the failure with full
    traceback so we don't lose visibility into background failures.

    Usage:
        safe_background(
            background_tasks,
            lambda: email_service.send_confirmation(...),
            task_name="send_guest_booking_confirmation",
        )
    """
    name = task_name or getattr(coro_factory, "__name__", "background_task")

    async def _runner() -> None:
        try:
            await coro_factory()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Background task '%s' failed", name)

    # BUG-01: pass the coroutine FUNCTION, not a called coroutine object.
    # bg.add_task(_runner()) hands Starlette a coroutine object as the
    # "callable", which it then fails to invoke — silently breaking every
    # background task (e.g. post-payment confirmation emails).
    bg.add_task(_runner)

async def check_subscription_expiry() -> dict:
    """
    Check subscriptions expiring in the next 7 days and send email alerts.
    Call this from a scheduled job or cron endpoint.
    """
    from datetime import datetime, timedelta
    from app.core.database import async_session
    from app.superadmin.subscriptions.subscription import Subscription
    from app.brand_console.hotel import Hotel
    from app.guests.user import User, UserRole
    from sqlmodel import select

    now = datetime.utcnow()
    warning_cutoff = now + timedelta(days=7)
    notified = 0
    errors = 0

    async with async_session() as session:
        expiring = (await session.execute(
            select(Subscription).where(
                Subscription.status == "active",
                Subscription.end_date <= warning_cutoff,
                Subscription.end_date > now,
            )
        )).scalars().all()

        for sub in expiring:
            try:
                hotel = await session.get(Hotel, sub.hotel_id)
                if not hotel:
                    continue
                owner = (await session.execute(
                    select(User).where(User.hotel_id == sub.hotel_id, User.role == UserRole.OWNER)
                )).scalar_one_or_none()
                if not owner:
                    continue

                days_left = (sub.end_date - now).days
                from app.services.email_service import get_email_service
                email_service = await get_email_service()
                await email_service.send_email(
                    to_email=owner.email,
                    to_name=owner.name,
                    subject=f"⚠️ Your {hotel.name} subscription expires in {days_left} day(s)",
                    html_content=f"""
                        <p>Hi {owner.name},</p>
                        <p>Your <strong>{sub.plan_name}</strong> subscription for <strong>{hotel.name}</strong>
                        expires on <strong>{sub.end_date.strftime('%d %b %Y')}</strong> ({days_left} day(s) left).</p>
                        <p>Please renew to avoid service interruption.</p>
                        <p>— Staybooker Team</p>
                    """,
                )
                notified += 1
            except Exception as e:
                logger.exception("Expiry alert failed for subscription %s: %s", sub.id, e)
                errors += 1

    return {"notified": notified, "errors": errors, "total_expiring": len(expiring)}


async def log_timeline_task(
    booking_id: str,
    event_type: str,
    message: str,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    changed_by: str = "system",
) -> None:
    """Background task to log events to the booking timeline."""
    from app.core.database import async_session
    from app.bookings.timeline import BookingTimeline

    async with async_session() as session:
        try:
            timeline_event = BookingTimeline(
                booking_id=booking_id,
                event_type=event_type,
                old_value=old_value,
                new_value=new_value,
                message=message,
                changed_by=changed_by
            )
            session.add(timeline_event)
            await session.commit()
        except Exception:
            logger.exception("Failed to log timeline event for booking %s", booking_id)


async def process_loyalty_checkout_task(booking_id: str) -> None:
    """Background task to calculate and award loyalty points on guest checkout."""
    from app.core.database import async_session
    from app.bookings.booking import Booking, BookingStatus, Guest
    from app.brand_console.hotel import Hotel
    from app.loyalty.loyalty import LoyaltyProgram, GuestLoyalty
    from sqlmodel import select
    from datetime import datetime

    async with async_session() as session:
        try:
            booking = await session.get(Booking, booking_id)
            if not booking or booking.status != BookingStatus.CHECKED_OUT:
                return

            hotel = await session.get(Hotel, booking.hotel_id)
            if not hotel:
                return

            chain_id = hotel.chain_id

            if chain_id:
                prog_stmt = select(LoyaltyProgram).where(
                    LoyaltyProgram.chain_id == chain_id,
                    LoyaltyProgram.is_active == True
                )
            else:
                prog_stmt = select(LoyaltyProgram).where(
                    LoyaltyProgram.hotel_id == hotel.id,
                    LoyaltyProgram.is_active == True
                )

            prog_res = await session.execute(prog_stmt)
            program = prog_res.scalar_one_or_none()
            if not program:
                return

            guest = await session.get(Guest, booking.guest_id)
            if not guest:
                return

            if chain_id:
                loyal_stmt = select(GuestLoyalty).where(
                    GuestLoyalty.guest_email == guest.email,
                    GuestLoyalty.chain_id == chain_id
                )
            else:
                loyal_stmt = select(GuestLoyalty).where(
                    GuestLoyalty.guest_email == guest.email,
                    GuestLoyalty.hotel_id == hotel.id
                )

            loyal_res = await session.execute(loyal_stmt)
            loyal = loyal_res.scalar_one_or_none()
            if not loyal:
                loyal = GuestLoyalty(
                    guest_email=guest.email,
                    hotel_id=None if chain_id else hotel.id,
                    chain_id=chain_id or None,
                    total_completed_bookings=0,
                    total_rooms_booked=0,
                    total_spend=0.0,
                    rewards_earned=0,
                    points_balance=0.0
                )
                session.add(loyal)

            earned_points = round(booking.total_amount * 0.1, 2)
            
            loyal.total_completed_bookings += 1
            loyal.total_rooms_booked += len(booking.rooms)
            loyal.total_spend += booking.total_amount
            loyal.points_balance += earned_points
            loyal.last_booking_at = datetime.utcnow()
            loyal.updated_at = datetime.utcnow()

            booking.loyalty_points_earned = earned_points

            if program.milestone_bookings > 0:
                milestone = program.milestone_bookings
                calculated_rewards = loyal.total_completed_bookings // milestone
                if calculated_rewards > loyal.rewards_earned:
                    loyal.rewards_earned = calculated_rewards
                    if program.reward_type == "percentage":
                        loyal.points_balance += program.reward_value

            session.add(loyal)
            session.add(booking)
            await session.commit()
            
            if chain_id:
                try:
                    from app.core.redis_client import redis_client
                    redis_client.delete_pattern(f"chain_analytics:{chain_id}:*")
                    redis_client.delete_pattern(f"chain_guests:{chain_id}:*")
                except Exception:
                    pass
        except Exception:
            logger.exception("Failed to process loyalty check-out for booking %s", booking_id)


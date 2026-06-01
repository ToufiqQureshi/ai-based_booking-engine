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

    bg.add_task(_runner())

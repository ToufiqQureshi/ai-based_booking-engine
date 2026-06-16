"""
Server-Sent Events endpoint for real-time rate change notifications.
When a hotelier updates room rates, the public booking page automatically
refreshes rates without requiring a manual page reload.
"""
import asyncio
import json
import logging
import time
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from app.core.cache.redis_client import redis_client

router = APIRouter(prefix="/public", tags=["Public"])
logger = logging.getLogger(__name__)

SSE_MAX_LIFETIME_SECONDS = 1800  # 30 minutes — INF-04: recycle connections
POLL_INTERVAL_SECONDS = 2        # check Redis every 2s for near-instant guest updates
HEARTBEAT_EVERY_N_POLLS = 15     # send keepalive every 30s (15 × 2s) to prevent proxy timeouts

@router.get("/hotels/{hotel_id}/rate-updates")
async def rate_update_stream(hotel_id: str, request: Request):
    """
    SSE stream that notifies clients when room rates change for a hotel.
    Polls Redis every 2 seconds — guests see price/availability changes within 2s.
    Sends a heartbeat every 30s to keep the connection alive through proxies.
    """
    async def event_generator():
        last_version = redis_client.get_value(f"rate_version:{hotel_id}") or "0"
        yield f"data: {json.dumps({'type': 'connected', 'version': last_version})}\n\n"

        started_at = time.monotonic()
        polls_since_heartbeat = 0

        while True:
            if await request.is_disconnected():
                break
            if time.monotonic() - started_at > SSE_MAX_LIFETIME_SECONDS:
                break

            try:
                current_version = redis_client.get_value(f"rate_version:{hotel_id}") or "0"
                if current_version != last_version:
                    last_version = current_version
                    polls_since_heartbeat = 0
                    # Read which room changed (set by bump_rate_version with 10s TTL)
                    changed = redis_client.get_value(f"rate_changed_room:{hotel_id}")
                    room_type_ids = None if (not changed or changed == "ALL") else [changed]
                    yield f"data: {json.dumps({'type': 'rate_update', 'hotel_id': hotel_id, 'version': current_version, 'room_type_ids': room_type_ids})}\n\n"
                else:
                    polls_since_heartbeat += 1
                    if polls_since_heartbeat >= HEARTBEAT_EVERY_N_POLLS:
                        polls_since_heartbeat = 0
                        yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
            except Exception as e:
                logger.warning(f"SSE error for hotel {hotel_id}: {e}")
                polls_since_heartbeat += 1
                if polls_since_heartbeat >= HEARTBEAT_EVERY_N_POLLS:
                    polls_since_heartbeat = 0
                    yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"

            await asyncio.sleep(POLL_INTERVAL_SECONDS)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )

"""
Server-Sent Events endpoint for real-time rate change notifications.
When a hotelier updates room rates, the public booking page automatically
refreshes rates without requiring a manual page reload.
"""
import asyncio
import json
import logging
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from app.core.redis_client import redis_client

router = APIRouter(prefix="/public", tags=["Public"])
logger = logging.getLogger(__name__)

@router.get("/hotels/{hotel_id}/rate-updates")
async def rate_update_stream(hotel_id: str, request: Request):
    """
    SSE stream that notifies clients when room rates change for a hotel.
    Clients connect once and receive events when rates are updated.
    Sends a heartbeat every 30s to keep the connection alive.
    """
    async def event_generator():
        last_version = redis_client.get_value(f"rate_version:{hotel_id}") or "0"
        yield f"data: {json.dumps({'type': 'connected', 'version': last_version})}\n\n"

        while True:
            if await request.is_disconnected():
                break
            try:
                current_version = redis_client.get_value(f"rate_version:{hotel_id}") or "0"
                if current_version != last_version:
                    last_version = current_version
                    yield f"data: {json.dumps({'type': 'rate_update', 'hotel_id': hotel_id, 'version': current_version})}\n\n"
                else:
                    yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
            except Exception as e:
                logger.warning(f"SSE error for hotel {hotel_id}: {e}")
                yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
            await asyncio.sleep(30)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )

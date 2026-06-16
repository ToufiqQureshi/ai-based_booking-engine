"""
WebSocket — real-time push channel for authenticated hotel staff.

Architecture:
  - JWT token passed as ?token=<bearer> query param (WS headers are browser-restricted)
  - Per-hotel connection registry in memory; production should replace with Redis pub/sub
  - Broadcasts booking events, new-booking notifications, and availability alerts

Usage (frontend):
  const ws = new WebSocket(`wss://api.staybooker.in/api/v1/ws/hotel?token=${jwt}`)
  ws.onmessage = (e) => { const evt = JSON.parse(e.data); ... }

Event envelope:
  { "type": "booking_created" | "booking_updated" | "booking_cancelled" | "ping",
    "data": { ...event-specific payload } }
"""
import asyncio
import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlmodel import select

logger = logging.getLogger(__name__)
router = APIRouter(tags=["WebSocket"])

# hotel_id → set of active WebSocket connections
# NOTE: this is per-process. For multi-instance Railway deployments, replace with
# Redis pub/sub (PUBLISH/SUBSCRIBE) so all workers share the event bus.
_connections: dict[str, set[WebSocket]] = {}


async def _authenticate_ws(token: str, session) -> Optional[object]:
    """
    Validate a Bearer JWT token and return the User, or None if invalid.
    Reuses Supabase token verification from the existing auth stack.
    """
    try:
        from app.core.db.supabase import verify_supabase_token
        from app.guests.user import User

        payload = await verify_supabase_token(token)
        if not payload:
            return None

        supabase_id = payload.get("sub")
        result = await session.execute(select(User).where(User.supabase_id == supabase_id))
        user = result.scalar_one_or_none()
        return user if user and user.is_active else None
    except Exception as e:
        logger.warning("WebSocket auth failed: %s", e)
        return None


async def broadcast_to_hotel(hotel_id: str, event_type: str, data: dict):
    """
    Push an event to all connected staff for a given hotel.
    Called from booking / availability endpoints after mutations.
    """
    connections = _connections.get(hotel_id, set())
    if not connections:
        return

    message = json.dumps({
        "type": event_type,
        "data": data,
        "ts": datetime.utcnow().isoformat(),
    })
    dead: set[WebSocket] = set()
    for ws in connections:
        try:
            await ws.send_text(message)
        except Exception:
            dead.add(ws)

    # Prune dead connections
    for ws in dead:
        connections.discard(ws)


@router.websocket("/ws/hotel")
async def hotel_ws(
    websocket: WebSocket,
    token: str = Query(..., description="Bearer JWT — same token used for REST API calls"),
):
    """
    Persistent WebSocket for hotel staff.
    Receives real-time booking and availability events.
    """
    from app.core.db.database import async_session

    await websocket.accept()

    async with async_session() as session:
        user = await _authenticate_ws(token, session)

    if not user or not user.hotel_id:
        await websocket.send_text(json.dumps({"type": "error", "data": {"message": "Unauthorized"}}))
        await websocket.close(code=4001)
        return

    hotel_id = user.hotel_id
    _connections.setdefault(hotel_id, set()).add(websocket)
    logger.info("WebSocket connected: user=%s hotel=%s", user.email, hotel_id)

    try:
        # Send a welcome ping so the client knows the channel is live
        await websocket.send_text(json.dumps({
            "type": "connected",
            "data": {"hotel_id": hotel_id, "user": user.email},
            "ts": datetime.utcnow().isoformat(),
        }))

        # Keep-alive loop: echo client pings and wait for disconnect
        while True:
            try:
                # 30-second receive timeout; client should send {"type":"ping"} periodically
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                msg = json.loads(raw)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong", "ts": datetime.utcnow().isoformat()}))
            except asyncio.TimeoutError:
                # Send a server-side keepalive to prevent proxy timeouts
                await websocket.send_text(json.dumps({"type": "ping", "ts": datetime.utcnow().isoformat()}))
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: user=%s hotel=%s", user.email, hotel_id)
    except Exception as e:
        logger.error("WebSocket error for hotel %s: %s", hotel_id, e)
    finally:
        _connections.get(hotel_id, set()).discard(websocket)

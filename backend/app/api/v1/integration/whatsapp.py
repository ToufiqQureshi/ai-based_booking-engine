"""
WhatsApp Webhook — verification and inbound message processing.
"""
import hmac
import hashlib
import json
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Header, HTTPException, Request
from sqlmodel import select

from app.api.deps import DbSession
from app.core.config import get_settings
from app.core.limiter import limiter
from app.core.redis_client import redis_client
from app.models.hotel import Hotel
from app.models.integration import IntegrationSettings

logger = logging.getLogger(__name__)
router = APIRouter()


def _verify_meta_signature(raw_body: bytes, signature_header: Optional[str], app_secret: str) -> bool:
    """Verify X-Hub-Signature-256 from Meta. Constant-time compare."""
    if not signature_header or not app_secret:
        return False
    if not signature_header.startswith("sha256="):
        return False
    provided = signature_header.split("=", 1)[1].strip()
    if not provided:
        return False
    expected = hmac.new(app_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(provided, expected)


@router.get("/whatsapp/webhook")
async def whatsapp_webhook_verification(request: Request):
    """Meta calls this to verify the webhook endpoint."""
    config = get_settings()
    expected_token = config.WHATSAPP_VERIFY_TOKEN
    if not expected_token:
        raise HTTPException(status_code=500, detail="WhatsApp webhook is not configured on this server")

    params = request.query_params
    mode = params.get("hub.mode")
    challenge = params.get("hub.challenge")
    verify_token = params.get("hub.verify_token")

    if mode == "subscribe" and challenge:
        if not challenge or len(challenge) > 1024:
            raise HTTPException(status_code=400, detail="Invalid challenge")
        if hmac.compare_digest(verify_token or "", expected_token):
            from fastapi.responses import PlainTextResponse
            return PlainTextResponse(content=challenge)
        raise HTTPException(status_code=403, detail="Invalid verification token")
    raise HTTPException(status_code=400, detail="Missing challenge or invalid mode")


@router.post("/whatsapp/webhook")
@limiter.limit("60/minute")
async def whatsapp_webhook_receive(
    request: Request,
    session: DbSession,
    x_hub_signature_256: Optional[str] = Header(None, alias="X-Hub-Signature-256"),
):
    """
    Meta calls this when a guest sends a WhatsApp message.
    Signature verified before any DB/AI work to prevent spoofed requests.
    """
    config = get_settings()
    app_secret = config.WHATSAPP_APP_SECRET
    if not app_secret:
        logger.error("WhatsApp webhook POST received but WHATSAPP_APP_SECRET is not configured")
        raise HTTPException(status_code=500, detail="WhatsApp webhook is not configured on this server")

    raw_body = await request.body()
    if not _verify_meta_signature(raw_body, x_hub_signature_256, app_secret):
        logger.warning(
            "WhatsApp webhook signature verification failed (header_present=%s, body_len=%d)",
            bool(x_hub_signature_256), len(raw_body),
        )
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        body = json.loads(raw_body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    entry = body.get("entry", [])
    if not entry:
        return {"status": "ignored", "reason": "no entries"}

    debug_log = []

    for ent in entry:
        for change in ent.get("changes", []):
            value = change.get("value", {})
            if "messages" not in value:
                debug_log.append("SKIP: no messages in value")
                continue

            metadata = value.get("metadata", {})
            phone_number_id = str(metadata.get("phone_number_id", ""))
            if not phone_number_id:
                debug_log.append("SKIP: empty phone_number_id")
                continue

            debug_log.append(f"phone_number_id: '{phone_number_id}'")

            is_central_number = bool(
                config.CENTRAL_WHATSAPP_PHONE_ID and phone_number_id == config.CENTRAL_WHATSAPP_PHONE_ID
            )
            target_hotel = None
            whatsapp_token_to_use = None

            if not is_central_number:
                # Specific hotel number — match by stored phone_number_id.
                # Load only active hotels. On PostgreSQL this could use a JSON index.
                # For now, fetch active hotels and filter in Python.
                hotel_res = await session.execute(
                    select(Hotel).where(Hotel.is_active == True)
                )
                for h in hotel_res.scalars().all():
                    h_settings = h.settings or {}
                    if str(h_settings.get("whatsapp_phone_number_id") or "") == phone_number_id:
                        target_hotel = h
                        whatsapp_token_to_use = h_settings.get("whatsapp_api_key")
                        break

                if not target_hotel:
                    debug_log.append(f"SKIP: No hotel found for phone_number_id '{phone_number_id}'")
                    continue

                debug_log.append(f"MATCH: Hotel '{target_hotel.name}' (ID: {target_hotel.id})")

                # Subscription / feature / AI checks for specific hotel
                from app.models.subscription import Subscription
                sub_res = await session.execute(
                    select(Subscription).where(Subscription.hotel_id == target_hotel.id, Subscription.status == "active")
                )
                subscription = sub_res.scalar_one_or_none()

                if subscription and subscription.whatsapp_credits <= 0:
                    debug_log.append("SKIP: WhatsApp credits exhausted")
                    continue
                if not target_hotel.feature_ai_agent:
                    debug_log.append("SKIP: feature_ai_agent is False")
                    continue

                int_res = await session.execute(
                    select(IntegrationSettings).where(IntegrationSettings.hotel_id == target_hotel.id)
                )
                int_settings = int_res.scalar_one_or_none()
                if not int_settings or not int_settings.ai_api_key:
                    debug_log.append("SKIP: AI not configured for hotel")
                    continue

                debug_log.append(f"AI Config: provider={int_settings.ai_provider}, model={int_settings.ai_model}")
            else:
                # Central number — hotel resolved per-message below
                whatsapp_token_to_use = config.CENTRAL_WHATSAPP_TOKEN

            contacts = value.get("contacts", [])
            contact_name = contacts[0].get("profile", {}).get("name", "Guest") if contacts else "Guest"

            for msg in value.get("messages", []):
                sender_phone = msg.get("from")
                if msg.get("type") != "text" or not sender_phone:
                    continue
                user_message = msg.get("text", {}).get("body", "").strip()
                if not user_message:
                    continue

                debug_log.append(f"Processing message from {sender_phone}: '{user_message[:50]}'")

                agent_reply = ""
                resolved_hotel = target_hotel

                # --- RESOLVE HOTEL FOR CENTRAL NUMBER ---
                if is_central_number:
                    session_key = f"whatsapp:global_session:{sender_phone}:hotel_id"
                    stored_hotel_id = redis_client.get_value(session_key)
                    if stored_hotel_id:
                        h_res = await session.execute(select(Hotel).where(Hotel.id == stored_hotel_id))
                        resolved_hotel = h_res.scalar_one_or_none()

                    if not resolved_hotel:
                        try:
                            from app.core.global_agent import create_global_concierge_graph
                            from langchain_core.messages import HumanMessage, AIMessage

                            global_agent = create_global_concierge_graph(
                                session,
                                ai_provider="groq",
                                ai_api_key=config.GROQ_API_KEY,
                                ai_model="llama-3.1-8b-instant",
                            )
                            if not global_agent:
                                debug_log.append("Global agent disabled or missing GROQ key.")
                                continue

                            history_key = f"whatsapp:global_chat:{sender_phone}"
                            history_raw = redis_client.get_value(history_key)
                            history = json.loads(history_raw) if history_raw else []

                            chat_history = [
                                HumanMessage(content=c) if r in ("human", "user") else AIMessage(content=c)
                                for r, c in history if r in ("human", "user", "ai", "assistant", "model")
                            ]
                            result = await global_agent.ainvoke({"messages": chat_history + [HumanMessage(content=user_message)]})
                            agent_reply = result["messages"][-1].content

                            if "ACTION:ROUTE_TO_HOTEL|" in agent_reply:
                                parts = agent_reply.split("ACTION:ROUTE_TO_HOTEL|")
                                action_data = json.loads(parts[1].strip())
                                selected_hotel_id = action_data.get("hotel_id")
                                selected_hotel_name = action_data.get("hotel_name")
                                redis_client.set_value(session_key, selected_hotel_id, expire=86400)
                                agent_reply = f"Connecting you to {selected_hotel_name}...\n\nHi! I'm the virtual assistant for {selected_hotel_name}. How can I help you today?"
                                redis_client.delete_value(history_key)
                            else:
                                history.append(["user", user_message])
                                history.append(["assistant", agent_reply])
                                redis_client.set_value(history_key, json.dumps(history[-10:]), expire=86400)
                        except Exception as e:
                            logger.error("Global Agent error: %s", e)
                            continue

                # --- HOTEL AGENT ---
                if resolved_hotel:
                    from app.models.subscription import Subscription
                    from langchain_core.messages import HumanMessage, AIMessage

                    sub_res = await session.execute(
                        select(Subscription).where(Subscription.hotel_id == resolved_hotel.id, Subscription.status == "active")
                    )
                    subscription = sub_res.scalar_one_or_none()
                    if subscription and subscription.whatsapp_credits <= 0:
                        continue
                    if not resolved_hotel.feature_ai_agent:
                        continue

                    int_res = await session.execute(
                        select(IntegrationSettings).where(IntegrationSettings.hotel_id == resolved_hotel.id)
                    )
                    int_settings = int_res.scalar_one_or_none()
                    if not int_settings or not int_settings.ai_api_key:
                        continue

                    redis_key = f"whatsapp:session:{resolved_hotel.id}:{sender_phone}"
                    history_raw = redis_client.get_value(redis_key)
                    history = json.loads(history_raw) if history_raw else []

                    chat_history = [
                        HumanMessage(content=c) if r in ("human", "user") else AIMessage(content=c)
                        for r, c in history if r in ("human", "user", "ai", "assistant", "model")
                    ]

                    try:
                        from app.core.guest_agent import create_guest_agent_graph
                        agent = create_guest_agent_graph(
                            session, resolved_hotel.id,
                            int_settings.ai_provider, int_settings.ai_api_key,
                            int_settings.ai_model, int_settings.ai_base_url,
                            resolved_hotel.name,
                        )
                        if agent:
                            if not agent_reply:
                                result = await agent.ainvoke({"messages": chat_history + [HumanMessage(content=user_message)]})
                                agent_reply = result["messages"][-1].content

                            if "ACTION:BOOKING_LINK|" in agent_reply:
                                try:
                                    action_data = json.loads(agent_reply.split("ACTION:BOOKING_LINK|")[1].strip())
                                    frontend_url = config.FRONTEND_URL
                                    guest_info = action_data.get("guest_info", {})
                                    rooms_list = action_data.get("rooms", [])
                                    room_id = rooms_list[0].get("id", "") if rooms_list else ""
                                    booking_url = (
                                        f"{frontend_url}/book/{resolved_hotel.slug}/rooms"
                                        f"?checkIn={action_data.get('checkInDate', '')}"
                                        f"&checkOut={action_data.get('checkOutDate', '')}"
                                        f"&adults={action_data.get('adults', 1)}"
                                        f"&children={action_data.get('children', 0)}"
                                        f"&roomTypeId={room_id}"
                                        f"&firstName={guest_info.get('firstName', '')}"
                                        f"&lastName={guest_info.get('lastName', '')}"
                                        f"&email={guest_info.get('email', '')}"
                                        f"&phone={guest_info.get('phone', sender_phone)}"
                                    )
                                    agent_reply = (
                                        f"I have prepared your booking details for {resolved_hotel.name}. "
                                        f"Please click the link below to complete your booking:\n\n👉 {booking_url}"
                                    )
                                except Exception:
                                    pass

                            history.append(["user", user_message])
                            history.append(["assistant", agent_reply])
                            redis_client.set_value(redis_key, json.dumps(history[-30:]), expire=86400)

                            if subscription:
                                subscription.whatsapp_credits = max(0, subscription.whatsapp_credits - 1)
                                session.add(subscription)

                            # Update hotel settings counters
                            h_settings = dict(resolved_hotel.settings) if isinstance(resolved_hotel.settings, dict) else {}
                            h_settings["total_messages_sent"] = int(h_settings.get("total_messages_sent", 0) or 0) + 1
                            h_settings["ai_whatsapp_credits"] = max(0, int(h_settings.get("ai_whatsapp_credits", 100) or 100) - 1)
                            resolved_hotel.settings = h_settings
                            session.add(resolved_hotel)

                            await session.commit()

                    except Exception as e:
                        logger.error("Guest Agent error: %s", e, exc_info=True)
                        continue

                # --- SEND REPLY ---
                if agent_reply and whatsapp_token_to_use:
                    try:
                        async with httpx.AsyncClient(timeout=30.0) as client:
                            wa_response = await client.post(
                                f"https://graph.facebook.com/v19.0/{phone_number_id}/messages",
                                headers={"Authorization": f"Bearer {whatsapp_token_to_use}", "Content-Type": "application/json"},
                                json={
                                    "messaging_product": "whatsapp",
                                    "recipient_type": "individual",
                                    "to": sender_phone,
                                    "type": "text",
                                    "text": {"body": agent_reply},
                                },
                            )
                            logger.info("WhatsApp send status=%s", wa_response.status_code)
                    except Exception as e:
                        logger.error("WhatsApp send error: %s", e)

    logger.info("WhatsApp webhook debug: %s", debug_log)
    return {"status": "success", "debug": debug_log}

"""
Public booking widget routes:
  POST /public/bookings          — create a booking (rate-limited, idempotency-guarded)
  POST /public/loyalty-check     — repeat-guest detection and reward lookup
  POST /public/bookings/cancel-request  — compute cancellation fee
  POST /public/bookings/cancel-confirm  — execute cancellation
"""
import time
from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, status
from sqlalchemy import func
from sqlmodel import select, and_, or_

from app.core.deps import DbSession
from app.core.limiter import limiter
from app.core.redis_client import redis_client
from app.core.time import utcnow
from app.bookings.booking import Booking, BookingStatus, BookingSource, Guest
from app.brand_console.hotel import Hotel
from app.loyalty.loyalty_model import GuestLoyalty, LoyaltyProgram, LoyaltyOffer
from app.rate_plans.promo import PromoCode
from app.rate_plans.rates_model import RatePlan, RoomRate
from app.rooms.room import RoomBlock, RoomType
from app.revenue.pricing_model import PricingRule
from app.revenue.pricing_engine import apply_pricing_rules

from ._schemas import (
    GuestCancelInfoResponse,
    GuestCancelRequest,
    LoyaltyCheckRequest,
    LoyaltyCheckResponse,
    LoyaltyOfferCheckRequest,
    LoyaltyOfferCheckResponse,
    PublicBookingCreate,
    PublicBookingResponse,
)
from ._booking_helpers import generate_booking_number, _update_guest_loyalty
from app.core.rate_signals import bump_rate_version

import logging

router = APIRouter(prefix="/public", tags=["Public"])
logger = logging.getLogger(__name__)


@router.post("/bookings", response_model=PublicBookingResponse)
@limiter.limit("5/minute")
async def create_public_booking(
    request: Request,
    booking_data: PublicBookingCreate,
    session: DbSession,
    background_tasks: BackgroundTasks,
):
    """
    Create a booking without authentication (used by the public widget).
    Performs server-side availability + price verification and idempotency locking.
    """
    if not booking_data.rooms:
        raise HTTPException(status_code=400, detail="At least one room is required")

    room_type_id = booking_data.rooms[0].room_type_id
    idempotency_key = f"booking_lock:{booking_data.guest.email}:{room_type_id}:{booking_data.check_in}"

    try:
        is_locked = redis_client.get_value(idempotency_key)
        if is_locked:
            logger.warning(f"Duplicate booking attempt blocked: {idempotency_key}")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A booking attempt is already in progress. Please wait a moment.",
            )
        redis_client.set_value(idempotency_key, "locked", expire=30)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Redis idempotency check failed: {e}")

    try:
        # Lock RoomTypes to prevent race conditions during inventory check
        unique_rt_ids = sorted(list({r.room_type_id for r in booking_data.rooms}))
        rt_result = await session.execute(
            select(RoomType).where(RoomType.id.in_(unique_rt_ids)).with_for_update()
        )
        locked_room_types = {rt.id: rt for rt in rt_result.scalars().all()}

        if not locked_room_types:
            raise HTTPException(status_code=404, detail="Requested room types not found")

        first_rt = locked_room_types.get(booking_data.rooms[0].room_type_id)
        if not first_rt:
            raise HTTPException(status_code=404, detail="Primary room type not found")
        hotel_id = first_rt.hotel_id

        # Fetch all overlapping bookings
        overlapping_bookings = (await session.execute(
            select(Booking).where(
                Booking.hotel_id == hotel_id,
                Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING, BookingStatus.CHECKED_IN]),
                and_(Booking.check_in < booking_data.check_out, Booking.check_out > booking_data.check_in),
            )
        )).scalars().all()

        # Fetch all overlapping blocks
        overlapping_blocks = (await session.execute(
            select(RoomBlock).where(
                RoomBlock.hotel_id == hotel_id,
                and_(RoomBlock.start_date < booking_data.check_out, RoomBlock.end_date >= booking_data.check_in),
            )
        )).scalars().all()

        # Fetch daily rates for price verification
        daily_rates = (await session.execute(
            select(RoomRate).where(
                RoomRate.hotel_id == hotel_id,
                RoomRate.rate_plan_id == None,
                and_(RoomRate.date_from < booking_data.check_out, RoomRate.date_to >= booking_data.check_in),
            )
        )).scalars().all()

        daily_price_map: dict = {}
        for dr in daily_rates:
            c = max(dr.date_from, booking_data.check_in)
            while c <= min(dr.date_to, booking_data.check_out - timedelta(days=1)):
                daily_price_map[(dr.room_type_id, c.isoformat())] = dr.price
                c += timedelta(days=1)

        # Fetch active dynamic pricing rules for this hotel
        active_pricing_rules = (await session.execute(
            select(PricingRule).where(
                PricingRule.hotel_id == hotel_id,
                PricingRule.is_active == True,  # noqa: E712
            )
        )).scalars().all()
        lead_time_days = (booking_data.check_in - date.today()).days

        # Per-room: availability check + server-side price recomputation
        for room_req in booking_data.rooms:
            rt = locked_room_types.get(room_req.room_type_id)
            if not rt:
                raise HTTPException(status_code=404, detail=f"Room type {room_req.room_type_id} not found")

            plan_modifier = 0.0
            if room_req.rate_plan_id and not room_req.rate_plan_id.startswith("virtual-"):
                rp = await session.get(RatePlan, room_req.rate_plan_id)
                if rp:
                    plan_modifier = float(rp.price_adjustment or 0.0)

            recalculated_total = 0.0
            curr_day = booking_data.check_in
            while curr_day < booking_data.check_out:
                d_str = curr_day.isoformat()

                booked_on_day = sum(
                    1 for b in overlapping_bookings
                    if b.check_in <= curr_day < b.check_out
                    for rb in b.rooms
                    if rb.get("room_type_id") == rt.id
                )
                blocked_on_day = sum(
                    bl.blocked_count for bl in overlapping_blocks
                    if bl.room_type_id == rt.id and bl.start_date <= curr_day <= bl.end_date
                )

                available = rt.total_inventory - booked_on_day - blocked_on_day
                if available <= 0:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=(
                            f"Room type '{rt.name}' is no longer available for {d_str}. "
                            "Please refresh and try again."
                        ),
                    )

                nightly_base = daily_price_map.get((rt.id, d_str), float(rt.base_price))
                occupancy_pct = (
                    (rt.total_inventory - available) / rt.total_inventory * 100
                    if rt.total_inventory > 0 else 0.0
                )
                dynamic_price, _ = apply_pricing_rules(
                    nightly_base, active_pricing_rules,
                    target_date=curr_day,
                    room_type_id=rt.id,
                    occupancy_pct=occupancy_pct,
                    lead_time_days=lead_time_days,
                )
                nightly_total = dynamic_price + plan_modifier
                extra_adults = max(0, room_req.guests - rt.base_occupancy)
                if extra_adults > 0:
                    rate_adult = float(rt.extra_adult_price) if rt.extra_adult_price else float(rt.extra_person_price or 1000.0)
                    nightly_total += extra_adults * rate_adult
                recalculated_total += nightly_total
                curr_day += timedelta(days=1)

            if abs(recalculated_total - room_req.total_price) > 5.0:
                logger.warning(f"Price mismatch: Recalculated {recalculated_total} vs Submitted {room_req.total_price}")
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"The price for '{rt.name}' has been updated to INR {recalculated_total}. "
                        "Please review and try again."
                    ),
                )

        # Upsert guest record
        guest_data = booking_data.guest
        guest = (await session.execute(
            select(Guest).where(Guest.email == guest_data.email, Guest.hotel_id == hotel_id)
        )).scalar_one_or_none()

        if not guest:
            guest = Guest(
                first_name=guest_data.first_name, last_name=guest_data.last_name,
                email=guest_data.email, phone=guest_data.phone,
                nationality=guest_data.nationality, id_type=guest_data.id_type,
                id_number=guest_data.id_number, hotel_id=hotel_id,
            )
            session.add(guest)
            await session.flush()

        hotel = await session.get(Hotel, hotel_id)
        settings = hotel.settings if hotel and hotel.settings else {}

        # Validate payment mode
        hotel_payment_mode = settings.get("payment_mode", "both")
        if booking_data.payment_method == "pay_at_property" and hotel_payment_mode == "online":
            raise HTTPException(status_code=400, detail="This property requires online payment.")
        if booking_data.payment_method == "online" and hotel_payment_mode == "property":
            raise HTTPException(status_code=400, detail="This property only accepts payment at property.")

        # Tax calculation
        tax_name = settings.get("tax_name", "GST")
        room_tax_rate = float(settings.get("room_tax_rate", 0.0))
        room_tax_type = settings.get("room_tax_type", "exclusive")
        room_tax_calculation_method = settings.get("room_tax_calculation_method", "flat")
        room_tax_slabs = settings.get("room_tax_slabs", [])
        addon_tax_rate = float(settings.get("addon_tax_rate", 0.0))
        addon_tax_type = settings.get("addon_tax_type", "exclusive")

        def resolve_room_rate_tax(nightly_price: float) -> float:
            if room_tax_calculation_method == "flat":
                return room_tax_rate
            for slab in room_tax_slabs:
                if float(slab.get("from", 0.0)) <= nightly_price <= float(slab.get("to", 999999.0)):
                    return float(slab.get("rate", 0.0))
            if nightly_price < 1000:
                return 0.0
            elif nightly_price < 7500:
                return 12.0
            return 18.0

        room_subtotal = 0.0
        room_tax_amount = 0.0
        for room in booking_data.rooms:
            r_rate = resolve_room_rate_tax(room.price_per_night)
            r_total = room.total_price
            if room_tax_type == "inclusive":
                r_sub = r_total / (1 + (r_rate / 100))
                r_tax = r_total - r_sub
            else:
                r_sub = r_total
                r_tax = r_total * (r_rate / 100)
            room_subtotal += r_sub
            room_tax_amount += r_tax

        addon_total = sum(addon.price for addon in booking_data.addons)
        if addon_tax_type == "inclusive":
            addon_subtotal = addon_total / (1 + (addon_tax_rate / 100))
            addon_tax_amount = addon_total - addon_subtotal
        else:
            addon_subtotal = addon_total
            addon_tax_amount = addon_total * (addon_tax_rate / 100)

        subtotal_amount = round(room_subtotal + addon_subtotal, 2)
        tax_amount = round(room_tax_amount + addon_tax_amount, 2)
        total_before_discount = subtotal_amount + tax_amount

        hotel_model = await session.get(Hotel, hotel_id)
        chain_id = hotel_model.chain_id if hotel_model else None

        # Promo code discount
        discount_amount = 0.0
        if booking_data.promo_code:
            from datetime import date as _date
            today = _date.today()
            promo = (await session.execute(
                select(PromoCode).where(
                    PromoCode.code == booking_data.promo_code,
                    or_(PromoCode.hotel_id == hotel_id, PromoCode.chain_id == chain_id),
                    PromoCode.is_active == True,
                )
            )).scalar_one_or_none()
            if promo:
                if (promo.end_date and promo.end_date < today) or \
                   (promo.start_date and promo.start_date > today) or \
                   (promo.max_usage is not None and (promo.current_usage or 0) >= promo.max_usage):
                    promo = None
            if promo:
                if promo.discount_type == "percentage":
                    discount_amount = (total_before_discount * promo.discount_value) / 100
                else:
                    discount_amount = promo.discount_value
                discount_amount = min(discount_amount, total_before_discount)
                promo.current_usage = (promo.current_usage or 0) + 1
                session.add(promo)

        # Loyalty points redemption
        points_redeemed = 0.0
        if booking_data.redeem_points and booking_data.redeem_points > 0:
            if chain_id:
                loyal_stmt = select(GuestLoyalty).where(
                    GuestLoyalty.guest_email == guest_data.email,
                    GuestLoyalty.chain_id == chain_id,
                )
            else:
                loyal_stmt = select(GuestLoyalty).where(
                    GuestLoyalty.guest_email == guest_data.email,
                    GuestLoyalty.hotel_id == hotel_id,
                )
            loyal = (await session.execute(loyal_stmt)).scalar_one_or_none()
            if not loyal or loyal.points_balance < booking_data.redeem_points:
                raise HTTPException(status_code=400, detail="Insufficient loyalty points balance")
            # Convert points → currency using the hotel's configured point_value.
            # Fallback 1:1 keeps legacy behaviour when the points wallet is off.
            prog = (await session.execute(
                select(LoyaltyProgram).where(LoyaltyProgram.hotel_id == hotel_id)
            )).scalar_one_or_none()
            point_value = (
                prog.point_value
                if prog and prog.points_enabled and prog.point_value and prog.point_value > 0
                else 1.0
            )
            redeemable_value = booking_data.redeem_points * point_value
            points_redeemed = min(redeemable_value, total_before_discount - discount_amount)
            points_used = points_redeemed / point_value if point_value > 0 else points_redeemed
            loyal.points_balance = float(loyal.points_balance) - points_used
            session.add(loyal)

        total_amount = round(total_before_discount - discount_amount - points_redeemed, 2)
        discount_amount = round(discount_amount, 2)

        tax_details = {
            "tax_name": tax_name, "room_tax_rate": room_tax_rate, "room_tax_type": room_tax_type,
            "room_base_amount": round(room_subtotal, 2), "room_tax_amount": round(room_tax_amount, 2),
            "addon_tax_rate": addon_tax_rate, "addon_tax_type": addon_tax_type,
            "addon_base_amount": round(addon_subtotal, 2), "addon_tax_amount": round(addon_tax_amount, 2),
        }

        # Build rooms list with frozen cancellation policy
        hotel_policy = settings.get("cancellation_policy")
        rooms_list = []
        for room in booking_data.rooms:
            rt = locked_room_types.get(room.room_type_id)
            cancellation_policy = rt.cancellation_policy if rt else None
            is_refundable = True
            cancellation_hours = 24
            plan_override = {}
            if rt and room.rate_plan_id:
                overrides = getattr(rt, "rate_plan_overrides", {}) or {}
                plan_override = overrides.get(room.rate_plan_id) or {} if isinstance(overrides, dict) else {}
            if room.rate_plan_id:
                rp = await session.get(RatePlan, room.rate_plan_id)
                if rp:
                    is_refundable = plan_override.get("is_refundable", rp.is_refundable)
                    cancellation_hours = plan_override.get("cancellation_hours", rp.cancellation_hours)
            if not cancellation_policy:
                if plan_override:
                    cancellation_policy = (
                        f"Free cancellation up to {cancellation_hours} hours before check-in"
                        if is_refundable else "Non-refundable"
                    )
                else:
                    cancellation_policy = hotel_policy or (
                        f"Free cancellation up to {cancellation_hours} hours before check-in"
                        if is_refundable else "Non-refundable"
                    )
            room_dict = room.model_dump()
            room_dict["cancellation_policy"] = cancellation_policy
            room_dict["is_refundable"] = is_refundable
            room_dict["cancellation_hours"] = cancellation_hours
            rooms_list.append(room_dict)

        booking = Booking(
            hotel_id=hotel_id, guest_id=guest.id,
            booking_number=generate_booking_number(),
            check_in=booking_data.check_in, check_out=booking_data.check_out,
            rooms=rooms_list, addons=[addon.model_dump() for addon in booking_data.addons],
            special_requests=booking_data.special_requests, promo_code=booking_data.promo_code,
            total_amount=total_amount, subtotal_amount=subtotal_amount,
            tax_amount=tax_amount, discount_amount=discount_amount,
            tax_details=tax_details, status=BookingStatus.PENDING,
            source=BookingSource.AI_AGENT if booking_data.source == "ai_agent" else BookingSource.BOOKING_ENGINE,
            loyalty_points_redeemed=points_redeemed,
        )
        session.add(booking)
        await session.commit()

        # Bump rate_version — inventory changed, notify guests via SSE.
        bump_rate_version(hotel_id)

        try:
            from app.calendar import clear_availability_cache
            clear_availability_cache(hotel_id)
        except Exception as e:
            logger.error(f"Failed clearing availability cache on public booking: {e}")

        await session.refresh(booking)

        if booking_data.payment_method == "pay_at_property":
            booking.status = BookingStatus.CONFIRMED
            session.add(booking)
            await _update_guest_loyalty(session, hotel_id, guest.email, booking.total_amount, len(booking_data.rooms))
            await session.commit()

            from app.system.ws import broadcast_to_hotel
            background_tasks.add_task(
                broadcast_to_hotel, hotel_id, "booking_created", {
                    "booking_number": booking.booking_number,
                    "guest_name": f"{guest.first_name} {guest.last_name}",
                    "room": booking.rooms[0].get("room_type_name", "Room") if booking.rooms else "Room",
                    "check_in": str(booking.check_in),
                    "total_amount": booking.total_amount,
                    "status": BookingStatus.CONFIRMED.value,
                }
            )

            from app.services.email_service import get_email_service
            from app.core.vault import resolve_settings_secrets
            email_service = await get_email_service()
            h_settings = await resolve_settings_secrets(
                session, hotel.settings if hotel and hotel.settings else {}
            )

            background_tasks.add_task(
                email_service.send_guest_booking_confirmation,
                guest_email=guest.email,
                guest_name=f"{guest.first_name} {guest.last_name}",
                booking_number=booking.booking_number,
                check_in=str(booking.check_in), check_out=str(booking.check_out),
                total_amount=booking.total_amount, hotel_settings=h_settings,
            )
            hotel_emails = hotel.contact.get("email", "") if hotel and hotel.contact else ""
            background_tasks.add_task(
                email_service.send_hotel_booking_notification,
                hotel_emails=hotel_emails,
                booking_number=booking.booking_number,
                guest_name=f"{guest.first_name} {guest.last_name}",
                check_in=str(booking.check_in), check_out=str(booking.check_out),
                total_amount=booking.total_amount, hotel_settings=h_settings,
            )

        return PublicBookingResponse(
            id=booking.id, booking_number=booking.booking_number,
            status=booking.status.value, check_in=booking.check_in, check_out=booking.check_out,
            total_amount=booking.total_amount, subtotal_amount=booking.subtotal_amount,
            tax_amount=booking.tax_amount, discount_amount=booking.discount_amount,
            tax_details=booking.tax_details or {},
            guest={
                "first_name": guest.first_name, "last_name": guest.last_name,
                "email": guest.email, "phone": guest.phone,
            },
            rooms=booking.rooms, addons=booking.addons or [],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Public booking error")
        raise HTTPException(status_code=500, detail=f"Booking failed: {str(e)}")


def _reward_label(reward_type: str, reward_value: float) -> str:
    """Human-readable reward text for guest popups."""
    if reward_type == "free_night":
        return "1 Free Night"
    if reward_type == "fixed_amount":
        return f"₹{int(reward_value)} off"
    return f"{int(reward_value)}% off"


@router.post("/loyalty-offers", response_model=LoyaltyOfferCheckResponse)
@limiter.limit("30/minute")
async def check_loyalty_offers(request: Request, data: LoyaltyOfferCheckRequest, session: DbSession):
    """
    Public, pre-booking stay-offer check for the booking widget.

    Given a hotel (and optionally a room type + chosen nights), returns the most
    relevant active stay offer plus a nudge if the guest is below the night
    threshold. Drives the "stay N nights to unlock" upsell popup.
    """
    try:
        # Room-scoped offers for the chosen room, plus hotel-wide (room_type_id IS NULL).
        conditions = [
            LoyaltyOffer.hotel_id == data.hotel_id,
            LoyaltyOffer.is_active == True,
        ]
        if data.room_type_id:
            conditions.append(
                or_(
                    LoyaltyOffer.room_type_id == data.room_type_id,
                    LoyaltyOffer.room_type_id.is_(None),
                )
            )
        else:
            # No room chosen yet → only hotel-wide offers are relevant.
            conditions.append(LoyaltyOffer.room_type_id.is_(None))

        offers = (await session.execute(
            select(LoyaltyOffer).where(*conditions)
        )).scalars().all()

        if not offers:
            return LoyaltyOfferCheckResponse(has_offer=False)

        # Prefer a room-specific offer over a hotel-wide one when both exist.
        offers.sort(key=lambda o: (o.room_type_id is None, o.min_nights))

        nights = data.nights or 0
        # No dates yet → tell the widget an offer exists so it can prompt for dates.
        if nights <= 0:
            offer = offers[0]
            return LoyaltyOfferCheckResponse(
                has_offer=True, needs_dates=True, offer_id=offer.id, title=offer.title,
                min_nights=offer.min_nights, reward_type=offer.reward_type,
                reward_value=offer.reward_value,
                reward_label=_reward_label(offer.reward_type, offer.reward_value),
                nudge_title=offer.nudge_title,
            )

        # Among unlocked offers (nights >= min), pick the highest threshold reached.
        unlocked = [o for o in offers if nights >= o.min_nights]
        if unlocked:
            offer = max(unlocked, key=lambda o: o.min_nights)
            label = _reward_label(offer.reward_type, offer.reward_value)
            return LoyaltyOfferCheckResponse(
                has_offer=True, unlocked=True, offer_id=offer.id, title=offer.title,
                min_nights=offer.min_nights, current_nights=nights, nights_remaining=0,
                reward_type=offer.reward_type, reward_value=offer.reward_value,
                reward_label=label,
                nudge_title="Offer Unlocked! 🎉",
                nudge_message=f"You've unlocked {label} on this stay!",
            )

        # Otherwise nudge toward the closest threshold above the current nights.
        offer = min(offers, key=lambda o: o.min_nights - nights)
        remaining = offer.min_nights - nights
        label = _reward_label(offer.reward_type, offer.reward_value)
        msg = (offer.nudge_message or "Stay {remaining} more night(s) and unlock {reward}!") \
            .replace("{remaining}", str(remaining)).replace("{reward}", label)
        return LoyaltyOfferCheckResponse(
            has_offer=True, unlocked=False, offer_id=offer.id, title=offer.title,
            min_nights=offer.min_nights, current_nights=nights, nights_remaining=remaining,
            reward_type=offer.reward_type, reward_value=offer.reward_value,
            reward_label=label, nudge_title=offer.nudge_title, nudge_message=msg,
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Loyalty offer check error")
        # Never break the booking widget over a loyalty lookup.
        return LoyaltyOfferCheckResponse(has_offer=False)


@router.post("/loyalty-check", response_model=LoyaltyCheckResponse)
@limiter.limit("15/minute")
async def check_guest_loyalty(request: Request, data: LoyaltyCheckRequest, session: DbSession):
    """
    Check guest loyalty status against the hotel's configured program.
    Returns reward coupon if milestone reached, or a nudge popup if close.
    """
    try:
        hotel_res = await session.execute(select(Hotel.chain_id).where(Hotel.id == data.hotel_id))
        chain_id = hotel_res.scalar_one_or_none()

        if chain_id:
            # Prefer hotel-level program over chain-level; use first() to avoid
            # MultipleResultsFound when both exist and are active simultaneously.
            prog_result = await session.execute(
                select(LoyaltyProgram).where(
                    or_(LoyaltyProgram.hotel_id == data.hotel_id, LoyaltyProgram.chain_id == chain_id),
                    LoyaltyProgram.is_active == True,
                ).order_by(LoyaltyProgram.hotel_id.nulls_last())
            )
        else:
            prog_result = await session.execute(
                select(LoyaltyProgram).where(
                    LoyaltyProgram.hotel_id == data.hotel_id,
                    LoyaltyProgram.is_active == True,
                )
            )
        program = prog_result.scalars().first()

        if chain_id:
            loyal_stmt = select(GuestLoyalty).where(
                GuestLoyalty.guest_email == data.email,
                GuestLoyalty.chain_id == chain_id,
            )
        else:
            loyal_stmt = select(GuestLoyalty).where(
                GuestLoyalty.guest_email == data.email,
                GuestLoyalty.hotel_id == data.hotel_id,
            )
        loyal = (await session.execute(loyal_stmt)).scalar_one_or_none()
        points_balance = float(loyal.points_balance) if loyal else 0.0

        completed_count = 0
        first_name = "Guest"
        if chain_id:
            hotel_ids = (await session.execute(
                select(Hotel.id).where(Hotel.chain_id == chain_id)
            )).scalars().all()
            guests = (await session.execute(
                select(Guest).where(Guest.email == data.email, Guest.hotel_id.in_(hotel_ids))
            )).scalars().all()
            guest_ids = [g.id for g in guests]
            if guests:
                first_name = guests[0].first_name or "Guest"
            if guest_ids:
                completed_count = (await session.execute(
                    select(func.count()).select_from(Booking).where(
                        Booking.guest_id.in_(guest_ids),
                        or_(Booking.status == BookingStatus.CONFIRMED, Booking.status == BookingStatus.CHECKED_OUT),
                    )
                )).scalar() or 0
        else:
            guest = (await session.execute(
                select(Guest).where(Guest.email == data.email, Guest.hotel_id == data.hotel_id)
            )).scalar_one_or_none()
            if guest:
                first_name = guest.first_name or "Guest"
                completed_count = (await session.execute(
                    select(func.count()).select_from(Booking).where(
                        Booking.guest_id == guest.id,
                        Booking.hotel_id == data.hotel_id,
                        or_(Booking.status == BookingStatus.CONFIRMED, Booking.status == BookingStatus.CHECKED_OUT),
                    )
                )).scalar() or 0

        if not program:
            if completed_count > 0:
                return LoyaltyCheckResponse(
                    is_repeat_guest=True,
                    message=f"Welcome back, {first_name}! We're delighted to have you again.",
                    bookings_completed=completed_count, points_balance=points_balance,
                )
            return LoyaltyCheckResponse(
                is_repeat_guest=False, message="Welcome! We're excited to have you here.",
                points_balance=points_balance,
            )

        milestone = program.milestone_bookings
        bookings_since_last_reward = completed_count % milestone if milestone > 0 else completed_count
        remaining = milestone - bookings_since_last_reward

        if completed_count > 0 and bookings_since_last_reward == 0:
            promo = (await session.execute(
                select(PromoCode).where(
                    or_(PromoCode.hotel_id == data.hotel_id, PromoCode.chain_id == chain_id),
                    PromoCode.code.like("%LOYALTY%"),
                    PromoCode.is_active == True,
                )
            )).scalar_one_or_none()
            coupon_code = promo.code if promo else "LOYALTY10"
            if promo:
                discount_text = (
                    f"{int(promo.discount_value)}% Loyalty Discount"
                    if promo.discount_type == "percentage"
                    else f"₹{int(promo.discount_value)} Loyalty Reward"
                )
            else:
                val = program.reward_value
                discount_text = (
                    f"{int(val)}% off your stay"
                    if program.reward_type == "percentage"
                    else f"₹{int(val)} off your stay"
                )
            return LoyaltyCheckResponse(
                is_repeat_guest=True,
                message=f"Welcome back, {first_name}! You've unlocked your loyalty reward. Enjoy your stay!",
                coupon_code=coupon_code, discount_text=discount_text,
                bookings_completed=completed_count, bookings_to_reward=0,
                reward_description=program.reward_description, points_balance=points_balance,
            )

        if completed_count > 0 and remaining == 1:
            popup_msg = program.popup_message.replace("{remaining}", str(remaining))
            val = program.reward_value
            reward_desc = program.reward_description or (
                f"{int(val)}% off" if program.reward_type == "percentage" else f"₹{int(val)} off"
            )
            return LoyaltyCheckResponse(
                is_repeat_guest=True, message=f"Welcome back, {first_name}!",
                show_milestone_popup=True, milestone_popup_title=program.popup_title,
                milestone_popup_message=popup_msg, bookings_completed=completed_count,
                bookings_to_reward=remaining, reward_description=reward_desc,
                points_balance=points_balance,
            )

        if completed_count > 0:
            return LoyaltyCheckResponse(
                is_repeat_guest=True, message=f"Welcome back, {first_name}! Great to see you again.",
                bookings_completed=completed_count, bookings_to_reward=remaining,
                points_balance=points_balance,
            )

        return LoyaltyCheckResponse(
            is_repeat_guest=False, message="Welcome! We're excited to have you here.",
            bookings_to_reward=milestone, points_balance=points_balance,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Loyalty check unexpected error for hotel {data.hotel_id}: {e}", exc_info=True)
        return LoyaltyCheckResponse(
            is_repeat_guest=False, message="Welcome! Enjoy your booking experience.", points_balance=0.0,
        )


@router.post("/bookings/cancel-request", response_model=GuestCancelInfoResponse)
@limiter.limit("10/minute")
async def public_cancel_request(request: Request, data: GuestCancelRequest, session: DbSession):
    """
    Look up a booking by number+email and compute cancellation fee details.
    PUB-01: rate-limited to throttle booking-number enumeration.
    """
    booking = (await session.execute(
        select(Booking).where(Booking.booking_number == data.booking_number)
    )).scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status == BookingStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Booking is already cancelled")
    if booking.status == BookingStatus.CANCEL_REQUESTED:
        raise HTTPException(status_code=400, detail="Cancellation request is already pending approval")

    guest = await session.get(Guest, booking.guest_id)
    if not guest or guest.email.lower().strip() != data.email.lower().strip():
        raise HTTPException(status_code=403, detail="Invalid guest email verification")

    from app.core.cancellation import calculate_cancellation_fee
    fee, refund, ref_status = calculate_cancellation_fee(booking)

    room = booking.rooms[0] if booking.rooms else {}
    hotel = await session.get(Hotel, booking.hotel_id)
    cancellation_mode = hotel.settings.get("cancellation_mode", "instant") if hotel and hotel.settings else "instant"

    return GuestCancelInfoResponse(
        booking_number=booking.booking_number,
        guest_name=f"{guest.first_name} {guest.last_name}",
        check_in=booking.check_in, check_out=booking.check_out,
        rooms=booking.rooms, total_amount=booking.total_amount, paid_amount=booking.paid_amount,
        cancellation_policy=room.get("cancellation_policy", "Standard policy applies."),
        is_refundable=room.get("is_refundable", True),
        cancellation_hours=room.get("cancellation_hours", 24),
        potential_fee=fee, potential_refund=refund, refund_status=ref_status,
        status=booking.status.value, cancellation_mode=cancellation_mode,
    )


@router.post("/bookings/cancel-confirm")
@limiter.limit("10/minute")
async def public_cancel_confirm(request: Request, data: GuestCancelRequest, session: DbSession, background_tasks: BackgroundTasks):
    """
    Execute or request a cancellation. Instant-mode cancels immediately;
    request-mode moves to CANCEL_REQUESTED for hotelier approval.
    PUB-01: rate-limited to throttle enumeration.
    """
    booking = (await session.execute(
        select(Booking).where(Booking.booking_number == data.booking_number).with_for_update()
    )).scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status == BookingStatus.CANCELLED:
        return {"status": "already_cancelled", "message": "Booking is already cancelled"}
    if booking.status == BookingStatus.CANCEL_REQUESTED:
        return {"status": "already_requested", "message": "Cancellation request is already pending approval"}

    guest = await session.get(Guest, booking.guest_id)
    if not guest or guest.email.lower().strip() != data.email.lower().strip():
        raise HTTPException(status_code=403, detail="Invalid guest email verification")

    from app.core.cancellation import calculate_cancellation_fee
    fee, refund, ref_status = calculate_cancellation_fee(booking)

    hotel = await session.get(Hotel, booking.hotel_id)
    cancellation_mode = hotel.settings.get("cancellation_mode", "instant") if hotel and hotel.settings else "instant"

    if cancellation_mode == "request":
        booking.status = BookingStatus.CANCEL_REQUESTED
        booking.cancellation_fee = fee
        booking.refund_amount = refund
        booking.refund_status = ref_status
        booking.updated_at = utcnow()
        session.add(booking)
        await session.commit()
        return {
            "status": "cancel_requested", "booking_number": booking.booking_number,
            "cancellation_fee": fee, "refund_amount": refund, "refund_status": ref_status,
            "message": "Your cancellation request has been successfully submitted for approval.",
        }

    booking.status = BookingStatus.CANCELLED
    booking.cancellation_fee = fee
    booking.refund_amount = refund
    booking.refund_status = ref_status
    booking.updated_at = utcnow()
    session.add(booking)
    await session.commit()

    # Cancellation frees inventory — notify waiting guests via SSE.
    bump_rate_version(booking.hotel_id)

    try:
        from app.calendar import clear_availability_cache
        clear_availability_cache(booking.hotel_id)
    except Exception as e:
        logger.error(f"Failed clearing availability cache on guest cancellation: {e}")

    from app.system.ws import broadcast_to_hotel
    background_tasks.add_task(
        broadcast_to_hotel, booking.hotel_id, "booking_cancelled", {
            "booking_number": booking.booking_number,
        }
    )

    return {
        "status": "cancelled", "booking_number": booking.booking_number,
        "cancellation_fee": fee, "refund_amount": refund, "refund_status": ref_status,
        "message": "Your booking has been successfully cancelled.",
    }



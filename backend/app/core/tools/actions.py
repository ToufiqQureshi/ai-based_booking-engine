from sqlmodel import select, Session
from app.rooms.room import RoomType
from app.rate_plans.promo import PromoCode
from app.core.database import engine
from sqlalchemy.orm import sessionmaker
import logging

logger = logging.getLogger(__name__)

# Logic functions to be wrapped as @tool in agent.py


async def logic_update_room_price(session, user, room_name: str, new_price: float) -> str:
    """Updates the base price of a room type."""
    # SECURITY: Input validation
    if new_price < 0:
        return "ERROR: Price cannot be negative."
    if new_price > 1000000:
        return "ERROR: Price seems unreasonably high. Maximum allowed is 10,00,000."
    
    query = select(RoomType).where(
        RoomType.hotel_id == user.hotel_id,
        RoomType.name.ilike(f"%{room_name}%")
    )
    result = await session.execute(query)
    room = result.scalars().first()
    
    if not room:
        return f"Room '{room_name}' not found."
    
    old_price = room.base_price
    room.base_price = new_price
    session.add(room)
    await session.commit()
    await session.refresh(room)
    
    logger.info(f"Room price updated: {room.name} from {old_price} to {new_price} by hotel {user.hotel_id}")
    return f"SUCCESS: Updated {room.name} price from {old_price} to {new_price}."


async def logic_create_promo_code(session, user, code: str, discount_percent: int) -> str:
    """Creates a new promo code."""
    # SECURITY: Input validation
    if not code or len(code) < 3:
        return "ERROR: Promo code must be at least 3 characters."
    if len(code) > 20:
        return "ERROR: Promo code cannot exceed 20 characters."
    if not code.isalnum():
        return "ERROR: Promo code must be alphanumeric only."
    if discount_percent < 1 or discount_percent > 100:
        return "ERROR: Discount must be between 1% and 100%."
    
    # Check if exists
    query = select(PromoCode).where(
        PromoCode.hotel_id == user.hotel_id,
        PromoCode.code == code.upper()
    )
    result = await session.execute(query)
    existing = result.scalars().first()
    
    if existing:
        return f"Promo code '{code}' already exists."
    
    new_promo = PromoCode(
        hotel_id=user.hotel_id,
        code=code.upper(),
        discount_value=discount_percent,
        is_active=True
    )
    session.add(new_promo)
    await session.commit()
    
    logger.info(f"Promo code created: {code.upper()} with {discount_percent}% discount for hotel {user.hotel_id}")
    return f"SUCCESS: Created promo code '{code.upper()}' with {discount_percent}% discount."


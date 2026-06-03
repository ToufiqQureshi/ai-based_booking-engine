import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import engine
from app.models.chain import Chain
from app.models.hotel import Hotel
from app.models.user import User, UserRole
from main import app

# ---------------------------------------------------------------------------
# Auth boundary tests
# ---------------------------------------------------------------------------

async def test_chain_dashboard_requires_auth(client: AsyncClient):
    """Unauthenticated access should be rejected with 401."""
    res = await client.get("/api/v1/chain/analytics")
    assert res.status_code == 401


async def test_chain_dashboard_forbidden_for_regular_user(auth_client: AsyncClient):
    """Regular hotel owners without a chain_id should be forbidden (403)."""
    res = await auth_client.get("/api/v1/chain/analytics")
    assert res.status_code == 403
    assert "restricted to brand/chain administrators only" in res.json()["detail"]


# ---------------------------------------------------------------------------
# Successful operations
# ---------------------------------------------------------------------------

async def test_chain_dashboard_success_for_brand_admin(seeded_hotel: Hotel):
    """Brand admins with a valid chain_id should get consolidated stats."""
    
    # 1. Setup brand entities in the database
    chain_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    hotel_id = str(uuid.uuid4())
    
    async with AsyncSession(engine) as db:
        # Create Chain
        chain = Chain(
            id=chain_id,
            name="Staybooker Test Chain",
            slug=f"test-chain-{uuid.uuid4().hex[:6]}"
        )
        db.add(chain)
        
        # Create brand user
        brand_user = User(
            id=user_id,
            supabase_id=str(uuid.uuid4()),
            email=f"brand-admin-{uuid.uuid4().hex[:6]}@staybooker.ai",
            name="Brand Admin User",
            role=UserRole.OWNER,
            hotel_id=seeded_hotel.id,  # Link to a dummy fallback hotel
            chain_id=chain_id,
            hashed_password="PYTEST_NO_AUTH",
            is_active=True
        )
        db.add(brand_user)
        
        # Create a brand hotel
        brand_hotel = Hotel(
            id=hotel_id,
            name="Staybooker Brand Resort",
            slug=f"brand-resort-{uuid.uuid4().hex[:6]}",
            chain_id=chain_id,
            is_active=True
        )
        db.add(brand_hotel)
        
        await db.commit()
    
    # 2. Authenticate the brand admin user using a transient User instance to avoid DetachedInstanceError
    transient_user = User(
        id=user_id,
        supabase_id=str(uuid.uuid4()),
        email="brand-admin-test@staybooker.ai",
        name="Brand Admin User",
        role=UserRole.OWNER,
        hotel_id=seeded_hotel.id,
        chain_id=chain_id,
        hashed_password="PYTEST_NO_AUTH",
        is_active=True
    )
    from app.api.deps import get_current_active_user
    app.dependency_overrides[get_current_active_user] = lambda: transient_user
    
    # 3. Call the API
    from httpx import ASGITransport
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as brand_client:
        res = await brand_client.get("/api/v1/chain/analytics")
    
    # Clean up overrides
    app.dependency_overrides.pop(get_current_active_user, None)
    
    # 4. Assert responses
    assert res.status_code == 200
    body = res.json()
    assert body["total_properties"] == 1
    assert "revenue_by_hotel" in body
    assert len(body["revenue_by_hotel"]) == 1
    assert body["revenue_by_hotel"][0]["hotel_id"] == hotel_id
    assert body["revenue_by_hotel"][0]["name"] == "Staybooker Brand Resort"
    assert "recent_bookings" in body
    
    # 5. DB Cleanup
    async with AsyncSession(engine) as db:
        h_obj = await db.get(Hotel, hotel_id)
        if h_obj:
            await db.delete(h_obj)
        u_obj = await db.get(User, user_id)
        if u_obj:
            await db.delete(u_obj)
        c_obj = await db.get(Chain, chain_id)
        if c_obj:
            await db.delete(c_obj)
        await db.commit()

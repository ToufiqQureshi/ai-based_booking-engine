import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import engine
from app.superadmin.chains.models import Chain
from app.brand_console.models import Hotel
from app.guests.models import User, UserRole
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
    from app.core.deps import get_current_active_user
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


# ---------------------------------------------------------------------------
# Super Admin Brand Management operations
# ---------------------------------------------------------------------------

async def test_superadmin_chains_crud_and_linking(super_admin_client: AsyncClient, seeded_hotel: Hotel, seeded_user: User):
    """Test full CRUD operations on chains and linking hotels/users."""
    
    # 1. Create a chain group
    chain_data = {
        "name": "Super Admin Test Brand",
        "slug": f"sa-test-brand-{uuid.uuid4().hex[:6]}",
        "logo_url": "https://test.com/logo.png"
    }
    create_res = await super_admin_client.post("/api/v1/superadmin/chains", json=chain_data)
    assert create_res.status_code == 200
    chain_json = create_res.json()["chain"]
    chain_id = chain_json["id"]
    
    # 2. Get all chains list
    list_res = await super_admin_client.get("/api/v1/superadmin/chains")
    assert list_res.status_code == 200
    chains_list = list_res.json()
    assert any(c["id"] == chain_id for c in chains_list)
    
    # 3. Update the chain
    update_data = {
        "name": "Super Admin Test Brand Updated",
        "slug": chain_data["slug"],
        "logo_url": "https://test.com/logo-updated.png"
    }
    update_res = await super_admin_client.put(f"/api/v1/superadmin/chains/{chain_id}", json=update_data)
    assert update_res.status_code == 200
    
    # 4. Link hotel and user to chain
    link_data = {
        "hotel_ids": [seeded_hotel.id],
        "user_ids": [seeded_user.id]
    }
    link_res = await super_admin_client.post(f"/api/v1/superadmin/chains/{chain_id}/link", json=link_data)
    assert link_res.status_code == 200
    
    # Verify linking in list
    verify_res = await super_admin_client.get("/api/v1/superadmin/chains")
    matched_chain = next(c for c in verify_res.json() if c["id"] == chain_id)
    assert len(matched_chain["hotels"]) == 1
    assert matched_chain["hotels"][0]["id"] == seeded_hotel.id
    assert len(matched_chain["users"]) == 1
    assert matched_chain["users"][0]["id"] == seeded_user.id
    
    # 5. Delete chain (and clean up)
    delete_res = await super_admin_client.delete(f"/api/v1/superadmin/chains/{chain_id}")
    assert delete_res.status_code == 200

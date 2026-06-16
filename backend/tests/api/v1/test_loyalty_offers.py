"""
Loyalty stay-offers + points wallet tests.

Covers:
  - Hotelier CRUD on /loyalty/offers (auth + IDOR + validation + tenant isolation)
  - /loyalty/points-config
  - Public /public/loyalty-offers night-threshold logic (nudge / unlocked / needs-dates)
"""
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.database import engine
from app.brand_console.hotel import Hotel
from app.loyalty.loyalty_model import LoyaltyOffer
from app.rooms.room import RoomType

pytestmark = pytest.mark.asyncio


async def _fresh_hotel_with_offers(*offers: dict) -> str:
    """Create an isolated hotel owning only the given offers.

    The public-offer checks share a session-scoped seeded_hotel, so offers that
    other tests create on it leak in and make the night-threshold assertions
    order-dependent (e.g. an unrelated min_nights=6 offer turns an "unlocked at 5"
    check into a "1 more night" nudge). Each check gets its own hotel instead.
    """
    hotel_id = str(uuid.uuid4())
    async with AsyncSession(engine) as s:
        s.add(Hotel(id=hotel_id, name="Offer Test Hotel", slug=f"offer-{uuid.uuid4().hex[:8]}"))
        for o in offers:
            s.add(LoyaltyOffer(hotel_id=hotel_id, **o))
        await s.commit()
    return hotel_id


# ─── Hotelier: offer CRUD ─────────────────────────────────────────────────────

class TestOfferCrud:
    async def test_create_hotelwide_offer(self, auth_client: AsyncClient):
        r = await auth_client.post("/api/v1/loyalty/offers", json={
            "title": "Stay 5, Save 20",
            "min_nights": 5,
            "reward_type": "percentage",
            "reward_value": 20,
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["min_nights"] == 5
        assert body["room_type_id"] is None
        assert body["id"]

    async def test_create_offer_invalid_reward_type(self, auth_client: AsyncClient):
        r = await auth_client.post("/api/v1/loyalty/offers", json={
            "min_nights": 3, "reward_type": "bogus", "reward_value": 5,
        })
        assert r.status_code == 400

    async def test_create_offer_min_nights_zero_rejected(self, auth_client: AsyncClient):
        r = await auth_client.post("/api/v1/loyalty/offers", json={
            "min_nights": 0, "reward_type": "percentage", "reward_value": 5,
        })
        assert r.status_code == 400

    async def test_create_room_scoped_offer(self, auth_client: AsyncClient, seeded_room: RoomType):
        r = await auth_client.post("/api/v1/loyalty/offers", json={
            "room_type_id": seeded_room.id,
            "min_nights": 4, "reward_type": "fixed_amount", "reward_value": 500,
        })
        assert r.status_code == 200, r.text
        assert r.json()["room_type_id"] == seeded_room.id

    async def test_create_offer_foreign_room_rejected(self, auth_client: AsyncClient):
        r = await auth_client.post("/api/v1/loyalty/offers", json={
            "room_type_id": str(uuid.uuid4()),
            "min_nights": 4, "reward_type": "percentage", "reward_value": 10,
        })
        assert r.status_code == 400

    async def test_list_offers(self, auth_client: AsyncClient):
        await auth_client.post("/api/v1/loyalty/offers", json={
            "min_nights": 6, "reward_type": "percentage", "reward_value": 15,
        })
        r = await auth_client.get("/api/v1/loyalty/offers")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1

    async def test_update_offer(self, auth_client: AsyncClient):
        created = (await auth_client.post("/api/v1/loyalty/offers", json={
            "min_nights": 5, "reward_type": "percentage", "reward_value": 10,
        })).json()
        r = await auth_client.put(f"/api/v1/loyalty/offers/{created['id']}", json={"min_nights": 7})
        assert r.status_code == 200
        assert r.json()["min_nights"] == 7

    async def test_update_missing_offer_404(self, auth_client: AsyncClient):
        r = await auth_client.put(f"/api/v1/loyalty/offers/{uuid.uuid4()}", json={"min_nights": 3})
        assert r.status_code == 404

    async def test_delete_offer(self, auth_client: AsyncClient):
        created = (await auth_client.post("/api/v1/loyalty/offers", json={
            "min_nights": 5, "reward_type": "percentage", "reward_value": 10,
        })).json()
        r = await auth_client.delete(f"/api/v1/loyalty/offers/{created['id']}")
        assert r.status_code == 200
        # gone now
        r2 = await auth_client.put(f"/api/v1/loyalty/offers/{created['id']}", json={"min_nights": 3})
        assert r2.status_code == 404

    async def test_offers_require_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/loyalty/offers")
        assert r.status_code == 401


# ─── Hotelier: points config ──────────────────────────────────────────────────

class TestPointsConfig:
    async def test_update_points_config(self, auth_client: AsyncClient):
        r = await auth_client.put("/api/v1/loyalty/points-config", json={
            "points_enabled": True, "points_per_currency": 0.1, "point_value": 0.5,
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["points_enabled"] is True
        assert body["point_value"] == 0.5

    async def test_negative_point_value_rejected(self, auth_client: AsyncClient):
        r = await auth_client.put("/api/v1/loyalty/points-config", json={"point_value": -1})
        assert r.status_code == 400

    async def test_points_config_requires_auth(self, client: AsyncClient):
        r = await client.put("/api/v1/loyalty/points-config", json={"points_enabled": True})
        assert r.status_code == 401


# ─── Public: stay-offer check ─────────────────────────────────────────────────

class TestPublicOfferCheck:
    async def test_no_offer_returns_false(self, client: AsyncClient):
        r = await client.post("/api/v1/public/loyalty-offers", json={
            "hotel_id": str(uuid.uuid4()), "nights": 3,
        })
        assert r.status_code == 200
        assert r.json()["has_offer"] is False

    async def test_nudge_below_threshold(self, client: AsyncClient):
        hotel_id = await _fresh_hotel_with_offers(
            {"title": "Stay 5", "min_nights": 5, "reward_type": "percentage", "reward_value": 20,
             "nudge_message": "Stay {remaining} more night(s) and unlock {reward}!"},
        )
        r = await client.post("/api/v1/public/loyalty-offers", json={
            "hotel_id": hotel_id, "nights": 3,
        })
        assert r.status_code == 200
        body = r.json()
        assert body["has_offer"] is True
        assert body["unlocked"] is False
        assert body["nights_remaining"] == 2
        assert "2" in body["nudge_message"]

    async def test_unlocked_at_threshold(self, client: AsyncClient):
        hotel_id = await _fresh_hotel_with_offers(
            {"title": "Stay 5", "min_nights": 5, "reward_type": "percentage", "reward_value": 20},
        )
        r = await client.post("/api/v1/public/loyalty-offers", json={
            "hotel_id": hotel_id, "nights": 5,
        })
        assert r.status_code == 200
        body = r.json()
        assert body["has_offer"] is True
        assert body["unlocked"] is True
        assert body["nights_remaining"] == 0

    async def test_needs_dates_when_nights_missing(self, client: AsyncClient):
        hotel_id = await _fresh_hotel_with_offers(
            {"title": "Stay 5", "min_nights": 5, "reward_type": "percentage", "reward_value": 20},
        )
        r = await client.post("/api/v1/public/loyalty-offers", json={"hotel_id": hotel_id})
        assert r.status_code == 200
        body = r.json()
        assert body["has_offer"] is True
        assert body["needs_dates"] is True

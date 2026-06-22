"""
Promo-code creation guards.

Regression: POST /promos/ used the `PromoCode` *table* model as its request
body. SQLModel table models skip validation on init, so bad/missing input
(e.g. no `discount_value`, a NOT NULL column) sailed past FastAPI and crashed
with a 500 IntegrityError at commit instead of a clean 422 — and a client
could mass-assign server-owned fields (id/hotel_id/chain_id/current_usage).
These tests pin the corrected behaviour.
"""
import pytest


@pytest.mark.asyncio
async def test_create_promo_valid(auth_client, seeded_user):
    res = await auth_client.post("/api/v1/promos/", json={
        "code": "SAVE10",
        "discount_type": "percentage",
        "discount_value": 10,
    })
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["code"] == "SAVE10"
    # Server-owned fields are set server-side, never trusted from the client.
    assert body["hotel_id"] == seeded_user.hotel_id
    assert body["current_usage"] == 0


@pytest.mark.asyncio
async def test_create_promo_missing_required_is_422_not_500(auth_client):
    # discount_value omitted — previously slipped through to a 500 at commit.
    res = await auth_client.post("/api/v1/promos/", json={"code": "NODISC"})
    assert res.status_code == 422, res.text


@pytest.mark.asyncio
async def test_create_promo_blank_code_is_422(auth_client):
    res = await auth_client.post("/api/v1/promos/", json={
        "code": "",
        "discount_value": 5,
    })
    assert res.status_code == 422, res.text


@pytest.mark.asyncio
async def test_create_promo_ignores_client_owned_fields(auth_client, seeded_user):
    # A client trying to seed usage / cross-tenant ids must not win: those
    # fields aren't on the create schema, so they're dropped, not honoured.
    res = await auth_client.post("/api/v1/promos/", json={
        "code": "MASSASSIGN",
        "discount_value": 15,
        "current_usage": 999,
        "hotel_id": "some-other-hotel",
        "chain_id": "some-chain",
    })
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["current_usage"] == 0
    assert body["hotel_id"] == seeded_user.hotel_id
